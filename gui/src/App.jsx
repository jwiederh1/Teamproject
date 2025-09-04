import React, { useState, useEffect } from "react";
import ChatInterface from "./features/chat/ChatInterface.jsx";
import Login from "./features/Login/Login.jsx";
import authAPI from "./api/authApi";
import "./index.css";

/**
 * The root component of the application. It manages the primary authentication
 * state and acts as a router, displaying either the Login screen or the main
 * ChatInterface based on whether the user is authenticated.
 * @returns {JSX.Element} The rendered application component.
 */
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAuthentication();
  }, []);

  /**
   * Checks if the user has a valid, non-expired authentication token stored.
   * It updates the component's state to reflect the user's auth status.
   */
  const checkAuthentication = async () => {
    try {
      setIsCheckingAuth(true);
      setAuthError(null);

      if (authAPI.isAuthenticated()) {
        // Verify token is still valid by making a lightweight API call.
        await authAPI.getCurrentUser();
        setIsAuthenticated(true);
        console.log("✅ User authenticated successfully");
      } else {
        setIsAuthenticated(false);
        console.log("ℹ️ User not authenticated");
      }
    } catch (error) {
      console.error("❌ Auth check failed:", error);
      authAPI.logout();
      setIsAuthenticated(false);

      if (error.message.includes("Session expired")) {
        setAuthError("Your session has expired. Please log in again.");
      } else if (error.message.includes("Network")) {
        setAuthError(
          "Unable to connect to server. Please check your connection and try again.",
        );
      } else {
        setAuthError("Authentication failed. Please try logging in again.");
      }
    } finally {
      setIsCheckingAuth(false);
    }
  };

  /**
   * Callback function triggered upon a successful login event.
   */
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setAuthError(null);
    console.log("✅ Login successful");
  };

  /**
   * Callback function to handle user logout.
   */
  const handleLogout = () => {
    authAPI.logout();
    setIsAuthenticated(false);
    setAuthError(null);
    console.log("✅ Logout successful");
  };

  /**
   * Callback to set an authentication-related error message.
   * @param {string} error - The error message to display.
   */
  const handleAuthError = (error) => {
    setAuthError(error);
    setIsAuthenticated(false);
  };

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
          <p
            style={{
              marginTop: "20px",
              fontSize: "1.1rem",
              color: "rgba(255, 255, 255, 0.8)",
            }}
          >
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

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
