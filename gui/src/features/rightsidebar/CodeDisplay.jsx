import React, { useState, useEffect } from 'react';

/**
 * CodeDisplay component - Simplified to show all implementations in a unified list
 */
const CodeDisplay = ({
                         result,
                         isSelected = false,
                         codeId = 0,
                         isRefined = false, // This now indicates if THIS specific implementation is the refined one
                         onSelect = null,
                         selectable = false,
                         isRefining = false
                     }) => {
    const [copiedButton, setCopiedButton] = useState(null);
    const [isHovered, setIsHovered] = useState(false);

    // Reset copied state when result changes
    useEffect(() => {
        setCopiedButton(null);
    }, [result]);

    // Copy to clipboard functionality
    const copyToClipboard = async (text, type = 'code', buttonId) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedButton(buttonId);

            setTimeout(() => {
                setCopiedButton(null);
            }, 2000);

            console.log(`✅ ${type} copied to clipboard`);
        } catch (err) {
            console.error(`❌ Failed to copy ${type}:`, err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);

            setCopiedButton(buttonId);
            setTimeout(() => {
                setCopiedButton(null);
            }, 2000);
        }
    };

    // Remove click-to-select functionality - selection only via buttons
    const handleClick = (e) => {
        // No click handling for selection anymore
    };

    if (!result) {
        console.log("❌ CodeDisplay: No result provided");
        return (
            <div className="compact-code-display" style={{
                minHeight: '400px',
                width: '100%',
                overflow: 'visible',
                transform: 'none',
                margin: '0',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                fontFamily: '"Playfair Display", serif',
                fontSize: '1rem'
            }}>
                <div style={{padding: '1rem', textAlign: 'center'}}>
                    <p style={{fontSize: '0.75rem', color: '#666'}}>No implementation data available</p>
                </div>
            </div>
        );
    }

    console.log("🔍 CodeDisplay: Received result:", result);
    console.log("🔍 CodeDisplay: isSelected:", isSelected, "isRefined:", isRefined, "selectable:", selectable);

    // Clean the code by removing the "Implementation:" prefix and extra whitespace
    const cleanCode = (rawCode) => {
        if (!rawCode) return '';
        let cleaned = rawCode.replace(/^Implementation:\s*\n?/i, '').trim();
        console.log("🔍 CodeDisplay: Cleaned code:", cleaned);
        return cleaned;
    };

    // Helper function to parse a Java code string into structured components
    const parseJavaCode = (code) => {
        const cleanedCode = cleanCode(code);

        if (!cleanedCode) {
            console.log("❌ CodeDisplay: No code to parse after cleaning");
            return {
                imports: [],
                className: 'Unknown',
                implementsInterface: null,
                fields: [],
                methods: [],
                rawCode: cleanedCode
            };
        }

        try {
            // Get imports
            const importRegex = /import\s+[^;]+;/g;
            const imports = cleanedCode.match(importRegex) || [];

            // Get class declaration and name
            const classDecRegex = /(?:public\s+)?(?:final\s+)?class\s+([\w]+(?:<[^>]+>)?)\s*(?:extends\s+[\w<>,\s]+)?\s*(?:implements\s+[\w<>,\s]+)?\s*{?/;
            const classMatch = cleanedCode.match(classDecRegex);
            const className = classMatch ? classMatch[1] : 'Unknown';
            const implementsInterface = classMatch && classMatch[2] ? classMatch[2] : null;

            // Get fields
            const fieldsRegex = /(private|protected|public)(?:\s+final)?\s+(?:\w+(?:<[^>]+>)?)\s+\w+(?:\s+=\s+[^;]+)?;/g;
            const fields = cleanedCode.match(fieldsRegex) || [];

            // Get methods
            const methodsRegex = /(public|private|protected)\s+(?:<[^>]+>\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*{/g;
            const methodsMatches = Array.from(cleanedCode.matchAll(methodsRegex) || []);

            const methods = methodsMatches.map(match => {
                const methodStart = match.index;
                const methodSignature = match[0];
                const methodName = match[2];

                // Find the full method by counting braces
                let braceCount = 1;
                let currentIndex = methodStart + methodSignature.length;

                while (braceCount > 0 && currentIndex < cleanedCode.length) {
                    const char = cleanedCode[currentIndex];
                    if (char === '{') braceCount++;
                    else if (char === '}') braceCount--;
                    currentIndex++;
                }

                const fullMethod = cleanedCode.substring(methodStart, currentIndex);

                return {
                    fullMethod: fullMethod,
                    name: methodName
                };
            });

            console.log("✅ CodeDisplay: Parsing successful", {
                imports: imports.length,
                className,
                implementsInterface,
                fields: fields.length,
                methods: methods.length
            });

            return {
                imports,
                className,
                implementsInterface,
                fields,
                methods,
                rawCode: cleanedCode
            };
        } catch (error) {
            console.error("❌ CodeDisplay: Error parsing Java code:", error);
            return {
                imports: [],
                className: 'ParseError',
                implementsInterface: null,
                fields: [],
                methods: [],
                rawCode: cleanedCode
            };
        }
    };

    const codeInfo = parseJavaCode(result.code_implementation);

    // Define metric labels for criteria scores
    const metricLabels = {
        m_static_complexity_td: "Code Simplicity",
        m_static_loc_td: "Code Brevity",
    };

    // Get container styles - removed selectable interaction styles
    const getContainerStyles = () => {
        const baseStyles = {
            minHeight: '400px',
            width: '100%',
            overflow: 'visible',
            display: 'flex',
            flexDirection: 'column',
            transform: 'none',
            margin: '0',
            borderRadius: '0.5rem',
            backgroundColor: 'white',
            fontFamily: '"Playfair Display", serif',
            fontSize: '1rem',
            transition: 'all 0.3s ease',
            position: 'relative'
        };

        // Refined implementations get special green styling
        if (isRefined) {
            return {
                ...baseStyles,
                border: '2px solid #10b981',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)'
            };
        } else if (isSelected) {
            return {
                ...baseStyles,
                border: '2px solid #3b82f6',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
            };
        } else {
            // No special hover or selectable styling
            return {
                ...baseStyles,
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            };
        }
    };

    // Header styling with refined implementation indicator
    const getHeaderStyles = () => {
        if (isRefined) {
            return {
                backgroundColor: '#10b981', // Green for refined
                color: 'white',
                padding: '0.8rem',
                borderTopLeftRadius: '0.5rem',
                borderTopRightRadius: '0.5rem',
                flexShrink: 0
            };
        } else {
            return {
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                padding: '0.8rem',
                borderTopLeftRadius: '0.5rem',
                borderTopRightRadius: '0.5rem',
                flexShrink: 0
            };
        }
    };

    // Rank badge styling
    const getRankBadgeStyles = () => {
        const baseStyles = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.8rem',
            height: '1.8rem',
            borderRadius: '50%',
            marginRight: '0.6rem',
            fontSize: '1rem',
            fontWeight: '700',
            border: '1px solid'
        };

        if (isRefined) {
            return {
                ...baseStyles,
                backgroundColor: '#065f46',
                color: 'white',
                borderColor: '#065f46'
            };
        } else if (isSelected) {
            return {
                ...baseStyles,
                backgroundColor: '#3b82f6',
                color: 'white',
                borderColor: '#3b82f6'
            };
        } else {
            return {
                ...baseStyles,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: isRefined ? 'white' : 'var(--color-text-primary)',
                borderColor: isRefined ? 'white' : 'var(--color-text-primary)'
            };
        }
    };

    // Remove selectable hint - selection only via buttons now
    const SelectableHint = () => {
        return null;
    };

    return (
        <div style={{ position: 'relative' }}>
            {/* Refined implementation banner */}
            {isRefined && (
                <div style={{
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #bbf7d0',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '0.875rem',
                    color: '#065f46',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderTopLeftRadius: '0.5rem',
                    borderTopRightRadius: '0.5rem'
                }}>
                    <span>✨</span>
                    <strong>Refined Implementation</strong>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.8 }}>
                        Enhanced based on your feedback
                    </span>
                </div>
            )}

            <div
                className="compact-code-display"
                style={getContainerStyles()}
                onClick={handleClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Custom scrollbar styles */}
                <style jsx>{`
                    .code-scroll::-webkit-scrollbar {
                        width: 6px;
                        height: 6px;
                    }
                    .code-scroll::-webkit-scrollbar-track {
                        background: #f9fafb;
                        border-radius: 3px;
                    }
                    .code-scroll::-webkit-scrollbar-thumb {
                        background-color: #967259;
                        border-radius: 3px;
                    }
                    .code-scroll::-webkit-scrollbar-thumb:hover {
                        background-color: #5c4433;
                    }
                    .code-scroll {
                        scrollbar-width: thin;
                        scrollbar-color: #967259 #f9fafb;
                    }
                `}</style>

                <SelectableHint />

                {/* Header */}
                <div style={getHeaderStyles()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div style={{display: 'flex', alignItems: 'center'}}>
                            <div style={getRankBadgeStyles()}>
                                {result.rank || '#'}
                            </div>

                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: '600',
                                color: isRefined ? 'white' : 'var(--color-text-primary)',
                                margin: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                {codeInfo.className}
                                {isRefined && (
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: '500',
                                        color: 'rgba(255, 255, 255, 0.9)'
                                    }}>
                                        (Refined)
                                    </span>
                                )}
                            </h3>
                        </div>

                        <div style={{
                            fontSize: '0.9rem',
                            backgroundColor: isRefined ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-text-primary)',
                            color: isRefined ? 'white' : 'var(--color-bg-primary)',
                            padding: '0.3rem 0.6rem',
                            borderRadius: '9999px',
                            fontWeight: '500'
                        }}>
                            {isRefined ?
                                (result.generated_by?.replace('-refined', '') || 'AI') + ' Enhanced' :
                                (result.generated_by || 'AI')
                            }
                        </div>
                    </div>
                </div>

                {/* Content area */}
                <div style={{
                    backgroundColor: isRefined ? '#fefffe' : 'white',
                    borderBottomLeftRadius: '0.5rem',
                    borderBottomRightRadius: '0.5rem',
                    flex: 1,
                    overflow: 'hidden'
                }}>
                    {/* Metrics bar */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem 0.8rem',
                        backgroundColor: isRefined ? 'rgba(16, 185, 129, 0.1)' : 'rgba(151, 114, 89, 0.1)',
                        borderBottom: `1px solid ${isRefined ? 'rgba(16, 185, 129, 0.2)' : 'rgba(151, 114, 89, 0.2)'}`,
                        fontSize: '1rem'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: '600',
                            color: isRefined ? '#065f46' : 'var(--color-bg-primary-dark)'
                        }}>
                            <span style={{marginRight: '0.3rem'}}>Rank:</span>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '1.2rem',
                                height: '1.2rem',
                                backgroundColor: isRefined ? '#10b981' : 'var(--color-bg-primary)',
                                color: 'white',
                                borderRadius: '0.15rem',
                                padding: '0 0.2rem',
                                fontSize: '0.6rem'
                            }}>
                                #{result.rank || 1}
                            </span>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: '600',
                            color: isRefined ? '#065f46' : 'var(--color-bg-primary-dark)'
                        }}>
                            <span style={{marginRight: '0.3rem'}}>Score:</span>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '1.8rem',
                                height: '1.2rem',
                                backgroundColor: isRefined ? '#10b981' : 'var(--color-bg-primary)',
                                color: 'white',
                                borderRadius: '0.15rem',
                                padding: '0 0.2rem',
                                fontSize: '0.6rem'
                            }}>
                                {result.overall_score ? (result.overall_score * 100).toFixed(1) + '%' : '0%'}
                            </span>
                        </div>
                    </div>

                    <div style={{padding: '0.8rem', fontSize: '0.75rem'}}>
                        {/* Refinement loading indicator */}
                        {isRefining && !isRefined && (
                            <div style={{
                                backgroundColor: '#fef3c7',
                                border: '1px solid #fcd34d',
                                borderRadius: '0.375rem',
                                padding: '0.75rem',
                                marginBottom: '1rem',
                                color: '#92400e',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    border: '2px solid #fcd34d',
                                    borderTop: '2px solid #92400e',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <div>
                                    <div style={{
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        marginBottom: '0.25rem'
                                    }}>
                                        Refining Implementation...
                                    </div>
                                    <p style={{
                                        fontSize: '0.75rem',
                                        margin: 0,
                                        opacity: 0.8
                                    }}>
                                        Creating an enhanced version based on your feedback
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Code Section */}
                        {codeInfo.rawCode && (
                            <div style={{marginBottom: '1rem'}}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '0.5rem'
                                }}>
                                    <h4 style={{
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        color: isRefined ? '#065f46' : 'var(--color-bg-primary-dark)',
                                        textTransform: 'uppercase',
                                        margin: 0
                                    }}>
                                        {isRefined ? '✨ REFINED CODE' : 'CODE'}
                                    </h4>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyToClipboard(codeInfo.rawCode, 'Implementation', 'code');
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0.3rem 0.6rem',
                                            backgroundColor: copiedButton === 'code' ? '#10b981' : (isRefined ? '#10b981' : 'var(--color-bg-primary)'),
                                            color: 'white',
                                            border: `1px solid ${copiedButton === 'code' ? '#10b981' : (isRefined ? '#10b981' : 'var(--color-bg-primary)')}`,
                                            borderRadius: '0.25rem',
                                            fontSize: '0.6rem',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            minWidth: '60px',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {copiedButton === 'code' ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <pre className="code-scroll" style={{
                                    backgroundColor: isRefined ? '#f0fdf4' : '#f9fafb',
                                    padding: '0.8rem',
                                    borderRadius: '0.25rem',
                                    border: `1px solid ${isRefined ? '#bbf7d0' : '#e5e7eb'}`,
                                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                                    fontSize: '0.75rem',
                                    lineHeight: '1.5',
                                    color: 'var(--color-bg-primary-dark)',
                                    overflowX: 'auto',
                                    margin: 0,
                                    whiteSpace: 'pre-wrap',
                                    maxHeight: '300px'
                                }}>
                                    {codeInfo.rawCode}
                                </pre>
                            </div>
                        )}

                        {/* JUnit Tests section */}
                        {result.test_results?.unit_test_implementations && (
                            <div style={{marginBottom: '1rem'}}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '0.5rem'
                                }}>
                                    <h4 style={{
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        color: isRefined ? '#065f46' : 'var(--color-bg-primary-dark)',
                                        textTransform: 'uppercase',
                                        margin: 0
                                    }}>
                                        {isRefined ? '✨ ENHANCED TESTS' : 'TESTS'}
                                    </h4>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyToClipboard(
                                                result.test_results.unit_test_implementations.map(t => t.test_code_implementation).join('\n\n'),
                                                'JUnit Tests',
                                                'tests'
                                            );
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0.3rem 0.6rem',
                                            backgroundColor: copiedButton === 'tests' ? '#10b981' : '#0ea5e9',
                                            color: 'white',
                                            border: `1px solid ${copiedButton === 'tests' ? '#10b981' : '#0ea5e9'}`,
                                            borderRadius: '0.25rem',
                                            fontSize: '0.6rem',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            minWidth: '60px',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {copiedButton === 'tests' ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <pre className="code-scroll" style={{
                                    backgroundColor: '#f0f9ff',
                                    padding: '0.8rem',
                                    borderRadius: '0.25rem',
                                    border: '1px solid #0ea5e9',
                                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                                    fontSize: '0.75rem',
                                    lineHeight: '1.5',
                                    color: 'var(--color-bg-primary-dark)',
                                    overflowX: 'auto',
                                    margin: 0,
                                    whiteSpace: 'pre-wrap',
                                    maxHeight: '250px'
                                }}>
                                    {result.test_results.unit_test_implementations.map(t => `${t.signature}\n${t.test_code_implementation}`).join('\n\n')}
                                </pre>
                            </div>
                        )}

                        {/* Performance metrics */}
                        <div style={{marginTop: '1rem'}}>
                            <h4 style={{
                                fontSize: '1.5rem',
                                fontWeight: '600',
                                marginBottom: '0.6rem',
                                color: isRefined ? '#065f46' : 'var(--color-bg-primary-dark)',
                                textTransform: 'uppercase'
                            }}>
                                {isRefined ? '✨ ENHANCED METRICS' : 'METRICS'}
                            </h4>

                            {/* Criteria scores */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                marginBottom: '1rem'
                            }}>
                                {Object.entries(result.criteria_scores || {}).map(([criterion, score]) => {
                                    const displayScore = score === 0 ? 0 : Math.round(score * 9 + 1);
                                    const barPercentage = (displayScore / 10) * 100;

                                    return (
                                        <div key={criterion} style={{
                                            padding: '0.5rem',
                                            backgroundColor: isRefined ? '#f0fdf4' : '#f9fafb',
                                            borderRadius: '0.25rem',
                                            border: `1px solid ${isRefined ? '#bbf7d0' : '#e5e7eb'}`
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '0.3rem'
                                            }}>
                                                <span style={{
                                                    fontSize: '0.9rem',
                                                    color: isRefined ? '#065f46' : 'var(--color-bg-primary-dark)',
                                                    fontWeight: '500'
                                                }}>
                                                    {metricLabels[criterion] || criterion}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.9rem',
                                                    fontWeight: '600',
                                                    color: isRefined ? '#065f46' : 'var(--color-bg-primary-dark)'
                                                }}>
                                                    {displayScore}/10
                                                </span>
                                            </div>
                                            <div style={{
                                                width: '100%',
                                                height: '0.4rem',
                                                backgroundColor: '#e5e7eb',
                                                borderRadius: '9999px',
                                                overflow: 'hidden'
                                            }}>
                                                <div
                                                    style={{
                                                        height: '100%',
                                                        backgroundColor: isRefined ? '#10b981' : 'var(--color-bg-primary)',
                                                        borderRadius: '9999px',
                                                        width: `${barPercentage}%`,
                                                        transition: 'width 0.3s ease'
                                                    }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Assertions results */}
                            {result.test_results && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.5rem',
                                    backgroundColor: isRefined ? '#f0fdf4' : '#f9fafb',
                                    borderRadius: '0.25rem',
                                    border: `1px solid ${isRefined ? '#bbf7d0' : '#e5e7eb'}`
                                }}>
                                    <span style={{
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        color: isRefined ? '#065f46' : 'var(--color-bg-primary-dark)'
                                    }}>
                                        Assertions:
                                    </span>
                                    <span style={{
                                        fontSize: '1rem',
                                        color: result.test_results.passed === result.test_results.total ? '#10b981' : '#f59e0b',
                                        fontWeight: '600'
                                    }}>
                                        {result.test_results.passed} / {result.test_results.total}
                                        {result.test_results.passed === result.test_results.total && (
                                            <span style={{marginLeft: '4px'}}>✓</span>
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
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

export default CodeDisplay;