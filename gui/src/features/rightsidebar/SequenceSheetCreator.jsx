import React, { useState, useEffect, useCallback, useRef } from "react";

/**
 * A visual editor for creating and managing test sequences in the
 * Sequence Sheet Notation (SSN) format. It provides a table-based UI
 * for defining multiple tests, each with multiple steps (rows).
 *
 * @param {object} props - The component props.
 * @param {function} props.onSequenceSheetChange - A callback function that is invoked whenever the generated SSN string changes.
 * @param {function} [props.onSubmit] - A callback function for when the user explicitly submits the sequence sheet.
 * @param {string} [props.initialSequenceSheet=""] - An initial SSN string to populate the editor with (not yet implemented).
 * @returns {JSX.Element} The rendered Sequence Sheet Creator component.
 */
const SequenceSheetCreator = ({
  onSequenceSheetChange,
  onSubmit = (ssn) => console.log("Submit clicked!", ssn),
  initialSequenceSheet = "",
}) => {
  const nextTestId = useRef(0);
  const nextRowId = useRef(0);

  /**
   * Creates a new, empty row object with a unique ID.
   * @returns {{id: number, expectedOutput: string, operation: string, service: string, param1: string, param2: string, param3: string, param4: string}} A new row object.
   */
  const createEmptyRow = useCallback(
    () => ({
      id: nextRowId.current++,
      expectedOutput: "",
      operation: "",
      service: "",
      param1: "",
      param2: "",
      param3: "",
      param4: "",
    }),
    [],
  );

  /**
   * Creates a new, empty test object with a unique ID and a default name.
   * @returns {{id: number, name: string, rows: Array<object>}} A new test object.
   */
  const createEmptyTest = useCallback(
    () => ({
      id: nextTestId.current++,
      name: `sequenceTest${nextTestId.current}`,
      rows: [createEmptyRow()],
    }),
    [createEmptyRow],
  );

  const [tests, setTests] = useState([createEmptyTest()]);
  const [numParams, setNumParams] = useState(1);
  const [generatedSsn, setGeneratedSsn] = useState("");

  // This effect runs whenever the test data or number of parameters changes.
  // It generates the final SSN string from the component's state and
  // notifies the parent component via the onSequenceSheetChange callback.
  useEffect(() => {
    const ssn = tests
      .map((test) => {
        const rowLines = test.rows
          .filter((row) => row.operation && row.service)
          .map((row) => {
            const params = [row.param1, row.param2, row.param3, row.param4]
              .slice(0, numParams)
              .filter((p) => p && p.trim() !== "")
              .map((p) => `'${p.trim()}'`);
            const service = `'${row.service.trim()}'`;
            const operation = `'${row.operation.trim()}'`;
            const output = `'${row.expectedOutput.trim()}'`;
            const allParams = [service, ...params].join(", ");
            return `    row ${output}, ${operation}, ${allParams}`;
          })
          .join("\n");

        if (!rowLines) return null;

        return `test(name: '${test.name.trim()}') {\n${rowLines}\n}`;
      })
      .filter(Boolean)
      .join(",\n");

    setGeneratedSsn(ssn);
    if (onSequenceSheetChange) {
      onSequenceSheetChange(ssn);
    }
  }, [tests, numParams, onSequenceSheetChange]);

  /**
   * Submits the generated SSN to the parent component.
   */
  const handleSubmission = () => {
    onSubmit(generatedSsn);
  };

  /**
   * Adds a new empty test to the state.
   */
  const addTest = () => setTests((prev) => [...prev, createEmptyTest()]);

  /**
   * Removes a test from the state by its ID.
   * @param {number} testId - The unique ID of the test to remove.
   */
  const removeTest = (testId) =>
    tests.length > 1 && setTests((prev) => prev.filter((t) => t.id !== testId));

  /**
   * Updates the name of a specific test.
   * @param {number} testId - The ID of the test to update.
   * @param {string} name - The new name for the test.
   */
  const updateTestName = (testId, name) => {
    setTests((prev) => prev.map((t) => (t.id === testId ? { ...t, name } : t)));
  };

  /**
   * Adds a new empty row to a specific test.
   * @param {number} testId - The ID of the test to add the row to.
   */
  const addRow = (testId) => {
    setTests((prev) =>
      prev.map((t) =>
        t.id === testId ? { ...t, rows: [...t.rows, createEmptyRow()] } : t,
      ),
    );
  };

  /**
   * Removes a row from a specific test by its ID.
   * @param {number} testId - The ID of the parent test.
   * @param {number} rowId - The ID of the row to remove.
   */
  const removeRow = (testId, rowId) => {
    setTests((prev) =>
      prev.map((t) =>
        t.id === testId
          ? {
              ...t,
              rows:
                t.rows.length > 1
                  ? t.rows.filter((r) => r.id !== rowId)
                  : t.rows,
            }
          : t,
      ),
    );
  };

  /**
   * Updates a specific field within a row of a test.
   * @param {number} testId - The ID of the parent test.
   * @param {number} rowId - The ID of the row to update.
   * @param {string} field - The name of the field to update (e.g., 'operation').
   * @param {string} value - The new value for the field.
   */
  const updateRow = (testId, rowId, field, value) => {
    setTests((prev) =>
      prev.map((t) =>
        t.id === testId
          ? {
              ...t,
              rows: t.rows.map((r) =>
                r.id === rowId ? { ...r, [field]: value } : r,
              ),
            }
          : t,
      ),
    );
  };

  /**
   * Moves a row up or down within its test's sequence.
   * @param {number} testId - The ID of the parent test.
   * @param {number} rowId - The ID of the row to move.
   * @param {'up'|'down'} direction - The direction to move the row.
   */
  const moveRow = (testId, rowId, direction) => {
    setTests((prev) =>
      prev.map((t) => {
        if (t.id !== testId) return t;
        const index = t.rows.findIndex((r) => r.id === rowId);
        if (
          (direction === "up" && index > 0) ||
          (direction === "down" && index < t.rows.length - 1)
        ) {
          const newRows = [...t.rows];
          const targetIndex = direction === "up" ? index - 1 : index + 1;
          [newRows[index], newRows[targetIndex]] = [
            newRows[targetIndex],
            newRows[index],
          ];
          return { ...t, rows: newRows };
        }
        return t;
      }),
    );
  };

  /**
   * Adds a parameter column to the table, up to a maximum of 4.
   */
  const addParamColumn = () => setNumParams((p) => Math.min(p + 1, 4));

  /**
   * Removes a parameter column from the table, down to a minimum of 1.
   */
  const removeParamColumn = () => setNumParams((p) => Math.max(p - 1, 1));

  return (
    <div className="sequence-sheet-creator">
      <div className="creator-header">
        <h3>Sequence Sheet Editor</h3>
        <p className="creator-description">
          Visually construct test sequences in SSN (Sequence Sheet Notation).
          Each row represents a step in your test.
        </p>
      </div>
      <div className="creator-content">
        <div className="sequence-table-wrapper">
          <table className="sheet-table">
            <thead>
              <tr>
                <th className="row-header">#</th>
                <th className="col-header">
                  A
                  <br />
                  Output
                </th>
                <th className="col-header">
                  B
                  <br />
                  Operation
                </th>
                <th className="col-header">
                  C
                  <br />
                  Service/ID
                </th>
                {Array.from({ length: numParams }).map((_, i) => (
                  <th key={i} className="col-header">
                    {String.fromCharCode(68 + i)}
                    <br />
                    Param {i + 1}
                  </th>
                ))}
                <th className="col-header actions-header">Actions</th>
              </tr>
            </thead>
            {tests.map((test) => (
              <tbody key={test.id} className="test-group">
                <tr className="test-header-row">
                  <td colSpan={5 + numParams}>
                    <div className="test-header">
                      <input
                        type="text"
                        value={test.name}
                        onChange={(e) =>
                          updateTestName(test.id, e.target.value)
                        }
                        className="test-name-input"
                        placeholder="Enter test name"
                      />
                      <button
                        onClick={() => removeTest(test.id)}
                        disabled={tests.length <= 1}
                        className="action-btn remove-btn"
                        title="Remove test"
                      >
                        Remove Test
                      </button>
                    </div>
                  </td>
                </tr>
                {test.rows.map((row, index) => (
                  <tr key={row.id} className="data-row">
                    <td className="row-number">{index + 1}</td>
                    <td className="cell">
                      <input
                        type="text"
                        value={row.expectedOutput}
                        onChange={(e) =>
                          updateRow(
                            test.id,
                            row.id,
                            "expectedOutput",
                            e.target.value,
                          )
                        }
                        placeholder="output"
                        className="cell-input"
                      />
                    </td>
                    <td className="cell">
                      <input
                        type="text"
                        value={row.operation}
                        onChange={(e) =>
                          updateRow(
                            test.id,
                            row.id,
                            "operation",
                            e.target.value,
                          )
                        }
                        placeholder="operation"
                        className="cell-input"
                      />
                    </td>
                    <td className="cell">
                      <input
                        type="text"
                        value={row.service}
                        onChange={(e) =>
                          updateRow(test.id, row.id, "service", e.target.value)
                        }
                        placeholder="service/id"
                        className="cell-input"
                      />
                    </td>
                    {Array.from({ length: numParams }).map((_, i) => (
                      <td key={i} className="cell">
                        <input
                          type="text"
                          value={row[`param${i + 1}`]}
                          onChange={(e) =>
                            updateRow(
                              test.id,
                              row.id,
                              `param${i + 1}`,
                              e.target.value,
                            )
                          }
                          className="cell-input"
                        />
                      </td>
                    ))}
                    <td className="actions-cell">
                      <div className="row-actions">
                        <button
                          onClick={() => moveRow(test.id, row.id, "up")}
                          disabled={index === 0}
                          className="action-btn"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveRow(test.id, row.id, "down")}
                          disabled={index === test.rows.length - 1}
                          className="action-btn"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => addRow(test.id)}
                          className="action-btn add-row-btn-inline"
                          title="Add row after"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeRow(test.id, row.id)}
                          disabled={test.rows.length <= 1}
                          className="action-btn remove-btn"
                          title="Remove row"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <div className="table-actions">
          <div className="main-actions">
            <button onClick={addTest} className="action-button add-row-btn">
              + Add Test
            </button>
          </div>
          <div className="param-actions">
            <button
              onClick={removeParamColumn}
              disabled={numParams <= 1}
              className="action-button"
            >
              - Remove Param
            </button>
            <button
              onClick={addParamColumn}
              disabled={numParams >= 4}
              className="action-button"
            >
              + Add Param
            </button>
          </div>
        </div>
        <div className="ssn-preview">
          <h4>Generated SSN</h4>
          <pre className="ssn-output">
            {generatedSsn || "No valid sequence defined"}
          </pre>
        </div>
        <div className="creator-instruction">
          <p>
            <strong>How to Use:</strong> Copy the text from the "Generated SSN"
            box above and paste it into the main chat input to start a
            generation with these tests. Do not add any additional text.
          </p>
        </div>
      </div>

      <style jsx>{`
        .sequence-sheet-creator {
          padding: 1rem;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background-color: #f8f9fa;
          font-family:
            -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        }

        .creator-header h3 {
          margin: 0 0 0.5rem 0;
          color: var(--color-bg-primary-dark);
          font-size: 1.2rem;
          font-weight: 600;
          font-family: "Playfair Display", serif;
        }

        .creator-description {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          color: #666;
          line-height: 1.4;
        }

        .creator-content {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          padding-right: 5px; /* space for scrollbar */
        }

        .sequence-table-wrapper {
          border: 1px solid var(--color-border-panel);
          border-radius: 8px;
          overflow: auto;
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .sheet-table {
          width: 100%;
          border-collapse: collapse;
        }

        .sheet-table th,
        .sheet-table td {
          border: 1px solid var(--color-border-panel);
          padding: 0;
          text-align: center;
          vertical-align: middle;
          white-space: nowrap;
        }

        .col-header {
          background-color: var(--color-bg-primary);
          color: white;
          font-weight: 600;
          font-size: 0.75rem;
          padding: 8px 6px;
          line-height: 1.2;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .actions-header {
          min-width: 90px;
        }

        .row-header,
        .row-number {
          background-color: #f8f9fa;
          color: #666;
          font-weight: 600;
          font-size: 0.8rem;
          width: 40px;
          padding: 4px;
          border-right: 1px solid var(--color-border-panel);
        }

        .cell {
          padding: 0;
          height: 38px;
          transition: background-color 0.2s;
        }

        .data-row .cell:focus-within {
          background-color: rgba(151, 114, 89, 0.1);
        }

        .cell-input {
          width: 100%;
          height: 100%;
          border: none;
          outline: none;
          padding: 4px 8px;
          font-size: 0.875rem;
          background: transparent;
          text-align: center;
          color: var(--color-text-panel);
          font-family: inherit;
          box-sizing: border-box;
        }

        .cell-input::placeholder {
          color: #a0aec0;
          font-style: italic;
          font-size: 0.8rem;
        }

        .actions-cell {
          padding: 4px;
        }

        .row-actions {
          display: flex;
          gap: 4px;
          justify-content: center;
          align-items: center;
        }

        .action-btn {
          width: 24px;
          height: 24px;
          border: 1px solid #d1d5db;
          background-color: white;
          color: #6b7280;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: all 0.2s ease;
        }

        .action-btn:hover:not(:disabled) {
          background-color: #f3f4f6;
          border-color: #9ca3af;
          transform: translateY(-1px);
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .remove-btn:hover:not(:disabled) {
          background-color: #fef2f2;
          border-color: #fca5a5;
          color: #dc2626;
        }

        .table-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
        }

        .main-actions,
        .param-actions {
          display: flex;
          gap: 0.5rem;
        }

        .action-button {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          border: 1px solid var(--color-border-panel);
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          background-color: white;
          color: var(--color-bg-primary-dark);
        }

        .action-button:hover:not(:disabled) {
          border-color: var(--color-bg-primary);
          background-color: rgba(151, 114, 89, 0.05);
          transform: translateY(-1px);
        }

        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .submit-btn {
          background-color: var(--color-bg-primary);
          color: white;
          border-color: var(--color-bg-primary);
        }

        .submit-btn:hover:not(:disabled) {
          background-color: var(--color-bg-primary-dark);
          border-color: var(--color-bg-primary-dark);
        }

        .ssn-preview {
          margin-top: 1rem;
        }

        .ssn-preview h4 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          color: var(--color-bg-primary-dark);
          font-weight: 600;
          font-family: "Playfair Display", serif;
        }

        .ssn-output {
          background-color: white;
          padding: 0.75rem;
          border: 1px solid var(--color-border-panel);
          border-radius: 8px;
          font-family: "Monaco", "Menlo", monospace;
          font-size: 0.8rem;
          line-height: 1.5;
          color: #374151;
          margin: 0;
          white-space: pre-wrap;
          word-break: break-all;
          min-height: 60px;
        }
        .test-group {
          border-bottom: 2px solid var(--color-bg-primary);
        }

        .test-header-row td {
          background-color: #f0ebe8;
          padding: 4px 8px;
          border: 1px solid var(--color-border-panel);
        }

        .test-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .test-name-input {
          border: none;
          background: transparent;
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--color-bg-primary-dark);
          outline: none;
          flex-grow: 1;
        }

        .test-header .remove-btn {
          background-color: #e9e2de;
          font-size: 0.75rem;
          height: auto;
          width: auto;
          padding: 4px 8px;
        }

        .actions-cell {
          min-width: 120px;
        }

        .add-row-btn-inline {
          color: #16a34a; /* green */
        }

        .submit-btn {
          background-color: var(--color-bg-primary);
          color: white;
          border-color: var(--color-bg-primary);
        }

        .submit-btn:hover:not(:disabled) {
          background-color: var(--color-bg-primary-dark);
          border-color: var(--color-bg-primary-dark);
        }
      `}</style>
    </div>
  );
};

export default SequenceSheetCreator;
