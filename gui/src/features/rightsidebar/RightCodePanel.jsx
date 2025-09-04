import React, { useState, useEffect, useCallback } from "react";
import CodeDisplay from "./CodeDisplay.jsx";
import LqlEditor from "./LQLEditor.jsx";
import SequenceSheetCreator from "./SequenceSheetCreator.jsx";

/**
 * Renders a sliding panel on the right side of the screen. This panel acts as a
 * container that can display different content based on the `panelContent` prop,
 * such as the code display, LQL editor, or sequence sheet creator. It also
 * features a draggable handle to resize its width.
 *
 * @param {object} props - The component props.
 * @param {boolean} props.isOpen - Controls whether the panel is visible.
 * @param {function} props.onClose - Callback function to close the panel.
 * @param {object|null} props.allResults - The data object containing generated code to be passed to CodeDisplay.
 * @param {string} props.panelContent - Determines which component to render: 'code', 'lql', or 'sequence'.
 * @param {string} props.lql - The LQL string, passed to the LqlEditor.
 * @param {function} props.onLqlChange - Callback for LQL changes.
 * @param {function} props.onValidateLql - Callback to trigger LQL validation.
 * @param {object|null} props.lqlValidationResult - The result of the LQL validation.
 * @param {string} props.sequenceSheet - The sequence sheet string.
 * @param {function} props.onSequenceSheetChange - Callback for sequence sheet changes.
 * @param {number} props.width - The current width of the panel in pixels.
 * @param {function} props.onWidthChange - Callback to update the panel's width during drag-resizing.
 * @param {boolean} props.hasRefinedCode - Flag indicating if the current results include refined code.
 * @param {boolean} props.isRefining - Flag indicating if a refinement process is in progress.
 * @param {number|null} [props.selectedCodeId=null] - The index of the code candidate selected for refinement.
 * @param {function|null} [props.onCodeSelect=null] - Callback for when a code candidate is selected.
 * @param {boolean} props.hasGeneratedCode - Flag indicating if code has been generated in the session.
 * @returns {JSX.Element} The rendered right-side panel.
 */
const RightCodePanel = ({
  isOpen,
  onClose,
  allResults,
  panelContent,
  lql,
  onLqlChange,
  onValidateLql,
  lqlValidationResult,
  sequenceSheet,
  onSequenceSheetChange,
  width,
  onWidthChange,
  hasRefinedCode,
  isRefining,
  selectedCodeId = null,
  onCodeSelect = null,
  hasGeneratedCode,
}) => {
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleCodeSelect = (codeId) => {
    console.log("📄 RightCodePanel: Selecting code ID:", codeId);
    if (onCodeSelect && typeof onCodeSelect === "function") {
      onCodeSelect(codeId);
    } else {
      console.warn("⚠️ RightCodePanel: onCodeSelect is not a function");
    }
  };

  const handleActiveResultChange = (index) => {
    setActiveResultIndex(index);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (isDragging) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 400 && newWidth < window.innerWidth - 350) {
          onWidthChange(newWidth);
        }
      }
    },
    [isDragging, onWidthChange],
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  /**
   * Determines the title of the panel based on its current content.
   * @returns {string} The panel title.
   */
  const getPanelTitle = () => {
    switch (panelContent) {
      case "lql":
        return "LQL Definition";
      case "sequence":
        return "Sequence Sheet Creator";
      case "code":
        return "Generated Code";
      default:
        return "Panel";
    }
  };

  /**
   * Renders the appropriate component inside the panel based on the `panelContent` state.
   * @returns {JSX.Element} The component to be rendered within the panel.
   */
  const renderPanelContent = () => {
    switch (panelContent) {
      case "code":
        return (
          <CodeDisplay
            allResults={allResults}
            selectedCodeId={selectedCodeId}
            onCodeSelect={handleCodeSelect}
            isRefining={isRefining}
            activeResultIndex={activeResultIndex}
            onActiveResultChange={handleActiveResultChange}
          />
        );

      case "lql":
        return (
          <LqlEditor
            lql={lql}
            onLqlChange={onLqlChange}
            validationResult={lqlValidationResult}
            onValidateLql={onValidateLql}
            disabled={hasGeneratedCode}
          />
        );

      case "sequence":
        return (
          <SequenceSheetCreator
            initialSequenceSheet={sequenceSheet || ""}
            onSequenceSheetChange={onSequenceSheetChange}
          />
        );

      default:
        return (
          <div className="empty-panel-content">
            <p>Select a panel type to get started.</p>
          </div>
        );
    }
  };

  return (
    <div
      className={`right-code-panel ${isOpen ? "open" : ""}`}
      style={{ width: `${width}px`, right: isOpen ? 0 : `-${width}px` }}
    >
      <div className="panel-dragger" onMouseDown={handleMouseDown} />

      <div className="panel-header">
        <h2>{getPanelTitle()}</h2>
        <div className="panel-header-actions">
          {isRefining && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginRight: "16px",
                color: "#10b981",
                fontSize: "0.875rem",
                fontWeight: "500",
              }}
            >
              <div
                className="spinner"
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid #e5e7eb",
                  borderTop: "2px solid #10b981",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Refining...
            </div>
          )}
          <button type="button" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      <div className="panel-content">{renderPanelContent()}</div>

      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .empty-panel-content {
          padding: 2rem;
          text-align: center;
          color: #6c757d;
        }

        .empty-panel-content p {
          margin: 0;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
};

export default RightCodePanel;
