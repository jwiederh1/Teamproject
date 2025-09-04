const API_BASE_URL = "http://localhost:8000/api";

/**
 * A singleton class to manage user authentication, including registration,
 * login, logout, and token management. It persists authentication data in
 * localStorage.
 */
class AuthAPI {
  constructor() {
    this.token = localStorage.getItem("auth_token");
    this.userId = localStorage.getItem("user_id");
    this.username = localStorage.getItem("username");
  }

  /**
   * Constructs and returns the authorization headers required for authenticated API requests.
   * @throws {Error} If no authentication token is available.
   * @returns {object} The authorization headers.
   */
  getAuthHeaders() {
    if (!this.token) {
      throw new Error("No authentication token available");
    }
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Registers a new user with the backend.
   * @param {string} username - The desired username.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @returns {Promise<object>} A promise that resolves with the new user's data.
   * @throws {Error} If registration fails or the server is unreachable.
   */
  async register(username, email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Registration failed");
      }

      const userData = await response.json();
      console.log("✅ User registered successfully:", userData.username);
      return userData;
    } catch (error) {
      console.error("❌ Registration error:", error);
      if (error.message === "Failed to fetch") {
        throw new Error(
          "Unable to connect to server. Please check if the backend is running on http://localhost:8000",
        );
      }
      throw error;
    }
  }

  /**
   * Logs in a user and stores the authentication token and user info.
   * @param {string} username - The username to log in with.
   * @param {string} password - The user's password.
   * @returns {Promise<object>} A promise that resolves with the token and user data.
   * @throws {Error} If login fails or the server is unreachable.
   */
  async login(username, password) {
    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const response = await fetch(`${API_BASE_URL}/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }

      const tokenData = await response.json();

      this.token = tokenData.access_token;
      this.userId = tokenData.user_id;
      this.username = tokenData.username;

      localStorage.setItem("auth_token", this.token);
      localStorage.setItem("user_id", this.userId);
      localStorage.setItem("username", this.username);

      console.log("✅ User logged in successfully:", this.username);
      return tokenData;
    } catch (error) {
      console.error("❌ Login error:", error);
      if (error.message === "Failed to fetch") {
        throw new Error(
          "Unable to connect to server. Please check if the backend is running on http://localhost:8000",
        );
      }
      throw error;
    }
  }

  /**
   * Logs out the current user by clearing the stored authentication data.
   */
  logout() {
    this.token = null;
    this.userId = null;
    this.username = null;

    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    localStorage.removeItem("current_session_id");

    console.log("✅ User logged out");
  }

  /**
   * Checks if a user is currently authenticated.
   * @returns {boolean} True if the user is authenticated, otherwise false.
   */
  isAuthenticated() {
    return !!this.token;
  }

  /**
   * Fetches the details of the currently authenticated user from the backend.
   * @returns {Promise<object>} A promise that resolves with the current user's data.
   * @throws {Error} If the user is not authenticated or the session has expired.
   */
  async getCurrentUser() {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.logout();
          throw new Error("Session expired. Please login again.");
        }
        const error = await response.json();
        throw new Error(error.detail || "Failed to get user info");
      }

      return await response.json();
    } catch (error) {
      console.error("❌ Error getting current user:", error);
      if (error.message === "Failed to fetch") {
        throw new Error(
          "Unable to connect to server. Please check if the backend is running",
        );
      }
      throw error;
    }
  }

  /**
   * Pings the backend's health check endpoint to verify connectivity.
   * @returns {Promise<boolean>} A promise that resolves to true if the backend is reachable.
   */
  async testConnection() {
    try {
      const response = await fetch(
        `${API_BASE_URL.replace("/api", "")}/health`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        console.log("✅ Backend connection successful");
        return true;
      } else {
        console.log(
          "⚠️ Backend responded but with error status:",
          response.status,
        );
        return false;
      }
    } catch (error) {
      console.error("❌ Backend connection failed:", error);
      return false;
    }
  }
}

const authAPI = new AuthAPI();
export default authAPI;
