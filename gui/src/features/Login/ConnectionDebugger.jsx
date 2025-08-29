import React, { useState, useEffect } from 'react';

const ConnectionDebugger = ({ onClose }) => {
    const [testResults, setTestResults] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const runDiagnostics = async () => {
        setIsLoading(true);
        const results = {};

        // Test 1: Basic connection to backend
        try {
            const response = await fetch('http://localhost:8000/health');
            if (response.ok) {
                const data = await response.json();
                results.backendHealth = { success: true, data };
            } else {
                results.backendHealth = { success: false, error: `HTTP ${response.status}` };
            }
        } catch (error) {
            results.backendHealth = { success: false, error: error.message };
        }

        // Test 2: API root endpoint
        try {
            const response = await fetch('http://localhost:8000/');
            if (response.ok) {
                const data = await response.json();
                results.apiRoot = { success: true, data };
            } else {
                results.apiRoot = { success: false, error: `HTTP ${response.status}` };
            }
        } catch (error) {
            results.apiRoot = { success: false, error: error.message };
        }

        // Test 3: Auth endpoint accessibility
        try {
            const response = await fetch('http://localhost:8000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'test', email: 'test@test.com', password: 'test' })
            });

            // We expect this to fail (probably user exists), but we want to see if the endpoint is reachable
            const data = await response.json();
            results.authEndpoint = {
                success: true,
                status: response.status,
                message: 'Auth endpoint is reachable',
                response: data
            };
        } catch (error) {
            results.authEndpoint = { success: false, error: error.message };
        }

        // Test 4: CORS check
        try {
            const response = await fetch('http://localhost:8000/api/auth/me', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer test-token' }
            });

            results.corsTest = {
                success: true,
                status: response.status,
                message: 'CORS is working (got response, even if unauthorized)'
            };
        } catch (error) {
            if (error.message.includes('CORS')) {
                results.corsTest = { success: false, error: 'CORS Error: ' + error.message };
            } else {
                results.corsTest = { success: true, message: 'CORS OK, got network response' };
            }
        }

        // Test 5: Check localStorage
        const token = localStorage.getItem('auth_token');
        const userId = localStorage.getItem('user_id');
        const username = localStorage.getItem('username');

        results.localStorage = {
            success: true,
            data: {
                hasToken: !!token,
                hasUserId: !!userId,
                hasUsername: !!username,
                token: token ? token.substring(0, 20) + '...' : null
            }
        };

        setTestResults(results);
        setIsLoading(false);
    };

    useEffect(() => {
        runDiagnostics();
    }, []);

    const ResultItem = ({ title, result }) => (
        <div style={{
            padding: '12px',
            margin: '8px 0',
            borderRadius: '6px',
            border: `2px solid ${result.success ? '#10b981' : '#ef4444'}`,
            backgroundColor: result.success ? '#f0fdf4' : '#fef2f2'
        }}>
            <div style={{
                fontWeight: 'bold',
                color: result.success ? '#065f46' : '#991b1b',
                marginBottom: '4px'
            }}>
                {result.success ? '✅' : '❌'} {title}
            </div>
            {result.error && (
                <div style={{ color: '#991b1b', fontSize: '0.9rem' }}>
                    Error: {result.error}
                </div>
            )}
            {result.message && (
                <div style={{ color: '#065f46', fontSize: '0.9rem' }}>
                    {result.message}
                </div>
            )}
            {result.data && (
                <details style={{ marginTop: '8px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                        View Details
                    </summary>
                    <pre style={{
                        background: '#f3f4f6',
                        padding: '8px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        marginTop: '4px',
                        overflow: 'auto',
                        maxHeight: '100px'
                    }}>
                        {JSON.stringify(result.data, null, 2)}
                    </pre>
                </details>
            )}
        </div>
    );

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '600px',
                maxHeight: '80vh',
                overflow: 'auto',
                width: '90%'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px'
                }}>
                    <h2 style={{ margin: 0, color: '#374151' }}>
                        🔧 Connection Diagnostics
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            cursor: 'pointer',
                            color: '#6b7280'
                        }}
                    >
                        ×
                    </button>
                </div>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{
                            display: 'inline-block',
                            width: '40px',
                            height: '40px',
                            border: '4px solid #f3f4f6',
                            borderTop: '4px solid #3b82f6',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        <p style={{ marginTop: '16px', color: '#6b7280' }}>
                            Running diagnostics...
                        </p>
                    </div>
                ) : (
                    <div>
                        <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                            This tool helps diagnose connection issues between the frontend and backend.
                        </p>

                        {Object.entries(testResults).map(([key, result]) => {
                            const titles = {
                                backendHealth: 'Backend Health Check',
                                apiRoot: 'API Root Endpoint',
                                authEndpoint: 'Authentication Endpoint',
                                corsTest: 'CORS Configuration',
                                localStorage: 'Local Storage State'
                            };

                            return (
                                <ResultItem
                                    key={key}
                                    title={titles[key] || key}
                                    result={result}
                                />
                            );
                        })}

                        <div style={{
                            marginTop: '24px',
                            padding: '16px',
                            backgroundColor: '#f9fafb',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb'
                        }}>
                            <h4 style={{ margin: '0 0 12px 0', color: '#374151' }}>
                                💡 Troubleshooting Tips:
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: '#6b7280' }}>
                                <li>Make sure the backend is running on http://localhost:8000</li>
                                <li>Check if you can access http://localhost:8000/docs directly in your browser</li>
                                <li>Verify no firewall is blocking the connection</li>
                                <li>Try refreshing the page if you see CORS errors</li>
                                <li>Check browser console for additional error details</li>
                            </ul>
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            marginTop: '20px',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={runDiagnostics}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                🔄 Re-run Tests
                            </button>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConnectionDebugger;