import React, { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableItem from "./SortableItem.jsx";
import CustomDragOverlay from "./DragOverlay.jsx";

/**
 * A multi-step modal for configuring code generation settings.
 * It allows users to rank criteria, select LLMs and repositories, set time limits,
 * and configure automatic test generation.
 * @param {object} props - The component props.
 * @param {object} props.settings - The initial generation settings object.
 * @param {function} props.onSave - Callback function to save the updated settings.
 * @param {function} props.onClose - Callback function to close the modal without saving.
 * @param {boolean} [props.hasGeneratedCode=false] - If true, certain options are disabled as they cannot be changed after the first generation.
 * @returns {JSX.Element} The rendered modal component.
 */
const GenerationSettingsModal = ({
                                   settings,
                                   onSave,
                                   onClose,
                                   hasGeneratedCode = false,
                                 }) => {
  const [step, setStep] = useState(1);
  const [localSettings, setLocalSettings] = useState({
    ...settings,
    llmEnabled: {
      "GPT-4o-mini": true,
      "deepseek-r1:latest": false,
      "gemma3:27b": true,
      "Llama 3.1-latest": false,
    },
    llmVersions: {
      ...settings.llmVersions,
      "GPT-4o-mini": settings.llmVersions["GPT-4o-mini"] || 1,
      "gemma3:27b": settings.llmVersions["gemma3:27b"] || 1,
    },
    use_testGen_ollama: true,
    samples_LLM_testGen: settings.samples_LLM_testGen || 1,
    model_testGen: settings.model_testGen || "gemma3:27b",
    use_random_testGen: settings.use_random_testGen || false,
    samples_random_testGen: settings.samples_random_testGen || 1,
    use_type_aware_testGen: settings.use_type_aware_testGen || false,
    samples_type_aware_testGen: settings.samples_type_aware_testGen || 5,
    use_nicad: settings.use_nicad || false,
    features: settings.features || "cc",
  });
  const [selectedCriteria, setSelectedCriteria] = useState(
      [
        "Efficiency",
        "Readability",
        "Security",
        "Maintainability",
        "Scalability",
        "Modularity",
        "Performance",
        "Testability",
      ].filter((c) => localSettings.rankedCriteria.includes(c)),
  );
  const [activeDragId, setActiveDragId] = useState(null);
  const [hoveredTooltip, setHoveredTooltip] = useState(null);

  const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 5,
        },
      }),
  );

  const allCriteria = [
    "Efficiency",
    "Readability",
    "Security",
    "Maintainability",
    "Scalability",
    "Modularity",
    "Performance",
    "Testability",
  ];

  const ollamaModels = ["gemma3:27b", "llama3.1:latest", "deepseek-r1:latest"];

  const tooltips = {
    use_testGen_ollama:
        "Use local Ollama models to generate test cases (requires a compatible model to be enabled in Step 2)",
    samples_LLM_testGen:
        "Number of test sets to generate using the selected AI model",
    model_testGen:
        "Which Ollama model to use for test generation (only applies when using Ollama)",
    use_random_testGen:
        "Generate random test cases based on method signatures and types",
    samples_random_testGen: "Number of random test sets to create",
    use_type_aware_testGen:
        "Generate additional tests using type information (requires existing tests as a base)",
    samples_type_aware_testGen: "Number of type-aware test sets to generate",
    use_nicad:
        "Use NiCad tool to detect and remove duplicate code candidates (recommended for Maven Central searches)",
    features_cc:
        "Code Coverage Analysis - measures how much of your code is tested",
    features_mutation:
        "Mutation Testing - introduces small changes to test the quality of your tests",
  };

  /**
   * Calculates constraints for generation, such as minimum time and total candidate count.
   * @returns {{minimumTime: number, totalCandidates: number, enabledLLMs: number}} The calculated constraints.
   */
  const calculateConstraints = () => {
    const enabledLLMs = Object.keys(localSettings.llmEnabled).filter(
        (llm) => localSettings.llmEnabled[llm],
    );
    const totalLLMVersions = enabledLLMs.reduce(
        (sum, llm) => sum + (localSettings.llmVersions[llm] || 0),
        0,
    );
    const mavenVersions = localSettings.mavenCentralEnabled
        ? localSettings.mavenCentralVersions
        : 0;
    const minimumTime = Math.max(2, 1 + enabledLLMs.length);
    const totalCandidates = totalLLMVersions + mavenVersions;
    return { minimumTime, totalCandidates, enabledLLMs: enabledLLMs.length };
  };

  const constraints = calculateConstraints();

  /**
   * Validates the test settings to ensure they are logical and complete.
   * @returns {string[]} An array of error messages, if any.
   */
  const validateTestSettings = () => {
    const errors = [];
    if (localSettings.use_testGen_ollama) {
      const hasCompatibleModel = ollamaModels.some(
          (model) => localSettings.llmEnabled[model],
      );
      if (!hasCompatibleModel) {
        errors.push(
            "Ollama test generation requires one of these models to be enabled: " +
            ollamaModels.join(", "),
        );
      }
    }
    if (localSettings.use_type_aware_testGen) {
      const hasBase =
          localSettings.use_testGen_ollama || localSettings.use_random_testGen;
      if (!hasBase) {
        errors.push(
            "Type-aware test generation needs a base set of tests. Enable Ollama or Random tests first.",
        );
      }
    }
    const hasTestGeneration =
        localSettings.use_testGen_ollama || localSettings.use_random_testGen;
    if (!hasTestGeneration) {
      errors.push(
          "You must enable at least one automatic test generation method (Ollama or Random).",
      );
    }
    return errors;
  };

  useEffect(() => {
    const { minimumTime } = calculateConstraints();
    if (localSettings.generationTimeMinutes < minimumTime) {
      setLocalSettings((prev) => ({
        ...prev,
        generationTimeMinutes: minimumTime,
      }));
    }
  }, [localSettings.llmEnabled]);

  /**
   * Toggles the selection state of a ranking criterion.
   * @param {string} criterion - The name of the criterion to toggle.
   */
  const handleCriteriaToggle = (criterion) => {
    const isSelected = selectedCriteria.includes(criterion);
    setSelectedCriteria(
        isSelected
            ? (prev) => prev.filter((c) => c !== criterion)
            : (prev) => [...prev, criterion],
    );
    setLocalSettings((prev) => ({
      ...prev,
      rankedCriteria: isSelected
          ? prev.rankedCriteria.filter((c) => c !== criterion)
          : [...prev.rankedCriteria, criterion],
    }));
  };

  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragOver = ({ active, over }) => {
    if (over && active.id !== over.id) {
      const overIndex = localSettings.rankedCriteria.indexOf(over.id);
      setDragOverIndex(overIndex);
    }
  };

  /**
   * Handles the end of a drag-and-drop operation for ranking criteria.
   * @param {object} event - The drag end event from dnd-kit.
   * @param {object} event.active - The dragged item.
   * @param {object} event.over - The drop target.
   */
  const handleDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setLocalSettings((prev) => ({
        ...prev,
        rankedCriteria: arrayMove(
            prev.rankedCriteria,
            prev.rankedCriteria.indexOf(active.id),
            prev.rankedCriteria.indexOf(over.id),
        ),
      }));
    }
    setActiveDragId(null);
    setDragOverIndex(null);
  };

  const getPreviewRank = () => {
    if (!activeDragId || dragOverIndex === null) {
      return localSettings.rankedCriteria.indexOf(activeDragId) + 1;
    }
    return dragOverIndex + 1;
  };

  const getItemPreviewRank = (itemId, itemIndex) => {
    if (!activeDragId || dragOverIndex === null) {
      return itemIndex + 1;
    }

    const draggedIndex = localSettings.rankedCriteria.indexOf(activeDragId);

    if (itemId === activeDragId) {
      return itemIndex + 1;
    }

    if (draggedIndex < dragOverIndex) {
      if (itemIndex > draggedIndex && itemIndex <= dragOverIndex) {
        return itemIndex;
      }
    } else if (draggedIndex > dragOverIndex) {
      if (itemIndex >= dragOverIndex && itemIndex < draggedIndex) {
        return itemIndex + 2;
      }
    }

    return itemIndex + 1;
  };

  /**
   * Toggles the enabled state of a specific Large Language Model.
   * @param {string} llm - The name of the LLM to toggle.
   */
  const handleLLMToggle = (llm) => {
    if (hasGeneratedCode) return;

    const newEnabledState = !localSettings.llmEnabled[llm];
    const newVersions = newEnabledState ? 1 : 0;
    const currentTotal = calculateConstraints().totalCandidates;
    const change =
        newVersions -
        (localSettings.llmEnabled[llm] ? localSettings.llmVersions[llm] : 0);

    if (currentTotal + change > 10) return;

    setLocalSettings((prev) => {
      const newSettings = {
        ...prev,
        llmEnabled: { ...prev.llmEnabled, [llm]: newEnabledState },
        llmVersions: { ...prev.llmVersions, [llm]: newVersions },
      };
      if (!newEnabledState && ollamaModels.includes(llm)) {
        if (
            !ollamaModels.some(
                (model) => model !== llm && newSettings.llmEnabled[model],
            )
        ) {
          newSettings.use_testGen_ollama = false;
        }
      }
      return newSettings;
    });
  };

  /**
   * Changes the number of versions to generate for a specific LLM.
   * @param {string} llm - The name of the LLM.
   * @param {number|string} versions - The new number of versions.
   */
  const handleVersionChange = (llm, versions) => {
    if (hasGeneratedCode) return;
    const newVersions = parseInt(versions) || 0;
    const currentTotal = calculateConstraints().totalCandidates;
    const change = newVersions - localSettings.llmVersions[llm];
    if (currentTotal + change > 10) return;
    setLocalSettings((prev) => ({
      ...prev,
      llmVersions: { ...prev.llmVersions, [llm]: newVersions },
    }));
  };

  /**
   * Toggles the enabled state of Maven Central as a code source.
   */
  const handleMavenToggle = () => {
    if (hasGeneratedCode) return;
    const newEnabledState = !localSettings.mavenCentralEnabled;
    const newVersions = newEnabledState ? 5 : 0;
    const currentTotal = calculateConstraints().totalCandidates;
    const change =
        newVersions -
        (localSettings.mavenCentralEnabled
            ? localSettings.mavenCentralVersions
            : 0);
    if (currentTotal + change > 10) return;
    setLocalSettings((prev) => ({
      ...prev,
      mavenCentralEnabled: newEnabledState,
      mavenCentralVersions: newVersions,
    }));
  };

  /**
   * Changes the number of versions to fetch from Maven Central.
   * @param {number|string} versions - The new number of versions.
   */
  const handleMavenVersionChange = (versions) => {
    if (hasGeneratedCode) return;
    const newVersions = parseInt(versions) || 0;
    const currentTotal = calculateConstraints().totalCandidates;
    const change = newVersions - localSettings.mavenCentralVersions;
    if (currentTotal + change > 10) return;
    setLocalSettings((prev) => ({
      ...prev,
      mavenCentralVersions: newVersions,
    }));
  };

  /**
   * Changes the maximum generation time limit.
   * @param {number|string} time - The new time in minutes.
   */
  const handleTimeChange = (time) => {
    const newTime = parseInt(time) || 1;
    const { minimumTime } = calculateConstraints();
    setLocalSettings((prev) => ({
      ...prev,
      generationTimeMinutes: Math.max(newTime, minimumTime),
    }));
  };

  /**
   * Toggles the enabled state of Ollama-based test generation.
   */
  const handleTestGenOllamaToggle = () => {
    if (hasGeneratedCode) return;

    const newValue = !localSettings.use_testGen_ollama;
    if (!newValue && !localSettings.use_random_testGen) {
      alert(
          "At least one test generation method (Ollama or Random) must be enabled.",
      );
      return;
    }
    const hasCompatibleModel = ollamaModels.some(
        (model) => localSettings.llmEnabled[model],
    );
    if (newValue && !hasCompatibleModel) {
      alert(
          "To enable Ollama test generation, please enable a compatible model in Step 2 first (e.g., gemma3:27b).",
      );
      return;
    }
    setLocalSettings((prev) => ({ ...prev, use_testGen_ollama: newValue }));
  };

  /**
   * Toggles the enabled state of random test generation.
   */
  const handleRandomTestToggle = () => {
    if (hasGeneratedCode) return;

    const newValue = !localSettings.use_random_testGen;
    if (!newValue && !localSettings.use_testGen_ollama) {
      alert(
          "At least one test generation method (Ollama or Random) must be enabled.",
      );
      return;
    }
    setLocalSettings((prev) => ({ ...prev, use_random_testGen: newValue }));
  };

  /**
   * Validates and saves the final settings, then closes the modal.
   */
  const handleSave = () => {
    if (!hasGeneratedCode) {
      const testErrors = validateTestSettings();
      if (testErrors.length > 0) {
        alert("Please fix the following issues:\n\n" + testErrors.join("\n"));
        return;
      }
    }
    onSave(localSettings);
    onClose();
  };

  /**
   * A small component to render a label with a hoverable tooltip.
   * @param {object} props - The component props.
   * @param {string} props.id - A unique ID for the tooltip content.
   * @param {JSX.Element} props.children - The content to wrap with the tooltip trigger.
   * @returns {JSX.Element}
   */
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
            <div className="tooltip-content">{tooltips[id]}</div>
        )}
      </div>
  );

  return (
      <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="settings-modal">
          <div className="modal-header">
            <h2>Generation Settings</h2>
            <button className="close-button" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="modal-content">
            {step === 1 && (
                <div className="step-content">
                  <h3>Step 1: Prioritize Your Implementation Criteria</h3>
                  <p>
                    Select and rank which qualities matter most for your code
                    implementation.
                  </p>
                  <div className="criteria-grid">
                    <div className="criteria-selection">
                      <h4>Available Criteria</h4>
                      <div className="criteria-list">
                        {allCriteria.map((criterion) => (
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
                          onDragOver={handleDragOver}
                          onDragEnd={handleDragEnd}
                          onDragCancel={() => {
                            setActiveDragId(null);
                            setDragOverIndex(null);
                          }}
                      >
                        <SortableContext
                            items={localSettings.rankedCriteria}
                            strategy={verticalListSortingStrategy}
                        >
                          <div className="sortable-list">
                            {localSettings.rankedCriteria.map((item, index) => (
                                <SortableItem
                                    key={item}
                                    id={item}
                                    index={index}
                                    previewRank={getItemPreviewRank(item, index)}
                                />
                            ))}
                          </div>
                        </SortableContext>
                        <CustomDragOverlay>
                          {activeDragId ? (
                              <div className="drag-overlay-item">
                          <span data-rank={getPreviewRank()}>
                            {activeDragId}
                          </span>
                                <div className="drag-handle">
                                  <svg
                                      width="24"
                                      height="24"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                  >
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
                        </CustomDragOverlay>
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
                        : "Select AI models and specify how many implementations you want from each source."}
                  </p>

                  {!hasGeneratedCode && (
                      <div className="constraints-info">
                        <div className="constraint-item">
                          <strong>Time Requirement:</strong> Minimum{" "}
                          {constraints.minimumTime} minutes ({constraints.enabledLLMs}{" "}
                          LLM
                          {constraints.enabledLLMs !== 1 ? "s" : ""} selected: 2 base
                          + {Math.max(0, constraints.enabledLLMs - 1)} additional)
                        </div>
                        <div className="constraint-item">
                          <strong>Code Candidates:</strong>{" "}
                          {constraints.totalCandidates}/10 maximum allowed
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
                          <p className="disabled-notice">
                            LLM selection is locked after first generation
                          </p>
                      )}
                      <div className="llm-grid">
                        {Object.keys(localSettings.llmEnabled).map((llm) => (
                            <div
                                key={llm}
                                className={`llm-item ${
                                    hasGeneratedCode ? "disabled" : ""
                                }`}
                            >
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
                                        onChange={(e) =>
                                            handleVersionChange(llm, e.target.value)
                                        }
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
                          <p className="disabled-notice">
                            Repository selection is locked after first generation
                          </p>
                      )}
                      <div
                          className={`repository-item ${
                              hasGeneratedCode ? "disabled" : ""
                          }`}
                      >
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
                                  onChange={(e) =>
                                      handleMavenVersionChange(e.target.value)
                                  }
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
                  <p>
                    {hasGeneratedCode
                        ? "Test generation and analysis settings are locked after first generation to maintain pipeline consistency."
                        : "Set up how tests should be generated and what analysis to perform on your code."}
                  </p>

                  {hasGeneratedCode && (
                      <p className="disabled-notice">
                        Test configuration is locked after first generation
                      </p>
                  )}

                  <div className={`test-options ${hasGeneratedCode ? "disabled" : ""}`}>
                    <div className="option-section">
                      <h4>Automatic Test Generation</h4>

                      <div className="test-option-item">
                        <Tooltip id="use_testGen_ollama">
                          <label className="test-checkbox">
                            <input
                                type="checkbox"
                                checked={localSettings.use_testGen_ollama}
                                onChange={handleTestGenOllamaToggle}
                                disabled={hasGeneratedCode}
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
                                    onChange={(e) =>
                                        setLocalSettings((prev) => ({
                                          ...prev,
                                          model_testGen: e.target.value,
                                        }))
                                    }
                                    disabled={hasGeneratedCode}
                                >
                                  {ollamaModels
                                      .filter(
                                          (model) => localSettings.llmEnabled[model],
                                      )
                                      .map((model) => (
                                          <option key={model} value={model}>
                                            {model}
                                          </option>
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
                                    onChange={(e) =>
                                        setLocalSettings((prev) => ({
                                          ...prev,
                                          samples_LLM_testGen:
                                              parseInt(e.target.value) || 1,
                                        }))
                                    }
                                    disabled={hasGeneratedCode}
                                />
                              </Tooltip>
                            </div>
                        )}
                        {!ollamaModels.some(
                            (model) => localSettings.llmEnabled[model],
                        ) && (
                            <small className="helper-text">
                              Requires a compatible Ollama model to be enabled in Step
                              2.
                            </small>
                        )}
                      </div>

                      <div className="test-option-item">
                        <Tooltip id="use_random_testGen">
                          <label className="test-checkbox">
                            <input
                                type="checkbox"
                                checked={localSettings.use_random_testGen}
                                onChange={handleRandomTestToggle}
                                disabled={hasGeneratedCode}
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
                                    onChange={(e) =>
                                        setLocalSettings((prev) => ({
                                          ...prev,
                                          samples_random_testGen:
                                              parseInt(e.target.value) || 1,
                                        }))
                                    }
                                    disabled={hasGeneratedCode}
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
                                onChange={(e) =>
                                    setLocalSettings((prev) => ({
                                      ...prev,
                                      use_type_aware_testGen: e.target.checked,
                                    }))
                                }
                                disabled={
                                    hasGeneratedCode ||
                                    (!localSettings.use_testGen_ollama &&
                                     !localSettings.use_random_testGen)
                                }
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
                                    onChange={(e) =>
                                        setLocalSettings((prev) => ({
                                          ...prev,
                                          samples_type_aware_testGen:
                                              parseInt(e.target.value) || 5,
                                        }))
                                    }
                                    disabled={hasGeneratedCode}
                                />
                              </Tooltip>
                            </div>
                        )}
                        {!localSettings.use_testGen_ollama &&
                            !localSettings.use_random_testGen && (
                                <small className="helper-text">
                                  Requires Ollama or Random test generation to be
                                  enabled first.
                                </small>
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
                                  onChange={(e) =>
                                      setLocalSettings((prev) => ({
                                        ...prev,
                                        features: e.target.value,
                                      }))
                                  }
                                  disabled={hasGeneratedCode}
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
                                  onChange={(e) =>
                                      setLocalSettings((prev) => ({
                                        ...prev,
                                        features: e.target.value,
                                      }))
                                  }
                                  disabled={hasGeneratedCode}
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
                                onChange={(e) =>
                                    setLocalSettings((prev) => ({
                                      ...prev,
                                      use_nicad: e.target.checked,
                                    }))
                                }
                                disabled={hasGeneratedCode}
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
                  <button type="button" className="cancel-button" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                      type="button"
                      className="next-button"
                      onClick={() => setStep(2)}
                  >
                    Next →
                  </button>
                </>
            )}
            {step === 2 && (
                <>
                  <button
                      type="button"
                      className="back-button"
                      onClick={() => setStep(1)}
                  >
                    ← Back
                  </button>
                  <button
                      type="button"
                      className="next-button"
                      onClick={() => setStep(3)}
                  >
                    Next →
                  </button>
                </>
            )}
            {step === 3 && (
                <>
                  <button
                      type="button"
                      className="back-button"
                      onClick={() => setStep(2)}
                  >
                    ← Back
                  </button>
                  <button
                      type="button"
                      className="save-button"
                      onClick={handleSave}
                      disabled={!hasGeneratedCode && constraints.totalCandidates > 10}
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