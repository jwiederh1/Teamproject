import React, { useState, useRef, useEffect } from "react";
import LeftSidebar from "../leftsidebar/LeftSidebar.jsx";
import RightCodePanel from "../rightsidebar/RightCodePanel.jsx";
import MessageBubble from "./MessageBubble.jsx";
import ChatInput from "./ChatInput.jsx";
import AsyncCodeGenerationAPI, {
  setupWebhookHandler,
} from "../../api/asyncCodeGenerationApi.js";
import sessionAPI from "../../api/sessionApi.js";
import { formatLqlErrorsForDisplay } from "../../utils/errorFormatters.js";

/**
 * The main component for the chat application interface.
 * It orchestrates the entire user experience, managing session state,
 * messages, UI panels, and communication with the backend for code generation.
 * @param {object} props - The component props.
 * @param {function} props.onLogout - A callback function to handle user logout.
 * @returns {JSX.Element} The rendered chat interface.
 */
const ChatInterface = ({ onLogout }) => {
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [webhookError, setWebhookError] = useState(false);
  const [messages, setMessages] = useState([]);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelContent, setRightPanelContent] = useState("code");
  const [rightPanelWidth, setRightPanelWidth] = useState(650);
  const [generationSettings, setGenerationSettings] = useState({
    rankedCriteria: ["Testability", "Efficiency", "Maintainability"],
    llmEnabled: {
      "GPT-4o-mini": true,
      "deepseek-r1:latest": false,
      "gemma3:27b": true,
      "Llama 3.1-latest": false,
    },
    llmVersions: {
      "GPT-4o-mini": 1,
      "deepseek-r1:latest": 0,
      "gemma3:27b": 1,
      "Llama 3.1-latest": 0,
    },
    mavenCentralEnabled: true,
    mavenCentralVersions: 5,
    generationTimeMinutes: 4,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [selectedCodeId, setSelectedCodeId] = useState(null);

  const DEFAULT_LQL_INTERFACE = `Stack {
    push(java.lang.Object)->java.lang.Object
    pop()->java.lang.Object
    peek()->java.lang.Object
    size()->int
}`

  const [lql, setLql] = useState(DEFAULT_LQL_INTERFACE);
  const [lqlValidationResult, setLqlValidationResult] = useState(null);
  const [sequenceSheet, setSequenceSheet] = useState("");
  const [userStartedWithPromptOnly, setUserStartedWithPromptOnly] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    initializeSession();
    setupWebhookHandler();
    checkWebhookConnection();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setLqlValidationResult(null);
  }, [lql]);

  /**
   * Checks the status of the webhook server and WebSocket connection.
   * Sets a webhook error flag if the connection fails.
   */
  const checkWebhookConnection = async () => {
    try {
      const status = AsyncCodeGenerationAPI.getWebSocketStatus();
      console.log("WebSocket status:", status);

      try {
        const response = await fetch("http://localhost:5174/api/health", {
          method: "GET",
          timeout: 5000,
        });

        if (response.ok) {
          console.log("✅ Webhook server is reachable");
          setWebhookError(false);
        } else {
          console.warn(
            "⚠️ Webhook server responded with error:",
            response.status,
          );
          setWebhookError(true);
        }
      } catch (fetchError) {
        console.error("❌ Cannot reach webhook server:", fetchError);
        setWebhookError(true);
      }

      if (!status.connected) {
        setTimeout(() => {
          const newStatus = AsyncCodeGenerationAPI.getWebSocketStatus();
          if (!newStatus.connected) {
            console.warn("⚠️ WebSocket not connected after delay");
            setWebhookError(true);
          }
        }, 3000);
      }
    } catch (error) {
      console.error("❌ Webhook connection check failed:", error);
      setWebhookError(true);
    }
  };

  /**
   * Initializes the user's session. It attempts to load an existing session
   * from storage, and if not found or invalid, creates a new one.
   */
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

      await createNewSession();
    } catch (error) {
      console.error("Error initializing session:", error);
      setMessages([
        {
          id: 1,
          type: "cody",
          content:
            "Howdy partner! 🤠 I'm Cody, your Code Cowboy. Ready to rustle up some code? How would you like to start?",
          timestamp: new Date(),
          options: [
            { id: "prompt", label: "Enter a Prompt", icon: "" },
            { id: "lql", label: "Define LQL Interface", icon: "" },
          ],
        },
      ]);
    } finally {
      setSessionLoading(false);
    }
  };

  /**
   * Creates a new chat session, resetting the application's state and
   * establishing a new session with the backend.
   * @param {string|null} sessionName - An optional name for the new session.
   */
  const createNewSession = async (sessionName = null) => {
    try {
      setSessionLoading(true);

      setMessages([]);
      setCurrentResult(null);
      setSelectedCodeId(null);
      setLql(DEFAULT_LQL_INTERFACE)
      setUserStartedWithPromptOnly(false);
      setLqlValidationResult(null);
      setSequenceSheet("");
      setError(null);
      setIsGenerating(false);
      setIsRefining(false);

      const newSession = await sessionAPI.createSession(sessionName);
      setCurrentSessionId(newSession.id);
      sessionAPI.setCurrentSessionId(newSession.id);

      await loadSessionData(newSession.id);
    } catch (error) {
      console.error("Error creating session:", error);
      setError("Failed to create a new session.");
    } finally {
      setSessionLoading(false);
    }
  };

  /**
   * Fetches and loads the state for a given session ID, updating the UI with
   * messages, generation results, and other relevant data.
   * @param {string} sessionId - The ID of the session to load.
   */
  const loadSessionData = async (sessionId) => {
    try {
      console.log("Loading session data for:", sessionId);
      const sessionState = await sessionAPI.getSessionState(sessionId);

      console.log("📦 Session state received:", sessionState);

      setMessages(sessionState.messages || []);

      if (sessionState.generation_settings) {
        setGenerationSettings(sessionState.generation_settings);
      }

      if (sessionState.current_result) {
        console.log(
          "🔄 Restoring generation result from session:",
          sessionState.current_result,
        );
        setCurrentResult(sessionState.current_result);

        if (
          sessionState.current_result.isRefinement &&
          sessionState.current_result.refinedImplementationIndex !== null
        ) {
          const implementations =
            sessionState.current_result.implementations || [];
          const refinedImplIndex = implementations.findIndex(
            (impl) =>
              impl.id ===
              sessionState.current_result.refinedImplementationIndex,
          );
          setSelectedCodeId(refinedImplIndex !== -1 ? refinedImplIndex : 0);
        } else {
          setSelectedCodeId(0);
        }
      }

      if (sessionState.lql_validation_result && sessionState.lql_validation_result.lqlCode) {
        setLql(sessionState.lql_validation_result.lqlCode);
        setLqlValidationResult(sessionState.lql_validation_result);
        setUserStartedWithPromptOnly(false);
      } else {
        setLql(DEFAULT_LQL_INTERFACE);
        setLqlValidationResult(null);
      }

      if (!sessionState.messages || sessionState.messages.length === 0) {
        await addMessage({
          type: "cody",
          content:
            "Howdy partner! 🤠 I'm Cody, your Code Cowboy. Ready to rustle up some code? How would you like to start?",
          options: [
            { id: "prompt", label: "Enter a Prompt", icon: "✏️" },
            {
              id: "lql",
              label: "Define LQL Interface",
              icon: "📋",
            },
          ],
        });
      }
    } catch (error) {
      console.error("Error loading session data:", error);
      throw error;
    }
  };

  /**
   * Handles the logic for switching between different chat sessions.
   * @param {string} sessionId - The ID of the session to switch to.
   */
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

      setCurrentResult(null);
      setSelectedCodeId(null);
      setSequenceSheet("");
      setUserStartedWithPromptOnly(false);

      await loadSessionData(sessionId);
    } catch (error) {
      console.error("Error changing session:", error);
      setError("Failed to load conversation.");
    } finally {
      setSessionLoading(false);
    }
  };

  /**
   * Updates the generation settings state.
   * @param {object} newSettings - The new settings object.
   */
  const handleSettingsChange = async (newSettings) => {
    setGenerationSettings(newSettings);
  };

  /**
   * Scrolls the message container to the most recent message.
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /**
   * Adds a new message to the chat history and persists it to the backend.
   * @param {object} message - The message object to add.
   */
  const addMessage = async (message) => {
    const newMessage = {
      ...message,
      id: Date.now(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);

    if (currentSessionId) {
      try {
        await sessionAPI.addMessage(currentSessionId, newMessage);
      } catch (error) {
        console.error("Error saving message:", error);
      }
    }
  };

  /**
   * Determines the current phase of the conversation (e.g., generating, completed).
   * @returns {string} The current phase.
   */
  const getCurrentPhase = () => {
    if (isGenerating) return "generating";
    if (isRefining) return "refining";
    if (currentResult) return "completed";
    if (messages.length === 0) return "initial";

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.type === "cody" && lastMessage.options) {
      return "awaiting_choice";
    }

    return "awaiting_input";
  };

  /**
   * Checks if code has been generated in the current session.
   * @returns {boolean} True if code has been generated.
   */
  const hasGeneratedCodeInCurrentSession = () => {
    return (
      currentResult !== null ||
      messages.some((msg) => msg.hasCode === true) ||
      getCurrentPhase() === "completed"
    );
  };

  /**
   * Determines what type of input is currently expected from the user.
   * @returns {string|null} 'prompt', 'sequence-sheet', or null.
   */
  const getAwaitedInput = () => {
    const phase = getCurrentPhase();
    if (phase !== "awaiting_input") return null;

    const recentMessages = messages.slice(-3);
    const lastCodyMessage = recentMessages
      .reverse()
      .find((m) => m.type === "cody");

    if (!lastCodyMessage) return null;

    if (lastCodyMessage.content.includes("prompt below")) return "prompt";
    if (lastCodyMessage.content.includes("sequence sheet"))
      return "sequence-sheet";

    return null;
  };

  /**
   * Handles user clicks on interactive message options.
   * @param {string} optionId - The identifier for the clicked option.
   */
  const handleOptionClick = async (optionId) => {
    if (optionId === "prompt") {
      await addMessage({
        type: "user",
        content: "I want to enter a prompt",
      });
      await addMessage({
        type: "cody",
        content:
          "Great choice! What kind of implementation would you like me to create? Just type your prompt below.",
      });
    } else if (optionId === "lql") {
      await addMessage({
        type: "user",
        content: "I want to define an LQL Interface",
      });
      await addMessage({
        type: "cody",
        content:
          "Excellent! I've opened the LQL editor in the right panel. You can define your interface there and validate it when ready.",
      });

      setRightPanelContent("lql");
      setRightPanelOpen(true);
    } else if (optionId === "yes-tests") {
      await addMessage({
        type: "user",
        content: "Yes, I want to add tests",
      });
      await addMessage({
        type: "cody",
        content:
          "Perfect! You can create tests using the Sequence Sheet Creator in the right panel, or enter a sequence sheet manually as text below.",
      });

      setRightPanelContent("sequence");
      setRightPanelOpen(true);
    } else if (optionId === "no-tests") {
      await addMessage({
        type: "user",
        content: "No, proceed without manual tests",
      });
      startGeneration();
    } else if (optionId === "new-generation") {
      await createNewSession();
    }
  };

  /**
   * Displays an error message in the chat with an option to restart the session.
   * @param {string} errorMessage - The error message to display.
   */
  const showErrorWithStartOver = async (errorMessage) => {
    await addMessage({
      type: "cody",
      content: errorMessage,
      isError: true,
      options: [{ id: "new-generation", label: "Restart Session", icon: "" }],
    });
  };

  /**
   * Displays a helpful message guiding the user on next steps after code generation.
   */
  const showHelpMessage = async () => {
    await addMessage({
      type: "cody",
      content:
        "You now have several options to proceed. You can choose one or several of the following actions:\n\n• **Refine the selected code** - Describe what aspects you'd like me to improve (performance, readability, error handling, etc.). You can select which code candidate to refine in the Code Panel on your right side.\n• **Request additional tests** - Ask for more comprehensive test coverage\n• **Generate more code candidates** - Get alternative implementations to choose from\n\nYou can also start again and try a new generation with different options or different inputs.",
      options: [{ id: "new-generation", label: "Restart Session", icon: "" }],
    });
  };

  /**
   * Handles the submission of user text input, routing it to either start
   * a new generation or a refinement based on the current state.
   * @param {string} text - The text input from the user.
   */
  const handleTextInput = async (text) => {
    await addMessage({
      type: "user",
      content: text,
    });

    if (text.toLowerCase().trim() === "help") {
      await showHelpMessage();
      return;
    }

    if (currentResult === null) {
      // If the LQL hasn't been validated and is still the default,
      // it means the user is starting with just a prompt.
      if (!lqlValidationResult && lql === DEFAULT_LQL_INTERFACE) {
        setUserStartedWithPromptOnly(true);
      }
      startGeneration(text);
    } else {
      startRefinement(text);
    }
  };

  /**
   * Initiates the validation process for the LQL code entered by the user.
   */
  const handleLqlValidation = async () => {
    if (!lql.trim()) {
      await addMessage({
        type: "cody",
        content: "Please enter some LQL content before validating.",
        isError: true,
      });
      return;
    }

    await addMessage({
      type: "cody",
      content: "Validating your LQL interface...",
    });

    try {
      const result = await sessionAPI.validateLQL(currentSessionId, lql);
      setLqlValidationResult(result);

      setMessages((prev) => prev.filter((m) => !m.isLoading));

      if (result.success && result.isValid) {
        await addMessage({
          type: "cody",
          content:
            "✅ Your LQL interface is valid! Would you like to manually add tests in the form of a sequence sheet?",
          options: [
            { id: "yes-tests", label: "Yes", icon: "✔" },
            { id: "no-tests", label: "No", icon: "✗" },
          ],
        });
      } else {
        const errorMessage = formatLqlErrorsForDisplay(result.errors);
        await addMessage({
          type: "cody",
          content: `❌ LQL Validation Failed:\n\n${errorMessage}\n\nPlease correct the errors and try again.`,
          isError: true,
        });
      }
    } catch (error) {
      setMessages((prev) => prev.filter((m) => !m.isLoading));
      await addMessage({
        type: "cody",
        content: `❌ Validation error: ${error.message}`,
        isError: true,
      });
      setLqlValidationResult({
        success: false,
        isValid: false,
        errors: [`Validation request failed: ${error.message}`],
      });
    }
  };

  /**
   * Handles the submission of a sequence sheet, triggering code generation.
   * @param {string} ssn - The sequence sheet content.
   */
  const handleSequenceSheetSubmit = async (ssn) => {
    if (!ssn || !ssn.trim()) {
      await addMessage({
        type: "cody",
        content:
          "The sequence sheet is empty. Please define at least one test step before generating.",
        isError: true,
      });
      return;
    }

    setSequenceSheet(ssn);
    await addMessage({
      type: "user",
      content: ssn,
    });

    await addMessage({
      type: "cody",
      content:
        "Thanks for the sequence sheet! I'll incorporate it into the test generation. Let me start working on your implementation now...",
    });

    startGeneration(null, ssn);
  };

  /**
   * Gathers all necessary data (LQL, prompt, sequence sheet) from the current
   * state to prepare for a generation request.
   * @returns {object} The collected data for the generation payload.
   */
  const collectGenerationData = () => {
    const data = {};

    if (lqlValidationResult && lqlValidationResult.isValid) {
      data.lql = lql;
    }

    if (sequenceSheet && sequenceSheet.trim()) {
      data.sequenceSheet = sequenceSheet;
    }

    const userMessages = messages.filter(
      (msg) =>
        msg.type === "user" &&
        !msg.content.includes("LQL") &&
        !msg.content.includes("Define") &&
        msg.content !== "I want to enter a prompt" &&
        msg.content !== "Yes, I want to add tests" &&
        msg.content !== "No, proceed without manual tests",
    );

    if (userMessages.length > 0) {
      const awaitedInput = getAwaitedInput();
      if (awaitedInput === "sequence-sheet" && userMessages.length > 0) {
        if (!data.sequenceSheet) {
          data.sequenceSheet = userMessages[userMessages.length - 1].content;
        }
        if (userMessages.length > 1) {
          data.prompt = userMessages[userMessages.length - 2].content;
        }
      } else {
        data.prompt = userMessages[userMessages.length - 1].content;
      }
    }

    return data;
  };

  /**
   * Kicks off the asynchronous code generation process by sending a request
   * to the backend with the user's specifications.
   * @param {string|null} promptOverride - An optional prompt to override the one in state.
   * @param {string|null} sequenceSheetOverride - An optional sequence sheet to override the one in state.
   */
  const startGeneration = async (
    promptOverride = null,
    sequenceSheetOverride = null,
  ) => {
    if (webhookError) {
      await addMessage({
        type: "cody",
        content:
          "❌ **Cannot start generation**: Webhook server is not running.\n\nPlease ensure the webhook server is started on `http://localhost:5174` and refresh the page.",
        isError: true,
      });
      return;
    }

    try {
      const testResponse = await fetch("http://localhost:5174/api/health", {
        method: "GET",
        timeout: 3000,
      });
      if (!testResponse.ok) {
        throw new Error("Webhook server not responding");
      }
    } catch (error) {
      setWebhookError(true);
      await addMessage({
        type: "cody",
        content:
          "❌ **Webhook server check failed**: The webhook server at `http://localhost:5174` is not reachable.\n\n**Please:**\n• Start the webhook server\n• Ensure it's running on port 5174 (HTTP) and 8080 (WebSocket)\n• Refresh the page and try again",
        isError: true,
      });
      return;
    }

    setIsGenerating(true);

    await addMessage({
      type: "cody",
      content:
        "Alright partner, I'm saddling up to generate your code! This might take a few minutes...",
    });

    const generationData = collectGenerationData();

    if (promptOverride) generationData.prompt = promptOverride;
    if (sequenceSheetOverride)
      generationData.sequenceSheet = sequenceSheetOverride;

    const payload = {
      lqlInterface: userStartedWithPromptOnly ? "" : (generationData.lql || ""),
      userPrompt: generationData.prompt || "",
      sequenceSheet: generationData.sequenceSheet || "",
      rankingCriteria: generationSettings.rankedCriteria,
      generationOptions: {
        numberOfVersions: Object.values(generationSettings.llmVersions).reduce(
          (a, b) => a + b,
          0,
        ),
        selectedLLMs: Object.keys(generationSettings.llmEnabled).filter(
          (k) => generationSettings.llmEnabled[k],
        ),
        features: generationSettings.features || "cc",
        use_nicad: generationSettings.use_nicad || false,
        use_gpt: generationSettings.llmEnabled["GPT-4o-mini"] || true,
        samples_gpt: generationSettings.llmVersions["GPT-4o-mini"] || 1,
        use_gemma: generationSettings.llmEnabled["gemma3:27b"] || true,
        samples_gemma: generationSettings.llmVersions["gemma3:27b"] || 0,
        use_llama: generationSettings.llmEnabled["Llama 3.1-latest"] || false,
        samples_llama: generationSettings.llmVersions["Llama 3.1-latest"] || 0,
        use_deepseek:
          generationSettings.llmEnabled["deepseek-r1:latest"] || false,
        samples_deepseek:
          generationSettings.llmVersions["deepseek-r1:latest"] || 0,
        use_search: generationSettings.mavenCentralEnabled || false,
        samples_search: generationSettings.mavenCentralVersions || 0,
        user_provided_tests: generationData.sequenceSheet || "",
        use_testGen_gpt: generationSettings.use_testGen_gpt || false,
        use_testGen_ollama: generationSettings.use_testGen_ollama || true,
        samples_LLM_testGen: generationSettings.samples_LLM_testGen || 1,
        model_testGen: generationSettings.model_testGen || "gemma3:27b",
        use_random_testGen: generationSettings.use_random_testGen || false,
        samples_random_testGen: generationSettings.samples_random_testGen || 5,
        use_type_aware_testGen:
          generationSettings.use_type_aware_testGen || false,
        samples_type_aware_testGen:
          generationSettings.samples_type_aware_testGen || 2,
        maxTimeMinutes: generationSettings.generationTimeMinutes,
      },
      frontendUrl: "http://localhost:5174",
    };

    try {
      const result = await sessionAPI.startGeneration(
        currentSessionId,
        payload,
      );

      if (result.success) {
        console.log("✅ Generation started. Listening for webhook results...");
        AsyncCodeGenerationAPI.registerSession(
          currentSessionId,
          handleGenerationComplete,
          (progress) => console.log("Generation progress:", progress),
        );
      } else {
        throw new Error(result.message || "Failed to start generation");
      }
    } catch (error) {
      setMessages((prev) => prev.filter((m) => !m.isLoading));
      await showErrorWithStartOver(`❌ Generation failed: ${error.message}`);
      setIsGenerating(false);
    }
  };

  /**
   * Initiates a refinement of an existing code generation based on new user input.
   * @param {string} userRequest - The new request from the user for refinement.
   */
  const startRefinement = async (userRequest) => {
    if (!currentSessionId || !currentResult) {
      await addMessage({
        type: "cody",
        content:
          "❌ No code available to work with. Please generate code first.",
        isError: true,
      });
      return;
    }

    const totalResults = currentResult
      ? 1 + (currentResult.otherImplementations?.length || 0)
      : 0;

    if (totalResults > 1 && selectedCodeId === null) {
      await addMessage({
        type: "cody",
        content:
          "Please select a code implementation to refine from the Code Panel on the right before requesting refinements.",
        isError: true,
      });
      return;
    }

    if (webhookError) {
      await addMessage({
        type: "cody",
        content:
          "❌ **Cannot start refinement**: Webhook server is not running.\n\nPlease ensure the webhook server is started on `http://localhost:5174` and refresh the page.",
        isError: true,
      });
      return;
    }

    try {
      const testResponse = await fetch("http://localhost:5174/api/health", {
        method: "GET",
        timeout: 3000,
      });
      if (!testResponse.ok) {
        throw new Error("Webhook server not responding");
      }
    } catch (error) {
      setWebhookError(true);
      await addMessage({
        type: "cody",
        content:
          "❌ **Webhook server check failed**: The webhook server at `http://localhost:5174` is not reachable.\n\n**Please:**\n• Start the webhook server\n• Ensure it's running on port 5174 (HTTP) and 8080 (WebSocket)\n• Refresh the page and try again",
        isError: true,
      });
      return;
    }

    setIsRefining(true);

    await addMessage({
      type: "cody",
      content: "Working on your request...",
    });

    const allUserRequests = messages
      .filter(
        (msg) =>
          msg.type === "user" &&
          !msg.content.includes("LQL") &&
          !msg.content.includes("No, proceed without manual tests") &&
          msg.content !== "I want to enter a prompt" &&
          msg.content !== "I want to define an LQL Interface",
      )
      .map((msg) => msg.content);

    allUserRequests.push(userRequest);

    try {
      const result = await sessionAPI.startRefinement(currentSessionId, {
        userResponses: allUserRequests,
        selectedCodeID: selectedCodeId || 0,
        frontendUrl: "http://localhost:5174",
        rankingCriteria: generationSettings.rankedCriteria,
        maxTimeMinutes: generationSettings.generationTimeMinutes,
      });

      if (result.success) {
        console.log("✅ Refinement started. Listening for webhook results...");
        AsyncCodeGenerationAPI.registerSession(
          currentSessionId,
          handleRefinementComplete,
          (progress) => console.log("Refinement progress:", progress),
        );
      } else {
        throw new Error(result.message || "Failed to start refinement");
      }
    } catch (error) {
      setMessages((prev) => prev.filter((m) => !m.isLoading));
      await showErrorWithStartOver(`❌ Request failed: ${error.message}`);
      setIsRefining(false);
    }
  };

  /**
   * Callback function to handle the successful completion of a code generation task.
   * @param {object} result - The result data from the backend.
   */
  const handleGenerationComplete = async (result) => {
    setIsGenerating(false);

    if (result.success) {
      setCurrentResult(result.data);

      if (
        result.data.isRefinement &&
        result.data.refinedImplementationIndex !== null
      ) {
        const implementations = result.data.implementations || [];
        const refinedImplIndex = implementations.findIndex(
          (impl) => impl.id === result.data.refinedImplementationIndex,
        );
        setSelectedCodeId(refinedImplIndex !== -1 ? refinedImplIndex : 0);
      } else {
        setSelectedCodeId(0);
      }

      console.log(
        "Generation completed, reloading session to get backend message",
      );
      await loadSessionData(currentSessionId);

      setRightPanelContent("code");
      setRightPanelOpen(true);
    } else {
      await showErrorWithStartOver(`❌ Generation failed: ${result.error}`);
    }
  };

  /**
   * Callback function to handle the successful completion of a code refinement task.
   * @param {object} result - The result data from the backend.
   */
  const handleRefinementComplete = async (result) => {
    setIsRefining(false);

    if (result.success) {
      setCurrentResult({
        ...result.data,
        isRefinement: true,
        hasRefinement: true,
      });

      console.log(
        "Refinement completed, reloading session to get backend message",
      );
      await loadSessionData(currentSessionId);

      setRightPanelContent("code");
      setRightPanelOpen(true);
    } else {
      await showErrorWithStartOver(`❌ Request failed: ${result.error}`);
    }
  };

  /**
   * Opens the right panel to show the generated code.
   */
  const handleCodeClick = () => {
    setRightPanelContent("code");
    setRightPanelOpen(true);
  };

  /**
   * Sets the currently selected code implementation for refinement.
   * @param {number} codeId - The index of the selected code.
   */
  const handleCodeSelect = (codeId) => {
    console.log("🔄 ChatInterface: Code selected:", codeId);
    setSelectedCodeId(codeId);
  };

  /**
   * Determines whether the chat input box should be visible.
   * @returns {boolean} True if the input should be shown.
   */
  const shouldShowInput = () => {
    const phase = getCurrentPhase();
    return ["awaiting_input", "completed"].includes(phase);
  };

  /**
   * Gets the appropriate placeholder text for the chat input box.
   * @returns {string} The placeholder text.
   */
  const getInputPlaceholder = () => {
    const awaitedInput = getAwaitedInput();
    const phase = getCurrentPhase();

    if (awaitedInput === "prompt") return "Enter your implementation prompt...";
    if (awaitedInput === "sequence-sheet")
      return "Enter your sequence sheet...";
    if (phase === "completed") {
      return "Ask for refinements, tests, more candidates, or type 'help' for options...";
    }
    return "Type a message...";
  };

  /**
   * Formats a date object or string into a German locale string (DD.MM.YYYY, HH:MM).
   * @param {Date|string|number} date - The date to format.
   * @returns {string} The formatted timestamp.
   */
  const formatTimestamp = (date) => {
    if (!date) return "";

    try {
      let dateObj;
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === "string") {
        dateObj = new Date(date);
      } else if (typeof date === "number") {
        dateObj = new Date(date);
      } else {
        return "";
      }

      if (isNaN(dateObj.getTime())) {
        console.warn("Invalid date:", date);
        return "";
      }

      return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Berlin",
      }).format(dateObj);
    } catch (error) {
      console.warn("Timestamp formatting error:", error, "for date:", date);
      return "";
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

      <div
        className={`chat-main ${leftSidebarOpen ? "sidebar-open" : ""} ${
          rightPanelOpen ? "panel-open" : ""
        }`}
      >
        <div className="chat-header">
          <div className="header-left">
            <button
              className="menu-button"
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            >
              ☰
            </button>
          </div>

          <div className="header-center">
            <div className="session-info">
              <h1>Code Cowboy</h1>
            </div>
          </div>

          <div className="header-right">
            <div className="header-actions">
              <button
                className="menu-button"
                onClick={() => {
                  setRightPanelContent("sequence");
                  setRightPanelOpen(!rightPanelOpen);
                }}
                title="Toggle Sequence Sheet Editor"
              >
                SSC
              </button>
              <button
                className="menu-button"
                onClick={() => {
                  setRightPanelContent("lql");
                  setRightPanelOpen(!rightPanelOpen);
                }}
                title="Toggle LQL Editor"
              >
                LQL
              </button>
              <button
                className="menu-button"
                onClick={() => {
                  setRightPanelContent("code");
                  setRightPanelOpen(!rightPanelOpen);
                }}
                title="Toggle Code Panel"
              >
                Code
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
              <span>
                ⚠️ Webhook server not connected. Code generation may not work
                properly.
              </span>
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
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={{
                  ...message,
                  timestamp: formatTimestamp(message.timestamp),
                }}
                onOptionClick={handleOptionClick}
                onCodeClick={handleCodeClick}
              />
            ))}

            {(isGenerating || isRefining) && (
              <MessageBubble
                key="loading-indicator"
                message={{
                  id: "loading-indicator",
                  type: "cody",
                  isLoading: true,
                }}
              />
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>

        {shouldShowInput() && (
          <ChatInput
            onSubmit={handleTextInput}
            placeholder={getInputPlaceholder()}
            multiline={getAwaitedInput() === "sequence-sheet"}
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
        sequenceSheet={sequenceSheet}
        onSequenceSheetChange={setSequenceSheet}
        onSubmitSequenceSheet={handleSequenceSheetSubmit}
        width={rightPanelWidth}
        onWidthChange={setRightPanelWidth}
        hasRefinedCode={currentResult?.isRefined || false}
        isRefining={isRefining}
        selectedCodeId={selectedCodeId}
        onCodeSelect={handleCodeSelect}
        hasGeneratedCode={hasGeneratedCodeInCurrentSession()}
      />
    </div>
  );
};

export default ChatInterface;
