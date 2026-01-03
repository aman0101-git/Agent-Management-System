import { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();
const API_URL = "http://localhost:5000/api/auth";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem("token");
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ===============================
     Restore token on refresh
     =============================== */
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }

    // 🔑 auth resolution complete
    setLoading(false);
  }, []);

  /* ===============================
     LOGIN (MATCHES BACKEND EXACTLY)
     =============================== */
  const login = async (username, password) => {
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post(`${API_URL}/login`, {
        username,
        password,
      });

      const loggedInUser = {
        id: res.data.user.id,
        firstName: res.data.user.firstName,
        lastName: res.data.user.lastName,
        username: res.data.user.username,
        role: res.data.user.role,
      };

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(loggedInUser));

      setToken(res.data.token);
      setUser(loggedInUser);

      return {
        success: true,
        redirectTo: res.data.redirectTo,
      };
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     LOGOUT
     =============================== */
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, error, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
