import React from "react";
import ReactMarkdown from "react-markdown";

/**
 * Renders a single chat message bubble for either the user or the AI (Cody).
 * It handles the display of message content (with Markdown support), sender information,
 * timestamp, and interactive options or buttons.
 *
 * @param {object} props - The component props.
 * @param {object} props.message - The message object to display.
 * @param {function} props.onOptionClick - Callback for when an interactive option button is clicked.
 * @param {function} props.onCodeClick - Callback for when the "View Code" button is clicked.
 * @returns {JSX.Element} The rendered message bubble component.
 */
const MessageBubble = ({ message, onOptionClick, onCodeClick }) => {
  /**
   * Formats a timestamp into a localized German date and time string.
   * @param {string|number|Date} timestamp - The timestamp to format.
   * @returns {string} The formatted timestamp string (e.g., "25.07.2024, 14:30").
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    try {
      let dateObj;
      if (timestamp instanceof Date) {
        dateObj = timestamp;
      } else if (
        typeof timestamp === "string" ||
        typeof timestamp === "number"
      ) {
        dateObj = new Date(timestamp);
      } else {
        return "";
      }

      if (isNaN(dateObj.getTime())) {
        console.warn("Invalid date received for formatting:", timestamp);
        return "";
      }

      return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Berlin",
      }).format(dateObj);
    } catch (error) {
      console.warn(
        "Timestamp formatting error:",
        error,
        "for timestamp:",
        timestamp,
      );
      return "";
    }
  };

  /**
   * Renders the main content of the message bubble, handling loading states,
   * Markdown rendering, and interactive elements like buttons.
   * @returns {JSX.Element} The content to be displayed inside the bubble.
   */
  const renderMessageContent = () => {
    if (message.isLoading) {
      return (
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      );
    }

    return (
      <div>
        <ReactMarkdown
          components={{
            p: ({ node, ...props }) => (
              <p {...props} style={{ margin: "0.25em 0" }} />
            ),
            strong: ({ node, ...props }) => (
              <strong {...props} style={{ fontWeight: "bold" }} />
            ),
            em: ({ node, ...props }) => (
              <em {...props} style={{ fontStyle: "italic" }} />
            ),
            ul: ({ node, ...props }) => (
              <ul
                {...props}
                style={{
                  margin: "0.5rem 0",
                  paddingLeft: "1rem",
                }}
              />
            ),
            ol: ({ node, ...props }) => (
              <ol
                {...props}
                style={{
                  margin: "0.5rem 0",
                  paddingLeft: "1rem",
                }}
              />
            ),
            li: ({ node, ...props }) => (
              <li {...props} style={{ margin: "0.1rem 0" }} />
            ),
            code: ({ node, inline, ...props }) =>
              inline ? (
                <code
                  {...props}
                  style={{
                    backgroundColor: "rgba(0,0,0,0.1)",
                    padding: "2px 4px",
                    borderRadius: "3px",
                    fontSize: "0.9em",
                  }}
                />
              ) : (
                <code
                  {...props}
                  style={{
                    display: "inline-block",
                    backgroundColor: "rgba(0,0,0,0.1)",
                    padding: "0.5rem",
                    borderRadius: "6px",
                    margin: "0.5rem 0",
                    fontSize: "0.9em",
                  }}
                />
              ),
          }}
        >
          {message.content}
        </ReactMarkdown>

        {message.hasCode && message.codeData && (
          <div style={{ marginTop: "12px" }}>
            <button onClick={onCodeClick} className="view-code-button">
              📄 View Code
            </button>
          </div>
        )}

        {message.options && message.options.length > 0 && (
          <div className="message-options">
            {message.options.map((option, index) => (
              <button
                key={index}
                onClick={() => onOptionClick(option.id)}
                className="option-button"
              >
                {option.icon && <span>{option.icon}</span>}
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`message-wrapper ${message.type}`}>
      <div className="message-avatar">
        {message.type === "user" ? "👤" : "🤠"}
      </div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-sender">
            {message.type === "user" ? "You" : "Cody"}
          </span>
          <span className="message-time">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
        <div
          className={`message-bubble ${
            message.isError ? "error" : ""
          } ${message.isLoading ? "loading" : ""}`}
        >
          {renderMessageContent()}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
