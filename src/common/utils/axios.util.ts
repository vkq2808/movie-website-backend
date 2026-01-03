// utils/api.util.ts

import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

// Mở rộng interface InternalAxiosRequestConfig để thêm thuộc tính _retry
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const baseURL =
  process.env.THE_MOVIE_DATABASE_BASE_URL || 'https://api.themoviedb.org/3';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// NOTE: Token refresh queueing removed until a proper refresh flow is implemented

// Interceptor cho request: khởi tạo headers nếu chưa có và thêm access token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers = config.headers || {};
    const token = process.env.THE_MOVIE_DATABASE_TOKEN;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) =>
    Promise.reject(error instanceof Error ? error : new Error('Request error')),
);

// Interceptor cho response để xử lý lỗi 401 và tự động refresh token
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Incomplete refresh flow: mark retry to prevent loops and reject with an Error
      originalRequest._retry = true;
      return Promise.reject(
        error instanceof Error ? error : new Error('Unauthorized response'),
      );
    }

    return Promise.reject(
      error instanceof Error ? error : new Error('Response error'),
    );
  },
);

export default api;
