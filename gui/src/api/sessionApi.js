// gui/src/api/sessionApi.js
// Clean session API using unified system endpoints only

import authAPI from './authApi';

const API_BASE_URL = 'http://localhost:8000/api';

class SessionAPI {
    constructor() {
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second
    }

    // Helper method to handle API responses with better error handling
    async handleResponse(response) {
        if (!response.ok) {
            let errorMessage = 'Request failed';
            try {
                const error = await response.json();
                errorMessage = error.detail || error.message || errorMessage;
            } catch {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }

            // Add specific handling for common errors
            if (response.status === 401) {
                errorMessage = 'Authentication failed. Please log in again.';
                authAPI.clearAuth();
            } else if (response.status === 404) {
                errorMessage = 'Resource not found';
            } else if (response.status === 500) {
                errorMessage = 'Server error. Please try again later.';
            }

            throw new Error(errorMessage);
        }
        return await response.json();
    }

    // Helper method to get auth headers safely
    getAuthHeaders() {
        try {
            return authAPI.getAuthHeaders();
        } catch (error) {
            console.error('❌ Authentication error:', error);
            throw new Error('Please log in to continue');
        }
    }

    // Retry mechanism for failed requests
    async retryRequest(requestFn, maxRetries = this.retryAttempts) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                lastError = error;

                // Don't retry on authentication errors or client errors (4xx)
                if (error.message.includes('Authentication') ||
                    error.message.includes('HTTP 4') ||
                    error.message.includes('log in')) {
                    throw error;
                }

                if (attempt < maxRetries) {
                    console.warn(`Attempt ${attempt} failed, retrying in ${this.retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
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

    async createSession(sessionName = null) {
        const createRequest = async () => {
            const response = await fetch(`${API_BASE_URL}/sessions/`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ session_name: sessionName })
            });
            return this.handleResponse(response);
        };

        try {
            const session = await this.retryRequest(createRequest);
            console.log('✅ Session created:', session.id);

            localStorage.setItem('current_session_id', session.id);
            return session;

        } catch (error) {
            console.error('❌ Error creating session:', error);
            throw error;
        }
    }

    async getUserSessions() {
        const getRequest = async () => {
            const response = await fetch(`${API_BASE_URL}/sessions/`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            return this.handleResponse(response);
        };

        try {
            const sessions = await this.retryRequest(getRequest);
            console.log(`✅ Retrieved ${sessions.length} sessions`);
            return sessions;

        } catch (error) {
            console.error('❌ Error getting sessions:', error);
            throw error;
        }
    }

    async getSessionState(sessionId) {
        const getStateRequest = async () => {
            const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            return this.handleResponse(response);
        };

        try {
            const sessionState = await this.retryRequest(getStateRequest);
            console.log('✅ Session state retrieved:', sessionId);
            return sessionState;

        } catch (error) {
            console.error('❌ Error getting session state:', error);
            throw error;
        }
    }

    async deleteSession(sessionId) {
        const deleteRequest = async () => {
            const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            return this.handleResponse(response);
        };

        try {
            const result = await this.retryRequest(deleteRequest);
            console.log('✅ Session deleted:', sessionId);

            const currentSessionId = localStorage.getItem('current_session_id');
            if (currentSessionId === sessionId) {
                localStorage.removeItem('current_session_id');
            }

            return result;

        } catch (error) {
            console.error('❌ Error deleting session:', error);
            throw error;
        }
    }

    // ================================
    // MESSAGE MANAGEMENT
    // ================================

    async addMessage(sessionId, message) {
        const addMessageRequest = async () => {
            const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/messages`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message_type: message.type,
                    content: message.content,
                    is_loading: message.isLoading || false,
                    is_error: message.isError || false,
                    has_code: message.hasCode || false,
                    options: message.options ? { options: message.options } : null,
                    code_data: message.codeData || null
                })
            });
            return this.handleResponse(response);
        };

        try {
            const result = await this.retryRequest(addMessageRequest);
            console.log('✅ Message added to session');
            return result;

        } catch (error) {
            console.error('❌ Error adding message:', error);
            throw error;
        }
    }

    // ================================
    // GENERATION MANAGEMENT
    // ================================

    async startGeneration(sessionId, generationRequest) {
        const startGenRequest = async () => {
            console.log('🚀 Starting generation for session:', sessionId);
            console.log('📤 Generation request:', generationRequest);

            const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/generate`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    lqlInterface: generationRequest.lqlInterface || '',
                    userPrompt: generationRequest.userPrompt || '',
                    sequenceSheet: generationRequest.sequenceSheet || '',
                    rankingCriteria: generationRequest.rankingCriteria || [],
                    generationOptions: generationRequest.generationOptions || {},
                    frontendUrl: generationRequest.frontendUrl || window.location.origin
                })
            });
            return this.handleResponse(response);
        };

        try {
            const result = await this.retryRequest(startGenRequest);
            console.log('✅ Generation started for session:', sessionId);
            return result;

        } catch (error) {
            console.error('❌ Error starting generation:', error);
            throw error;
        }
    }

    // ================================
    // CODE REFINEMENT
    // ================================

    async startRefinement(sessionId, refinementData) {
        const refineRequest = async () => {
            const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/refine`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userResponses: refinementData.userResponses || [],
                    selectedCodeID: refinementData.selectedCodeID || 0,
                    frontendUrl: refinementData.frontendUrl || window.location.origin,
                    rankingCriteria: refinementData.rankingCriteria,
                    maxTimeMinutes: refinementData.maxTimeMinutes
                })
            });
            return this.handleResponse(response);
        };

        try {
            const result = await this.retryRequest(refineRequest);
            console.log('✅ Code refinement started for session:', sessionId, 'with selectedCodeID:', refinementData.selectedCodeID);
            return result;
        } catch (error) {
            console.error('❌ Error starting code refinement:', error);
            throw error;
        }
    }

    // ================================
    // LQL VALIDATION
    // ================================

    async validateLQL(sessionId, lqlCode) {
        if (!sessionId) {
            throw new Error("A session ID is required to validate LQL.");
        }

        const validateRequest = async () => {
            const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/validate-lql`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    lqlCode: lqlCode,
                    enableSemanticValidation: true,
                })
            });
            return this.handleResponse(response);
        };

        try {
            const result = await this.retryRequest(validateRequest);
            console.log('✅ LQL validation successful for session:', sessionId);
            return result;
        } catch (error) {
            console.error('❌ Error during LQL validation:', error);
            throw error;
        }
    }

    // ================================
    // UTILITY METHODS
    // ================================

    getCurrentSessionId() {
        return localStorage.getItem('current_session_id');
    }

    setCurrentSessionId(sessionId) {
        localStorage.setItem('current_session_id', sessionId);
    }

    clearCurrentSession() {
        localStorage.removeItem('current_session_id');
    }

    async validateSession(sessionId) {
        try {
            await this.getSessionState(sessionId);
            return true;
        } catch (error) {
            return false;
        }
    }

    async healthCheck() {
        try {
            const response = await fetch(`${API_BASE_URL}/system/health`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            return this.handleResponse(response);
        } catch (error) {
            console.error('❌ Health check failed:', error);
            return { status: 'unhealthy', error: error.message };
        }
    }

    clearAuth() {
        authAPI.logout();
        this.clearCurrentSession();
        console.log('✅ Authentication and session data cleared');
    }
}

// Create singleton instance
const sessionAPI = new SessionAPI();
export default sessionAPI;