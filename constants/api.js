// Base API URL for the backend
export const API_BASE_URL = "https://react-app-api-mos5.onrender.com/api";
// export const API_BASE_URL = "http://localhost:5001/api";

// Endpoint for food-entry–related requests
export const FOOD_ENTRIES_API_URL = `${API_BASE_URL}/food-entries`;

// Endpoint for user-related requests
export const USERS_API_URL = `${API_BASE_URL}/users`;

// Endpoint for session-related requests
export const SESSIONS_API_URL = `${API_BASE_URL}/sessions`;

// Camera timing constants
export const FRAME_UPLOAD_INTERVAL_MS = 300; // How often to send frames to backend (ms)

// Polling intervals (in seconds)
export const LOG_POLL_INTERVAL_SEC = 0.35; // How often to fetch the session log when running (sec)
