// Base API URL for the backend
export const API_BASE_URL = "https://react-app-api-mos5.onrender.com/api";
// export const API_BASE_URL = "http://localhost:5001/api";

// Endpoint for food-entry–related requests
export const FOOD_ENTRIES_API_URL = `${API_BASE_URL}/food-entries`;

// Endpoint for user-related requests
export const USERS_API_URL = `${API_BASE_URL}/users`;

// Endpoint to estimate nutrition macros using AI
export const ESTIMATE_MACROS_API_URL = `${API_BASE_URL}/food-entries/estimate`;

// Endpoint to recommend goals
export const RECOMMEND_GOALS_API_URL = `${API_BASE_URL}/users/recommend-goals`;

// Endpoint for voice log
export const VOICE_LOG_API_URL = `${API_BASE_URL}/voice/log`;

// Endpoint to create Stripe Payment Intent
export const PAYMENTS_API_URL = `${API_BASE_URL}/payments/create-payment-intent`;

// Endpoint for vision-related requests
export const VISION_API_URL = `${API_BASE_URL}/vision`;

// Sign-up completion polling
export const VERIFY_USER_CREATION_RETRY_COUNT = 10; // Number of times to poll for user existence
export const VERIFY_USER_CREATION_RETRY_INTERVAL_MS = 300; // Delay between retries (ms)
