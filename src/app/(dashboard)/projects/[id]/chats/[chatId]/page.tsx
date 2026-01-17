"use client";

import { use, useEffect, useState } from "react";
import { SignInButton, SignedIn, SignedOut, UserButton, useAuth } from "@clerk/nextjs";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatWithMessages } from "@/lib/types";
import { apiClient } from "@/lib/api";
import { MessageFeedbackModal } from "@/components/chat/MessageFeedbackModel";
import toast from "react-hot-toast";
import { NotFound } from "@/components/ui/NotFound";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface ProjectChatPageProps {
  params: Promise<{
    id: string; // matches folder name
    chatId: string;
  }>;
}

export default function ProjectChatPage({ params }: ProjectChatPageProps) {
  // Unwrap async params (Next.js 16 Turbopack requirement)
  const { id: projectId, chatId } = use(params);

  const [currentChatData, setCurrentChatData] =
    useState<ChatWithMessages | null>(null);

  const [isLoadingChatData, setIsLoadingChatData] = useState(true);
  const [chatLoadError, setChatLoadError] = useState<string | null>(null);

  const [sendMessageError, setSendMessageError] = useState<string | null>(null);
  const [isMessageSending, setIsMessageSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);

  const [feedbackModal, setFeedbackModal] = useState<{
    messageId: string;
    type: "like" | "dislike";
  } | null>(null);

  const { getToken, userId } = useAuth();

  const normalizeChatResponse = (apiResult: any) => {
    if (apiResult?.data?.data) return apiResult.data.data;
    if (apiResult?.data) return apiResult.data;
    return apiResult;
  };

  const refreshChat = async () => {
    try {
      const token = await getToken();
      const latest = await apiClient.get<ChatWithMessages>(
        `/api/chats/${chatId}`,
        token ?? undefined
      );
      const parsed = normalizeChatResponse(latest);
      if (parsed?.id) {
        setCurrentChatData(parsed as ChatWithMessages);
        return parsed as ChatWithMessages;
      }
    } catch (err) {
      console.warn("Failed to refresh chat:", err);
    }
    return null;
  };

  // Send message (streaming endpoint)
const handleSendMessage = async (content: string) => {
    try {
      setSendMessageError(null);
      setIsMessageSending(true);
      setIsStreaming(true);
      setStreamingMessage(null);
      setAgentStatus(null);

      if (!currentChatData || !userId) {
        setSendMessageError("Chat or user not found");
        return;
      }

      // Optimistically add the user message
      const optimisticUserMessage = {
        id: `temp-${Date.now()}`,
        chat_id: currentChatData.id,
        content,
        role: "user" as const,
        clerk_id: userId,
        created_at: new Date().toISOString(),
        citations: [],
      };
      setCurrentChatData((prev) => {
        if (!prev) return prev;
        return { ...prev, messages: [...prev.messages, optimisticUserMessage] };
      });

      const token = await getToken();
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(
        `${apiBase}/api/projects/${projectId}/chats/${currentChatData.id}/messages/stream?clerk_id=${encodeURIComponent(
          userId
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error("Failed to start streaming response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processEvent = (eventName: string, data: string) => {
        if (!eventName) return;
        if (eventName === "status") {
          try {
            const payload = JSON.parse(data);
            if (payload.status) setAgentStatus(payload.status);
          } catch (e) {
            console.warn("Failed to parse status event", e);
          }
        } else if (eventName === "token") {
          try {
            const payload = JSON.parse(data);
            if (payload.content) {
              setStreamingMessage((prev) => (prev || "") + payload.content);
            }
          } catch (e) {
            console.warn("Failed to parse token event", e);
          }
        } else if (eventName === "done") {
          try {
            const payload = JSON.parse(data);
            console.log("[DEBUG] done event payload:", payload);
            const userMessage = (payload as any).userMessage;
            let aiMessage = (payload as any).aiMessage;
            setCurrentChatData((prev) => {
              if (!prev) return prev;
              const filtered = prev.messages.filter(
                (msg) => !msg.id.startsWith("temp-")
              );
              const updates = [];
              if (userMessage) updates.push(userMessage);
              // If aiMessage is missing but streamingMessage exists, add it as a message
              if (!aiMessage && streamingMessage) {
                aiMessage = {
                  id: `ai-${Date.now()}`,
                  chat_id: prev.id,
                  content: streamingMessage,
                  role: "assistant",
                  clerk_id: "",
                  created_at: new Date().toISOString(),
                  citations: [],
                };
              }
              if (aiMessage) updates.push(aiMessage);
              if (!aiMessage && !streamingMessage) {
                toast.error("No AI response received from server.");
              }
              return { ...prev, messages: [...filtered, ...updates] };
            });
            toast.success("Message sent");
          } catch (e) {
            console.warn("Failed to process done event", e);
          } finally {
            setIsStreaming(false);
            setStreamingMessage(null);
            setAgentStatus(null);
          }
        } else if (eventName === "error") {
          try {
            const payload = JSON.parse(data);
            throw new Error(payload.message || "Streaming error");
          } catch (e: any) {
            throw e;
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

        const parts = buffer.split("\n");
        buffer = parts.pop() || "";

        let currentEvent = "";
        for (const line of parts) {
          if (!line.trim()) {
            if (currentEvent) {
              // Reset between events
              currentEvent = "";
            }
            continue;
          }
          if (line.startsWith("event:")) {
            currentEvent = line.replace("event:", "").trim();
          } else if (line.startsWith("data:")) {
            const data = line.replace("data:", "").trim();
            processEvent(currentEvent, data);
          }
        }

        if (done) break;
      }

      // Final refresh to sync with backend (ensures AI message is shown)
      await refreshChat();
    } catch (err) {
      console.error("Failed to send message:", err);
      setSendMessageError("Failed to send message");
      toast.error("Failed to send message");
      // Remove optimistic message on error
      setCurrentChatData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter((msg) => !msg.id.startsWith("temp-")),
        };
      });
      await refreshChat();
    } finally {
      setIsMessageSending(false);
      setIsStreaming(false);
      setAgentStatus(null);
    }
  };

  const handleFeedbackOpen = (messageId: string, type: "like" | "dislike") => {
    setFeedbackModal({ messageId, type });
  };

  const handleFeedbackSubmit = async (feedback: {
    rating: "like" | "dislike";
    comment?: string;
    category?: string;
  }) => {
    if (!userId || !feedbackModal) return;

    try {
      const token = await getToken();

      await apiClient.post(
        "/api/feedback",
        {
          message_id: feedbackModal.messageId,
          rating: feedback.rating,
          comment: feedback.comment,
          category: feedback.category,
        },
        token ?? undefined
      );

      toast.success("Thanks for your feedback!");
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setFeedbackModal(null);
    }
  };

  useEffect(() => {
    const loadChat = async () => {
      if (!userId) return;

      setIsLoadingChatData(true);
      setChatLoadError(null);

      try {
        const chatData = await refreshChat();
        if (!chatData) {
          throw new Error("Invalid chat data received");
        }
        toast.success("Chat loaded");
      } catch (err: any) {
        console.error("Failed to load chat:", err);
        const errorMessage =
          err?.message === "Invalid chat data received"
            ? err.message
            : "Failed to load chat. Please try again.";
        setChatLoadError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoadingChatData(false);
      }
    };

    loadChat();
  }, [userId, chatId, projectId, getToken]);

  if (isLoadingChatData) {
    return <LoadingSpinner message="Loading chat..." />;
  }

  if (chatLoadError || !currentChatData) {
    return (
      <NotFound
        message={chatLoadError || "Chat not found"}
      />
    );
  }

  return (
    <>
      <div className="flex min-h-screen bg-[#0d1117]">
        <aside className="hidden w-64 flex-col border-r border-white/10 bg-gradient-to-b from-[#14161a] via-[#101216] to-[#0b0b0c] md:flex">
          <div className="px-6 pb-6 pt-8 text-lg font-semibold tracking-wide">
            NextgenSoft
          </div>
          <nav className="flex flex-1 flex-col gap-2 px-4">
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm text-white/90 shadow-sm transition hover:bg-white/10"
              onClick={() => (window.location.href = "/projects")}
            >
              New project
            </button>
            <button
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-left text-sm font-medium text-white"
              onClick={() => (window.location.href = "/projects")}
            >
              Projects
            </button>
          </nav>
          <div className="mt-auto px-4 pb-6 pt-6 text-xs text-white/40">
            Workspace settings
          </div>
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-4">
            <SignedIn>
              <div className="flex items-center gap-3">
                <UserButton afterSignOutUrl="/sign-in" />
                <span className="text-xs text-white/70">Signed in</span>
              </div>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:bg-white/10">
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </aside>
        <main className="flex min-h-screen flex-1">
          <ChatInterface
            chat={currentChatData}
            projectId={projectId}
            onSendMessage={handleSendMessage}
            onFeedback={handleFeedbackOpen}
            isLoading={isMessageSending}
            isStreaming={isStreaming}
            streamingMessage={streamingMessage || undefined}
            agentStatus={agentStatus || undefined}
            error={sendMessageError}
            onDismissError={() => setSendMessageError(null)}
          />
        </main>
      </div>
      <MessageFeedbackModal
        isOpen={!!feedbackModal}
        feedbackType={feedbackModal?.type}
        onSubmit={handleFeedbackSubmit}
        onClose={() => setFeedbackModal(null)}
      />
    </>
  );
}
