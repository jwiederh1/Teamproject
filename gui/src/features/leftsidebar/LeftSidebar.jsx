import React, { useState, useEffect } from 'react';
import GenerationSettingsModal from './GenerationSettingsModal.jsx';
import sessionAPI from '../../api/sessionApi.js';

const LeftSidebar = ({
                         isOpen,
                         onToggle,
                         generationSettings,
                         onSettingsChange,
                         currentSessionId,
                         onSessionChange,
                         hasGeneratedCode
                     }) => {
    const [activeTab, setActiveTab] = useState('sessions');
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showNewSessionInput, setShowNewSessionInput] = useState(false);
    const [newSessionName, setNewSessionName] = useState('');

    // Load sessions when sidebar opens or when switching to history tab
    useEffect(() => {
        if (isOpen) {
            loadSessions();
        }
    }, [isOpen]);

    // Load sessions from API
    const loadSessions = async () => {
        setLoading(true);
        setError(null);
        try {
            const userSessions = await sessionAPI.getUserSessions();
            setSessions(userSessions);
        } catch (err) {
            console.error('Error loading sessions:', err);
            setError('Failed to load conversations');
        } finally {
            setLoading(false);
        }
    };

    // Get conversation preview from session data
    const getConversationPreview = (session) => {
        // Try to get actual conversation preview from session data
        if (session.last_message_preview) {
            return session.last_message_preview;
        }

        if (!session.message_count || session.message_count === 0) {
            return 'New conversation - no messages yet';
        } else if (session.message_count === 1) {
            return 'Just started chatting with Cody';
        } else if (session.conversation_phase === 'generating') {
            return '🔄 Cody is generating code...';
        } else if (session.conversation_phase === 'completed') {
            return '✅ Code generation completed';
        } else if (session.conversation_phase === 'awaiting_input') {
            return '⏳ Waiting for your input';
        } else {
            // Show based on message count
            if (session.message_count < 5) {
                return `Early conversation - ${session.message_count} messages`;
            } else if (session.message_count < 15) {
                return `Active discussion - ${session.message_count} messages`;
            } else {
                return `Long conversation - ${session.message_count} messages`;
            }
        }
    };

    // Get human-readable status label
    const getStatusLabel = (phase) => {
        switch (phase) {
            case 'awaiting_input':
                return 'Waiting for input';
            case 'generating':
                return 'Generating';
            case 'completed':
                return 'Completed';
            default:
                return phase;
        }
    };

    // Create new session
    const handleCreateSession = async () => {
        if (!newSessionName.trim()) return;

        setLoading(true);
        try {
            const newSession = await sessionAPI.createSession(newSessionName.trim());

            // Add to sessions list at the top
            setSessions(prev => [newSession, ...prev]);
            setNewSessionName('');
            setShowNewSessionInput(false);

            // Switch to the new session immediately
            if (onSessionChange) {
                await onSessionChange(newSession.id);
            }

            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                onToggle();
            }

        } catch (err) {
            console.error('Error creating session:', err);
            setError('Failed to create new conversation');
        } finally {
            setLoading(false);
        }
    };

    // Delete session
    const handleDeleteSession = async (sessionId, event) => {
        event.stopPropagation(); // Prevent session selection

        if (!confirm('Are you sure you want to delete this session?')) return;

        setLoading(true);
        try {
            await sessionAPI.deleteSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));

            // If we deleted the current session, notify parent
            if (sessionId === currentSessionId && onSessionChange) {
                onSessionChange(null);
            }
        } catch (err) {
            console.error('Error deleting session:', err);
            setError('Failed to delete session');
        } finally {
            setLoading(false);
        }
    };

    // Select session and load its conversation
    const handleSelectSession = async (sessionId) => {
        if (sessionId === currentSessionId) return;

        try {
            setLoading(true);

            // Actually load the conversation data and switch to it
            if (onSessionChange) {
                await onSessionChange(sessionId);
            }

            // Close sidebar on mobile after selection
            if (window.innerWidth <= 768) {
                onToggle();
            }

        } catch (error) {
            console.error('Error loading conversation:', error);
            setError('Failed to load conversation');
        } finally {
            setLoading(false);
        }
    };

    // Format date for display with proper error handling (German format)
    const formatDate = (dateString) => {
        try {
            // Handle various date formats
            let date;
            if (dateString instanceof Date) {
                date = dateString;
            } else if (typeof dateString === 'string') {
                date = new Date(dateString);
            } else {
                return 'Unknown';
            }

            // Check if date is valid
            if (isNaN(date.getTime())) {
                return 'Invalid date';
            }

            const now = new Date();
            const diffInHours = Math.abs(now - date) / 36e5;

            if (diffInHours < 1) {
                return 'Gerade eben';
            } else if (diffInHours < 24) {
                return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            } else if (diffInHours < 168) { // Less than a week
                return date.toLocaleDateString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
            } else {
                return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
            }
        } catch (error) {
            console.warn('Date formatting error:', error, 'for date:', dateString);
            return 'Recent';
        }
    };

    // Get list of active models
    const getActiveModels = () => {
        return Object.keys(generationSettings.llmEnabled)
            .filter(model => generationSettings.llmEnabled[model])
            .map(model => ({
                name: model,
                versions: generationSettings.llmVersions[model] || 0
            }));
    };

    // Get ranked criteria with their positions
    const getRankedCriteria = () => {
        return generationSettings.rankedCriteria.map((criterion, index) => ({
            name: criterion,
            rank: index + 1
        }));
    };

    const activeModels = getActiveModels();
    const rankedCriteria = getRankedCriteria();

    return (
        <>
            <div className={`left-sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h2>Settings</h2>
                    <button className="close-button" onClick={onToggle}>
                        ×
                    </button>
                </div>

                <div className="sidebar-tabs">
                    <button
                        className={`tab ${activeTab === 'sessions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('sessions')}
                    >
                        Sessions
                    </button>
                    <button
                        className={`tab ${activeTab === 'options' ? 'active' : ''}`}
                        onClick={() => setActiveTab('options')}
                    >
                        Options
                    </button>
                </div>

                <div className="sidebar-content">
                    {/* Sessions Tab */}
                    {activeTab === 'sessions' && (
                        <div className="sessions-content">
                            <div className="sessions-header">
                                <h3>Chat Sessions</h3>
                                <button
                                    className="new-session-button"
                                    onClick={() => setShowNewSessionInput(true)}
                                    disabled={loading}
                                >
                                    + New
                                </button>
                            </div>

                            {/* New Session Input */}
                            {showNewSessionInput && (
                                <div className="new-session-input">
                                    <input
                                        type="text"
                                        placeholder="Session name..."
                                        value={newSessionName}
                                        onChange={(e) => setNewSessionName(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                handleCreateSession();
                                            } else if (e.key === 'Escape') {
                                                setShowNewSessionInput(false);
                                                setNewSessionName('');
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <div className="input-buttons">
                                        <button
                                            onClick={handleCreateSession}
                                            disabled={!newSessionName.trim() || loading}
                                        >
                                            Create
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowNewSessionInput(false);
                                                setNewSessionName('');
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <div className="error-message">
                                    {error}
                                    <button onClick={() => setError(null)}>×</button>
                                </div>
                            )}

                            {/* Loading Indicator */}
                            {loading && (
                                <div className="loading-indicator">
                                    <div className="spinner"></div>
                                    Loading sessions...
                                </div>
                            )}

                            {/* Sessions List */}
                            <div className="sessions-list">
                                {sessions.length > 0 ? (
                                    sessions.map((session) => (
                                        <div
                                            key={session.id}
                                            className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
                                            onClick={() => handleSelectSession(session.id)}
                                        >
                                            <div className="session-main">
                                                <div className="session-name">
                                                    {session.session_name || 'Untitled Session'}
                                                </div>
                                                <div className="session-meta">
                                                    <span className="message-count">
                                                        {session.message_count} Nachrichten
                                                    </span>
                                                    <span className="session-date">
                                                        {formatDate(session.last_accessed)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="session-actions">
                                                <button
                                                    className="delete-button"
                                                    onClick={(e) => handleDeleteSession(session.id, e)}
                                                    title="Delete session"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                            {session.conversation_phase && (
                                                <div className="session-status">
                                                    Phase: {session.conversation_phase}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    !loading && (
                                        <div className="empty-message">
                                            No sessions yet. Create your first session to get started!
                                        </div>
                                    )
                                )}
                            </div>

                            {/* Session Actions */}
                            {sessions.length > 0 && (
                                <div className="sessions-actions">
                                    <button
                                        className="refresh-button"
                                        onClick={loadSessions}
                                        disabled={loading}
                                    >
                                        🔄 Refresh
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Options Tab (ohne "Other Options") */}
                    {activeTab === 'options' && (
                        <div className="options-content">
                            <h3>Generation Settings</h3>

                            {/* Active Models Section */}
                            <div className="sidebar-section">
                                <h4 className="section-title">Active Models</h4>
                                {activeModels.length > 0 ? (
                                    <div className="section-list">
                                        {activeModels.map((model) => (
                                            <div key={model.name} className="list-item model-item">
                                                <div className="item-main">{model.name}</div>
                                                <div className="item-detail">{model.versions} ver.</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-message">No models selected</div>
                                )}
                            </div>

                            {/* Criteria Section */}
                            <div className="sidebar-section">
                                <h4 className="section-title">Priority Ranking</h4>
                                {rankedCriteria.length > 0 ? (
                                    <div className="section-list">
                                        {rankedCriteria.map((criterion) => (
                                            <div key={criterion.name} className="list-item criterion-item">
                                                <div className="rank-badge">{criterion.rank}</div>
                                                <div className="item-main">{criterion.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-message">No criteria ranked</div>
                                )}
                            </div>

                            {/* Time Limit Section */}
                            <div className="sidebar-section">
                                <h4 className="section-title">Time Limit</h4>
                                <div className="time-display">{generationSettings.generationTimeMinutes} minutes</div>
                            </div>

                            <button
                                className="change-settings-button"
                                onClick={() => setShowSettingsModal(true)}
                            >
                                ⚙️ Change Settings
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Generation Settings Modal */}
            {showSettingsModal && (
                <GenerationSettingsModal
                    settings={generationSettings}
                    onSave={(newSettings) => {
                        onSettingsChange(newSettings);
                        setShowSettingsModal(false);
                    }}
                    onClose={() => setShowSettingsModal(false)}
                    hasGeneratedCode={hasGeneratedCode}
                />
            )}
        </>
    );
};

export default LeftSidebar;