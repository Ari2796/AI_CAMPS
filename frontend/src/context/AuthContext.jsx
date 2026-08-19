import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      try {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (storedUser) setUser(storedUser);
      } catch (e) {
        console.error("Failed to parse user data");
      }
    }
    setLoading(false);
  }, [token]);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const loginAsGuest = (guestData = null, authToken = null) => {
    const guestUser = guestData || { name: 'Guest', isGuest: true, role: 'guest' };
    const tokenToSave = authToken || 'guest-token';
    setUser(guestUser);
    setToken(tokenToSave);
    localStorage.setItem('token', tokenToSave);
    localStorage.setItem('user', JSON.stringify(guestUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    try {
      sessionStorage.clear();
    } catch (e) {}
  };

  const isAdmin = user?.role === 'admin';
  const isGuest = user?.role === 'guest' || user?.isGuest === true;
  const isStudent = user?.role === 'student' || (!isAdmin && !isGuest && !!user);

  const value = {
    user,
    token,
    login,
    loginAsGuest,
    logout,
    isAdmin,
    isGuest,
    isStudent,
    isAuthenticated: !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
