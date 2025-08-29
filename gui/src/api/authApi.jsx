// gui/src/api/authApi.js
const API_BASE_URL = 'http://localhost:8000/api';

class AuthAPI {
    constructor() {
        this.token = localStorage.getItem('auth_token');
        this.userId = localStorage.getItem('user_id');
        this.username = localStorage.getItem('username');
    }

    // Get authorization headers
    getAuthHeaders() {
        if (!this.token) {
            throw new Error('No authentication token available');
        }
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    // Register new user
    async register(username, email, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Registration failed');
            }

            const userData = await response.json();
            console.log('✅ User registered successfully:', userData.username);
            return userData;

        } catch (error) {
            console.error('❌ Registration error:', error);
            // Handle network errors
            if (error.message === 'Failed to fetch') {
                throw new Error('Unable to connect to server. Please check if the backend is running on http://localhost:8000');
            }
            throw error;
        }
    }

    // Login user
    async login(username, password) {
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch(`${API_BASE_URL}/auth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Login failed');
            }

            const tokenData = await response.json();

            // Store authentication data
            this.token = tokenData.access_token;
            this.userId = tokenData.user_id;
            this.username = tokenData.username;

            localStorage.setItem('auth_token', this.token);
            localStorage.setItem('user_id', this.userId);
            localStorage.setItem('username', this.username);

            console.log('✅ User logged in successfully:', this.username);
            return tokenData;

        } catch (error) {
            console.error('❌ Login error:', error);
            // Handle network errors
            if (error.message === 'Failed to fetch') {
                throw new Error('Unable to connect to server. Please check if the backend is running on http://localhost:8000');
            }
            throw error;
        }
    }

    // Logout user
    logout() {
        this.token = null;
        this.userId = null;
        this.username = null;

        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('username');
        localStorage.removeItem('current_session_id');

        console.log('✅ User logged out');
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token;
    }

    // Get current user info
    async getCurrentUser() {
        if (!this.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired or invalid
                    this.logout();
                    throw new Error('Session expired. Please login again.');
                }
                const error = await response.json();
                throw new Error(error.detail || 'Failed to get user info');
            }

            const userData = await response.json();
            return userData;

        } catch (error) {
            console.error('❌ Error getting current user:', error);
            // Handle network errors
            if (error.message === 'Failed to fetch') {
                throw new Error('Unable to connect to server. Please check if the backend is running');
            }
            throw error;
        }
    }

    // Test connection to backend
    async testConnection() {
        try {
            const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                console.log('✅ Backend connection successful');
                return true;
            } else {
                console.log('⚠️ Backend responded but with error status:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Backend connection failed:', error);
            return false;
        }
    }

    // Refresh token (if implemented on backend)
    async refreshToken() {
        // Implementation depends on backend refresh token endpoint
        console.log('Token refresh not implemented yet');
    }
}

// Create singleton instance
const authAPI = new AuthAPI();
export default authAPI;