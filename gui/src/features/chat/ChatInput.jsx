import React, { useState } from "react";

/**
 * A controlled component for user text input in the chat interface.
 * It supports both single-line and multi-line input and handles form
 * submission via a button click or the Enter key.
 *
 * @param {object} props - The component props.
 * @param {function} props.onSubmit - The callback function to execute when the user submits text.
 * @param {string} [props.placeholder] - The placeholder text to display in the input area.
 * @param {boolean} [props.multiline] - If true, the input will be a textarea; otherwise, a single-line input.
 * @param {boolean} [props.disabled=false] - If true, the input and send button will be disabled.
 * @returns {JSX.Element} The rendered chat input component.
 */
const ChatInput = ({ onSubmit, placeholder, multiline, disabled }) => {
  const [text, setText] = useState("");

  /**
   * Handles the form submission logic.
   */
  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text);
      setText("");
    }
  };

  /**
   * Handles the key down event to allow submission with the Enter key.
   * @param {React.KeyboardEvent} e - The keyboard event.
   */
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Prevents adding a new line in the textarea
      handleSubmit();
    }
  };

  return (
    <div className="chat-input-container">
      <div className="input-center">
        <textarea
          className="chat-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Type your prompt..."}
          disabled={disabled}
          rows="1"
        />
        <button
          className="send-button"
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
