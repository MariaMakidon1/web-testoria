import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Shared refresh promise — deduplicate concurrent 401s
let refreshPromise: Promise<{
  access_token: string;
  refresh_token: string;
}> | null = null;

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// Response interceptor - Handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const isAuthEndpoint = originalRequest.url?.startsWith("/auth/");
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          // Reuse in-flight refresh if one is already running
          if (!refreshPromise) {
            refreshPromise = axios
              .post(`${API_BASE_URL}/auth/refresh`, {
                refresh_token: refreshToken,
              })
              .then((res) => res.data)
              .finally(() => {
                refreshPromise = null;
              });
          }

          const { access_token, refresh_token: newRefreshToken } =
            await refreshPromise;
          localStorage.setItem("access_token", access_token);
          localStorage.setItem("refresh_token", newRefreshToken);

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          return apiClient(originalRequest);
        } catch (refreshError) {
          // Refresh failed - clear tokens and redirect to login
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token - redirect to login
        localStorage.removeItem("access_token");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
