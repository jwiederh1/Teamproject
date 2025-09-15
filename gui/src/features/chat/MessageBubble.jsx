
import React, { Fragment } from "react";
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
   * Gracefully handles various input types (Date object, string, number)
   * and returns an empty string for invalid inputs.
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
   * Determines and renders the primary content inside the message bubble.
   * This function handles different rendering logic based on the message state,
   * such as loading indicators, plain text for users, or Markdown with
   * interactive elements for the AI.
   * @returns {JSX.Element|string} The content to be placed inside the bubble.
   */
  const renderMessageContent = () => {
    // Display a loading animation if the message is in a loading state.
    if (message.isLoading) {
      return (
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      );
    }

    // User messages are treated as plain text. The CSS `white-space: pre-wrap`
    // will correctly preserve any line breaks they enter.
    if (message.type === "user") {
      return message.content;
    }

    // AI messages can contain Markdown and interactive elements.
    // A Fragment is used here to prevent an extra wrapper div, which
    // allows for more precise CSS styling of the bubble's direct children.
    return (
      <Fragment>
        <div className="markdown-content">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {/* Conditionally render a "View Code" button if the message has associated code. */}
        {message.hasCode && message.codeData && (
          <div style={{ marginTop: "12px" }}>
            <button onClick={onCodeClick} className="view-code-button">
              📄 View Code
            </button>
          </div>
        )}

        {/* Conditionally render interactive option buttons if they are provided. */}
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
      </Fragment>
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
