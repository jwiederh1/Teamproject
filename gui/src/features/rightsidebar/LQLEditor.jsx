import React from 'react';
import Editor from '@monaco-editor/react';

const LqlEditor = ({ lql, onLqlChange, validationResult, onValidateLql }) => {
    return (
        <div className="lql-editor-container">
            {/* Validation Results Display */}
            {validationResult && !validationResult.isValid && (
                <div className="validation-error-display">
                    <h3 className="validation-error-title">LQL Validation Errors:</h3>
                    <div className="validation-errors">
                        {validationResult.errors.map((error, index) => (
                            <div key={index} className="validation-error-item">
                                {error.includes('Line') ? (
                                    <span className="error-code">{error}</span>
                                ) : (
                                    <span>{error}</span>
                                )}
                            </div>
                        ))}
                    </div>
                    {validationResult.timestamp && (
                        <div className="validation-timestamp">
                            Validation timestamp: {new Date(validationResult.timestamp).toLocaleTimeString()}
                        </div>
                    )}
                </div>
            )}

            {/* Success message for valid LQL */}
            {validationResult && validationResult.isValid && (
                <div className="validation-success-display">
                    <h3 className="validation-success-title">✅ LQL is Valid!</h3>
                    <p>Your LQL interface definition has been validated successfully.</p>
                </div>
            )}

            {/* Editor - Reduced to 50% height */}
            <div
                className="lql-editor-wrapper"
                style={{
                    height: '300px', // Fixed height - 50% of previous size
                    minHeight: '300px', // Ensure minimum height
                    maxHeight: '300px', // Prevent expansion
                    border: validationResult
                        ? (validationResult.isValid ? '2px solid #10b981' : '2px solid #ef4444')
                        : '2px solid var(--color-accent)',
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    marginBottom: '15px'
                }}
            >
                <Editor
                    height="300px"
                    width="100%"
                    language="java"
                    theme="vs-light"
                    value={lql}
                    onChange={(value) => onLqlChange(value || '')}
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: true,
                        fontSize: 14, // Slightly smaller font
                        tabSize: 4,
                        wordWrap: 'on',
                        automaticLayout: true,
                        lineHeight: 20, // Reduced line height
                        letterSpacing: 0.5,
                        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
                        fontWeight: 'normal',
                        fontLigatures: false
                    }}
                />
            </div>

            {/* Validate Button - Now below the editor */}
            <div className="lql-validate-button-container">
                <button
                    type="button"
                    className="validate-lql-button primary-button"
                    onClick={onValidateLql}
                >
                    Validate LQL
                </button>
            </div>
        </div>
    );
};

export default LqlEditor;