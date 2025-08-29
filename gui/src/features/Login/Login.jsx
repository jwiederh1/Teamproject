import React, { useState, useEffect } from 'react';
import authAPI from '../../api/authApi.jsx';

const Login = ({ onLoginSuccess, onError, initialError }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(initialError || '');
    const [isLoading, setIsLoading] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    // Update error when initialError changes
    useEffect(() => {
        if (initialError) {
            setError(initialError);
        }
    }, [initialError]);

    // Clear errors when switching between login/register
    useEffect(() => {
        setError('');
        setValidationErrors({});
    }, [isLogin]);

    const validateForm = () => {
        const errors = {};

        // Username validation
        if (!username.trim()) {
            errors.username = 'Username is required';
        } else if (username.length < 3) {
            errors.username = 'Username must be at least 3 characters';
        } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            errors.username = 'Username can only contain letters, numbers, and underscores';
        }

        // Email validation (only for registration)
        if (!isLogin) {
            if (!email.trim()) {
                errors.email = 'Email is required';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errors.email = 'Please enter a valid email address';
            }
        }

        // Password validation
        if (!password) {
            errors.password = 'Password is required';
        } else if (!isLogin && password.length < 6) {
            errors.password = 'Password must be at least 6 characters';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate form
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            if (isLogin) {
                // Login existing user
                const response = await authAPI.login(username, password);
                console.log('✅ Login successful for user:', response.username || username);
                onLoginSuccess();
            } else {
                // Register new user
                const response = await authAPI.register(username, email, password);
                console.log('✅ Registration successful for user:', response.username || username);

                // After registration, login automatically
                const loginResponse = await authAPI.login(username, password);
                console.log('✅ Auto-login successful for new user');
                onLoginSuccess();
            }
        } catch (err) {
            console.error('❌ Authentication error:', err);

            // Handle specific error types
            let errorMessage = '';

            if (err.message.includes('Username or email already registered')) {
                errorMessage = 'An account with this username or email already exists. Please try a different one or login instead.';
            } else if (err.message.includes('Incorrect username or password')) {
                errorMessage = 'Invalid username or password. Please check your credentials and try again.';
            } else if (err.message.includes('Network')) {
                errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
            } else if (err.message.includes('Failed to fetch')) {
                errorMessage = 'Server is unavailable. Please try again later.';
            } else {
                errorMessage = err.message || `${isLogin ? 'Login' : 'Registration'} failed. Please try again.`;
            }

            setError(errorMessage);
            onError?.(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleMode = () => {
        setIsLogin(!isLogin);
        setError('');
        setValidationErrors({});
        // Clear form fields when switching modes
        if (!isLogin) {
            setEmail('');
        }
    };

    const getInputClassName = (fieldName) => {
        let className = 'form-input';
        if (validationErrors[fieldName]) {
            className += ' form-input-error';
        }
        return className;
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>🤠 Code Cowboy</h1>
                    <p>{isLogin ? 'Welcome back, partner!' : 'Join the ranch!'}</p>
                </div>

                <div className="login-form">
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                // Clear validation error when user starts typing
                                if (validationErrors.username) {
                                    setValidationErrors(prev => ({ ...prev, username: '' }));
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                            required
                            placeholder="Enter your username"
                            className={getInputClassName('username')}
                            disabled={isLoading}
                            maxLength={50}
                        />
                        {validationErrors.username && (
                            <div className="field-error">
                                {validationErrors.username}
                            </div>
                        )}
                    </div>

                    {!isLogin && (
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    // Clear validation error when user starts typing
                                    if (validationErrors.email) {
                                        setValidationErrors(prev => ({ ...prev, email: '' }));
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                                required
                                placeholder="Enter your email"
                                className={getInputClassName('email')}
                                disabled={isLoading}
                                maxLength={255}
                            />
                            {validationErrors.email && (
                                <div className="field-error">
                                    {validationErrors.email}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                // Clear validation error when user starts typing
                                if (validationErrors.password) {
                                    setValidationErrors(prev => ({ ...prev, password: '' }));
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                            required
                            placeholder="Enter your password"
                            className={getInputClassName('password')}
                            disabled={isLoading}
                            maxLength={255}
                        />
                        {validationErrors.password && (
                            <div className="field-error">
                                {validationErrors.password}
                            </div>
                        )}
                        {!isLogin && (
                            <div className="password-hint">
                                Password must be at least 6 characters long
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="error-message">
                            ⚠️ {error}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="primary-button login-button"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="login-loading">
                                <div className="loading-spinner"></div>
                                {isLogin ? 'Logging in...' : 'Creating account...'}
                            </span>
                        ) : (
                            <span>{isLogin ? 'Login' : 'Create Account'}</span>
                        )}
                    </button>
                </div>

                <div className="login-footer">
                    <button
                        type="button"
                        onClick={handleToggleMode}
                        className="toggle-button"
                        disabled={isLoading}
                    >
                        {isLogin
                            ? "Don't have an account? Create one"
                            : "Already have an account? Login"
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;