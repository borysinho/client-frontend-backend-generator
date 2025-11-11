// API configuration utility
// This ensures consistent API URL usage across the application

const getApiBaseUrl = (): string => {
  // Get the environment variable
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;

  // Return the configured URL or fallback to localhost for development
  return envUrl && envUrl !== "undefined"
    ? envUrl
    : "http://localhost:3001";
};

// Export the base URL for use in API calls
export const API_BASE_URL = getApiBaseUrl();

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};