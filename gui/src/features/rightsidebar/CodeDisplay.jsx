import React, { useState, useEffect } from "react";
import styles from "./CodeDisplay.module.css";

/**
 * Renders the detailed view of a generated code implementation, including its
 * source code, test results, and performance metrics. It also provides an
 * interface for selecting between different implementations and choosing one
 * for refinement.
 *
 * @param {object} props - The component props.
 * @param {object|null} props.allResults - The main object containing all generated implementations and metadata.
 * @param {number|null} props.selectedCodeId - The index of the code candidate currently selected for refinement.
 * @param {function|null} props.onCodeSelect - Callback function triggered when a user selects or clears a code candidate for refinement.
 * @param {boolean} [props.isRefining=false] - A flag indicating if a refinement process is currently active.
 * @param {number} [props.activeResultIndex=0] - The index of the implementation to display from the `allResults` object.
 * @param {function|null} props.onActiveResultChange - Callback function triggered when the user switches the view to a different implementation.
 * @returns {JSX.Element} The rendered CodeDisplay component or an empty state placeholder.
 */
const CodeDisplay = ({
  allResults,
  selectedCodeId = null,
  onCodeSelect = null,
  isRefining = false,
  activeResultIndex = 0,
  onActiveResultChange = null,
}) => {
  const [copiedButton, setCopiedButton] = useState(null);

  /**
   * Creates a unified list of all implementations from the results object,
   * adding an `index` and `isRefined` property to each for easier rendering.
   * @returns {Array<object>} A list of implementation objects.
   */
  const buildUnifiedImplementationsList = () => {
    if (!allResults || !Array.isArray(allResults.implementations)) {
      return [];
    }

    return allResults.implementations.map((impl, index) => ({
      ...impl,
      index: index,
      isRefined:
        allResults.isRefinement &&
        index === allResults.refinedImplementationIndex,
    }));
  };

  const unifiedImplementations = buildUnifiedImplementationsList();
  const totalResults = unifiedImplementations.length;
  const currentResult = unifiedImplementations[activeResultIndex] || null;

  useEffect(() => {
    setCopiedButton(null);
  }, [activeResultIndex, currentResult]);

  /**
   * Copies the provided text to the user's clipboard and provides visual feedback.
   * @param {string} text - The text to be copied.
   * @param {string} type - A descriptive type for the content being copied (for logging).
   * @param {string} buttonId - The ID of the button that was clicked, to manage its "Copied!" state.
   */
  const copyToClipboard = async (text, type = "code", buttonId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedButton(buttonId);

      setTimeout(() => {
        setCopiedButton(null);
      }, 2000);

      console.log(`✅ ${type} copied to clipboard`);
    } catch (err) {
      console.error(`❌ Failed to copy ${type}:`, err);
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);

      setCopiedButton(buttonId);
      setTimeout(() => {
        setCopiedButton(null);
      }, 2000);
    }
  };

  /**
   * Handles clicks on the implementation selector buttons at the top of the panel,
   * triggering a change in the displayed implementation.
   * @param {number} implIndex - The index of the implementation to display.
   */
  const handleImplSelectorClick = (implIndex) => {
    if (onActiveResultChange) {
      onActiveResultChange(implIndex);
    }
  };

  /**
   * Handles clicks on the "Select" or "Clear Selection" buttons, notifying the
   * parent component of the change.
   * @param {number|null} implIndex - The index of the implementation to select, or null to clear the selection.
   */
  const handleCodeSelect = (implIndex) => {
    if (onCodeSelect) {
      onCodeSelect(implIndex);
    }
  };

  if (!currentResult) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyContent}>
          <div className={styles.emptyIcon}>📄</div>
          <h3 className={styles.emptyTitle}>No Code Generated Yet</h3>
          <p className={styles.emptyText}>
            Start a conversation with Cody to generate some code!
          </p>
        </div>
      </div>
    );
  }

  /**
   * Removes the "Implementation:" prefix and trims whitespace from raw code strings.
   * @param {string} rawCode - The raw code string from the backend.
   * @returns {string} The cleaned code string.
   */
  const cleanCode = (rawCode) => {
    if (!rawCode) return "";
    let cleaned = rawCode.replace(/^Implementation:\s*\n?/i, "").trim();
    return cleaned;
  };

  /**
   * A simple parser to extract key components from a Java code string for display purposes.
   * @param {string} code - The Java code string.
   * @returns {{imports: Array, className: string, fields: Array, methods: Array, rawCode: string}} An object containing the parsed parts of the code.
   */
  const parseJavaCode = (code) => {
    const cleanedCode = cleanCode(code);

    if (!cleanedCode) {
      return {
        imports: [],
        className: "Unknown",
        implementsInterface: null,
        fields: [],
        methods: [],
        rawCode: cleanedCode,
      };
    }

    try {
      const importRegex = /import\s+[^;]+;/g;
      const imports = cleanedCode.match(importRegex) || [];

      const classDecRegex =
        /(?:public\s+)?(?:final\s+)?class\s+([\w]+(?:<[^>]+>)?)\s*(?:extends\s+[\w<>,\s]+)?\s*(?:implements\s+[\w<>,\s]+)?\s*{?/;
      const classMatch = cleanedCode.match(classDecRegex);
      const className = classMatch ? classMatch[1] : "Unknown";

      const fieldsRegex =
        /(private|protected|public)(?:\s+final)?\s+(?:\w+(?:<[^>]+>)?)\s+\w+(?:\s+=\s+[^;]+)?;/g;
      const fields = cleanedCode.match(fieldsRegex) || [];

      const methodsRegex =
        /(public|private|protected)\s+(?:<[^>]+>\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*{/g;
      const methodsMatches = Array.from(
        cleanedCode.matchAll(methodsRegex) || [],
      );

      const methods = methodsMatches.map((match) => {
        const methodStart = match.index;
        const methodSignature = match[0];
        const methodName = match[2];

        let braceCount = 1;
        let currentIndex = methodStart + methodSignature.length;

        while (braceCount > 0 && currentIndex < cleanedCode.length) {
          const char = cleanedCode[currentIndex];
          if (char === "{") braceCount++;
          else if (char === "}") braceCount--;
          currentIndex++;
        }

        const fullMethod = cleanedCode.substring(methodStart, currentIndex);

        return {
          fullMethod: fullMethod,
          name: methodName,
        };
      });

      return {
        imports,
        className,
        implementsInterface: null,
        fields,
        methods,
        rawCode: cleanedCode,
      };
    } catch (error) {
      console.error("❌ CodeDisplay: Error parsing Java code:", error);
      return {
        imports: [],
        className: "ParseError",
        implementsInterface: null,
        fields: [],
        methods: [],
        rawCode: cleanedCode,
      };
    }
  };

  const codeInfo = parseJavaCode(currentResult.code_implementation);

  const metricLabels = {
    m_static_complexity_td: "Code Simplicity",
    m_static_loc_td: "Code Brevity",
  };

  const isCurrentRefined =
    currentResult.isRefined ||
    (currentResult.generated_by &&
      currentResult.generated_by.includes("refined")) ||
    (allResults.isRefinement &&
      activeResultIndex === allResults.refinedImplementationIndex);

  const isRefinedAndSelected =
    isCurrentRefined && selectedCodeId === activeResultIndex;

  const themeClass = isRefinedAndSelected
    ? styles.themeRefinedSelected
    : isCurrentRefined
      ? styles.themeRefined
      : styles.themeDefault;

  console.log("🔍 CodeDisplay Debug:", {
    activeResultIndex,
    currentResultId: currentResult.id,
    isCurrentRefined,
    isRefinedAndSelected,
    themeClass,
    selectedCodeId,
  });

  return (
    <div className={`${styles.codeDisplayContainer} ${themeClass}`}>
      {totalResults > 1 && (
        <div className={styles.implSelector}>
          <span className={styles.implLabel}>Select implementation:</span>
          {unifiedImplementations.map((impl, idx) => {
            const isActive = activeResultIndex === idx;
            const isSelected = selectedCodeId === impl.index;
            const isRefinedImpl = impl.isRefined;

            const buttonClasses = [styles.implButton];
            if (isSelected) {
              buttonClasses.push(styles.implSelected);
            } else if (isRefinedImpl) {
              buttonClasses.push(styles.implRefined);
            } else if (isActive) {
              buttonClasses.push(styles.implActive);
            }

            return (
              <button
                key={idx}
                type="button"
                className={buttonClasses.join(" ")}
                onClick={() => handleImplSelectorClick(idx)}
                title={
                  isRefinedImpl
                    ? `Refined Implementation ${idx + 1}`
                    : `Implementation ${idx + 1}`
                }
              >
                {isRefinedImpl ? "✨" : idx + 1}
              </button>
            );
          })}
        </div>
      )}

      {totalResults > 1 && (
        <div
          className={`${styles.selectionInfo} ${
            selectedCodeId === activeResultIndex ? styles.selectionActive : ""
          }`}
        >
          <span className={styles.selectionText}>
            {selectedCodeId !== null ? (
              <>
                Selected for refinement: Implementation {selectedCodeId + 1}
                {unifiedImplementations[selectedCodeId]?.isRefined &&
                  " (Previously Refined)"}
              </>
            ) : (
              "No implementation selected for refinement"
            )}
          </span>

          <div className={styles.selectionActions}>
            {selectedCodeId !== null && (
              <button
                onClick={() => handleCodeSelect(null)}
                className={styles.selectionClear}
              >
                Clear Selection
              </button>
            )}
            <button
              onClick={() => handleCodeSelect(activeResultIndex)}
              className={styles.selectionSelect}
            >
              {selectedCodeId === activeResultIndex ? "Selected" : "Select"}
            </button>
          </div>
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.rankBadge}>{currentResult.rank || "#"}</div>
            <h3 className={styles.title}>
              {codeInfo.className}
              {isCurrentRefined && (
                <span className={styles.refinedLabel}>(Refined)</span>
              )}
            </h3>
          </div>
          <div className={styles.generatedBy}>
            {isCurrentRefined
              ? (currentResult.generated_by?.replace("-refined", "") || "AI") +
                " Enhanced"
              : currentResult.generated_by || "AI"}
          </div>
        </div>

        <div className={styles.metricsBar}>
          <div className={styles.metricItem}>
            <span>Rank:</span>
            <span className={styles.metricValue}>
              #{currentResult.rank || 1}
            </span>
          </div>
          <div className={styles.metricItem}>
            <span>Score:</span>
            <span className={styles.metricValue}>
              {currentResult.overall_score
                ? (currentResult.overall_score * 100).toFixed(1) + "%"
                : "0%"}
            </span>
          </div>
        </div>

        <div className={styles.details}>
          {isRefining && selectedCodeId === currentResult.index && (
            <div className={styles.refiningIndicator}>
              <div className={styles.spinner} />
              <div>
                <div className={styles.refiningTitle}>
                  Refining Implementation...
                </div>
                <p className={styles.refiningText}>
                  Creating an enhanced version based on your feedback
                </p>
              </div>
            </div>
          )}

          {codeInfo.rawCode && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>
                  {isCurrentRefined ? "✨ REFINED CODE" : "CODE"}
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(codeInfo.rawCode, "Implementation", "code");
                  }}
                  className={styles.copyButton}
                >
                  {copiedButton === "code" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className={styles.codeBlock}>{codeInfo.rawCode}</pre>
            </div>
          )}

          {currentResult.test_results?.unit_test_implementations && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>
                  {isCurrentRefined ? "✨ ENHANCED TESTS" : "TESTS"}
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(
                      currentResult.test_results.unit_test_implementations
                        .map((t) => t.test_code_implementation)
                        .join("\n\n"),
                      "JUnit Tests",
                      "tests",
                    );
                  }}
                  className={`${styles.copyButton} ${styles.copyTests}`}
                >
                  {copiedButton === "tests" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className={styles.testsBlock}>
                {currentResult.test_results.unit_test_implementations
                  .map((t) => `${t.signature}\n${t.test_code_implementation}`)
                  .join("\n\n")}
              </pre>
            </div>
          )}

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              {isCurrentRefined ? "✨ ENHANCED METRICS" : "METRICS"}
            </h4>

            <div className={styles.metricsList}>
              {Object.entries(currentResult.criteria_scores || {}).map(
                ([criterion, score]) => {
                  const displayScore =
                    score === 0 ? 0 : Math.round(score * 9 + 1);
                  const barPercentage = (displayScore / 10) * 100;

                  return (
                    <div key={criterion} className={styles.metricProgress}>
                      <div className={styles.metricProgressHeader}>
                        <span className={styles.metricName}>
                          {metricLabels[criterion] || criterion}
                        </span>
                        <span className={styles.metricScore}>
                          {displayScore}/10
                        </span>
                      </div>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${barPercentage}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                },
              )}
            </div>

            {currentResult.test_results && (
              <div className={styles.assertions}>
                <span className={styles.assertionsLabel}>Assertions:</span>
                <span
                  className={`${styles.assertionsValue} ${
                    currentResult.test_results.passed ===
                    currentResult.test_results.total
                      ? styles.assertionsSuccess
                      : styles.assertionsPartial
                  }`}
                >
                  {currentResult.test_results.passed} /{" "}
                  {currentResult.test_results.total}
                  {currentResult.test_results.passed ===
                    currentResult.test_results.total && (
                    <span className={styles.assertionsCheckmark}>✓</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeDisplay;
