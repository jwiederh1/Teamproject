// FILE: src/utils/errorFormatters.js

/**
 * A collection of utility functions for formatting errors for display in the UI.
 */

/**
 * Formats LQL validation errors into a human-readable string.
 * @param {Array<Object|string>} errors - An array of error objects or strings from the API.
 * @returns {string} A formatted string ready for display in a message bubble.
 */
export function formatLqlErrorsForDisplay(errors) {
    if (!errors || errors.length === 0) {
        return "No errors found.";
    }

    // Standardize error messages, whether they are strings or objects with a 'message' property.
    const errorMessages = errors.map(error => {
        if (typeof error === 'string') {
            return error;
        }
        if (typeof error === 'object' && error.message) {
            return error.message;
        }
        return 'An unspecified error occurred.';
    });

    // Simple formatting with bullet points.
    return errorMessages.map(msg => `- ${msg}`).join('\n');
}

/**
 * Extracts a concise, user-friendly error message from various error types.
 * @param {Error|Object|string} error - The error object caught in a try-catch block.
 * @returns {string} A simple, clean error message.
 */
export function getSimpleErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (typeof error === 'object' && error.detail) {
        return error.detail;
    }
    if (typeof error === 'object' && error.message) {
        return error.message;
    }
    return "An unknown error occurred. Please check the console for details.";
}