import axios from 'axios';

// Get base URL from environment or default to local backend (stripping trailing slash)
const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for consistent error extraction and logging
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let errorMessage;

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      errorMessage =
        error.response.data?.error ||
        error.response.data?.detail ||
        error.response.data?.message ||
        `Request failed with status ${error.response.status}`;
    } else if (error.request) {
      // The request was made but no response was received (e.g. timeout or server down)
      errorMessage = 'Unable to connect to the backend server. Please verify the server is running.';
    } else {
      errorMessage = error.message;
    }

    // Attach parsed human-readable message to error object
    error.userMessage = errorMessage;
    return Promise.reject(error);
  }
);

export default apiClient;
