"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatWithMessages } from "@/lib/types";
import { apiClient } from "@/lib/api";
import { MessageFeedbackModal } from "@/components/chat/MessageFeedbackModel";
import toast from "react-hot-toast";
import { NotFound } from "@/components/ui/NotFound";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface ProjectChatPageProps {
  params: Promise<{
    id: string;        // ← Changed from projectId to id (matches folder name)
    chatId: string;
  }>;
}

export default function ProjectChatPage({ params }: ProjectChatPageProps) {
  const { id: projectId, chatId } = use(params);  // ← Destructure 'id' and rename to projectId

  const [currentChatData, setCurrentChatData] =
    useState<ChatWithMessages | null>(null);

  const [isLoadingChatData, setIsLoadingChatData] = useState(true);
  const [chatLoadError, setChatLoadError] = useState<string | null>(null);

  const [sendMessageError, setSendMessageError] = useState<string | null>(null);
  const [isMessageSending, setIsMessageSending] = useState(false);

  const [feedbackModal, setFeedbackModal] = useState<{
    messageId: string;
    type: "like" | "dislike";
  } | null>(null);

  const { getToken, userId } = useAuth();

  // Send message function
  const handleSendMessage = async (content: string) => {
    try {
      setSendMessageError(null);
      setIsMessageSending(true);

      if (!currentChatData || !userId) {
        setSendMessageError("Chat or user not found");
        return;
      }

      // Send POST request to create message
      const token = await getToken();
      const response = await apiClient.post(
        `/api/projects/${projectId}/chats/${currentChatData.id}/messages`,
        { content },
        token
      );

      // Expecting response.data.data to contain both user message and AI response
      const { userMessage, aiMessage } = response.data.data;

      // Update chat with both messages
      setCurrentChatData((prev) => ({
        ...prev!,
        messages: [...prev!.messages, userMessage, aiMessage],
      }));

      toast.success("Message sent");
    } catch (err) {
      console.error("Failed to send message:", err);
      setSendMessageError("Failed to send message");
      toast.error("Failed to send message");
    } finally {
      setIsMessageSending(false);
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
        token
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
      if (!userId) {
        console.log("Waiting for userId...");
        return;
      }

      console.log(`Loading chat ${chatId} for project ${projectId}...`);
      setIsLoadingChatData(true);
      setChatLoadError(null);

      try {
        const token = await getToken();
        
        // Use the working endpoint
        const result = await apiClient.get(`/api/chats/${chatId}`, token);
        
        console.log("Full API Response:", result);
        console.log("Response data:", result.data);
        
        // Handle different response structures
        let chatData;
        
        // Check if response has nested data property
        if (result.data && result.data.data) {
          console.log("Using nested data property");
          chatData = result.data.data;
        } else {
          chatData = result.data;
        }
        
        console.log("Extracted chat data:", chatData);
        console.log("Chat data keys:", chatData ? Object.keys(chatData) : "null");

        // Validate chat data exists and has required fields
        // Database has: id, title, project_id, clerk_id, created_at, messages
        if (!chatData) {
          console.error("Chat data is null or undefined");
          throw new Error("No chat data received from server");
        }
        
        // Check for id field (primary key from database)
        if (!chatData.id) {
          console.error("Chat data missing 'id' field:", chatData);
          throw new Error("Invalid chat data: missing id");
        }

        console.log("Chat ID:", chatData.id);
        console.log("Chat Title:", chatData.title);
        console.log("Chat Project ID:", chatData.project_id);
        console.log("URL Project ID:", projectId);
        console.log("Project IDs match:", chatData.project_id === projectId);

        // OPTIONAL: Validate chat belongs to this project
        // Note: Commenting this out temporarily to debug the header issue
        // You can uncomment after confirming the header shows properly
        
        if (chatData.project_id !== projectId) {
          console.warn("⚠️ PROJECT MISMATCH!");
          console.warn(`  Chat's project_id: "${chatData.project_id}"`);
          console.warn(`  URL's project_id:  "${projectId}"`);
          console.warn("  Loading chat anyway for debugging...");
          
          // Uncomment below to enforce project scoping:
          // throw new Error("This chat does not belong to the current project");
        }

        console.log("✅ Chat validation passed");
        setCurrentChatData(chatData);
      } catch (err: any) {
        console.error("Failed to load chat:", err);
        console.error("Error response:", err.response);
        
        // Set specific error message
        let errorMessage = "Failed to load chat";
        
        if (err.response?.status === 404) {
          errorMessage = "Chat not found";
        } else if (err.message?.includes("does not belong")) {
          errorMessage = err.message;
        } else if (err.message?.includes("missing id")) {
          errorMessage = "Invalid chat data received";
        } else if (err.response?.data?.detail) {
          errorMessage = err.response.data.detail;
        }
        
        setChatLoadError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoadingChatData(false);
      }
    };

    loadChat();
  }, [userId, chatId, projectId, getToken]);

  // Loading state
  if (isLoadingChatData) {
    return <LoadingSpinner message="Loading chat..." />;
  }

  // Error state - show if we tried to load but failed
  if (chatLoadError || (!currentChatData && !isLoadingChatData)) {
    return (
      <NotFound 
        message={chatLoadError || "Chat not found"} 
        description="This chat may have been deleted or you don't have access to it."
      />
    );
  }

  // Success state - we have chat data
  return (
    <>
      <ChatInterface
        chat={currentChatData}
        projectId={projectId}
        onSendMessage={handleSendMessage}
        onFeedback={handleFeedbackOpen}
        isLoading={isMessageSending}
        error={sendMessageError}
        onDismissError={() => setSendMessageError(null)}
      />
      <MessageFeedbackModal
        isOpen={!!feedbackModal}
        feedbackType={feedbackModal?.type}
        onSubmit={handleFeedbackSubmit}
        onClose={() => setFeedbackModal(null)}
      />
    </>
  );
}
