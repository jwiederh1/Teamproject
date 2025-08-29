import React from 'react';
import ReactMarkdown from 'react-markdown';

const MessageBubble = ({ message, onOptionClick, onCodeClick, onRetry }) => {
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';

        try {
            // Erstelle Date-Objekt aus verschiedenen Eingabeformaten
            let dateObj;
            if (timestamp instanceof Date) {
                dateObj = timestamp;
            } else if (typeof timestamp === 'string') {
                // Handhabe verschiedene String-Formate
                dateObj = new Date(timestamp);
            } else if (typeof timestamp === 'number') {
                dateObj = new Date(timestamp);
            } else {
                return '';
            }

            // Prüfe ob Date gültig ist
            if (isNaN(dateObj.getTime())) {
                console.warn('Invalid date:', timestamp);
                return '';
            }

            // Formatiere IMMER mit deutscher Lokalisierung
            return new Intl.DateTimeFormat('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Berlin' // Explizit deutsche Zeitzone
            }).format(dateObj);
        } catch (error) {
            console.warn('Timestamp formatting error:', error, 'for timestamp:', timestamp);
            return '';
        }
    };

    const handleRetry = () => {
        if (onRetry && typeof onRetry === 'function') {
            onRetry(message);
        } else {
            console.warn('Retry function not available');
        }
    };

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
                        p: ({node, ...props}) => <span {...props} />,
                        strong: ({node, ...props}) => <strong {...props} style={{fontWeight: 'bold'}} />,
                        em: ({node, ...props}) => <em {...props} style={{fontStyle: 'italic'}} />,
                        ul: ({node, ...props}) => <ul {...props} style={{margin: '0.5rem 0', paddingLeft: '1rem'}} />,
                        ol: ({node, ...props}) => <ol {...props} style={{margin: '0.5rem 0', paddingLeft: '1rem'}} />,
                        li: ({node, ...props}) => <li {...props} style={{margin: '0.1rem 0'}} />,
                        code: ({node, inline, ...props}) =>
                            inline ?
                                <code {...props} style={{backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '3px', fontSize: '0.9em'}} /> :
                                <code {...props} style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: '6px', margin: '0.5rem 0', fontSize: '0.9em'}} />
                    }}
                >
                    {message.content}
                </ReactMarkdown>

                {/* Code Click Handler */}
                {message.hasCode && message.codeData && (
                    <div style={{ marginTop: '12px' }}>
                        <button
                            onClick={onCodeClick}
                            className="view-code-button"
                        >
                            📄 View Code
                        </button>
                    </div>
                )}

                {/* Error State mit Retry Button */}
                {message.isError && (
                    <div style={{ marginTop: '12px' }}>
                        <button
                            onClick={handleRetry}
                            className="retry-button"
                            disabled={message.isLoading}
                        >
                            🔄 Retry
                        </button>
                    </div>
                )}

                {/* Options */}
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
                {message.type === 'user' ? '👤' : '🤠'}
            </div>
            <div className="message-content">
                <div className="message-header">
                    <span className="message-sender">
                        {message.type === 'user' ? 'You' : 'Cody'}
                    </span>
                    <span className="message-time">
                        {formatTimestamp(message.timestamp)}
                    </span>
                </div>
                <div className={`message-bubble ${message.isError ? 'error' : ''} ${message.isLoading ? 'loading' : ''}`}>
                    {renderMessageContent()}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;