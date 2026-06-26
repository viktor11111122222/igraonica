import { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setLoading(false);
        return;
      }
      const data = await apiRequest('/auth/me');
      setUser(data.user);
    } catch {
      await SecureStore.deleteItemAsync('token');
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    await SecureStore.setItemAsync('token', data.token);
    setUser(data.user);
    return data;
  }

  async function register(fields) {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: fields,
    });
    await SecureStore.setItemAsync('token', data.token);
    setUser(data.user);
    return data;
  }

  async function logout() {
    await SecureStore.deleteItemAsync('token');
    setUser(null);
  }

  async function updateProfile(fields) {
    const data = await apiRequest('/auth/profile', {
      method: 'PATCH',
      body: fields,
    });
    setUser(data.user);
    return data;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be inside AuthProvider');
  return context;
}
