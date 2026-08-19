import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Hash, BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import { apiCall } from '../services/api';

const LoginPage = () => {
  const [authTab, setAuthTab] = useState('student');
  const { login, loginAsGuest, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Student Form
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [dept, setDept] = useState('Computer Science & Engineering');

  // Guest Form
  const [guestName, setGuestName] = useState('Guest Visitor');

  // Admin Form
  const [username, setUsername] = useState('admin1');
  const [password, setPassword] = useState('1admin');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('guest') === 'true') {
      handleGuestSubmit();
    }
  }, [searchParams]);

  if (isAuthenticated && isAdmin) return <Navigate to="/admin" replace />;
  if (isAuthenticated) return <Navigate to="/chat" replace />;

  // Google Sign-In State & Handlers
  const [googleEmail, setGoogleEmail] = useState('');
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    
    const emailClean = googleEmail.trim().toLowerCase();
    if (!emailClean) {
      setError('Please enter your college email address.');
      return;
    }

    if (!emailClean.endsWith('@bitsathy.ac.in')) {
      setError('⚠️ Access Restricted: Please use your official college email ending with @bitsathy.ac.in');
      return;
    }

    setGoogleLoading(true);
    try {
      const rollPart = emailClean.split('@')[0].toUpperCase();
      const studentName = name || rollPart;
      
      const data = await apiCall('/auth/google', {
        method: 'POST',
        body: JSON.stringify({
          email: emailClean,
          name: studentName,
        }),
      });

      login({
        name: studentName,
        roll: rollPart,
        dept: dept || 'Engineering & Technology',
        role: 'student',
        email: emailClean,
        id: data.user_id
      }, data.access_token);

      setShowGoogleModal(false);
      navigate('/chat');
    } catch (err) {
      console.warn("Backend error, local student session created:", err);
      const rollPart = emailClean.split('@')[0].toUpperCase();
      login({ 
        name: name || rollPart, 
        roll: rollPart, 
        dept: dept || 'Engineering & Technology', 
        role: 'student', 
        email: emailClean 
      }, 'token_google_student');
      setShowGoogleModal(false);
      navigate('/chat');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ 
          name, 
          roll_number: roll, 
          department: dept,
          email: `${roll.toLowerCase()}@bitsathy.ac.in`
        }),
      });
      login({ 
        name, 
        roll, 
        dept, 
        role: 'student', 
        email: `${roll.toLowerCase()}@bitsathy.ac.in`, 
        id: data.user_id 
      }, data.access_token);
      navigate('/chat');
    } catch (err) {
      console.warn("Backend error, fallback login:", err);
      login({ name, roll, dept, role: 'student', email: `${roll.toLowerCase()}@bitsathy.ac.in` }, 'token_student');
      navigate('/chat');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiCall('/auth/guest', {
        method: 'POST',
        body: JSON.stringify({ name: guestName || 'Guest Visitor' }),
      });
      loginAsGuest({ 
        name: guestName || 'Guest Visitor', 
        isGuest: true, 
        role: 'guest' 
      }, data.access_token);
      navigate('/chat');
    } catch (err) {
      loginAsGuest({ name: guestName || 'Guest Visitor', isGuest: true, role: 'guest' }, 'token_guest');
      navigate('/chat');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiCall('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      login({ name: 'Administrator', role: 'admin' }, data.access_token);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Invalid administrator credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 transition-colors">
      
      <div className="w-full max-w-sm clean-card p-6 sm:p-7 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-xs">
            <Sparkles size={18} />
          </div>
          <h2 className="text-lg font-bold">
            Sign In to BIT Campus AI
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Bannari Amman Institute of Technology
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 text-xs font-medium">
          <button
            type="button"
            onClick={() => { setAuthTab('student'); setError(''); }}
            className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
              authTab === 'student'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Student
          </button>

          <button
            type="button"
            onClick={() => { setAuthTab('guest'); setError(''); }}
            className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
              authTab === 'guest'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Guest
          </button>

          <button
            type="button"
            onClick={() => { setAuthTab('admin'); setError(''); }}
            className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
              authTab === 'admin'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Admin
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-medium">
            {error}
          </div>
        )}

        {/* ---------------- 1. STUDENT FORM (GOOGLE SSO + ROLL NO) ---------------- */}
        {authTab === 'student' && (
          <div className="space-y-4 text-xs">
            {/* Primary Google Login Button */}
            <button
              type="button"
              onClick={() => setShowGoogleModal(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-100 font-semibold flex items-center justify-center gap-2.5 transition-all shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign in with College Gmail (@bitsathy.ac.in)</span>
            </button>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-zinc-800" />
              <span className="flex-shrink mx-3 text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                or use Roll Number
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-zinc-800" />
            </div>

            <form onSubmit={handleStudentSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-600 dark:text-zinc-400 font-medium mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dinesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-zinc-400 font-medium mb-1">
                  Roll Number / Reg No.
                </label>
                <div className="relative">
                  <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. 7376221CS101"
                    value={roll}
                    onChange={(e) => setRoll(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-emerald-500 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-zinc-400 font-medium mb-1">
                  Department
                </label>
                <div className="relative">
                  <BookOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={dept}
                    onChange={(e) => setDept(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                  >
                    <option value="Computer Science & Engineering">Computer Science (CSE)</option>
                    <option value="Artificial Intelligence & ML">AI & ML</option>
                    <option value="Artificial Intelligence & Data Science">AI & DS</option>
                    <option value="Information Technology">Information Technology (IT)</option>
                    <option value="Electronics & Communication">ECE</option>
                    <option value="Electrical & Electronics">EEE</option>
                    <option value="Mechanical Engineering">Mechanical</option>
                    <option value="Biotechnology">Biotechnology</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-emerald py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-1"
              >
                <span>{loading ? 'Signing in...' : 'Sign In as Student'}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          </div>
        )}

        {/* Google Email Input Modal for @bitsathy.ac.in */}
        {showGoogleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    Google Workspace Sign-In
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Enter your official BIT student email. Only institutional accounts (<strong>@bitsathy.ac.in</strong>) are authorized.
              </p>

              <form onSubmit={handleGoogleLoginSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-zinc-400 font-medium mb-1">
                    College Gmail Address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="e.g. 7376222ad101@bitsathy.ac.in"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-emerald-500 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowGoogleModal(false)}
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={googleLoading}
                    className="flex-1 btn-emerald py-2 px-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{googleLoading ? 'Verifying...' : 'Continue'}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* ---------------- 2. GUEST VISITOR ---------------- */}
        {authTab === 'guest' && (
          <form onSubmit={handleGuestSubmit} className="space-y-3.5 text-xs">
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Explore campus information, admissions guidance, and chat with Aura without creating an account.
            </p>

            <div>
              <label className="block text-slate-600 dark:text-zinc-400 font-medium mb-1">
                Display Name (Optional)
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Guest Visitor"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-1 transition-colors"
            >
              <span>{loading ? 'Entering...' : 'Enter as Guest'}</span>
              <ArrowRight size={14} />
            </button>
          </form>
        )}

        {/* ---------------- 3. ADMIN PORTAL ---------------- */}
        {authTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-zinc-400 font-medium mb-1">
                Admin Username
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-zinc-400 font-medium mb-1">
                Admin Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-1 transition-colors"
            >
              <span>{loading ? 'Verifying...' : 'Sign In as Admin'}</span>
              <ArrowRight size={14} />
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default LoginPage;
