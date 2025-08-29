import React, { useState, useRef, useEffect } from 'react';
import LeftSidebar from '../leftsidebar/LeftSidebar.jsx';
import RightCodePanel from '../rightsidebar/RightCodePanel.jsx';
import MessageBubble from './MessageBubble.jsx';
import ChatInput from './ChatInput.jsx';
import AsyncCodeGenerationAPI, { setupWebhookHandler } from '../../api/asyncCodeGenerationApi.js';
import sessionAPI from '../../api/sessionApi.js';
import { formatLqlErrorsForDisplay } from '../../utils/errorFormatters.js';

const ChatInterface = ({ onLogout }) => {
    // Core session state
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [sessionLoading, setSessionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [webhookError, setWebhookError] = useState(false);

    // Messages are the primary state
    const [messages, setMessages] = useState([]);

    // UI state
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
    const [rightPanelOpen, setRightPanelOpen] = useState(false);
    const [rightPanelContent, setRightPanelContent] = useState('code');
    const [rightPanelWidth, setRightPanelWidth] = useState(650);

    // Generation settings (persisted in backend)
    const [generationSettings, setGenerationSettings] = useState({
        rankedCriteria: ['Testability', 'Efficiency', 'Maintainability'],
        llmEnabled: {
            'GPT-4o-mini': true,
            'deepseek-r1:latest': false,
            'gemma3:27b': false,
            'Llama 3.1-latest': false
        },
        llmVersions: {
            'GPT-4o-mini': 1,
            'deepseek-r1:latest': 0,
            'gemma3:27b': 0,
            'Llama 3.1-latest': 0
        },
        mavenCentralEnabled: true,
        mavenCentralVersions: 5,
        generationTimeMinutes: 3
    });

    // Processing state
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRefining, setIsRefining] = useState(false);

    // Current code results (from latest generation/refinement)
    const [currentResult, setCurrentResult] = useState(null);
    const [selectedCodeId, setSelectedCodeId] = useState(null); // Geändert zu null für optional

    // LQL state
    const [lql, setLql] = useState(`Stack {
    push(java.lang.Object)->java.lang.Object
    pop()->java.lang.Object
    peek()->java.lang.Object
    size()->int
}`);
    const [lqlValidationResult, setLqlValidationResult] = useState(null);

    const messagesEndRef = useRef(null);

    // Initialize session on component mount
    useEffect(() => {
        initializeSession();
        setupWebhookHandler();
        checkWebhookConnection();
    }, []);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Reset LQL validation when LQL changes
    useEffect(() => {
        setLqlValidationResult(null);
    }, [lql]);

    // Check webhook connection
    const checkWebhookConnection = async () => {
        try {
            // Check WebSocket status first
            const status = AsyncCodeGenerationAPI.getWebSocketStatus();
            console.log('WebSocket status:', status);

            // Test direct connection to webhook server HTTP endpoint (correct port 5174)
            try {
                const response = await fetch('http://localhost:5174/api/health', {
                    method: 'GET',
                    timeout: 5000
                });

                if (response.ok) {
                    console.log('✅ Webhook server is reachable');
                    setWebhookError(false);
                } else {
                    console.warn('⚠️ Webhook server responded with error:', response.status);
                    setWebhookError(true);
                }
            } catch (fetchError) {
                console.error('❌ Cannot reach webhook server:', fetchError);
                setWebhookError(true);
            }

            // Also check WebSocket connection after a delay
            if (!status.connected) {
                setTimeout(() => {
                    const newStatus = AsyncCodeGenerationAPI.getWebSocketStatus();
                    if (!newStatus.connected) {
                        console.warn('⚠️ WebSocket not connected after delay');
                        setWebhookError(true);
                    }
                }, 3000);
            }
        } catch (error) {
            console.error('❌ Webhook connection check failed:', error);
            setWebhookError(true);
        }
    };

    const initializeSession = async () => {
        try {
            setSessionLoading(true);

            const storedSessionId = sessionAPI.getCurrentSessionId();
            if (storedSessionId) {
                const isValid = await sessionAPI.validateSession(storedSessionId);
                if (isValid) {
                    setCurrentSessionId(storedSessionId);
                    await loadSessionData(storedSessionId);
                    return;
                }
            }

            // Create new session if no valid existing session
            await createNewSession();
        } catch (error) {
            console.error('Error initializing session:', error);
            // Show welcome message even if session creation fails
            setMessages([{
                id: 1,
                type: 'cody',
                content: "Howdy partner! 🤠 I'm Cody, your Code Cowboy. Ready to rustle up some code? How would you like to start?",
                timestamp: new Date(),
                options: [
                    { id: 'prompt', label: 'Enter a Prompt', icon: '✏️' },
                    { id: 'lql', label: 'Define LQL Interface', icon: '📋' }
                ]
            }]);
        } finally {
            setSessionLoading(false);
        }
    };

    const createNewSession = async (sessionName = null) => {
        try {
            setSessionLoading(true);

            // Reset local state FIRST
            setMessages([]);
            setCurrentResult(null);
            setSelectedCodeId(null); // Geändert zu null
            setLql(`Stack {
    push(java.lang.Object)->java.lang.Object
    pop()->java.lang.Object
    peek()->java.lang.Object
    size()->int
}`);
            setLqlValidationResult(null);
            setError(null);
            setIsGenerating(false);
            setIsRefining(false);

            // Create session on backend
            const newSession = await sessionAPI.createSession(sessionName);
            setCurrentSessionId(newSession.id);
            sessionAPI.setCurrentSessionId(newSession.id);

            // Load the new session data
            await loadSessionData(newSession.id);

        } catch (error) {
            console.error('Error creating session:', error);
            setError('Failed to create a new session.');
        } finally {
            setSessionLoading(false);
        }
    };

    const loadSessionData = async (sessionId) => {
        try {
            console.log('Loading session data for:', sessionId);
            const sessionState = await sessionAPI.getSessionState(sessionId);

            // Apply session state to UI
            setMessages(sessionState.messages || []);

            if (sessionState.generation_settings) {
                setGenerationSettings(sessionState.generation_settings);
            }

            if (sessionState.current_result) {
                setCurrentResult(sessionState.current_result);
            }

            if (sessionState.lql_validation_result) {
                setLql(sessionState.lql_validation_result.lqlCode || '');
                setLqlValidationResult(sessionState.lql_validation_result);
            }

            // If no messages, show welcome message
            if (!sessionState.messages || sessionState.messages.length === 0) {
                await addMessage({
                    type: 'cody',
                    content: "Howdy partner! 🤠 I'm Cody, your Code Cowboy. Ready to rustle up some code? How would you like to start?",
                    options: [
                        { id: 'prompt', label: 'Enter a Prompt', icon: '✏️' },
                        { id: 'lql', label: 'Define LQL Interface', icon: '📋' }
                    ]
                });
            }

        } catch (error) {
            console.error('Error loading session data:', error);
            throw error;
        }
    };

    const handleSessionChange = async (sessionId) => {
        if (sessionId === currentSessionId) return;

        if (!sessionId) {
            await createNewSession();
            return;
        }

        try {
            setSessionLoading(true);
            setCurrentSessionId(sessionId);
            sessionAPI.setCurrentSessionId(sessionId);

            // Reset current session state before loading new session
            setCurrentResult(null);
            setSelectedCodeId(null); // Geändert zu null

            await loadSessionData(sessionId);
        } catch (error) {
            console.error('Error changing session:', error);
            setError('Failed to load conversation.');
        } finally {
            setSessionLoading(false);
        }
    };

    const handleSettingsChange = async (newSettings) => {
        setGenerationSettings(newSettings);
        // Settings are automatically saved when used in generation/refinement
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const addMessage = async (message) => {
        const newMessage = {
            ...message,
            id: Date.now(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newMessage]);

        // Save to backend
        if (currentSessionId) {
            try {
                await sessionAPI.addMessage(currentSessionId, newMessage);
            } catch (error) {
                console.error('Error saving message:', error);
            }
        }
    };

    // Determine current conversation phase from message history
    const getCurrentPhase = () => {
        if (isGenerating) return 'generating';
        if (isRefining) return 'refining';
        if (currentResult) return 'completed';
        if (messages.length === 0) return 'initial';

        const lastMessage = messages[messages.length - 1];
        if (lastMessage.type === 'cody' && lastMessage.options) {
            return 'awaiting_choice';
        }

        return 'awaiting_input';
    };

    const hasGeneratedCodeInCurrentSession = () => {
        // Check if current session has generated code
        return currentResult !== null ||
            messages.some(msg => msg.hasCode === true) ||
            getCurrentPhase() === 'completed';
    };

    // Determine what input is expected based on conversation context
    const getAwaitedInput = () => {
        const phase = getCurrentPhase();
        if (phase !== 'awaiting_input') return null;

        const recentMessages = messages.slice(-3);
        const lastCodyMessage = recentMessages.reverse().find(m => m.type === 'cody');

        if (!lastCodyMessage) return null;

        if (lastCodyMessage.content.includes('prompt below')) return 'prompt';
        if (lastCodyMessage.content.includes('sequence sheet')) return 'sequence-sheet';

        return null;
    };

    const handleOptionClick = async (optionId) => {
        if (optionId === 'prompt') {
            await addMessage({
                type: 'user',
                content: 'I want to enter a prompt'
            });
            await addMessage({
                type: 'cody',
                content: "Great choice! What kind of implementation would you like me to create? Just type your prompt below."
            });

        } else if (optionId === 'lql') {
            await addMessage({
                type: 'user',
                content: 'I want to define an LQL Interface'
            });
            await addMessage({
                type: 'cody',
                content: "Excellent! I've opened the LQL editor in the right panel. You can define your interface there and validate it when ready."
            });

            setRightPanelContent('lql');
            setRightPanelOpen(true);

        } else if (optionId === 'yes-tests') {
            await addMessage({
                type: 'user',
                content: 'Yes, I want to add tests'
            });
            await addMessage({
                type: 'cody',
                content: "Perfect! Please enter your sequence sheet as a string below. This will help me create comprehensive tests for your implementation."
            });

        } else if (optionId === 'no-tests') {
            await addMessage({
                type: 'user',
                content: 'No, proceed without manual tests'
            });
            startGeneration();

        } else if (optionId === 'new-generation') {
            // Komplett neue Session - Nachrichten werden gelöscht
            await createNewSession();
        }
    };

    // Function to show help message
    const showHelpMessage = async () => {
        await addMessage({
            type: 'cody',
            content: "You now have several options to proceed. You can choose one or several of the following actions:\n\n• **Refine the selected code** - Describe what aspects you'd like me to improve (performance, readability, error handling, etc.). You can select which code candidate to refine in the Code Panel on your right side.\n• **Request additional tests** - Ask for more comprehensive test coverage\n• **Generate more code candidates** - Get alternative implementations to choose from\n\nYou can also start again and try a new generation with different options or different inputs.",
            options: [
                { id: 'new-generation', label: 'Start New Session', icon: '🆕' }
            ]
        });
    };

    const handleTextInput = async (text) => {
        await addMessage({
            type: 'user',
            content: text
        });

        // Check if user is asking for help
        if (text.toLowerCase().trim() === 'help') {
            await showHelpMessage();
            return;
        }

        const awaitedInput = getAwaitedInput();
        const phase = getCurrentPhase();

        if (awaitedInput === 'prompt') {
            startGeneration(text);
        } else if (awaitedInput === 'sequence-sheet') {
            await addMessage({
                type: 'cody',
                content: "Thanks for the sequence sheet! I'll incorporate it into the test generation. Let me start working on your implementation now..."
            });
            startGeneration(null, text);
        } else if (phase === 'completed') {
            // All post-generation requests go through refinement endpoint
            // Let the backend handle the logic for different request types
            startRefinement(text);
        } else {
            await addMessage({
                type: 'cody',
                content: "I'm not sure what you're asking for right now. If you'd like to start a new generation, please use the options I've provided, or let me know if you have questions about the current results. Type 'help' for available options."
            });
        }
    };

    const handleLqlValidation = async () => {
        if (!lql.trim()) {
            await addMessage({
                type: 'cody',
                content: "Please enter some LQL content before validating.",
                isError: true
            });
            return;
        }

        await addMessage({
            type: 'cody',
            content: "Validating your LQL interface...",
            isLoading: true
        });

        try {
            const result = await sessionAPI.validateLQL(currentSessionId, lql);
            setLqlValidationResult(result);

            // Remove loading message
            setMessages(prev => prev.filter(m => !m.isLoading));

            if (result.success && result.isValid) {
                await addMessage({
                    type: 'cody',
                    content: "✅ Your LQL interface is valid! Would you like to manually add tests in the form of a sequence sheet?",
                    options: [
                        { id: 'yes-tests', label: 'Yes', icon: '✔' },
                        { id: 'no-tests', label: 'No', icon: '✗' }
                    ]
                });
            } else {
                const errorMessage = formatLqlErrorsForDisplay(result.errors);
                await addMessage({
                    type: 'cody',
                    content: `❌ LQL Validation Failed:\n\n${errorMessage}\n\nPlease correct the errors and try again.`,
                    isError: true
                });
            }
        } catch (error) {
            setMessages(prev => prev.filter(m => !m.isLoading));
            await addMessage({
                type: 'cody',
                content: `❌ Validation error: ${error.message}`,
                isError: true
            });
            setLqlValidationResult({
                success: false,
                isValid: false,
                errors: [`Validation request failed: ${error.message}`]
            });
        }
    };

    const collectGenerationData = () => {
        const data = {};

        // Extract LQL from recent validation or messages
        if (lqlValidationResult && lqlValidationResult.isValid) {
            data.lql = lql;
        }

        // Extract prompt and sequence sheet from user messages
        const userMessages = messages.filter(msg =>
            msg.type === 'user' &&
            !msg.content.includes('LQL') &&
            !msg.content.includes('Define') &&
            msg.content !== 'I want to enter a prompt' &&
            msg.content !== 'Yes, I want to add tests' &&
            msg.content !== 'No, proceed without manual tests'
        );

        if (userMessages.length > 0) {
            // Last user message might be sequence sheet if we're expecting it
            const awaitedInput = getAwaitedInput();
            if (awaitedInput === 'sequence-sheet' && userMessages.length > 0) {
                data.sequenceSheet = userMessages[userMessages.length - 1].content;
                if (userMessages.length > 1) {
                    data.prompt = userMessages[userMessages.length - 2].content;
                }
            } else {
                data.prompt = userMessages[userMessages.length - 1].content;
            }
        }

        return data;
    };

    const startGeneration = async (promptOverride = null, sequenceSheetOverride = null) => {
        // Prüfe Webhook-Verbindung vor Generation
        if (webhookError) {
            await addMessage({
                type: 'cody',
                content: "❌ **Cannot start generation**: Webhook server is not running.\n\nPlease ensure the webhook server is started on `http://localhost:5174` and refresh the page.",
                isError: true
            });
            return;
        }

        // Zusätzliche Live-Prüfung vor Generation
        try {
            const testResponse = await fetch('http://localhost:5174/api/health', {
                method: 'GET',
                timeout: 3000
            });
            if (!testResponse.ok) {
                throw new Error('Webhook server not responding');
            }
        } catch (error) {
            setWebhookError(true);
            await addMessage({
                type: 'cody',
                content: "❌ **Webhook server check failed**: The webhook server at `http://localhost:5174` is not reachable.\n\n**Please:**\n• Start the webhook server\n• Ensure it's running on port 5174 (HTTP) and 8080 (WebSocket)\n• Refresh the page and try again",
                isError: true
            });
            return;
        }

        setIsGenerating(true);

        await addMessage({
            type: 'cody',
            content: "🤠 Alright partner, I'm saddling up to generate your code! This might take a few minutes...",
            isLoading: true
        });

        const generationData = collectGenerationData();

        if (promptOverride) generationData.prompt = promptOverride;
        if (sequenceSheetOverride) generationData.sequenceSheet = sequenceSheetOverride;

        const payload = {
            lqlInterface: generationData.lql || '',
            userPrompt: generationData.prompt || '',
            sequenceSheet: generationData.sequenceSheet || '',
            rankingCriteria: generationSettings.rankedCriteria,
            generationOptions: {
                numberOfVersions: Object.values(generationSettings.llmVersions).reduce((a, b) => a + b, 0),
                selectedLLMs: Object.keys(generationSettings.llmEnabled).filter(k => generationSettings.llmEnabled[k]),
                features: generationSettings.features || "cc",
                use_nicad: generationSettings.use_nicad || false,
                use_gpt: generationSettings.llmEnabled['GPT-4o-mini'] || false,
                samples_gpt: generationSettings.llmVersions['GPT-4o-mini'] || 0,
                use_gemma: generationSettings.llmEnabled['gemma3:27b'] || false,
                samples_gemma: generationSettings.llmVersions['gemma3:27b'] || 0,
                use_llama: generationSettings.llmEnabled['Llama 3.1-latest'] || false,
                samples_llama: generationSettings.llmVersions['Llama 3.1-latest'] || 0,
                use_deepseek: generationSettings.llmEnabled['deepseek-r1:latest'] || false,
                samples_deepseek: generationSettings.llmVersions['deepseek-r1:latest'] || 0,
                use_search: generationSettings.mavenCentralEnabled || false,
                samples_search: generationSettings.mavenCentralVersions || 0,
                user_provided_tests: generationData.sequenceSheet || "",
                use_testGen_gpt: generationSettings.use_testGen_gpt || true,
                use_testGen_ollama: generationSettings.use_testGen_ollama || false,
                samples_LLM_testGen: generationSettings.samples_LLM_testGen || 5,
                model_testGen: generationSettings.model_testGen || "gemma3:27b",
                use_random_testGen: generationSettings.use_random_testGen || false,
                samples_random_testGen: generationSettings.samples_random_testGen || 5,
                use_type_aware_testGen: generationSettings.use_type_aware_testGen || false,
                samples_type_aware_testGen: generationSettings.samples_type_aware_testGen || 2,
                maxTimeMinutes: generationSettings.generationTimeMinutes
            },
            frontendUrl: "http://localhost:5174"
        };

        try {
            const result = await sessionAPI.startGeneration(currentSessionId, payload);

            if (result.success) {
                console.log('✅ Generation started. Listening for webhook results...');
                AsyncCodeGenerationAPI.registerSession(
                    currentSessionId,
                    handleGenerationComplete,
                    (progress) => console.log('Generation progress:', progress)
                );
            } else {
                throw new Error(result.message || 'Failed to start generation');
            }
        } catch (error) {
            setMessages(prev => prev.filter(m => !m.isLoading));
            await addMessage({
                type: 'cody',
                content: `❌ Generation failed: ${error.message}`,
                isError: true
            });
            setIsGenerating(false);
        }
    };

    const startRefinement = async (userRequest) => {
        if (!currentSessionId || !currentResult) {
            await addMessage({
                type: 'cody',
                content: "❌ No code available to work with. Please generate code first.",
                isError: true
            });
            return;
        }

        // Check if no code is selected for refinement when there are multiple options
        const totalResults = currentResult
            ? 1 + (currentResult.otherImplementations?.length || 0)
            : 0;

        if (totalResults > 1 && selectedCodeId === null) {
            await addMessage({
                type: 'cody',
                content: "Please select a code implementation to refine from the Code Panel on the right before requesting refinements.",
                isError: true
            });
            return;
        }

        // Prüfe Webhook-Verbindung vor Refinement
        if (webhookError) {
            await addMessage({
                type: 'cody',
                content: "❌ **Cannot start refinement**: Webhook server is not running.\n\nPlease ensure the webhook server is started on `http://localhost:5174` and refresh the page.",
                isError: true
            });
            return;
        }

        // Zusätzliche Live-Prüfung vor Refinement
        try {
            const testResponse = await fetch('http://localhost:5174/api/health', {
                method: 'GET',
                timeout: 3000
            });
            if (!testResponse.ok) {
                throw new Error('Webhook server not responding');
            }
        } catch (error) {
            setWebhookError(true);
            await addMessage({
                type: 'cody',
                content: "❌ **Webhook server check failed**: The webhook server at `http://localhost:5174` is not reachable.\n\n**Please:**\n• Start the webhook server\n• Ensure it's running on port 5174 (HTTP) and 8080 (WebSocket)\n• Refresh the page and try again",
                isError: true
            });
            return;
        }

        setIsRefining(true);

        await addMessage({
            type: 'cody',
            content: "🔄 Working on your request...",
            isLoading: true
        });

        // Collect all user requests for context
        const allUserRequests = messages
            .filter(msg => msg.type === 'user' &&
                !msg.content.includes('LQL') &&
                !msg.content.includes('No, proceed without manual tests') &&
                msg.content !== 'I want to enter a prompt' &&
                msg.content !== 'I want to define an LQL Interface')
            .map(msg => msg.content);

        allUserRequests.push(userRequest);

        try {
            const result = await sessionAPI.startRefinement(currentSessionId, {
                userResponses: allUserRequests,
                selectedCodeID: selectedCodeId || 0, // Default to 0 if none selected
                frontendUrl: "http://localhost:5174",
                rankingCriteria: generationSettings.rankedCriteria,
                maxTimeMinutes: generationSettings.generationTimeMinutes
            });

            if (result.success) {
                console.log('✅ Refinement started. Listening for webhook results...');
                AsyncCodeGenerationAPI.registerSession(
                    currentSessionId,
                    handleRefinementComplete,
                    (progress) => console.log('Refinement progress:', progress)
                );
            } else {
                throw new Error(result.message || 'Failed to start refinement');
            }

        } catch (error) {
            setMessages(prev => prev.filter(m => !m.isLoading));
            await addMessage({
                type: 'cody',
                content: `❌ Request failed: ${error.message}`,
                isError: true
            });
            setIsRefining(false);
        }
    };

    const handleGenerationComplete = async (result) => {
        setMessages(prev => prev.filter(m => !m.isLoading));
        setIsGenerating(false);

        if (result.success) {
            setCurrentResult(result.data);
            setSelectedCodeId(0); // Auto-select first implementation

            const hasMultipleImplementations = result.data.otherImplementations &&
                result.data.otherImplementations.length > 0;

            // Use the backend's chat response if available, otherwise fall back to default message
            let messageContent = result.data.backendAnswer ||
                "🎉 Yeehaw! Your code is ready! I've generated the best implementation based on your criteria.";

            if (hasMultipleImplementations && !result.data.backendAnswer) {
                messageContent += " You can view different implementations in the right panel.";
            }

            // Add hint about help command
            messageContent += "\n\nType 'help' if you need guidance on what to do next.";

            // Single message with the code and backend description
            await addMessage({
                type: 'cody',
                content: messageContent,
                hasCode: true,
                codeData: result.data.bestImplementation,
                options: [
                    { id: 'new-generation', label: 'Start New Session', icon: '🆕' }
                ]
            });

            setRightPanelContent('code');
            setRightPanelOpen(true);
        } else {
            await addMessage({
                type: 'cody',
                content: `❌ Generation failed: ${result.error}`,
                isError: true
            });
        }
    };

    const handleRefinementComplete = async (result) => {
        setMessages(prev => prev.filter(m => !m.isLoading));
        setIsRefining(false);

        if (result.success) {
            // Transform and store the refined result
            const transformedResult = {
                ...result.data,
                isRefined: true,
                hasRefinement: true,
                refinedImplementation: {
                    ...result.data.refinedImplementation,
                    refinementMetadata: {
                        selectedCodeID: selectedCodeId,
                        refinementApplied: true,
                        processingTime: result.processingTime || 0,
                        backendAnswer: result.data.backendAnswer || "Your request has been processed."
                    }
                }
            };

            setCurrentResult(transformedResult);

            const backendMessage = result.data.backendAnswer ||
                "✅ Your request has been processed! Check out the updated results in the right panel.";

            await addMessage({
                type: 'cody',
                content: backendMessage,
                hasCode: true,
                codeData: result.data.refinedImplementation || result.data.bestImplementation
            });

            setRightPanelContent('code');
            setRightPanelOpen(true);
        } else {
            await addMessage({
                type: 'cody',
                content: `❌ Request failed: ${result.error}`,
                isError: true
            });
        }
    };

    const handleCodeClick = () => {
        setRightPanelContent('code');
        setRightPanelOpen(true);
    };

    const handleCodeSelect = (codeId) => {
        console.log('🔄 ChatInterface: Code selected:', codeId);
        setSelectedCodeId(codeId);
    };

    const handleRetry = async (errorMessage) => {
        // Remove the error message
        setMessages(prev => prev.filter(msg => msg.id !== errorMessage.id));

        // Determine what to retry based on current phase
        const phase = getCurrentPhase();

        if (isGenerating || phase === 'generating') {
            // Retry generation with same parameters
            const generationData = collectGenerationData();
            await startGeneration(generationData.prompt, generationData.sequenceSheet);
        } else if (isRefining || phase === 'refining') {
            // Retry refinement with last user message
            const lastUserMessage = messages
                .filter(msg => msg.type === 'user')
                .pop();

            if (lastUserMessage) {
                await startRefinement(lastUserMessage.content);
            }
        } else {
            // Generic retry - show help
            await showHelpMessage();
        }
    };

    const shouldShowInput = () => {
        const phase = getCurrentPhase();
        return ['awaiting_input', 'completed'].includes(phase);
    };

    const getInputPlaceholder = () => {
        const awaitedInput = getAwaitedInput();
        const phase = getCurrentPhase();

        if (awaitedInput === 'prompt') return "Enter your implementation prompt...";
        if (awaitedInput === 'sequence-sheet') return "Enter your sequence sheet...";
        if (phase === 'completed') {
            return "Ask for refinements, tests, more candidates, or type 'help' for options...";
        }
        return "Type a message...";
    };

    // Format timestamp in German locale
    const formatTimestamp = (date) => {
        if (!date) return '';

        try {
            // Erstelle Date-Objekt aus verschiedenen Eingabeformaten
            let dateObj;
            if (date instanceof Date) {
                dateObj = date;
            } else if (typeof date === 'string') {
                // Handhabe verschiedene String-Formate
                dateObj = new Date(date);
            } else if (typeof date === 'number') {
                dateObj = new Date(date);
            } else {
                return '';
            }

            // Prüfe ob Date gültig ist
            if (isNaN(dateObj.getTime())) {
                console.warn('Invalid date:', date);
                return '';
            }

            // Formatiere IMMER mit deutscher Lokalisierung
            return new Intl.DateTimeFormat('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Berlin' // Explizit deutsche Zeitzone
            }).format(dateObj);
        } catch (error) {
            console.warn('Timestamp formatting error:', error, 'for date:', date);
            return '';
        }
    };

    if (sessionLoading && !currentSessionId) {
        return (
            <div className="chat-interface">
                <div className="loading-overlay">
                    <div className="loading-content">
                        <div className="spinner"></div>
                        <p>Loading your session...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-interface">
            <LeftSidebar
                isOpen={leftSidebarOpen}
                onToggle={() => setLeftSidebarOpen(!leftSidebarOpen)}
                generationSettings={generationSettings}
                onSettingsChange={handleSettingsChange}
                currentSessionId={currentSessionId}
                onSessionChange={handleSessionChange}
                hasGeneratedCode={hasGeneratedCodeInCurrentSession()}
            />

            <div className={`chat-main ${leftSidebarOpen ? 'sidebar-open' : ''} ${rightPanelOpen ? 'panel-open' : ''}`}>
                <div className="chat-header">
                    <button
                        className="menu-button"
                        onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                    >
                        ☰
                    </button>

                    <div className="session-info">
                        <h1>Code Cowboy</h1>
                    </div>

                    <div className="header-actions">
                        <button
                            className="menu-button"
                            onClick={() => {
                                setRightPanelContent('lql');
                                setRightPanelOpen(!rightPanelOpen);
                            }}
                            title="Toggle LQL Editor"
                        >
                            📋
                        </button>
                        <button
                            className="menu-button"
                            onClick={() => {
                                setRightPanelContent('code');
                                setRightPanelOpen(!rightPanelOpen);
                            }}
                            title="Toggle Code Panel"
                        >
                            📄
                        </button>
                        {onLogout && (
                            <button
                                className="menu-button logout-button"
                                onClick={onLogout}
                                title="Logout"
                            >
                                🚪
                            </button>
                        )}
                    </div>
                </div>

                <div className="messages-container">
                    {error && (
                        <div className="error-banner">
                            <span>{error}</span>
                            <button onClick={() => setError(null)}>×</button>
                        </div>
                    )}

                    {webhookError && (
                        <div className="error-banner webhook-error">
                            <span>⚠️ Webhook server not connected. Code generation may not work properly.</span>
                            <button onClick={() => setWebhookError(false)}>×</button>
                        </div>
                    )}

                    {sessionLoading && (
                        <div className="session-loading">
                            <div className="loading-content">
                                <div className="spinner"></div>
                                <span>Loading conversation...</span>
                            </div>
                        </div>
                    )}

                    <div className="messages-wrapper">
                        {messages.map(message => (
                            <MessageBubble
                                key={message.id}
                                message={{
                                    ...message,
                                    timestamp: formatTimestamp(message.timestamp)
                                }}
                                onOptionClick={handleOptionClick}
                                onCodeClick={handleCodeClick}
                                onRetry={handleRetry}
                            />
                        ))}
                    </div>
                    <div ref={messagesEndRef} />
                </div>

                {shouldShowInput() && (
                    <ChatInput
                        onSubmit={handleTextInput}
                        placeholder={getInputPlaceholder()}
                        multiline={getAwaitedInput() === 'sequence-sheet'}
                        disabled={isGenerating || isRefining}
                    />
                )}
            </div>

            <RightCodePanel
                isOpen={rightPanelOpen}
                onClose={() => setRightPanelOpen(false)}
                allResults={currentResult}
                panelContent={rightPanelContent}
                lql={lql}
                onLqlChange={setLql}
                onValidateLql={handleLqlValidation}
                lqlValidationResult={lqlValidationResult}
                width={rightPanelWidth}
                onWidthChange={setRightPanelWidth}
                hasRefinedCode={currentResult?.isRefined || false}
                isRefining={isRefining}
                selectedCodeId={selectedCodeId}
                onCodeSelect={handleCodeSelect}
            />
        </div>
    );
};

export default ChatInterface;