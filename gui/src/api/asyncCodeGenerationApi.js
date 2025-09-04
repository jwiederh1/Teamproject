import authAPI from "./authApi";

const API_BASE_URL = "http://localhost:8000/api";

/**
 * A map to store active session callbacks for asynchronous operations.
 * @type {Map<string, {onComplete: function, onProgress: function|null, startTime: number}>}
 */
const activeSessions = new Map();

/**
 * Manages the WebSocket connection to the backend's webhook server for real-time
 * updates on code generation and refinement tasks. It handles connection,
 * reconnection logic, and message dispatching to subscribers.
 */
class WebhookWebSocketClient {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.subscribers = new Map();
  }

  /**
   * Initiates a connection to the WebSocket server.
   */
  connect() {
    try {
      console.log("🔗 ASYNC API: Connecting to webhook WebSocket...");
      this.ws = new WebSocket("ws://localhost:8080");

      this.ws.onopen = () => {
        console.log("✅ ASYNC API: WebSocket connected to webhook server");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📨 ASYNC API: WebSocket message received:", data);

          if (data.type === "generation-complete") {
            this.handleGenerationComplete(data);
          } else if (data.type === "connection") {
            console.log("🎉 ASYNC API: WebSocket connection confirmed");
          } else if (data.type === "test") {
            console.log(
              "🧪 ASYNC API: Test message from webhook server:",
              data.message,
            );
          }
        } catch (error) {
          console.error(
            "❌ ASYNC API: Error parsing WebSocket message:",
            error,
          );
        }
      };

      this.ws.onclose = () => {
        console.log("🔌 ASYNC API: WebSocket connection closed");
        this.isConnected = false;
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error("❌ ASYNC API: WebSocket error:", error);
        this.isConnected = false;
      };
    } catch (error) {
      console.error(
        "❌ ASYNC API: Failed to create WebSocket connection:",
        error,
      );
      this.attemptReconnect();
    }
  }

  /**
   * Attempts to reconnect to the WebSocket server with exponential backoff.
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(
        "🛑 ASYNC API: Max reconnection attempts reached. WebSocket unavailable.",
      );
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `🔄 ASYNC API: Attempting to reconnect WebSocket... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  /**
   * Handles an incoming 'generation-complete' message by invoking the
   * appropriate session callback.
   * @param {object} data - The message data from the WebSocket.
   */
  handleGenerationComplete(data) {
    console.log("🎯 ASYNC API: Generation completed via WebSocket!");
    const callback = this.subscribers.get(data.sessionId);
    if (callback) {
      console.log(
        "📞 ASYNC API: Calling registered callback for session:",
        data.sessionId,
      );
      callback(data);
      this.subscribers.delete(data.sessionId);
    } else {
      console.log(
        "⚠️ ASYNC API: No callback registered for session:",
        data.sessionId,
      );
    }
  }

  /**
   * Subscribes a callback function to a specific session ID.
   * @param {string} sessionId - The session ID to listen for.
   * @param {function} callback - The function to call when a message for the session arrives.
   */
  subscribe(sessionId, callback) {
    console.log(
      "📝 ASYNC API: Subscribing to WebSocket updates for session:",
      sessionId,
    );
    this.subscribers.set(sessionId, callback);

    if (!this.isConnected && !this.ws) {
      this.connect();
    }
  }

  /**
   * Removes a subscription for a specific session ID.
   * @param {string} sessionId - The session ID to unsubscribe from.
   */
  unsubscribe(sessionId) {
    console.log(
      "🗑️ ASYNC API: Unsubscribing from WebSocket updates for session:",
      sessionId,
    );
    this.subscribers.delete(sessionId);
  }

  /**
   * Manually closes the WebSocket connection.
   */
  disconnect() {
    if (this.ws) {
      console.log("🔌 ASYNC API: Manually disconnecting WebSocket");
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.subscribers.clear();
  }

  /**
   * Gets the current status of the WebSocket connection.
   * @returns {{connected: boolean, reconnectAttempts: number, subscribersCount: number}} The status object.
   */
  getStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscribersCount: this.subscribers.size,
    };
  }
}

const webhookWebSocket = new WebhookWebSocketClient();

/**
 * Provides a static interface for managing asynchronous code generation tasks,
 * primarily through a WebSocket connection.
 */
export class AsyncCodeGenerationAPI {
  /**
   * Registers a session to listen for completion events via WebSocket.
   * @param {string} sessionId - The session ID to monitor.
   * @param {function} onComplete - The callback to execute when the task is complete.
   * @param {function|null} [onProgress=null] - A callback for progress updates (currently unused).
   */
  static registerSession(sessionId, onComplete, onProgress = null) {
    console.log(
      `📝 ASYNC API: Registering session ${sessionId} with WebSocket`,
    );

    activeSessions.set(sessionId, {
      onComplete,
      onProgress,
      startTime: Date.now(),
    });

    webhookWebSocket.subscribe(sessionId, (data) => {
      console.log(
        "🎉 ASYNC API: Received WebSocket result for session:",
        sessionId,
      );
      if (onComplete) {
        onComplete(data);
      }
      this.unregisterSession(sessionId);
    });
  }

  /**
   * Unregisters a session, removing it from active tracking and unsubscribing from WebSocket updates.
   * @param {string} sessionId - The session ID to unregister.
   */
  static unregisterSession(sessionId) {
    console.log(`🗑️ ASYNC API: Unregistering session ${sessionId}`);
    activeSessions.delete(sessionId);
    webhookWebSocket.unsubscribe(sessionId);
  }

  /**
   * Handles a webhook result pushed from an external source (e.g., simulation).
   * @param {object} result - The webhook result object.
   */
  static handleWebhookResult(result) {
    console.log("🔥 ASYNC API: Processing webhook result");
    const sessionId = result.sessionId;
    const sessionData = activeSessions.get(sessionId);

    if (sessionData) {
      console.log(`✅ ASYNC API: Processing result for session ${sessionId}`);
      if (sessionData.onComplete) {
        sessionData.onComplete(result);
      }
      this.unregisterSession(sessionId);
    } else {
      console.log(
        `⚠️ ASYNC API: Received result for unknown session ${sessionId}`,
      );
    }
  }

  /**
   * Returns an array of all currently active session IDs being monitored.
   * @returns {string[]} An array of session IDs.
   */
  static getActiveSessions() {
    return Array.from(activeSessions.keys());
  }

  /**
   * Retrieves the current status of the WebSocket client.
   * @returns {object} The status object from the WebSocket client.
   */
  static getWebSocketStatus() {
    return webhookWebSocket.getStatus();
  }

  /**
   * Manually initiates the WebSocket connection.
   */
  static connectWebSocket() {
    webhookWebSocket.connect();
  }

  /**
   * Manually disconnects the WebSocket.
   */
  static disconnectWebSocket() {
    webhookWebSocket.disconnect();
  }

  /**
   * Performs a health check on the main backend API.
   * @returns {Promise<object>} A promise that resolves with the health status.
   */
  static async healthCheck() {
    console.log("🏥 ASYNC API: Checking unified session system health");
    try {
      const response = await fetch(`${API_BASE_URL}/system/health`, {
        headers: authAPI.getAuthHeaders(),
      });

      if (!response.ok) {
        console.error("❌ Health check failed, status:", response.status);
        throw new Error(`Health check failed: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ ASYNC API: Unified session system is healthy");
      return result;
    } catch (error) {
      console.error("💥 ASYNC API: Health check failed:", error.message);
      throw error;
    }
  }

  /**
   * Tests connectivity to the local webhook server.
   * @returns {Promise<boolean>} A promise that resolves to true if the server is reachable.
   */
  static async testWebhookConnectivity() {
    console.log("🧪 ASYNC API: Testing webhook connectivity");
    try {
      const response = await fetch("http://localhost:5174/api/health");
      if (response.ok) {
        const result = await response.json();
        console.log("✅ Webhook server is reachable:", result);
        return true;
      } else {
        console.error(
          "❌ Webhook server responded with error:",
          response.status,
        );
        return false;
      }
    } catch (error) {
      console.error("❌ Cannot reach webhook server:", error.message);
      return false;
    }
  }
}

/**
 * Initializes the webhook handling system by connecting the WebSocket client
 * and setting up a global function for simulating webhook events for testing.
 */
export const setupWebhookHandler = () => {
  console.log(
    "🔧 ASYNC API: Setting up WebSocket-only webhook handler for unified session system",
  );
  webhookWebSocket.connect();

  AsyncCodeGenerationAPI.testWebhookConnectivity().then((isConnected) => {
    if (!isConnected) {
      console.warn("⚠️ Webhook server is not accessible - WebSocket only");
    }
  });

  window.simulateWebhook = (result) => {
    console.log("🧪 ASYNC API: Simulating webhook reception");
    AsyncCodeGenerationAPI.handleWebhookResult(result);
  };

  console.log("✅ ASYNC API: WebSocket-only webhook handler ready");
};

export { webhookWebSocket };
export default AsyncCodeGenerationAPI;
