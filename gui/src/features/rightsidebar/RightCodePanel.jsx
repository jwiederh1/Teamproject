import React, { useState, useEffect, useCallback } from 'react';
import CodeDisplay from './CodeDisplay.jsx';
import LqlEditor from './LQLEditor.jsx';

const RightCodePanel = ({
                            isOpen,
                            onClose,
                            allResults,
                            panelContent,
                            lql,
                            onLqlChange,
                            onValidateLql,
                            lqlValidationResult,
                            width,
                            onWidthChange,
                            hasRefinedCode,
                            isRefining,
                            selectedCodeId = null, // GeÃ¤ndert zu null default
                            onCodeSelect = null
                        }) => {
    const [activeResultIndex, setActiveResultIndex] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    // Handle code selection with proper event handling
    const handleCodeSelect = (codeId) => {
        console.log('ðŸ”„ RightCodePanel: Selecting code ID:', codeId);
        if (onCodeSelect && typeof onCodeSelect === 'function') {
            onCodeSelect(codeId);
        } else {
            console.warn('âš ï¸ RightCodePanel: onCodeSelect is not a function');
        }
    };

    // Get current result based on active index
    const currentResult = activeResultIndex === 0
        ? allResults?.bestImplementation
        : allResults?.otherImplementations?.[activeResultIndex - 1];

    // Get refined result
    const refinedResult = allResults?.refinedImplementation;

    // Calculate total results
    const totalResults = allResults
        ? 1 + (allResults.otherImplementations?.length || 0)
        : 0;

    // Check if refinement selection is optional (only one implementation available)
    const isSelectionOptional = totalResults <= 1;

    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (isDragging) {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 400 && newWidth < window.innerWidth - 350) {
                onWidthChange(newWidth);
            }
        }
    }, [isDragging, onWidthChange]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const getPanelTitle = () => {
        if (panelContent === 'lql') return 'LQL Definition';
        if (panelContent === 'code') {
            return 'Generated Code';
        }
        return 'Panel';
    };

    return (
        <div
            className={`right-code-panel ${isOpen ? 'open' : ''}`}
            style={{ width: `${width}px`, right: isOpen ? 0 : `-${width}px` }}
        >
            <div
                className="panel-dragger"
                onMouseDown={handleMouseDown}
            />

            <div className="panel-header">
                <h2>{getPanelTitle()}</h2>
                <div className="panel-header-actions">
                    {/* Refinement status indicator */}
                    {isRefining && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginRight: '16px',
                            color: '#10b981',
                            fontSize: '0.875rem',
                            fontWeight: '500'
                        }}>
                            <div className="spinner" style={{
                                width: '16px',
                                height: '16px',
                                border: '2px solid #e5e7eb',
                                borderTop: '2px solid #10b981',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                            Refining...
                        </div>
                    )}
                    <button type="button" className="close-button" onClick={onClose}>
                        Ã—
                    </button>
                </div>
            </div>

            {/* Implementation selector - nur anzeigen wenn mehrere Implementierungen */}
            {panelContent === 'code' && totalResults > 1 && (
                <div className="implementation-selector">
                    <span>Select implementation:</span>
                    {Array.from({ length: totalResults }).map((_, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className={`impl-button ${activeResultIndex === idx ? 'active' : ''} ${selectedCodeId === idx ? 'selected-for-refinement' : ''}`}
                            onClick={() => setActiveResultIndex(idx)}
                        >
                            {idx + 1}
                        </button>
                    ))}
                </div>
            )}

            {/* Code selection info - nur anzeigen wenn mehrere Implementierungen UND Code ausgewÃ¤hlt */}
            {panelContent === 'code' && totalResults > 1 && selectedCodeId !== null && (
                <div className="code-selection-info">
                    <span>
                        Selected for refinement: Implementation {selectedCodeId + 1}
                    </span>
                    {selectedCodeId !== activeResultIndex && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('ðŸ”„ RightCodePanel: Selecting active result index:', activeResultIndex);
                                handleCodeSelect(activeResultIndex);
                            }}
                            className="primary-button"
                        >
                            Select This One
                        </button>
                    )}
                </div>
            )}

            {/* Optional selection hint - nur wenn mehrere Implementierungen aber keine Auswahl */}
            {panelContent === 'code' && totalResults > 1 && selectedCodeId === null && (
                <div style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#f8f9fa',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '0.875rem',
                    color: '#6c757d',
                    fontStyle: 'italic',
                    textAlign: 'center'
                }}>
                    ðŸ’¡ Tip: Click on a code implementation to select it for refinement (optional)
                </div>
            )}

            <div className="panel-content">
                {panelContent === 'code' && (
                    <>
                        {/* Show current result */}
                        {currentResult && (
                            <CodeDisplay
                                result={currentResult}
                                isSelected={selectedCodeId === activeResultIndex}
                                codeId={activeResultIndex}
                                isRefined={false}
                                onSelect={handleCodeSelect}
                                selectable={totalResults > 1} // Nur selektierbar wenn mehrere vorhanden
                                hasRefinedCode={hasRefinedCode}
                                refinedResult={refinedResult}
                                isRefining={isRefining}
                                selectedCodeId={selectedCodeId}
                            />
                        )}

                        {/* Show empty state if no current result */}
                        {!currentResult && (
                            <div className="empty-state">
                                <div style={{
                                    textAlign: 'center',
                                    padding: '3rem 2rem',
                                    color: '#6c757d'
                                }}>
                                    <div style={{
                                        fontSize: '3rem',
                                        marginBottom: '1rem',
                                        opacity: 0.5
                                    }}>
                                        ðŸ“„
                                    </div>
                                    <h3 style={{
                                        margin: '0 0 0.5rem 0',
                                        color: '#495057'
                                    }}>
                                        No Code Generated Yet
                                    </h3>
                                    <p style={{
                                        margin: 0,
                                        lineHeight: 1.5
                                    }}>
                                        Start a conversation with Cody to generate some code!
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
                {panelContent === 'lql' && (
                    <LqlEditor
                        lql={lql}
                        onLqlChange={onLqlChange}
                        validationResult={lqlValidationResult}
                        onValidateLql={onValidateLql}
                    />
                )}
            </div>

            {/* Add spinner animation styles */}
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default RightCodePanel;