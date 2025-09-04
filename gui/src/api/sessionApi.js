import authAPI from "./authApi";

const API_BASE_URL = "http://localhost:8000/api";

/**
 * A singleton class that provides an interface for interacting with the session-related
 * endpoints of the backend API. It handles creating, fetching, and modifying chat
 * sessions, messages, and code generation tasks.
 */
class SessionAPI {
  constructor() {
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  /**
   * A robust helper to process API fetch responses, handling non-OK statuses
   * and parsing JSON error details.
   * @param {Response} response - The raw response object from a fetch call.
   * @returns {Promise<object>} A promise that resolves with the parsed JSON body.
   * @throws {Error} If the response status is not OK.
   */
  async handleResponse(response) {
    if (!response.ok) {
      let errorMessage = "Request failed";
      try {
        const error = await response.json();
        errorMessage = error.detail || error.message || errorMessage;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }

      if (response.status === 401) {
        errorMessage = "Authentication failed. Please log in again.";
        authAPI.logout();
      } else if (response.status === 404) {
        errorMessage = "Resource not found";
      } else if (response.status === 500) {
        errorMessage = "Server error. Please try again later.";
      }

      throw new Error(errorMessage);
    }
    return await response.json();
  }

  /**
   * A safe way to get authorization headers from the authAPI.
   * @returns {object} The authorization headers.
   * @throws {Error} If the user is not authenticated.
   */
  getAuthHeaders() {
    try {
      return authAPI.getAuthHeaders();
    } catch (error) {
      console.error("❌ Authentication error:", error);
      throw new Error("Please log in to continue");
    }
  }

  /**
   * A generic retry wrapper for API requests that may fail due to transient
   * network issues. Does not retry on client or authentication errors.
   * @param {function(): Promise<any>} requestFn - The async function to execute.
   * @param {number} [maxRetries=this.retryAttempts] - The maximum number of retry attempts.
   * @returns {Promise<any>} A promise that resolves with the result of the successful request.
   * @throws {Error} If all retry attempts fail.
   */
  async retryRequest(requestFn, maxRetries = this.retryAttempts) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        if (
          error.message.includes("Authentication") ||
          error.message.includes("HTTP 4") ||
          error.message.includes("log in")
        ) {
          throw error;
        }

        if (attempt < maxRetries) {
          console.warn(
            `Attempt ${attempt} failed, retrying in ${this.retryDelay}ms...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelay * attempt),
          );
        } else {
          console.error(`All ${maxRetries} attempts failed`);
        }
      }
    }
    throw lastError;
  }

  // ================================
  // SESSION MANAGEMENT
  // ================================

  /**
   * Creates a new chat session.
   * @param {string|null} [sessionName=null] - An optional name for the new session.
   * @returns {Promise<object>} A promise that resolves with the new session data.
   */
  async createSession(sessionName = null) {
    const createRequest = async () => {
      const response = await fetch(`${API_BASE_URL}/sessions/`, {
        method: "POST",
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_name: sessionName }),
      });
      return this.handleResponse(response);
    };

    try {
      const session = await this.retryRequest(createRequest);
      console.log("✅ Session created:", session.id);
      localStorage.setItem("current_session_id", session.id);
      return session;
    } catch (error) {
      console.error("❌ Error creating session:", error);
      throw error;
    }
  }

  /**
   * Fetches all sessions for the currently authenticated user.
   * @returns {Promise<Array<object>>} A promise that resolves with an array of session objects.
   */
  async getUserSessions() {
    const getRequest = async () => {
      const response = await fetch(`${API_BASE_URL}/sessions/`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse(response);
    };

    try {
      const sessions = await this.retryRequest(getRequest);
      console.log(`✅ Retrieved ${sessions.length} sessions`);
      return sessions;
    } catch (error) {
      console.error("❌ Error getting sessions:", error);
      throw error;
    }
  }

  /**
   * Retrieves the entire state of a specific session, including messages and results.
   * @param {string} sessionId - The ID of the session to fetch.
   * @returns {Promise<object>} A promise that resolves with the session state.
   */
  async getSessionState(sessionId) {
    const getStateRequest = async () => {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse(response);
    };

    try {
      const sessionState = await this.retryRequest(getStateRequest);
      console.log("✅ Session state retrieved:", sessionId);
      return sessionState;
    } catch (error) {
      console.error("❌ Error getting session state:", error);
      throw error;
    }
  }

  /**
   * Deletes a session from the backend.
   * @param {string} sessionId - The ID of the session to delete.
   * @returns {Promise<object>} A promise that resolves with the deletion confirmation.
   */
  async deleteSession(sessionId) {
    const deleteRequest = async () => {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse(response);
    };

    try {
      const result = await this.retryRequest(deleteRequest);
      console.log("✅ Session deleted:", sessionId);

      const currentSessionId = localStorage.getItem("current_session_id");
      if (currentSessionId === sessionId) {
        localStorage.removeItem("current_session_id");
      }
      return result;
    } catch (error) {
      console.error("❌ Error deleting session:", error);
      throw error;
    }
  }

  // ================================
  // MESSAGE MANAGEMENT
  // ================================

  /**
   * Adds a message to a specific session's history.
   * @param {string} sessionId - The ID of the session.
   * @param {object} message - The message object to add.
   * @returns {Promise<object>} A promise that resolves with the server's response.
   */
  async addMessage(sessionId, message) {
    const addMessageRequest = async () => {
      const response = await fetch(
        `${API_BASE_URL}/sessions/${sessionId}/messages`,
        {
          method: "POST",
          headers: {
            ...this.getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message_type: message.type,
            content: message.content,
            is_loading: message.isLoading || false,
            is_error: message.isError || false,
            has_code: message.hasCode || false,
            options: message.options ? { options: message.options } : null,
            code_data: message.codeData || null,
          }),
        },
      );
      return this.handleResponse(response);
    };

    try {
      const result = await this.retryRequest(addMessageRequest);
      console.log("✅ Message added to session");
      return result;
    } catch (error) {
      console.error("❌ Error adding message:", error);
      throw error;
    }
  }

  // ================================
  // GENERATION & REFINEMENT
  // ================================

  /**
   * Initiates an asynchronous code generation task for a session.
   * @param {string} sessionId - The ID of the session.
   * @param {object} generationRequest - The payload containing all generation parameters.
   * @returns {Promise<object>} A promise that resolves with the initial response from the server.
   */
  async startGeneration(sessionId, generationRequest) {
    const startGenRequest = async () => {
      console.log("🚀 Starting generation for session:", sessionId);
      console.log("📤 Generation request:", generationRequest);

      const response = await fetch(
        `${API_BASE_URL}/sessions/${sessionId}/generate`,
        {
          method: "POST",
          headers: {
            ...this.getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(generationRequest),
        },
      );
      return this.handleResponse(response);
    };

    try {
      const result = await this.retryRequest(startGenRequest);
      console.log("✅ Generation started for session:", sessionId);
      return result;
    } catch (error) {
      console.error("❌ Error starting generation:", error);
      throw error;
    }
  }

  /**
   * Initiates an asynchronous code refinement task for a session.
   * @param {string} sessionId - The ID of the session.
   * @param {object} refinementData - The payload containing refinement parameters.
   * @returns {Promise<object>} A promise that resolves with the initial response from the server.
   */
  async startRefinement(sessionId, refinementData) {
    const refineRequest = async () => {
      const response = await fetch(
        `${API_BASE_URL}/sessions/${sessionId}/refine`,
        {
          method: "POST",
          headers: {
            ...this.getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(refinementData),
        },
      );
      return this.handleResponse(response);
    };

    try {
      const result = await this.retryRequest(refineRequest);
      console.log(
        "✅ Code refinement started for session:",
        sessionId,
        "with selectedCodeID:",
        refinementData.selectedCodeID,
      );
      return result;
    } catch (error) {
      console.error("❌ Error starting code refinement:", error);
      throw error;
    }
  }

  // ================================
  // LQL VALIDATION
  // ================================

  /**
   * Sends LQL code to the backend for validation within a session.
   * @param {string} sessionId - The ID of the session.
   * @param {string} lqlCode - The LQL code to validate.
   * @returns {Promise<object>} A promise that resolves with the validation result.
   */
  async validateLQL(sessionId, lqlCode) {
    if (!sessionId) {
      throw new Error("A session ID is required to validate LQL.");
    }

    const validateRequest = async () => {
      const response = await fetch(
        `${API_BASE_URL}/sessions/${sessionId}/validate-lql`,
        {
          method: "POST",
          headers: {
            ...this.getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lqlCode: lqlCode,
            enableSemanticValidation: true,
          }),
        },
      );
      return this.handleResponse(response);
    };

    try {
      const result = await this.retryRequest(validateRequest);
      console.log("✅ LQL validation successful for session:", sessionId);
      return result;
    } catch (error) {
      console.error("❌ Error during LQL validation:", error);
      throw error;
    }
  }

  // ================================
  // UTILITY METHODS
  // ================================

  getCurrentSessionId() {
    return localStorage.getItem("current_session_id");
  }

  setCurrentSessionId(sessionId) {
    localStorage.setItem("current_session_id", sessionId);
  }

  clearCurrentSession() {
    localStorage.removeItem("current_session_id");
  }

  /**
   * Validates if a session ID is still valid on the backend.
   * @param {string} sessionId - The session ID to validate.
   * @returns {Promise<boolean>} True if the session is valid.
   */
  async validateSession(sessionId) {
    try {
      await this.getSessionState(sessionId);
      return true;
    } catch (error) {
      return false;
    }
  }
}

const sessionAPI = new SessionAPI();
export default sessionAPI;
