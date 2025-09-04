import React from "react";
import Editor from "@monaco-editor/react";

/**
 * A specialized code editor for writing and validating LQL (Lasso Query Language).
 * It uses the Monaco Editor for a rich editing experience and displays validation
 * success or error messages.
 *
 * @param {object} props - The component props.
 * @param {string} props.lql - The current LQL code string to display in the editor.
 * @param {function} props.onLqlChange - Callback function that is triggered when the content of the editor changes.
 * @param {object|null} props.validationResult - An object containing the results of the last LQL validation attempt.
 * @param {function} props.onValidateLql - Callback function to be executed when the "Validate LQL" button is clicked.
 * @param {boolean} [props.disabled=false] - If true, the editor and validate button will be disabled.
 * @returns {JSX.Element} The rendered LQL editor component.
 */
const LqlEditor = ({
  lql,
  onLqlChange,
  validationResult,
  onValidateLql,
  disabled = false,
}) => {
  return (
    <div className="lql-editor-container">
      {validationResult && !validationResult.isValid && (
        <div className="validation-error-display">
          <h3 className="validation-error-title">LQL Validation Errors:</h3>
          <div className="validation-errors">
            {validationResult.errors.map((error, index) => (
              <div key={index} className="validation-error-item">
                {error.includes("Line") ? (
                  <span className="error-code">{error}</span>
                ) : (
                  <span>{error}</span>
                )}
              </div>
            ))}
          </div>
          {validationResult.timestamp && (
            <div className="validation-timestamp">
              Validation timestamp:{" "}
              {new Date(validationResult.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {validationResult && validationResult.isValid && (
        <div className="validation-success-display">
          <h3 className="validation-success-title">✅ LQL is Valid!</h3>
          <p>Your LQL interface definition has been validated successfully.</p>
        </div>
      )}

      <div
        className="lql-editor-wrapper"
        style={{
          height: "300px",
          minHeight: "300px",
          maxHeight: "300px",
          border: validationResult
            ? validationResult.isValid
              ? "2px solid #10b981"
              : "2px solid #ef4444"
            : "2px solid var(--color-accent)",
          borderRadius: "0.5rem",
          overflow: "hidden",
          marginBottom: "15px",
        }}
      >
        <Editor
          height="300px"
          width="100%"
          language="java"
          theme="vs-light"
          value={lql}
          onChange={(value) => onLqlChange(value || "")}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: true,
            fontSize: 14,
            tabSize: 4,
            wordWrap: "on",
            automaticLayout: true,
            lineHeight: 20,
            letterSpacing: 0.5,
            fontFamily:
              'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
            fontWeight: "normal",
            fontLigatures: false,
          }}
        />
      </div>

      <div className="lql-validate-button-container">
        <button
          type="button"
          className="validate-lql-button primary-button"
          onClick={onValidateLql}
          disabled={disabled}
        >
          Validate LQL
        </button>
      </div>
    </div>
  );
};

export default LqlEditor;
