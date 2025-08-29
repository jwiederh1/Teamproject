import React, {useState, useEffect, useRef} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import Editor from '@monaco-editor/react';
import SortableItem from '../features/leftsidebar/SortableItem.jsx';
import CodeDisplay from '../features/rightsidebar/CodeDisplay.jsx';
import AsyncCodeGenerationAPI, {setupWebhookHandler} from '../api/asyncCodeGenerationApi.js';


import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

const fadeVariants = {
    hidden: {opacity: 0, y: 8},
    visible: {opacity: 1, y: 0},
    exit: {opacity: 0, y: -8},
};

function WizardInterface() {
    const [step, setStep] = useState(0);
    const [prompt, setPrompt] = useState('');
    const [selectedCriteria, setSelectedCriteria] = useState([]);
    const [rankedCriteria, setRankedCriteria] = useState([]);
    const [numVersions, setNumVersions] = useState(3);
    const [selectedLLMs, setSelectedLLMs] = useState(['GPT-4o']);
    const [results, setResults] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeResultIndex, setActiveResultIndex] = useState(0);
    const [activeDragId, setActiveDragId] = useState(null);
    const resultsRef = useRef(null);

    // LQL Validation states
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [processingStatus, setProcessingStatus] = useState(null);
    const [estimatedTime, setEstimatedTime] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [processingStartTime, setProcessingStartTime] = useState(null);
    const [isValidatingLQL, setIsValidatingLQL] = useState(false);
    const [lqlValidationResult, setLqlValidationResult] = useState(null);
    const [generationTimeMinutes, setGenerationTimeMinutes] = useState(3);
    const [llmEnabled, setLlmEnabled] = useState({
        'GPT-4o-mini': true,
        'deepseek-r1:latest': false,
        'gemma3:27b': false,
        'Llama 3.1-latest': false
    });
    const [llmVersions, setLlmVersions] = useState({
        'GPT-4o-mini': 1,
        'deepseek-r1:latest': 0,
        'gemma3:27b': 0,
        'Llama 3.1-latest': 0
    });
    const [lql, setLql] = useState(`Stack {
    push(java.lang.Object)->java.lang.Object
    pop()->java.lang.Object
    peek()->java.lang.Object
    size()->int
}`);
    const [mavenCentralEnabled, setMavenCentralEnabled] = useState(false);
    const [mavenCentralVersions, setMavenCentralVersions] = useState(0);
    const [skippedLQL, setSkippedLQL] = useState(false);

    // Configure the sensor with proper activation constraints
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
                tolerance: 5,
                delay: 0,
            },
        })
    );

    // Clear backend validation result when LQL changes
    useEffect(() => {
        setLqlValidationResult(null);
    }, [lql]);

    useEffect(() => {
        // Setup webhook handler when component mounts
        setupWebhookHandler();

        // Cleanup function
        return () => {
            if (currentSessionId) {
                AsyncCodeGenerationAPI.unregisterSession(currentSessionId);
            }
        };
    }, [currentSessionId]);

    // Add elapsed time counter useEffect
    useEffect(() => {
        let interval;

        if (processingStatus === 'processing' && processingStartTime) {
            interval = setInterval(() => {
                const elapsed = (Date.now() - processingStartTime) / 1000;
                setElapsedTime(elapsed);
            }, 1000);
        }

        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [processingStatus, processingStartTime]);

    // Reacting to Step Changes
    useEffect(() => {
        const styleElement = document.createElement('style');
        switch (step) {
            case 0:
                document.title = "Code Cowboy";
                break;
            case 1:
                document.title = "Define LQL Interface";
                break;
            case 2:
                document.title = "Rank Criteria";
                break;
            case 3:
                document.title = "Generation Options";
                break;
            case 4:
                document.title = "Generating...";
                break;
            case 5:
                document.title = "Results";
                break;
            default:
                document.title = "Code Cowboy";
        }

        styleElement.textContent = `
        /* Custom scrollbar styles */
        #code-display-container .wizard-code-container::-webkit-scrollbar,
        #code-display-container .wizard-code-container *::-webkit-scrollbar {
            width: 10px !important;
            height: 10px !important;
        }
        
        #code-display-container .wizard-code-container::-webkit-scrollbar-track,
        #code-display-container .wizard-code-container *::-webkit-scrollbar-track {
            background: #f9fafb !important;
            border-radius: 10px !important;
        }
        
        #code-display-container .wizard-code-container::-webkit-scrollbar-thumb,
        #code-display-container .wizard-code-container *::-webkit-scrollbar-thumb {
            background-color: #8d7161 !important;
            border-radius: 10px !important;
            border: 2px solid #f9fafb !important;
        }
        
        /* Firefox scrollbar styles */
        #code-display-container .wizard-code-container,
        #code-display-container .wizard-code-container * {
            scrollbar-width: thin !important;
            scrollbar-color: #8d7161 #f9fafb !important;
        }
        
        /* Scaling and container styles */
        #code-display-container .wizard-code-container {
            transform: scale(1.1);
            transform-origin: center top;
            margin: 0 auto;
            max-height: 900px !important;
            width: 90% !important;
            max-width: 1000px !important;
            border: 2px solid #f9fafb !important;
            border-radius: 0.75rem !important;
        }
        
        /* Container styling */
        #code-display-container {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            width: 100%;
            overflow: visible;
            margin-bottom: 100px;
            position: relative;
        }
    `;

        document.head.appendChild(styleElement);

        return () => {
            if (document.head.contains(styleElement)) {
                document.head.removeChild(styleElement);
            }
        };
    }, [step]);

    const handleGenerationComplete = (result) => {
        console.log("🎉 WIZARD: Generation completed!");
        console.log("📋 Result:", result);

        if (result.success) {
            console.log("✅ WIZARD: Setting results and moving to step 5");
            setResults(result.data);
            setProcessingStatus('completed');
            setStep(5);
        } else {
            console.error("❌ WIZARD: Generation failed:", result.error);
            setError(result.error || 'Generation failed');
            setProcessingStatus('error');
        }

        setIsLoading(false);
        setCurrentSessionId(null);
    };

    const handleGenerationProgress = (status) => {
        console.log("⏳ WIZARD: Generation progress:", status);

        if (status.elapsedTime) {
            const serverElapsed = parseFloat(status.elapsedTime.replace(' seconds', ''));
            setElapsedTime(serverElapsed);
        }
    };

    const handleLQLValidation = async () => {
        if (!lql.trim()) {
            console.log("⚠️ WIZARD: Empty LQL, skipping validation");
            setStep(2);
            return;
        }

        setIsValidatingLQL(true);
        setLqlValidationResult(null);
        setError(null);

        console.log("🔍 WIZARD: Starting backend LQL validation");
        console.log("   LQL length:", lql.length);

        try {
            const validationResult = await LQLValidationAPI.validateLQL(lql, true);

            console.log("📋 WIZARD: Backend validation result:", validationResult);
            setLqlValidationResult(validationResult);

            if (validationResult.success && validationResult.isValid) {
                console.log("✅ WIZARD: LQL is valid, proceeding to next step");
                setStep(2);
            } else {
                console.log("❌ WIZARD: LQL validation failed");
                console.log("   Errors:", validationResult.errors);

                const errorMessage = LQLValidationAPI.formatErrorsForDisplay(validationResult.errors);
                setError(errorMessage || 'LQL validation failed');
            }

        } catch (err) {
            console.error("💥 WIZARD: LQL validation request failed:", err);
            setError(`LQL validation failed: ${err.message}`);
            setLqlValidationResult({
                success: false,
                isValid: false,
                errors: [`Validation request failed: ${err.message}`]
            });
        } finally {
            setIsValidatingLQL(false);
        }
    };

    // Updated handleSubmit function in WizardInterface.jsx

    const handleSubmit = async () => {
        setIsLoading(true);
        setError(null);
        setResults(null);
        setActiveResultIndex(0);
        setProcessingStatus('starting');
        setStep(4);

        const payload = {
            lqlInterface: lql,
            userPrompt: prompt,
            rankingCriteria: rankedCriteria,
            generationOptions: {
                // Keep backward compatibility
                numberOfVersions: numVersions,
                selectedLLMs: selectedLLMs,

                // All LLMs and repositories with their status - directly in generationOptions
                'GPT-4o-mini': {
                    name: 'GPT-4o-mini',
                    Is_Used: llmEnabled['GPT-4o-mini'] || false,
                    versions: llmVersions['GPT-4o-mini'] || 0
                },
                'deepseek-r1:latest': {
                    name: 'deepseek-r1:latest',
                    Is_Used: llmEnabled['deepseek-r1:latest'] || false,
                    versions: llmVersions['deepseek-r1:latest'] || 0
                },
                'gemma3:27b': {
                    name: 'gemma3:27b',
                    Is_Used: llmEnabled['gemma3:27b'] || false,
                    versions: llmVersions['gemma3:27b'] || 0
                },
                'Llama 3.1-latest': {
                    name: 'Llama 3.1-latest',
                    Is_Used: llmEnabled['Llama 3.1-latest'] || false,
                    versions: llmVersions['Llama 3.1-latest'] || 0
                },
                'Maven Central': {
                    name: 'Maven Central',
                    Is_Used: mavenCentralEnabled || false,
                    versions: mavenCentralVersions || 0
                },

                // Additional options using state variables
                maxTimeMinutes: generationTimeMinutes
            },
            frontendUrl: 'http://localhost:5174'
        };

        console.log("🎯 WIZARD: Starting async generation with detailed payload:", payload);

        try {
            const startResponse = await AsyncCodeGenerationAPI.startGeneration(payload);

            if (startResponse.success) {
                console.log("✅ WIZARD: Generation started successfully");
                console.log("📋 Session ID:", startResponse.sessionId);
                console.log("⏰ Estimated  time:", startResponse.estimatedTime);

                setCurrentSessionId(startResponse.sessionId);
                setEstimatedTime(startResponse.estimatedTime);
                setProcessingStatus('processing');
                setProcessingStartTime(Date.now());
                setIsLoading(false);

                AsyncCodeGenerationAPI.registerSession(
                    startResponse.sessionId,
                    handleGenerationComplete,
                    handleGenerationProgress
                );

            } else {
                throw new Error(startResponse.message || 'Failed to start generation');
            }

        } catch (err) {
            console.error("💥 WIZARD: Failed to start generation:", err);
            setError(err.message || 'Failed to start generation. Please check if the Python backend is running on port 8000.');
            setProcessingStatus('error');
            setIsLoading(false);
        }
    };

    const getActiveResult = () => {
        if (!results) return null;
        return activeResultIndex === 0
            ? results.bestImplementation
            : results.otherImplementations[activeResultIndex - 1];
    };

    const currentResult = getActiveResult();
    const autoResizeTextarea = (e) => {
        const textarea = e.target;
        textarea.style.height = 'auto';
        const newHeight = Math.min(Math.max(textarea.scrollHeight, 80), 300);
        textarea.style.height = `${newHeight}px`;
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-background text-primary font-fancy px-4">
            <div className="w-full max-w-4xl mx-auto my-8 space-y-10 text-center">
                <AnimatePresence mode="wait">
                    {step === 0 && (
                        <motion.div key="welcome" variants={fadeVariants} initial="hidden" animate="visible" exit="exit"
                                    className="flex flex-col items-center justify-center min-h-[60vh]">
                            <h1 className="text-6xl mb-10">Ready to code, Cowboy?</h1>
                            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center w-full">
    <textarea
        value={prompt}
        onChange={(e) => {
            setPrompt(e.target.value);
            autoResizeTextarea(e);
        }}
        onInput={autoResizeTextarea}
        placeholder="Write a prompt that describes the implementation you want..."
        rows={3}
        className="w-[700px] text-xl p-6 rounded-3xl border-2 border-accent focus:ring-4 focus:ring-accent bg-white text-black shadow-lg resize-none overflow-y-auto"
        style={{
            minHeight: '80px',
            maxHeight: '300px',
            height: '80px',
            resize: 'none',
            fontSize: '1rem !important',
            color: '#000000 !important',
            fontWeight: '400 !important',
            overflowY: 'hidden',
        }}
    />
                                <div className="flex flex-col gap-4">
                                    <button
                                        onClick={() => {
                                            setSkippedLQL(false);
                                            setStep(1);
                                        }}
                                        className="px-8 py-6 text-xl bg-accent text-on-accent hover:bg-blue-600 rounded-2xl shadow-lg transition-colors"
                                    >
                                        ➜
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSkippedLQL(true);
                                            setStep(2);
                                        }}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minWidth: '12rem',
                                            minHeight: '4.5rem',
                                            padding: '0 1.5rem',
                                            backgroundColor: '#967259',
                                            color: '#f9fafb',
                                            border: '2px solid #f9fafb',
                                            borderRadius: '0.75rem',
                                            fontSize: '1.5rem',
                                            fontFamily: '"Playfair Display", serif',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Skip LQL Definition
                                    </button>
                                </div>
                            </div>

                        </motion.div>
                    )}

                    {step === 1 && (
                        <motion.div
                            key="lql"
                            variants={fadeVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="w-full space-y-6 text-left"
                        >
                            <h2 className="wizard-heading">Define LQL Interface</h2>

                            {/* Backend Validation Error Display */}
                            {lqlValidationResult && !lqlValidationResult.isValid && (
                                <div
                                    className="mx-auto max-w-4xl bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
                                    <h3 className="font-semibold text-lg mb-2">LQL Validation Errors:</h3>
                                    {lqlValidationResult.errors.map((error, index) => (
                                        <div key={index} className="text-sm mb-1">
                                            {error.includes('Line') ? (
                                                <span className="font-mono">{error}</span>
                                            ) : (
                                                <span>{error}</span>
                                            )}
                                        </div>
                                    ))}
                                    <div className="mt-2 text-xs text-red-600">
                                        Validation timestamp: {new Date(lqlValidationResult.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            )}

                            {/* Success message for valid LQL */}
                            {lqlValidationResult && lqlValidationResult.isValid && (
                                <div className="mx-auto max-w-4xl bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">
                                    <h3 className="font-semibold text-lg mb-2">✅ LQL is Valid!</h3>
                                    <p className="text-sm">Your LQL interface definition has been validated successfully.</p>
                                </div>
                            )}

                            {/* Loading indicator for validation */}
                            {isValidatingLQL && (
                                <div className="mx-auto max-w-4xl bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg mb-4">
                                    <div className="flex items-center">
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-blue-600 mr-3"></div>
                                    </div>
                                </div>
                            )}

                            {/* Editor container with dynamic border color */}
                            <div
                                className="step-1-editor-container"
                                style={{
                                    height: '600px',
                                    width: '1000px',
                                    maxWidth: '100%',
                                    margin: '2rem auto',
                                    border: lqlValidationResult
                                        ? (lqlValidationResult.isValid ? '2px solid #10b981' : '2px solid #ef4444')
                                        : '2px solid var(--color-accent)',
                                    borderRadius: '0.75rem',
                                    overflow: 'hidden',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <Editor
                                    height="600px"
                                    width="1000px"
                                    language="java"
                                    theme="vs-light"
                                    value={lql}
                                    onChange={(v) => setLql(v || '')}
                                    options={{
                                        minimap: {enabled: false},
                                        scrollBeyondLastLine: true,
                                        fontSize: 20,
                                        tabSize: 4,
                                        wordWrap: 'on',
                                        automaticLayout: true,
                                        lineHeight: 40,
                                        letterSpacing: 0.5,
                                        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
                                        fontWeight: 'normal',
                                        fontLigatures: false
                                    }}
                                />
                            </div>

                            {/* Navigation buttons */}
                            <div className="flex justify-center w-full mt-6 space-x-4">
                                <button
                                    onClick={() => setStep(0)}
                                    className="px-8 py-6 text-xl bg-accent text-on-accent hover:bg-blue-600 rounded-2xl shadow-lg transition-colors"
                                    disabled={isValidatingLQL}
                                >
                                    <span style={{display: 'inline-block', transform: 'scaleX(-1)'}}>➜</span>
                                </button>
                                <button
                                    onClick={handleLQLValidation}
                                    disabled={isValidatingLQL}
                                    className={`px-8 py-6 text-xl rounded-2xl shadow-lg transition-colors ${
                                        isValidatingLQL
                                            ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                            : 'bg-accent text-on-accent hover:bg-blue-600'
                                    }`}
                                >
                                    ➜
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="ranking" variants={fadeVariants} initial="hidden" animate="visible" exit="exit"
                                    className="flex flex-col items-center justify-center min-h-[60vh]">
                            <h2 className="wizard-heading">Prioritize Your Implementation Criteria</h2>
                            <p className="wizard-text mb-6" style={{
                                textAlign: 'center',
                                width: '100%',
                                maxWidth: '1000px',
                                margin: '0 auto 1.5rem auto'
                            }}>
                                Select and rank which qualities matter most for your code implementation. Drag criteria
                                to reorder their importance.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left w-full max-w-3xl mx-auto">
                                <div className="space-y-4 bg-white bg-opacity-10 p-6 rounded-lg text-center">
                                    <h3 className="wizard-subheading"
                                        style={{marginTop: '0.5rem', marginBottom: '1rem'}}>Available Criteria</h3>

                                    <div style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            marginLeft: '10%'
                                        }}>
                                            {['Efficiency', 'Readability', 'Security', 'Maintainability'].map((crit) => (
                                                <label key={crit} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    margin: '10px 0',
                                                    textAlign: 'left'
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        value={crit}
                                                        checked={selectedCriteria.includes(crit)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedCriteria((prev) => [...prev, crit]);
                                                                setRankedCriteria((prev) => [...prev, crit]);
                                                            } else {
                                                                setSelectedCriteria((prev) => prev.filter((c) => c !== crit));
                                                                setRankedCriteria((prev) => prev.filter((c) => c !== crit));
                                                            }
                                                        }}
                                                        style={{marginRight: '10px'}}
                                                        className="h-5 w-5 rounded border-border-panel text-accent"
                                                    />
                                                    <span className="wizard-text" style={{
                                                        marginBottom: '0',
                                                        color: 'var(--color-text-primary)',
                                                        textAlign: 'left'
                                                    }}>
                                                        {crit}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            marginRight: '10%'
                                        }}>
                                            {['Scalability', 'Modularity', 'Performance', 'Testability'].map((crit) => (
                                                <label key={crit} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    margin: '10px 0',
                                                    textAlign: 'left'
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        value={crit}
                                                        checked={selectedCriteria.includes(crit)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedCriteria((prev) => [...prev, crit]);
                                                                setRankedCriteria((prev) => [...prev, crit]);
                                                            } else {
                                                                setSelectedCriteria((prev) => prev.filter((c) => c !== crit));
                                                                setRankedCriteria((prev) => prev.filter((c) => c !== crit));
                                                            }
                                                        }}
                                                        style={{marginRight: '10px'}}
                                                        className="h-5 w-5 rounded border-border-panel text-accent"
                                                    />
                                                    <span className="wizard-text" style={{
                                                        marginBottom: '0',
                                                        color: 'var(--color-text-primary)',
                                                        textAlign: 'left'
                                                    }}>
                                                        {crit}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="min-h-[250px] border-2 border-dashed border-border-panel rounded-md p-6 bg-white bg-opacity-10 text-center">
                                    <h3 className="wizard-subheading"
                                        style={{marginTop: '0.5rem', marginBottom: '1rem'}}>Drag to Rank</h3>
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragStart={({active}) => {
                                            setActiveDragId(active.id);
                                        }}
                                        onDragEnd={({active, over}) => {
                                            if (over && active.id !== over.id) {
                                                setRankedCriteria((items) => arrayMove(
                                                    items,
                                                    items.indexOf(active.id),
                                                    items.indexOf(over.id)
                                                ));
                                            }
                                            setActiveDragId(null);
                                        }}
                                        onDragCancel={() => {
                                            setActiveDragId(null);
                                        }}
                                    >
                                        <SortableContext items={rankedCriteria} strategy={verticalListSortingStrategy}>
                                            <ul className="space-y-3">
                                                {rankedCriteria.map((item, index) => (
                                                    <SortableItem key={item} id={item} index={index}/>
                                                ))}
                                            </ul>
                                        </SortableContext>
                                        <DragOverlay>
                                            {activeDragId ? (
                                                <div className="p-3 bg-white text-black rounded-lg text-lg shadow-lg ring-2 ring-accent border border-border-panel"
                                                     style={{
                                                         backgroundColor: 'var(--color-text-primary)',
                                                         color: 'var(--color-bg-primary-dark)',
                                                         border: '2px solid var(--color-bg-primary-dark)',
                                                         borderRadius: '0.75rem',
                                                         boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
                                                         padding: '1rem 1.25rem',
                                                         fontSize: '1.5rem',
                                                         fontFamily: '"Playfair Display", serif',
                                                         minHeight: '4rem',
                                                         display: 'flex',
                                                         alignItems: 'center',
                                                         justifyContent: 'space-between',
                                                         width: 'auto', // Let the width be determined by content
                                                         userSelect: 'none'
                                                     }}>
            <span style={{
                display: 'flex',
                alignItems: 'center',
                fontWeight: '600'
            }}>
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '1.75rem',
                    height: '1.75rem',
                    marginRight: '0.75rem',
                    backgroundColor: 'rgba(151, 114, 89, 0.15)',
                    color: 'var(--color-bg-primary-dark)',
                    borderRadius: '50%',
                    fontSize: '0.9em',
                    fontWeight: '600'
                }}>
                    {rankedCriteria.indexOf(activeDragId) + 1}
                </span>
                {activeDragId}
            </span>
                                                    <div style={{
                                                        color: 'var(--color-bg-primary-dark)',
                                                        width: '3rem',
                                                        height: '3rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        borderRadius: '0.5rem',
                                                        backgroundColor: 'rgba(151, 114, 89, 0.08)',
                                                        marginLeft: '0.5rem'
                                                    }}>
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <circle cx="9" cy="12" r="1"/>
                                                            <circle cx="9" cy="5" r="1"/>
                                                            <circle cx="9" cy="19" r="1"/>
                                                            <circle cx="15" cy="12" r="1"/>
                                                            <circle cx="15" cy="5" r="1"/>
                                                            <circle cx="15" cy="19" r="1"/>
                                                        </svg>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </DragOverlay>
                                    </DndContext>
                                </div>
                            </div>
                            <div className="flex justify-center w-full mt-6 space-x-4">
                                <button
                                onClick={() => setStep(skippedLQL ? 0 : 1)}
                                className="px-8 py-6 text-xl bg-accent text-on-accent hover:bg-blue-600 rounded-2xl shadow-lg transition-colors"
                                >
                                <span style={{display: 'inline-block', transform: 'scaleX(-1)'}}>➜</span>
                            </button>
                                <button
                                    onClick={() => setStep(3)}
                                    className="px-8 py-6 text-xl bg-accent hover:bg-blue-600 rounded-2xl text-on-accent shadow-lg transition-colors"
                                >
                                    ➜
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div key="options" variants={fadeVariants} initial="hidden" animate="visible" exit="exit"
                                    className="flex flex-col items-center justify-center min-h-[60vh]">
                            <h2 className="wizard-heading">Configure Your Code Generation</h2>
                            <p className="wizard-text mb-6" style={{
                                textAlign: 'center',
                                width: '100%',
                                maxWidth: '1000px',
                                margin: '0 auto 1.5rem auto'
                            }}>
                                Configure the generation time, select AI models, and specify how many implementations
                                you want from each source.
                            </p>


                            {/* AI Language Models Box */}
                            <div className="space-y-4 bg-white bg-opacity-10 p-6 rounded-lg text-center">
                                <h3 className="wizard-subheading" style={{marginTop: '0.5rem', marginBottom: '1rem'}}>
                                    AI Language Models
                                </h3>

                                <div style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                                    {/* Left column */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                        marginLeft: '10%'
                                    }}>
                                        {['GPT-4o-mini', 'Deepseek-r1:latest'].map((llm) => (
                                            <div key={llm} style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-start',
                                                margin: '10px 0',
                                                minWidth: '200px'
                                            }}>
                                                <label style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    textAlign: 'left',
                                                    marginBottom: '8px'
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={llmEnabled[llm] || false}
                                                        onChange={(e) => {
                                                            setLlmEnabled(prev => ({
                                                                ...prev,
                                                                [llm]: e.target.checked
                                                            }));
                                                            if (!e.target.checked) {
                                                                setLlmVersions(prev => ({
                                                                    ...prev,
                                                                    [llm]: 0
                                                                }));
                                                            } else {
                                                                setLlmVersions(prev => ({
                                                                    ...prev,
                                                                    [llm]: 1
                                                                }));
                                                            }
                                                        }}
                                                        style={{marginRight: '10px'}}
                                                        className="h-5 w-5 rounded border-border-panel text-accent"
                                                    />
                                                    <span className="wizard-text" style={{
                                                        marginBottom: '0',
                                                        color: 'var(--color-text-primary)',
                                                        textAlign: 'left'
                                                    }}>
                                        {llm}
                                    </span>
                                                </label>

                                                {llmEnabled[llm] && (
                                                    <div style={{marginLeft: '35px'}}>
                                                        <label style={{
                                                            fontSize: '1.3rem',
                                                            opacity: '1',
                                                            marginRight: '8px'
                                                        }}>
                                                            Versions:
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="10"
                                                            value={llmVersions[llm] || 1}
                                                            onChange={(e) => setLlmVersions(prev => ({
                                                                ...prev,
                                                                [llm]: Number(e.target.value)
                                                            }))}
                                                            style={{
                                                                width: '60px',
                                                                padding: '4px',
                                                                border: '2px solid var(--color-text-primary)',
                                                                borderRadius: '4px',
                                                                backgroundColor: 'white',
                                                                color: 'var(--color-bg-primary-dark)',
                                                                textAlign: 'center',
                                                                fontFamily: '"Playfair Display", serif',
                                                                fontSize: '1rem'
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Right column */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                        marginRight: '10%'
                                    }}>
                                        {['Gemma3:27b', 'Llama 3.1-latest'].map((llm) => (
                                            <div key={llm} style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-start',
                                                margin: '10px 0',
                                                minWidth: '200px'
                                            }}>
                                                <label style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    textAlign: 'left',
                                                    marginBottom: '8px'
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={llmEnabled[llm] || false}
                                                        onChange={(e) => {
                                                            setLlmEnabled(prev => ({
                                                                ...prev,
                                                                [llm]: e.target.checked
                                                            }));
                                                            if (!e.target.checked) {
                                                                setLlmVersions(prev => ({
                                                                    ...prev,
                                                                    [llm]: 0
                                                                }));
                                                            } else {
                                                                setLlmVersions(prev => ({
                                                                    ...prev,
                                                                    [llm]: 1
                                                                }));
                                                            }
                                                        }}
                                                        style={{marginRight: '10px'}}
                                                        className="h-5 w-5 rounded border-border-panel text-accent"
                                                    />
                                                    <span className="wizard-text" style={{
                                                        marginBottom: '0',
                                                        color: 'var(--color-text-primary)',
                                                        textAlign: 'left'
                                                    }}>
                {llm}
            </span>
                                                </label>

                                                {llmEnabled[llm] && (
                                                    <div style={{marginLeft: '35px'}}>
                                                        <label style={{
                                                            fontSize: '1.3rem',
                                                            opacity: '1',
                                                            marginRight: '8px'
                                                        }}>
                                                            Versions:
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="10"
                                                            value={llmVersions[llm] || 1}
                                                            onChange={(e) => setLlmVersions(prev => ({
                                                                ...prev,
                                                                [llm]: Number(e.target.value)
                                                            }))}
                                                            style={{
                                                                width: '60px',
                                                                padding: '4px',
                                                                border: '2px solid var(--color-text-primary)',
                                                                borderRadius: '4px',
                                                                backgroundColor: 'white',
                                                                color: 'var(--color-bg-primary-dark)',
                                                                textAlign: 'center',
                                                                fontFamily: '"Playfair Display", serif',
                                                                fontSize: '1rem'
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Empty space to balance layout */}
                                        <div style={{margin: '10px 0', minHeight: '60px'}}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Code Repositories Box */}
                            <div className="space-y-4 bg-white bg-opacity-10 p-6 rounded-lg text-center">
                                <h3 className="wizard-subheading" style={{marginTop: '0.5rem', marginBottom: '1rem'}}>
                                    Code Repositories
                                </h3>

                                <div style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                                    {/* Left column */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                        marginLeft: '10%'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            margin: '10px 0',
                                            minWidth: '200px'
                                        }}>
                                            <label style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                textAlign: 'left',
                                                marginBottom: '8px'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={mavenCentralEnabled}
                                                    onChange={(e) => {
                                                        setMavenCentralEnabled(e.target.checked);
                                                        if (!e.target.checked) {
                                                            setMavenCentralVersions(0);
                                                        } else {
                                                            setMavenCentralVersions(1);
                                                        }
                                                    }}
                                                    style={{marginRight: '10px'}}
                                                    className="h-5 w-5 rounded border-border-panel text-accent"
                                                />
                                                <span className="wizard-text" style={{
                                                    marginBottom: '0',
                                                    color: 'var(--color-text-primary)',
                                                    textAlign: 'left'
                                                }}>
                                    Maven Central
                                </span>
                                            </label>

                                            {mavenCentralEnabled && (
                                                <div style={{marginLeft: '35px'}}>
                                                    <label style={{
                                                        fontSize: '1.3rem',
                                                        opacity: '1',
                                                        marginRight: '0.8px'
                                                    }}>
                                                        Versions:
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="10"
                                                        value={mavenCentralVersions}
                                                        onChange={(e) => setMavenCentralVersions(Number(e.target.value))}
                                                        style={{
                                                            width: '60px',
                                                            padding: '4px',
                                                            border: '2px solid var(--color-text-primary)',
                                                            borderRadius: '4px',
                                                            backgroundColor: 'white',
                                                            color: 'var(--color-bg-primary-dark)',
                                                            textAlign: 'center',
                                                            fontFamily: '"Playfair Display", serif',
                                                            fontSize: '1rem'
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right column */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                        marginRight: '10%'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            margin: '10px 0',
                                            minWidth: '200px',
                                            opacity: '0.5'
                                        }}>
                                            <label style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                textAlign: 'left',
                                                marginBottom: '8px'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    disabled
                                                    style={{marginRight: '10px'}}
                                                    className="h-5 w-5 rounded border-border-panel text-accent"
                                                />
                                                <span className="wizard-text" style={{
                                                    marginBottom: '0',
                                                    color: 'var(--color-text-primary)',
                                                    textAlign: 'left'
                                                }}>
                                    (Coming Soon)
                                </span>
                                            </label>
                                        </div>
                                    </div>

                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-8 text-left w-full max-w-5xl mx-auto">
                                {/* Time Configuration Box */}
                                <div className="space-y-4 bg-white bg-opacity-10 p-6 rounded-lg text-center">
                                    <h3 className="wizard-subheading"
                                        style={{marginTop: '0.5rem', marginBottom: '1rem'}}>
                                        Generation Time
                                    </h3>

                                    <div className="flex flex-col items-center space-y-4">
                                        <div className="flex items-center space-x-4">
                                            <label className="wizard-text">Maximum Time (minutes): </label>
                                            <input
                                                type="number"
                                                min={(() => {
                                                    const totalVersions = Object.values(llmVersions).reduce((sum, count) => sum + count, 0) +
                                                        (mavenCentralEnabled ? mavenCentralVersions : 0);
                                                    return Math.ceil(totalVersions * 0.5);
                                                })()}
                                                value={generationTimeMinutes}
                                                onChange={(e) => setGenerationTimeMinutes(Number(e.target.value))}
                                                className="w-24 p-3 border-2 rounded-md wizard-text bg-white text-black"
                                                style={{
                                                    fontFamily: '"Playfair Display", serif',
                                                    fontSize: '1.25rem',
                                                    textAlign: 'center'
                                                }}
                                            />
                                        </div>

                                        <div className="text-center">
                        <span className="wizard-text" style={{fontSize: '1rem', opacity: '1'}}>
                            Minimum: {(() => {
                            const totalVersions = Object.values(llmVersions).reduce((sum, count) => sum + count, 0) +
                                (mavenCentralEnabled ? mavenCentralVersions : 0);
                            return Math.ceil(totalVersions * 0.5);
                        })()} minutes (30 seconds per implementation)
                        </span>
                                        </div>

                                        {generationTimeMinutes < (() => {
                                            const totalVersions = Object.values(llmVersions).reduce((sum, count) => sum + count, 0) +
                                                (mavenCentralEnabled ? mavenCentralVersions : 0);
                                            return Math.ceil(totalVersions * 0.5);
                                        })() && (
                                            <p className="text-red-300 text-center"
                                               style={{fontSize: '1.1rem', marginRight: '10px'}}>
                                                Please allow at least 30 seconds per implementation
                                                (currently {Object.values(llmVersions).reduce((sum, count) => sum + count, 0) + (mavenCentralEnabled ? mavenCentralVersions : 0)} implementations
                                                selected)!
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Navigation buttons */}
                            <div className="flex justify-center w-full mt-6 space-x-4">
                                <button
                                    onClick={() => setStep(2)}
                                    className="px-8 py-6 text-xl bg-accent text-on-accent hover:bg-blue-600 rounded-2xl shadow-lg transition-colors"
                                >
                                    <span style={{display: 'inline-block', transform: 'scaleX(-1)'}}>➜</span>
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={generationTimeMinutes < (() => {
                                        const totalVersions = Object.values(llmVersions).reduce((sum, count) => sum + count, 0) +
                                            (mavenCentralEnabled ? mavenCentralVersions : 0);
                                        return Math.ceil(totalVersions * 0.5);
                                    })() || Object.values(llmVersions).reduce((sum, count) => sum + count, 0) + (mavenCentralEnabled ? mavenCentralVersions : 0) === 0}
                                    className={`px-8 py-6 text-xl rounded-2xl shadow-lg transition-colors ${
                                        generationTimeMinutes < (() => {
                                            const totalVersions = Object.values(llmVersions).reduce((sum, count) => sum + count, 0) +
                                                (mavenCentralEnabled ? mavenCentralVersions : 0);
                                            return Math.ceil(totalVersions * 0.5);
                                        })() || Object.values(llmVersions).reduce((sum, count) => sum + count, 0) + (mavenCentralEnabled ? mavenCentralVersions : 0) === 0
                                            ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                            : 'bg-accent text-on-accent hover:bg-blue-600'
                                    }`}
                                >
                                    ➜
                                </button>
                            </div>
                        </motion.div>
                    )}


                    {step === 4 && (
                        <motion.div key="loading" variants={fadeVariants} initial="hidden" animate="visible" exit="exit"
                                    className="flex flex-col items-center justify-center min-h-[60vh]">
                            <h2 className="wizard-heading">Creating Your Implementation</h2>
                            <p className="wizard-text mb-6">Your code is being generated based on your criteria and
                                preferences. This may take a moment...</p>

                            {!error && (
                                <div className="flex justify-center items-center mb-8">
                                    <div
                                        style={{
                                            width: '8rem',
                                            height: '8rem',
                                            border: '6px solid rgba(249, 250, 251, 0.2)',
                                            borderTop: '6px solid var(--color-text-primary)',
                                            borderRadius: '50%',
                                            animation: 'simpleSpin 2s linear infinite',
                                            margin: '0 auto'
                                        }}
                                    />
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-6 max-w-2xl">
                                    <h3 className="font-bold text-lg mb-2">Generation Error</h3>
                                    <p>{error}</p>
                                    <button
                                        onClick={() => setStep(3)}
                                        className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                    >
                                        Go Back and Try Again
                                    </button>
                                </div>
                            )}

                            <style jsx>{`
            @keyframes simpleSpin {
                from {
                    transform: rotate(0deg);
                }
                to {
                    transform: rotate(360deg);
                }
            }
        `}</style>
                        </motion.div>
                    )}


                    {step === 5 && (
                        <motion.div key="result" variants={fadeVariants} initial="hidden" animate="visible" exit="exit"
                                    ref={resultsRef}
                                    className="py-8">

                            {/* Implementation selector buttons with improved active state handling */}
                            <div
                                style={{
                                    position: 'relative',
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginBottom: '2rem',
                                    marginTop: '2rem'
                                }}
                            >
                                {results && [results.bestImplementation, ...results.otherImplementations].map((impl, idx) => {
                                    const isActive = activeResultIndex === idx;

                                    return (
                                        <button
                                            key={`impl-${idx}`}
                                            onClick={() => setActiveResultIndex(idx)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                minWidth: '4.5rem',
                                                minHeight: '4.5rem',
                                                width: '4.5rem',
                                                height: '4.5rem',
                                                margin: '0 0.75rem',
                                                padding: 0,
                                                backgroundColor: isActive ? '#f9fafb' : '#967259',
                                                color: isActive ? '#967259' : '#f9fafb',
                                                border: '2px solid #f9fafb',
                                                borderRadius: '0.75rem',
                                                fontSize: '1.5rem',
                                                fontFamily: '"Playfair Display", serif',
                                                transition: 'all 0.2s ease',
                                                boxShadow: isActive
                                                    ? '0 6px 12px rgba(0, 0, 0, 0.25)'
                                                    : '0 4px 8px rgba(0, 0, 0, 0.2)',
                                                transform: isActive ? 'translateY(-2px)' : 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {idx + 1}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* CodeDisplay with proper container and styling */}
                            <div id="code-display-container">
                                <CodeDisplay result={currentResult}/>
                            </div>

                            {/* Add a restart button */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                marginTop: '2.5rem'
                            }}>
                                <button
                                    onClick={() => setStep(0)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minWidth: '8rem',
                                        minHeight: '4.5rem',
                                        padding: '0 1.5rem',
                                        backgroundColor: '#967259',
                                        color: '#f9fafb',
                                        border: '2px solid #f9fafb',
                                        borderRadius: '0.75rem',
                                        fontSize: '1.5rem',
                                        fontFamily: '"Playfair Display", serif',
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Start Over
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default WizardInterface;