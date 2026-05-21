import axios from 'axios';

const client = axios.create({ baseURL: '/api/v1' });

client.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('mosaic_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mosaic_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
