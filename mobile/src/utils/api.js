import * as storage from './storage';

const API_URL = 'http://localhost:3002/api';

export async function apiRequest(endpoint, options = {}) {
  const token = await storage.getItem('token');

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || 'Greska na serveru.');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
