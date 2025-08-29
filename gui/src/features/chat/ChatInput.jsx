import React, { useState, useRef, useEffect } from 'react';

const ChatInput = ({ onSubmit, placeholder, multiline = false }) => {
    const [value, setValue] = useState('');
    const textareaRef = useRef(null);

    useEffect(() => {
        if (multiline && textareaRef.current) {
            autoResize();
        }
    }, [value, multiline]);

    const autoResize = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const newHeight = Math.min(Math.max(textarea.scrollHeight, 80), 300);
            textarea.style.height = `${newHeight}px`;
        }
    };

    const handleSubmit = () => {
        if (value.trim()) {
            onSubmit(value.trim());
            setValue('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="chat-input-container">
            {multiline ? (
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="chat-textarea"
                    rows={3}
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="chat-input"
                />
            )}
            <button
                onClick={handleSubmit}
                className="send-button"
                disabled={!value.trim()}
            >
                Send
            </button>
        </div>
    );
};

export default ChatInput;