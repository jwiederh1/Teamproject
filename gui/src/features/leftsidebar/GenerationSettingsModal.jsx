import React, { useState, useEffect } from 'react';
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
import SortableItem from './SortableItem.jsx';

const GenerationSettingsModal = ({ settings, onSave, onClose, hasGeneratedCode = false }) => {
    const [step, setStep] = useState(1);
    const [localSettings, setLocalSettings] = useState({
        ...settings,
        // Add test-related settings with defaults
        use_testGen_gpt: settings.use_testGen_gpt !== undefined ? settings.use_testGen_gpt : true, // Default true
        use_testGen_ollama: settings.use_testGen_ollama || false,
        samples_LLM_testGen: settings.samples_LLM_testGen || 1,
        model_testGen: settings.model_testGen || "gemma3:27b",
        use_random_testGen: settings.use_random_testGen || false,
        samples_random_testGen: settings.samples_random_testGen || 1,
        use_type_aware_testGen: settings.use_type_aware_testGen || false,
        samples_type_aware_testGen: settings.samples_type_aware_testGen || 5,
        use_nicad: settings.use_nicad || false,
        features: settings.features || "cc"
    });
    const [selectedCriteria, setSelectedCriteria] = useState(
        ['Efficiency', 'Readability', 'Security', 'Maintainability',
            'Scalability', 'Modularity', 'Performance', 'Testability']
            .filter(c => localSettings.rankedCriteria.includes(c))
    );
    const [activeDragId, setActiveDragId] = useState(null);
    const [hoveredTooltip, setHoveredTooltip] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const allCriteria = [
        'Efficiency', 'Readability', 'Security', 'Maintainability',
        'Scalability', 'Modularity', 'Performance', 'Testability'
    ];

    // Available Ollama models for test generation
    const ollamaModels = ["gemma3:27b", "llama3.1:latest", "deepseek-r1:latest"];

    // Tooltip explanations
    const tooltips = {
        use_testGen_gpt: "Use GPT-4 to automatically generate test cases for your code implementations",
        use_testGen_ollama: "Use local Ollama models to generate test cases (requires an Ollama model to be enabled)",
        samples_LLM_testGen: "Number of test sets to generate using the selected AI model",
        model_testGen: "Which Ollama model to use for test generation (only applies when using Ollama)",
        use_random_testGen: "Generate random test cases based on method signatures and types",
        samples_random_testGen: "Number of random test sets to create",
        use_type_aware_testGen: "Generate additional tests using type information (requires existing tests as a base)",
        samples_type_aware_testGen: "Number of type-aware test sets to generate",
        use_nicad: "Use NiCad tool to detect and remove duplicate code candidates (recommended for Maven Central searches)",
        features_cc: "Code Coverage Analysis - measures how much of your code is tested",
        features_mutation: "Mutation Testing - introduces small changes to test the quality of your tests"
    };

    // Calculate minimum time and total candidates
    const calculateConstraints = () => {
        const enabledLLMs = Object.keys(localSettings.llmEnabled).filter(llm => localSettings.llmEnabled[llm]);
        const totalLLMVersions = Object.values(localSettings.llmVersions).reduce((sum, versions) => sum + versions, 0);
        const mavenVersions = localSettings.mavenCentralEnabled ? localSettings.mavenCentralVersions : 0;

        const minimumTime = Math.max(2, 1 + enabledLLMs.length); // Base 2 minutes, +1 per additional LLM
        const totalCandidates = totalLLMVersions + mavenVersions;

        return {
            minimumTime,
            totalCandidates,
            enabledLLMs: enabledLLMs.length
        };
    };

    const constraints = calculateConstraints();

    // Validation for test settings
    const validateTestSettings = () => {
        const errors = [];

        // Check if Ollama test generation is enabled but no compatible model is selected
        if (localSettings.use_testGen_ollama) {
            const hasCompatibleModel = ollamaModels.some(model => localSettings.llmEnabled[model]);
            if (!hasCompatibleModel) {
                errors.push("Ollama test generation requires one of these models to be enabled: " + ollamaModels.join(", "));
            }
        }

        // Check if type-aware tests need a base
        if (localSettings.use_type_aware_testGen) {
            const hasBase = localSettings.use_testGen_gpt ||
                localSettings.use_testGen_ollama ||
                localSettings.use_random_testGen;
            if (!hasBase) {
                errors.push("Type-aware test generation needs a base set of tests. Enable GPT tests, Ollama tests, or random tests first.");
            }
        }

        // NEW VALIDATION: If no user-provided tests, at least one test generation method must be enabled
        const hasUserProvidedTests = false; // We don't have access to user tests in this modal
        const hasTestGeneration = localSettings.use_testGen_gpt ||
            localSettings.use_testGen_ollama ||
            localSettings.use_random_testGen;

        if (!hasUserProvidedTests && !hasTestGeneration) {
            errors.push("Since no manual tests are provided, you must enable at least one automatic test generation method (GPT, Ollama, or Random).");
        }

        return errors;
    };

    // Auto-adjust time when LLMs change
    useEffect(() => {
        const { minimumTime } = calculateConstraints();
        if (localSettings.generationTimeMinutes < minimumTime) {
            setLocalSettings(prev => ({
                ...prev,
                generationTimeMinutes: minimumTime
            }));
        }
    }, [localSettings.llmEnabled, localSettings.llmVersions]);

    const handleCriteriaToggle = (criterion) => {
        if (selectedCriteria.includes(criterion)) {
            setSelectedCriteria(prev => prev.filter(c => c !== criterion));
            setLocalSettings(prev => ({
                ...prev,
                rankedCriteria: prev.rankedCriteria.filter(c => c !== criterion)
            }));
        } else {
            setSelectedCriteria(prev => [...prev, criterion]);
            setLocalSettings(prev => ({
                ...prev,
                rankedCriteria: [...prev.rankedCriteria, criterion]
            }));
        }
    };

    const handleDragEnd = ({ active, over }) => {
        if (over && active.id !== over.id) {
            setLocalSettings(prev => ({
                ...prev,
                rankedCriteria: arrayMove(
                    prev.rankedCriteria,
                    prev.rankedCriteria.indexOf(active.id),
                    prev.rankedCriteria.indexOf(over.id)
                )
            }));
        }
        setActiveDragId(null);
    };

    const handleLLMToggle = (llm) => {
        if (hasGeneratedCode) return; // Prevent changes after generation

        const newEnabledState = !localSettings.llmEnabled[llm];
        const newVersions = newEnabledState ? 1 : 0;

        // Check if this would exceed 10 candidates
        const currentTotalWithoutThis = Object.keys(localSettings.llmVersions)
            .filter(key => key !== llm)
            .reduce((sum, key) => sum + (localSettings.llmEnabled[key] ? localSettings.llmVersions[key] : 0), 0);

        const mavenVersions = localSettings.mavenCentralEnabled ? localSettings.mavenCentralVersions : 0;
        const wouldExceedLimit = (currentTotalWithoutThis + newVersions + mavenVersions) > 10;

        if (newEnabledState && wouldExceedLimit) {
            return; // Don't allow if it would exceed limit
        }

        setLocalSettings(prev => {
            const newSettings = {
                ...prev,
                llmEnabled: {
                    ...prev.llmEnabled,
                    [llm]: newEnabledState
                },
                llmVersions: {
                    ...prev.llmVersions,
                    [llm]: newVersions
                }
            };

            // Auto-disable Ollama test generation if no compatible models are enabled
            if (!newEnabledState && ollamaModels.includes(llm)) {
                const stillHasCompatible = ollamaModels.some(model =>
                    model !== llm && newSettings.llmEnabled[model]
                );
                if (!stillHasCompatible) {
                    newSettings.use_testGen_ollama = false;
                }
            }

            return newSettings;
        });
    };

    const handleVersionChange = (llm, versions) => {
        if (hasGeneratedCode) return; // Prevent changes after generation

        const newVersions = parseInt(versions) || 0;

        // Check if this would exceed 10 candidates
        const currentTotalWithoutThis = Object.keys(localSettings.llmVersions)
            .filter(key => key !== llm)
            .reduce((sum, key) => sum + localSettings.llmVersions[key], 0);

        const mavenVersions = localSettings.mavenCentralEnabled ? localSettings.mavenCentralVersions : 0;
        const wouldExceedLimit = (currentTotalWithoutThis + newVersions + mavenVersions) > 10;

        if (wouldExceedLimit) {
            return; // Don't allow if it would exceed limit
        }

        setLocalSettings(prev => ({
            ...prev,
            llmVersions: {
                ...prev.llmVersions,
                [llm]: newVersions
            }
        }));
    };

    const handleMavenToggle = () => {
        if (hasGeneratedCode) return; // Prevent changes after generation

        const newEnabledState = !localSettings.mavenCentralEnabled;
        const newVersions = newEnabledState ? 1 : 0;

        // Check if this would exceed 10 candidates
        const llmVersionsTotal = Object.values(localSettings.llmVersions).reduce((sum, versions) => sum + versions, 0);
        const wouldExceedLimit = (llmVersionsTotal + newVersions) > 10;

        if (newEnabledState && wouldExceedLimit) {
            return; // Don't allow if it would exceed limit
        }

        setLocalSettings(prev => ({
            ...prev,
            mavenCentralEnabled: newEnabledState,
            mavenCentralVersions: newVersions
        }));
    };

    const handleMavenVersionChange = (versions) => {
        if (hasGeneratedCode) return; // Prevent changes after generation

        const newVersions = parseInt(versions) || 0;

        // Check if this would exceed 10 candidates
        const llmVersionsTotal = Object.values(localSettings.llmVersions).reduce((sum, versions) => sum + versions, 0);
        const wouldExceedLimit = (llmVersionsTotal + newVersions) > 10;

        if (wouldExceedLimit) {
            return; // Don't allow if it would exceed limit
        }

        setLocalSettings(prev => ({
            ...prev,
            mavenCentralVersions: newVersions
        }));
    };

    const handleTimeChange = (time) => {
        const newTime = parseInt(time) || 1;
        const { minimumTime } = calculateConstraints();

        setLocalSettings(prev => ({
            ...prev,
            generationTimeMinutes: Math.max(newTime, minimumTime)
        }));
    };

    // Test generation handlers
    const handleTestGenGptToggle = () => {
        const newValue = !localSettings.use_testGen_gpt;

        // Check if turning off GPT would leave no test generation methods
        if (!newValue) {
            const wouldHaveNoTestGen = !localSettings.use_testGen_ollama && !localSettings.use_random_testGen;
            if (wouldHaveNoTestGen) {
                // Don't allow turning off if it would leave no test generation
                alert("At least one test generation method must be enabled since no manual tests are provided.");
                return;
            }
        }

        setLocalSettings(prev => ({
            ...prev,
            use_testGen_gpt: newValue,
            // Ensure only one of GPT or Ollama is enabled
            use_testGen_ollama: newValue ? false : prev.use_testGen_ollama
        }));
    };

    const handleTestGenOllamaToggle = () => {
        const hasCompatibleModel = ollamaModels.some(model => localSettings.llmEnabled[model]);
        if (!hasCompatibleModel && !localSettings.use_testGen_ollama) {
            return; // Don't allow enabling if no compatible model
        }

        const newValue = !localSettings.use_testGen_ollama;

        // Check if turning off Ollama would leave no test generation methods
        if (!newValue) {
            const wouldHaveNoTestGen = !localSettings.use_testGen_gpt && !localSettings.use_random_testGen;
            if (wouldHaveNoTestGen) {
                // Don't allow turning off if it would leave no test generation
                alert("At least one test generation method must be enabled since no manual tests are provided.");
                return;
            }
        }

        setLocalSettings(prev => ({
            ...prev,
            use_testGen_ollama: newValue,
            // Ensure only one of GPT or Ollama is enabled
            use_testGen_gpt: newValue ? false : prev.use_testGen_gpt
        }));
    };

    const handleRandomTestToggle = () => {
        const newValue = !localSettings.use_random_testGen;

        // Check if turning off random would leave no test generation methods
        if (!newValue) {
            const wouldHaveNoTestGen = !localSettings.use_testGen_gpt && !localSettings.use_testGen_ollama;
            if (wouldHaveNoTestGen) {
                // Don't allow turning off if it would leave no test generation
                alert("At least one test generation method must be enabled since no manual tests are provided.");
                return;
            }
        }

        setLocalSettings(prev => ({
            ...prev,
            use_random_testGen: newValue
        }));
    };

    const handleSave = () => {
        const testErrors = validateTestSettings();
        if (testErrors.length > 0) {
            alert("Please fix the following issues:\n\n" + testErrors.join("\n"));
            return;
        }

        onSave(localSettings);
        onClose();
    };

    const Tooltip = ({ id, children }) => (
        <div className="tooltip-container">
            {children}
            <button
                className="tooltip-trigger"
                onMouseEnter={() => setHoveredTooltip(id)}
                onMouseLeave={() => setHoveredTooltip(null)}
                onClick={(e) => e.preventDefault()}
            >
                ?
            </button>
            {hoveredTooltip === id && (
                <div className="tooltip-content">
                    {tooltips[id]}
                </div>
            )}
        </div>
    );

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="settings-modal">
                <div className="modal-header">
                    <h2>Generation Settings</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <div className="modal-content">
                    {step === 1 && (
                        <div className="step-content">
                            <h3>Step 1: Prioritize Your Implementation Criteria</h3>
                            <p>Select and rank which qualities matter most for your code implementation.</p>

                            <div className="criteria-grid">
                                <div className="criteria-selection">
                                    <h4>Available Criteria</h4>
                                    <div className="criteria-list">
                                        {allCriteria.map(criterion => (
                                            <label key={criterion} className="criteria-item">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCriteria.includes(criterion)}
                                                    onChange={() => handleCriteriaToggle(criterion)}
                                                />
                                                <span>{criterion}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="criteria-ranking">
                                    <h4>Drag to Rank</h4>
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragStart={({ active }) => setActiveDragId(active.id)}
                                        onDragEnd={handleDragEnd}
                                        onDragCancel={() => setActiveDragId(null)}
                                    >
                                        <SortableContext
                                            items={localSettings.rankedCriteria}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="sortable-list">
                                                {localSettings.rankedCriteria.map((item, index) => (
                                                    <SortableItem key={item} id={item} index={index} />
                                                ))}
                                            </div>
                                        </SortableContext>
                                        <DragOverlay>
                                            {activeDragId ? (
                                                <div className="drag-overlay-item">
                                                    <span data-rank={localSettings.rankedCriteria.indexOf(activeDragId) + 1}>
                                                        {activeDragId}
                                                    </span>
                                                    <div className="drag-handle">
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <circle cx="9" cy="12" r="1" />
                                                            <circle cx="9" cy="5" r="1" />
                                                            <circle cx="9" cy="19" r="1" />
                                                            <circle cx="15" cy="12" r="1" />
                                                            <circle cx="15" cy="5" r="1" />
                                                            <circle cx="15" cy="19" r="1" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </DragOverlay>
                                    </DndContext>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="step-content">
                            <h3>Step 2: Configure Your Code Generation</h3>
                            <p>
                                {hasGeneratedCode
                                    ? "After generation, you can only modify the time limit and ranking criteria."
                                    : "Select AI models and specify how many implementations you want from each source."
                                }
                            </p>

                            {!hasGeneratedCode && (
                                <div className="constraints-info">
                                    <div className="constraint-item">
                                        <strong>Time Requirement:</strong> Minimum {constraints.minimumTime} minutes
                                        ({constraints.enabledLLMs} LLM{constraints.enabledLLMs !== 1 ? 's' : ''} selected: 2 base + {constraints.enabledLLMs - 1} additional)
                                    </div>
                                    <div className="constraint-item">
                                        <strong>Code Candidates:</strong> {constraints.totalCandidates}/10 maximum allowed
                                        {constraints.totalCandidates > 10 && (
                                            <span className="error-text"> - Exceeds limit!</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="generation-options">
                                <div className="option-section">
                                    <h4>AI Language Models</h4>
                                    {hasGeneratedCode && (
                                        <p className="disabled-notice">LLM selection is locked after first generation</p>
                                    )}
                                    <div className="llm-grid">
                                        {Object.keys(localSettings.llmEnabled).map(llm => (
                                            <div key={llm} className={`llm-item ${hasGeneratedCode ? 'disabled' : ''}`}>
                                                <label className="llm-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={localSettings.llmEnabled[llm]}
                                                        onChange={() => handleLLMToggle(llm)}
                                                        disabled={hasGeneratedCode}
                                                    />
                                                    <span>{llm}</span>
                                                </label>
                                                {localSettings.llmEnabled[llm] && (
                                                    <div className="version-selector">
                                                        <label>Versions:</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="10"
                                                            value={localSettings.llmVersions[llm]}
                                                            onChange={(e) => handleVersionChange(llm, e.target.value)}
                                                            disabled={hasGeneratedCode}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="option-section">
                                    <h4>Code Repositories</h4>
                                    {hasGeneratedCode && (
                                        <p className="disabled-notice">Repository selection is locked after first generation</p>
                                    )}
                                    <div className={`repository-item ${hasGeneratedCode ? 'disabled' : ''}`}>
                                        <label className="repository-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={localSettings.mavenCentralEnabled}
                                                onChange={handleMavenToggle}
                                                disabled={hasGeneratedCode}
                                            />
                                            <span>Maven Central</span>
                                        </label>
                                        {localSettings.mavenCentralEnabled && (
                                            <div className="version-selector">
                                                <label>Versions:</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="10"
                                                    value={localSettings.mavenCentralVersions}
                                                    onChange={(e) => handleMavenVersionChange(e.target.value)}
                                                    disabled={hasGeneratedCode}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="option-section">
                                    <h4>Generation Time</h4>
                                    <div className="time-setting">
                                        <label>Maximum Time (minutes):</label>
                                        <input
                                            type="number"
                                            min={constraints.minimumTime}
                                            max="60"
                                            value={localSettings.generationTimeMinutes}
                                            onChange={(e) => handleTimeChange(e.target.value)}
                                        />
                                        <small className="time-help">
                                            Minimum: {constraints.minimumTime} minutes
                                        </small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="step-content">
                            <h3>Step 3: Configure Test Generation & Analysis</h3>
                            <p>Set up how tests should be generated and what analysis to perform on your code.</p>

                            <div className="test-options">
                                <div className="option-section">
                                    <h4>Automatic Test Generation</h4>

                                    <div className="test-option-item">
                                        <Tooltip id="use_testGen_gpt">
                                            <label className="test-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={localSettings.use_testGen_gpt}
                                                    onChange={handleTestGenGptToggle}
                                                />
                                                <span>GPT Test Generation</span>
                                            </label>
                                        </Tooltip>
                                        {localSettings.use_testGen_gpt && (
                                            <div className="test-config">
                                                <Tooltip id="samples_LLM_testGen">
                                                    <label>Test Sets:</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="10"
                                                        value={localSettings.samples_LLM_testGen}
                                                        onChange={(e) => setLocalSettings(prev => ({
                                                            ...prev,
                                                            samples_LLM_testGen: parseInt(e.target.value) || 1
                                                        }))}
                                                    />
                                                </Tooltip>
                                            </div>
                                        )}
                                    </div>

                                    <div className="test-option-item">
                                        <Tooltip id="use_testGen_ollama">
                                            <label className="test-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={localSettings.use_testGen_ollama}
                                                    onChange={handleTestGenOllamaToggle}
                                                    disabled={!ollamaModels.some(model => localSettings.llmEnabled[model])}
                                                />
                                                <span>Ollama Test Generation</span>
                                            </label>
                                        </Tooltip>
                                        {localSettings.use_testGen_ollama && (
                                            <div className="test-config">
                                                <Tooltip id="model_testGen">
                                                    <label>Model:</label>
                                                    <select
                                                        value={localSettings.model_testGen}
                                                        onChange={(e) => setLocalSettings(prev => ({
                                                            ...prev,
                                                            model_testGen: e.target.value
                                                        }))}
                                                    >
                                                        {ollamaModels.filter(model => localSettings.llmEnabled[model]).map(model => (
                                                            <option key={model} value={model}>{model}</option>
                                                        ))}
                                                    </select>
                                                </Tooltip>
                                                <Tooltip id="samples_LLM_testGen">
                                                    <label>Test Sets:</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="10"
                                                        value={localSettings.samples_LLM_testGen}
                                                        onChange={(e) => setLocalSettings(prev => ({
                                                            ...prev,
                                                            samples_LLM_testGen: parseInt(e.target.value) || 1
                                                        }))}
                                                    />
                                                </Tooltip>
                                            </div>
                                        )}
                                        {!ollamaModels.some(model => localSettings.llmEnabled[model]) && (
                                            <small className="helper-text">Requires an Ollama model to be enabled in Step 2</small>
                                        )}
                                    </div>

                                    <div className="test-option-item">
                                        <Tooltip id="use_random_testGen">
                                            <label className="test-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={localSettings.use_random_testGen}
                                                    onChange={handleRandomTestToggle}
                                                />
                                                <span>Random Test Generation</span>
                                            </label>
                                        </Tooltip>
                                        {localSettings.use_random_testGen && (
                                            <div className="test-config">
                                                <Tooltip id="samples_random_testGen">
                                                    <label>Test Sets:</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="10"
                                                        value={localSettings.samples_random_testGen}
                                                        onChange={(e) => setLocalSettings(prev => ({
                                                            ...prev,
                                                            samples_random_testGen: parseInt(e.target.value) || 1
                                                        }))}
                                                    />
                                                </Tooltip>
                                            </div>
                                        )}
                                    </div>

                                    <div className="test-option-item">
                                        <Tooltip id="use_type_aware_testGen">
                                            <label className="test-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={localSettings.use_type_aware_testGen}
                                                    onChange={(e) => setLocalSettings(prev => ({
                                                        ...prev,
                                                        use_type_aware_testGen: e.target.checked
                                                    }))}
                                                    disabled={!localSettings.use_testGen_gpt &&
                                                        !localSettings.use_testGen_ollama &&
                                                        !localSettings.use_random_testGen}
                                                />
                                                <span>Type-Aware Test Generation</span>
                                            </label>
                                        </Tooltip>
                                        {localSettings.use_type_aware_testGen && (
                                            <div className="test-config">
                                                <Tooltip id="samples_type_aware_testGen">
                                                    <label>Test Sets:</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="10"
                                                        value={localSettings.samples_type_aware_testGen}
                                                        onChange={(e) => setLocalSettings(prev => ({
                                                            ...prev,
                                                            samples_type_aware_testGen: parseInt(e.target.value) || 5
                                                        }))}
                                                    />
                                                </Tooltip>
                                            </div>
                                        )}
                                        {!localSettings.use_testGen_gpt &&
                                            !localSettings.use_testGen_ollama &&
                                            !localSettings.use_random_testGen && (
                                                <small className="helper-text">Requires at least one other test generation method</small>
                                            )}
                                    </div>
                                </div>

                                <div className="option-section">
                                    <h4>Code Analysis</h4>

                                    <div className="analysis-option">
                                        <label>Analysis Type:</label>
                                        <div className="radio-group">
                                            <Tooltip id="features_cc">
                                                <label className="radio-option">
                                                    <input
                                                        type="radio"
                                                        name="features"
                                                        value="cc"
                                                        checked={localSettings.features === "cc"}
                                                        onChange={(e) => setLocalSettings(prev => ({
                                                            ...prev,
                                                            features: e.target.value
                                                        }))}
                                                    />
                                                    <span>Code Coverage</span>
                                                </label>
                                            </Tooltip>
                                            <Tooltip id="features_mutation">
                                                <label className="radio-option">
                                                    <input
                                                        type="radio"
                                                        name="features"
                                                        value="mutation"
                                                        checked={localSettings.features === "mutation"}
                                                        onChange={(e) => setLocalSettings(prev => ({
                                                            ...prev,
                                                            features: e.target.value
                                                        }))}
                                                    />
                                                    <span>Mutation Testing</span>
                                                </label>
                                            </Tooltip>
                                        </div>
                                    </div>

                                    <div className="test-option-item">
                                        <Tooltip id="use_nicad">
                                            <label className="test-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={localSettings.use_nicad}
                                                    onChange={(e) => setLocalSettings(prev => ({
                                                        ...prev,
                                                        use_nicad: e.target.checked
                                                    }))}
                                                />
                                                <span>Use NiCad Clone Detection</span>
                                            </label>
                                        </Tooltip>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    {step === 1 && (
                        <>
                            <button type="button" className="cancel-button" onClick={onClose}>Cancel</button>
                            <button type="button" className="next-button" onClick={() => setStep(2)}>Next →</button>
                        </>
                    )}
                    {step === 2 && (
                        <>
                            <button type="button" className="back-button" onClick={() => setStep(1)}>← Back</button>
                            <button type="button" className="next-button" onClick={() => setStep(3)}>Next →</button>
                        </>
                    )}
                    {step === 3 && (
                        <>
                            <button type="button" className="back-button" onClick={() => setStep(2)}>← Back</button>
                            <button
                                type="button"
                                className="save-button"
                                onClick={handleSave}
                                disabled={constraints.totalCandidates > 10}
                            >
                                Save Settings
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GenerationSettingsModal;