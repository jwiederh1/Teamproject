import React, { useState, useEffect } from 'react';
import ChatInterface from './features/chat/ChatInterface.jsx';
import Login from './features/Login/Login.jsx';
import authAPI from './api/authApi';
import './index.css';

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        checkAuthentication();
    }, []);

    const checkAuthentication = async () => {
        try {
            setIsCheckingAuth(true);
            setAuthError(null);

            if (authAPI.isAuthenticated()) {
                // Verify token is still valid by making an API call
                await authAPI.getCurrentUser();
                setIsAuthenticated(true);
                console.log('✅ User authenticated successfully');
            } else {
                setIsAuthenticated(false);
                console.log('ℹ️ User not authenticated');
            }
        } catch (error) {
            console.error('❌ Auth check failed:', error);

            // Clear invalid authentication data
            authAPI.logout();
            setIsAuthenticated(false);

            // Set user-friendly error message
            if (error.message.includes('Session expired')) {
                setAuthError('Your session has expired. Please log in again.');
            } else if (error.message.includes('Network')) {
                setAuthError('Unable to connect to server. Please check your connection and try again.');
            } else {
                setAuthError('Authentication failed. Please try logging in again.');
            }
        } finally {
            setIsCheckingAuth(false);
        }
    };

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
        setAuthError(null);
        console.log('✅ Login successful');
    };

    const handleLogout = () => {
        authAPI.logout();
        setIsAuthenticated(false);
        setAuthError(null);
        console.log('✅ Logout successful');
    };

    const handleAuthError = (error) => {
        setAuthError(error);
        setIsAuthenticated(false);
    };

    // Show loading screen while checking authentication
    if (isCheckingAuth) {
        return (
            <div className="app-loading">
                <div className="loading-content">
                    <h1>🤠 Code Cowboy</h1>
                    <div className="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <p style={{
                        marginTop: '20px',
                        fontSize: '1.1rem',
                        color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                        Checking authentication...
                    </p>
                </div>
            </div>
        );
    }

    // Show main application or login screen
    return (
        <div className="app">
            {isAuthenticated ? (
                <ChatInterface onLogout={handleLogout} />
            ) : (
                <Login
                    onLoginSuccess={handleLoginSuccess}
                    onError={handleAuthError}
                    initialError={authError}
                />
            )}
        </div>
    );
};

export default App;