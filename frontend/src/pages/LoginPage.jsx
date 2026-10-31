import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Lock, User, Mail, ArrowRight, AudioLines, 
  ShieldCheck, Sparkles, CheckCircle2, RefreshCw, KeyRound, AlertCircle
} from 'lucide-react';
import { apiCall } from '../services/api';

const LoginPage = () => {
  // 'bitsathy' (official email + OTP) | 'guest' | 'admin'
  const [authTab, setAuthTab] = useState('bitsathy');
  const { login, loginAsGuest, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // BITSathy OTP Form States
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Guest Form State
  const [guestName, setGuestName] = useState('');

  // Admin Form States
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState('admin1');
  const [adminPassword, setAdminPassword] = useState('1admin');

  // Status & Feedback States
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('guest') === 'true') {
      handleGuestSubmit();
    }
  }, [searchParams]);

  // OTP Cooldown Timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  if (isAuthenticated && isAdmin) return <Navigate to="/admin" replace />;
  if (isAuthenticated) return <Navigate to="/chat" replace />;

  // 1. Send OTP to official @bitsathy.ac.in email
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMessage('');

    let cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your official BIT email address.');
      return;
    }

    if (!cleanEmail.endsWith('@bitsathy.ac.in')) {
      setError('Unauthorized email. Only official BIT accounts ending with @bitsathy.ac.in are permitted.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiCall('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail }),
      });

      // If test account detected, automatically verify without asking for OTP
      if (res.is_test || res.test_otp) {
        const testOtp = res.test_otp || '000000';
        setOtp(testOtp);
        const data = await apiCall('/auth/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ email: cleanEmail, otp: testOtp }),
        });
        login({ 
          name: data.name || cleanEmail.split('@')[0], 
          roll: data.roll_number || '', 
          dept: data.department || 'Engineering & Technology',
          year: data.year || 'UG',
          role: data.role || 'student', 
          email: data.email || cleanEmail, 
          isVerified: true,
          id: data.user_id 
        }, data.access_token);
        navigate('/chat');
        return;
      }

      setOtpSent(true);
      setCooldown(60);
      setInfoMessage(res.message || `A 6-digit verification code has been sent to ${cleanEmail}`);
    } catch (err) {
      console.error("Failed to send OTP:", err);
      setError(err.message || 'Unable to send verification code. Please check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP & Log In
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length < 6) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiCall('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, otp: cleanOtp }),
      });

      login({ 
        name: data.name || cleanEmail.split('@')[0], 
        roll: data.roll_number || '', 
        dept: data.department || 'Engineering & Technology',
        year: data.year || 'UG',
        role: data.role || 'student', 
        email: data.email || cleanEmail, 
        isVerified: true,
        id: data.user_id 
      }, data.access_token);

      navigate('/chat');
    } catch (err) {
      console.error("OTP verification failed:", err);
      setError(err.message || 'Incorrect or expired verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Guest Login
  const handleGuestSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    const guestDisplayName = guestName.trim() || 'Guest Visitor';
    try {
      const data = await apiCall('/auth/guest', {
        method: 'POST',
        body: JSON.stringify({ name: guestDisplayName }),
      });
      loginAsGuest({ 
        name: guestDisplayName, 
        isGuest: true, 
        role: 'guest',
        isVerified: false,
        id: data.user_id 
      }, data.access_token);
      navigate('/chat');
    } catch (err) {
      loginAsGuest({ name: guestDisplayName, isGuest: true, role: 'guest', isVerified: false });
      navigate('/chat');
    } finally {
      setLoading(false);
    }
  };

  // 4. Admin Login
  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiCall('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      login({ 
        name: 'Administrator', 
        role: 'admin', 
        username: adminUsername,
        isVerified: true
      }, data.access_token);
      navigate('/admin');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Invalid administrator credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 bg-[#F8FAFC] dark:bg-[#09090B] transition-colors">
      <div className="w-full max-w-md space-y-5 animate-in fade-in duration-200">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md">
            <AudioLines size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight">
              Campus Voice
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
              Bannari Amman Institute of Technology
            </p>
          </div>
        </div>

        {/* Main Card Container */}
        <div className="p-6 sm:p-7 space-y-5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-sm">
          
          {/* Tab Selector: 2 Clear Options */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setAuthTab('bitsathy'); setError(''); setInfoMessage(''); }}
              className={`flex-1 py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                authTab === 'bitsathy'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              <ShieldCheck size={16} className={authTab === 'bitsathy' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
              <span>BITSathy Member</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthTab('guest'); setError(''); setInfoMessage(''); }}
              className={`flex-1 py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                authTab === 'guest'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              <Sparkles size={16} className={authTab === 'guest' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
              <span>Guest Visitor</span>
            </button>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* TAB 1: BITSathy Member (Email + SMTP OTP) */}
          {authTab === 'bitsathy' && (
            <div className="space-y-4">
              {!otpSent ? (
                // Step 1: Enter email
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    Sign in with your official <strong>@bitsathy.ac.in</strong> email to access full faculty contacts, directory search, and campus services.
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Official Institutional Email
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="yourname@bitsathy.ac.in"
                        required
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 outline-none focus:border-blue-500 font-medium"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                      We'll send a 6-digit secure login code to your inbox.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm gap-2 shadow-xs cursor-pointer flex items-center justify-center transition-all disabled:opacity-60"
                  >
                    <span>{loading ? 'Sending Code...' : 'Send Verification Code (OTP)'}</span>
                    <ArrowRight size={15} />
                  </button>
                </form>
              ) : (
                // Step 2: Enter OTP
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="flex items-center justify-between text-xs pb-1">
                    <span className="text-slate-500 dark:text-zinc-400">Verifying code for:</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200 font-mono text-[11px] truncate max-w-[200px]">
                      {email}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                      6-Digit Verification Code
                    </label>
                    <div className="relative">
                      <KeyRound size={16} className="absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••••"
                        autoFocus
                        required
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-base font-mono tracking-widest text-slate-900 dark:text-zinc-100 outline-none focus:border-blue-500 text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm gap-2 shadow-xs cursor-pointer flex items-center justify-center transition-all disabled:opacity-60"
                  >
                    <span>{loading ? 'Verifying Code...' : 'Verify & Sign In'}</span>
                    <CheckCircle2 size={16} />
                  </button>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => { setOtpSent(false); setOtp(''); setError(''); setInfoMessage(''); }}
                      className="text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 underline cursor-pointer"
                    >
                      Change Email
                    </button>

                    <button
                      type="button"
                      disabled={cooldown > 0 || loading}
                      onClick={handleSendOtp}
                      className="text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer flex items-center gap-1 font-medium"
                    >
                      <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                      <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: Guest Visitor */}
          {authTab === 'guest' && (
            <form onSubmit={handleGuestSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                  <Sparkles size={15} />
                  <span>Public Guest Visitor Access</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Guests can freely chat with the AI Campus Companion, view campus navigation and 3D maps, and browse official 24x7 emergency SOS numbers.
                </p>
                <div className="pt-1 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium">
                  <Lock size={12} className="shrink-0" />
                  <span>Personal faculty contact numbers are restricted to verified members.</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Your Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Visitor / Guest"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs sm:text-sm gap-2 shadow-xs cursor-pointer flex items-center justify-center transition-all"
              >
                <span>{loading ? 'Entering...' : 'Continue as Guest'}</span>
                <ArrowRight size={15} />
              </button>
            </form>
          )}

          {/* Discreet Admin Login Trigger */}
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-900 text-center">
            <button
              type="button"
              onClick={() => setShowAdminModal(true)}
              className="text-[11px] text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 font-medium cursor-pointer"
            >
              Campus Administrator Portal
            </button>
          </div>
        </div>

        {/* Admin Login Modal */}
        {showAdminModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Administrator Sign In</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAdminSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Username</label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Password</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer mt-2"
                >
                  {loading ? 'Authenticating...' : 'Sign In as Admin'}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default LoginPage;
