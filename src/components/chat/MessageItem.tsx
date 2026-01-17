import { ThumbsUp, ThumbsDown, User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  created_at: string;
  chat_id: string;
  clerk_id: string;
  citations?: Array<{
    filename: string;
    page: number;
  }>;
}

interface MessageItemProps {
  message: Message;
  onFeedback?: (messageId: string, type: "like" | "dislike") => void;
}

export function MessageItem({ message, onFeedback }: MessageItemProps) {
  const isUser = message.role === "user";
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const headingClass = isUser ? "text-green-700" : "text-green-400";
  const textClass = isUser ? "text-gray-900" : "text-gray-200";
  const mutedClass = isUser ? "text-gray-700" : "text-gray-300";
  const codeClass = isUser
    ? "bg-gray-100 text-gray-900"
    : "bg-[#111827] text-gray-100";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} group`}>
      <div className={`max-w-[85%] ${isUser ? "ml-12" : "mr-12"} relative`}>
        {/* Avatar & Message Container */}
        <div className="flex items-start gap-3">
          {/* Avatar - Only show for assistant */}
          {!isUser && (
            <div className="flex-shrink-0 w-7 h-7 bg-[#252525] border border-gray-700 rounded-lg flex items-center justify-center mt-1">
              <Bot size={14} className="text-gray-400" />
            </div>
          )}

          {/* Message Bubble */}
          <div
            className={`rounded-lg p-4 border transition-colors ${
              isUser
                ? "bg-white text-gray-900 border-gray-300"
                : "bg-[#202020] text-gray-200 border-gray-800 hover:border-gray-700"
            }`}
          >
            <div className={`text-sm leading-relaxed ${textClass}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: (props) => (
                    <h1
                      className={`mt-4 text-lg font-semibold ${headingClass}`}
                      {...props}
                    />
                  ),
                  h2: (props) => (
                    <h2
                      className={`mt-4 text-base font-semibold ${headingClass}`}
                      {...props}
                    />
                  ),
                  h3: (props) => (
                    <h3
                      className={`mt-3 text-sm font-semibold ${headingClass}`}
                      {...props}
                    />
                  ),
                  p: (props) => (
                    <p className={`mt-2 whitespace-pre-wrap ${textClass}`} {...props} />
                  ),
                  ul: (props) => (
                    <ul className="mt-2 list-disc space-y-1 pl-5" {...props} />
                  ),
                  ol: (props) => (
                    <ol className="mt-2 list-decimal space-y-1 pl-5" {...props} />
                  ),
                  li: (props) => <li className={mutedClass} {...props} />,
                  strong: (props) => <strong className={textClass} {...props} />,
                  em: (props) => <em className={mutedClass} {...props} />,
                  a: (props) => (
                    <a
                      className="text-blue-400 underline underline-offset-4 hover:text-blue-300"
                      target="_blank"
                      rel="noreferrer"
                      {...props}
                    />
                  ),
                  code: ({ inline, className, children, ...props }) =>
                    inline ? (
                      <code
                        className={`rounded px-1.5 py-0.5 text-xs ${codeClass}`}
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <pre className={`mt-3 overflow-x-auto rounded-lg p-3 text-xs ${codeClass}`}>
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    ),
                  blockquote: (props) => (
                    <blockquote
                      className="mt-3 border-l-2 border-gray-600 pl-3 text-sm text-gray-400"
                      {...props}
                    />
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>

          {/* User Avatar - Only show for user */}
          {isUser && (
            <div className="flex-shrink-0 w-7 h-7 bg-[#252525] border border-gray-700 rounded-lg flex items-center justify-center mt-1">
              <User size={14} className="text-gray-400" />
            </div>
          )}
        </div>

        {/* Feedback Buttons - Only show for assistant messages */}
        {!isUser && (
          <div className="absolute -bottom-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#252525] border border-gray-700 rounded-lg p-1">
            <button
              onClick={() => onFeedback?.(message.id, "like")}
              className="p-1.5 hover:bg-[#2a2a2a] rounded-md transition-colors group/btn"
              title="Like this response"
            >
              <ThumbsUp
                size={12}
                className="text-gray-400 group-hover/btn:text-gray-300 transition-colors"
              />
            </button>
            <button
              onClick={() => onFeedback?.(message.id, "dislike")}
              className="p-1.5 hover:bg-[#2a2a2a] rounded-md transition-colors group/btn"
              title="Dislike this response"
            >
              <ThumbsDown
                size={12}
                className="text-gray-400 group-hover/btn:text-gray-300 transition-colors"
              />
            </button>
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`flex items-center gap-2 mt-2 px-1 ${
            isUser ? "justify-end" : "justify-start ml-10"
          }`}
        >
          <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
            {time}
          </span>
          {!isUser && (
            <div className="w-1 h-1 bg-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          )}
        </div>
      </div>
    </div>
  );
}
