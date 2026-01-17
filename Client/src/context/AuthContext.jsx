import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();
const API_LOGIN = 'http://localhost:5000/api/auth/login';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState(null);

  // Restore token and user from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');
    const expiresAt = localStorage.getItem('tokenExpiresAt');

    if (storedToken && storedUser && expiresAt) {
      if (new Date(expiresAt) > new Date()) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      } else {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        localStorage.removeItem('tokenExpiresAt');
      }
    }
    setLoading(false);
  }, []);

  // login performs API call and persists token/user
    const login = async (username, password) => {
    setAuthLoading(true);
    setError(null);

    try {
      const res = await axios.post(API_LOGIN, { username, password }, { withCredentials: true });

      if (res.data?.token && res.data?.user) {
        const { token: tkn, user: u, expiresAt } = res.data;

        setToken(tkn);
        setUser(u);

        axios.defaults.headers.common['Authorization'] = `Bearer ${tkn}`;

        localStorage.setItem('authToken', tkn);
        localStorage.setItem('authUser', JSON.stringify(u));
        localStorage.setItem(
          'tokenExpiresAt',
          expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        );

        return true;
      }

      setError('Invalid login response');
      return false;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setError(null);
    delete axios.defaults.headers.common['Authorization'];
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    localStorage.removeItem('tokenExpiresAt');
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, authLoading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
