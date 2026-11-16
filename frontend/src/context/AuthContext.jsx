import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('docugenius_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('docugenius_token') || null);
  const [loading, setLoading] = useState(true);

  // Check current session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data && res.data.success) {
          setUser(res.data.data);
          localStorage.setItem('docugenius_user', JSON.stringify(res.data.data));
        }
      } catch {
        // If backend auth/me fails (e.g. MongoDB offline or no token), keep existing cached session or null
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data && res.data.success) {
        const { user: userData, token: userToken } = res.data.data;
        setUser(userData);
        setToken(userToken);
        localStorage.setItem('docugenius_user', JSON.stringify(userData));
        localStorage.setItem('docugenius_token', userToken);
        return { success: true, user: userData };
      }
      return { success: false, error: res.data.message || 'Login failed' };
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      return { success: false, error: msg };
    }
  };

  const register = async (name, email, password) => {
    try {
      const res = await api.post('/auth/register', { name, email, password });
      if (res.data && res.data.success) {
        const { user: userData, token: userToken } = res.data.data;
        setUser(userData);
        setToken(userToken);
        localStorage.setItem('docugenius_user', JSON.stringify(userData));
        localStorage.setItem('docugenius_token', userToken);
        return { success: true, user: userData };
      }
      return { success: false, error: res.data.message || 'Registration failed' };
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors during logout
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('docugenius_user');
      localStorage.removeItem('docugenius_token');
    }
  };

  // Quick dev guest login for UI evaluation when MongoDB is pending configuration
  const devGuestLogin = () => {
    const guestUser = {
      id: 'demo-guest-user',
      name: 'Studio Designer',
      email: 'demo@docugenius.ai',
      role: 'user',
    };
    setUser(guestUser);
    setToken('demo-guest-token');
    localStorage.setItem('docugenius_user', JSON.stringify(guestUser));
    localStorage.setItem('docugenius_token', 'demo-guest-token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        devGuestLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

