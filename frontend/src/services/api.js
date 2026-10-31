// Use environment variable if configured (for production deployment e.g. Vercel), else fallback to dynamic hostname
const PROD_API = import.meta.env.VITE_API_URL;
const API_HOST = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '127.0.0.1';
export const API_BASE_URL = PROD_API ? `${PROD_API}/api` : `http://${API_HOST}:8000/api`;

export const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const headers = {
    ...options.headers,
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API Error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};
