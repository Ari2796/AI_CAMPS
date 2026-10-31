import React, { createContext, useState, useEffect, useContext } from 'react';
import { apiCall } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const isSignedOut = typeof window !== 'undefined' && localStorage.getItem('signed_out') === 'true';

  const sanitizeUser = (rawUser) => {
    if (!rawUser) return null;
    const mail = (rawUser.email || '').toLowerCase();
    const roll = (rawUser.roll || rawUser.roll_number || '').toLowerCase();
    const isStudent = mail.includes('7376') || mail.includes('.ad') || mail.includes('.cs') || mail.includes('.it') || mail.includes('.ec') || roll.includes('7376') || roll.includes('ad');

    let sanitizedRole = rawUser.role;
    let sanitizedDept = rawUser.dept || rawUser.department;
    let sanitizedName = rawUser.name;

    if (isStudent && sanitizedRole !== 'admin') {
      sanitizedRole = 'student';
      if (sanitizedDept === 'Faculty of Engineering' || !sanitizedDept) {
        sanitizedDept = (mail.includes('ad') || roll.includes('ad')) ? 'Artificial Intelligence and Data Science' : 'Engineering & Technology';
      }
      if (sanitizedName && /ad23/i.test(sanitizedName)) {
        sanitizedName = sanitizedName.replace(/ad23/gi, '').trim() || 'Arikrishnan R';
      }
    }

    return {
      ...rawUser,
      name: sanitizedName,
      role: sanitizedRole,
      dept: sanitizedDept,
      isVerified: sanitizedRole !== 'guest'
    };
  };

  const [user, setUser] = useState(() => {
    if (isSignedOut) return null;
    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return null;
      const parsed = JSON.parse(storedUser);
      const sanitized = sanitizeUser(parsed);
      if (sanitized && JSON.stringify(sanitized) !== storedUser) {
        localStorage.setItem('user', JSON.stringify(sanitized));
      }
      return sanitized;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    if (isSignedOut) return null;
    return localStorage.getItem('token') || null;
  });

  const [loading, setLoading] = useState(false);

  const login = (userData, authToken) => {
    localStorage.removeItem('signed_out');
    const enrichedUser = sanitizeUser(userData);
    setUser(enrichedUser);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(enrichedUser));
  };

  const loginAsGuest = (guestData = null, authToken = null) => {
    localStorage.removeItem('signed_out');
    const guestUser = guestData || { name: 'Guest Visitor', isGuest: true, role: 'guest', isVerified: false };
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
    localStorage.setItem('signed_out', 'true');
    try {
      sessionStorage.clear();
    } catch (e) {}
  };

  const isAdmin = user?.role === 'admin';
  const isFaculty = user?.role === 'faculty' || user?.role === 'teacher';
  const isGuest = user?.role === 'guest' || user?.isGuest === true;
  const isStudent = user?.role === 'student' || (!isAdmin && !isFaculty && !isGuest && !!user);
  const isVerifiedMember = !isGuest && (isStudent || isFaculty || isAdmin || user?.isVerified === true);

  const value = {
    user,
    token,
    login,
    loginAsGuest,
    logout,
    isAdmin,
    isFaculty,
    isGuest,
    isStudent,
    isVerifiedMember,
    isAuthenticated: !!token || !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
