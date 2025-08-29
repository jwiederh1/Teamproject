// api/asyncCodeGenerationApi.js

const API_BASE_URL = 'http://localhost:8000/api';
import authAPI from "./authApi";

// Store active sessions and their callbacks
const activeSessions = new Map();

// WebSocket connection for real-time webhook results
class WebhookWebSocketClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.subscribers = new Map();
    }

    connect() {
        try {
            console.log('🔗 ASYNC API: Connecting to webhook WebSocket...');
            this.ws = new WebSocket('ws://localhost:8080');

            this.ws.onopen = () => {
                console.log('✅ ASYNC API: WebSocket connected to webhook server');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 ASYNC API: WebSocket message received:', data);

                    if (data.type === 'generation-complete') {
                        this.handleGenerationComplete(data);
                    } else if (data.type === 'connection') {
                        console.log('🎉 ASYNC API: WebSocket connection confirmed');
                    } else if (data.type === 'test') {
                        console.log('🧪 ASYNC API: Test message from webhook server:', data.message);
                    }
                } catch (error) {
                    console.error('❌ ASYNC API: Error parsing WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('🔌 ASYNC API: WebSocket connection closed');
                this.isConnected = false;
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('❌ ASYNC API: WebSocket error:', error);
                this.isConnected = false;
            };

        } catch (error) {
            console.error('❌ ASYNC API: Failed to create WebSocket connection:', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('🛑 ASYNC API: Max reconnection attempts reached. WebSocket unavailable.');
            return;
        }

        this.reconnectAttempts++;
        console.log(`🔄 ASYNC API: Attempting to reconnect WebSocket... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);

        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    }

    handleGenerationComplete(data) {
        console.log('🎯 ASYNC API: Generation completed via WebSocket!');
        console.log('Session ID:', data.sessionId);
        console.log('Success:', data.success);

        // Find subscriber for this session
        const callback = this.subscribers.get(data.sessionId);
        if (callback) {
            console.log('📞 ASYNC API: Calling registered callback for session:', data.sessionId);
            callback(data);
            this.subscribers.delete(data.sessionId);
        } else {
            console.log('⚠️ ASYNC API: No callback registered for session:', data.sessionId);
        }
    }

    subscribe(sessionId, callback) {
        console.log('📝 ASYNC API: Subscribing to WebSocket updates for session:', sessionId);
        this.subscribers.set(sessionId, callback);

        if (!this.isConnected && !this.ws) {
            this.connect();
        }
    }

    unsubscribe(sessionId) {
        console.log('🗑️ ASYNC API: Unsubscribing from WebSocket updates for session:', sessionId);
        this.subscribers.delete(sessionId);
    }

    disconnect() {
        if (this.ws) {
            console.log('🔌 ASYNC API: Manually disconnecting WebSocket');
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.subscribers.clear();
    }

    getStatus() {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            subscribersCount: this.subscribers.size
        };
    }
}

// Create singleton WebSocket client
const webhookWebSocket = new WebhookWebSocketClient();

export class AsyncCodeGenerationAPI {

    /**
     * Register session with WebSocket support only (no polling fallback)
     */
    static registerSession(sessionId, onComplete, onProgress = null) {
        console.log(`📝 ASYNC API: Registering session ${sessionId} with WebSocket`);

        // Store session for tracking
        activeSessions.set(sessionId, {
            onComplete,
            onProgress,
            startTime: Date.now()
        });

        // Subscribe to WebSocket updates
        webhookWebSocket.subscribe(sessionId, (data) => {
            console.log('🎉 ASYNC API: Received WebSocket result for session:', sessionId);

            // Call completion callback
            if (onComplete) {
                onComplete(data);
            }

            // Clean up
            this.unregisterSession(sessionId);
        });
    }

    /**
     * Unregister session with WebSocket cleanup
     */
    static unregisterSession(sessionId) {
        console.log(`🗑️ ASYNC API: Unregistering session ${sessionId}`);
        activeSessions.delete(sessionId);
        webhookWebSocket.unsubscribe(sessionId);
    }

    /**
     * Handle webhook result directly
     */
    static handleWebhookResult(result) {
        console.log('🔥 ASYNC API: Processing webhook result');
        console.log('📋 Result:', result);

        const sessionId = result.sessionId;
        const sessionData = activeSessions.get(sessionId);

        if (sessionData) {
            console.log(`✅ ASYNC API: Processing result for session ${sessionId}`);

            // Call completion callback
            if (sessionData.onComplete) {
                sessionData.onComplete(result);
            }

            // Unregister session
            this.unregisterSession(sessionId);
        } else {
            console.log(`⚠️ ASYNC API: Received result for unknown session ${sessionId}`);
        }
    }

    /**
     * Get all active sessions
     */
    static getActiveSessions() {
        return Array.from(activeSessions.keys());
    }

    /**
     * Get WebSocket connection status
     */
    static getWebSocketStatus() {
        return webhookWebSocket.getStatus();
    }

    /**
     * Manually connect WebSocket
     */
    static connectWebSocket() {
        webhookWebSocket.connect();
    }

    /**
     * Manually disconnect WebSocket
     */
    static disconnectWebSocket() {
        webhookWebSocket.disconnect();
    }

    /**
     * Health check - checks unified session system
     */
    static async healthCheck() {
        console.log('🏥 ASYNC API: Checking unified session system health');

        try {
            const response = await fetch(`${API_BASE_URL}/system/health`, {
                headers: authAPI.getAuthHeaders()
            });

            if (!response.ok) {
                console.error('❌ Health check failed, status:', response.status);
                throw new Error(`Health check failed: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ ASYNC API: Unified session system is healthy');
            console.log('Health info:', result);

            return result;

        } catch (error) {
            console.error('💥 ASYNC API: Health check failed:', error.message);
            throw error;
        }
    }

    /**
     * Test webhook connectivity
     */
    static async testWebhookConnectivity() {
        console.log('🧪 ASYNC API: Testing webhook connectivity');

        try {
            const response = await fetch('http://localhost:5174/api/health');

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Webhook server is reachable:', result);
                return true;
            } else {
                console.error('❌ Webhook server responded with error:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Cannot reach webhook server:', error.message);
            return false;
        }
    }
}

// Enhanced webhook handler setup with WebSocket integration only
export const setupWebhookHandler = () => {
    console.log('🔧 ASYNC API: Setting up WebSocket-only webhook handler for unified session system');

    // Connect WebSocket for real-time updates
    webhookWebSocket.connect();

    // Test webhook connectivity
    AsyncCodeGenerationAPI.testWebhookConnectivity().then(isConnected => {
        if (isConnected) {
            console.log('✅ Webhook server is accessible');
        } else {
            console.warn('⚠️ Webhook server is not accessible - WebSocket only');
        }
    });

    // Keep the simulation function for testing
    window.simulateWebhook = (result) => {
        console.log('🧪 ASYNC API: Simulating webhook reception');
        AsyncCodeGenerationAPI.handleWebhookResult(result);
    };

    console.log('✅ ASYNC API: WebSocket-only webhook handler ready');
};

// Export WebSocket client for debugging
export { webhookWebSocket };
export default AsyncCodeGenerationAPI;