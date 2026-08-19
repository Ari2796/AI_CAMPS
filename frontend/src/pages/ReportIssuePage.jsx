import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, CheckCircle2, Clock, MapPin, Send, 
  Zap, Droplets, Home, Monitor, Wifi, Utensils, 
  Bus, Building, RefreshCw, Check, User
} from 'lucide-react';
import { apiCall } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ReportIssuePage = () => {
  const { user, isGuest } = useAuth();
  const [category, setCategory] = useState('Electrical');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  
  const [guestName, setGuestName] = useState(user?.name || '');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [myIssues, setMyIssues] = useState([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [filterTab, setFilterTab] = useState('all');

  const categories = [
    { id: 'Electrical', label: 'Electrical', icon: Zap },
    { id: 'Plumbing', label: 'Plumbing', icon: Droplets },
    { id: 'Hostel', label: 'Hostel Room', icon: Home },
    { id: 'Labs', label: 'Computer Labs', icon: Monitor },
    { id: 'Wifi', label: 'Wi-Fi / Network', icon: Wifi },
    { id: 'Cafeteria', label: 'Mess & Food', icon: Utensils },
    { id: 'Transport', label: 'Transport', icon: Bus },
    { id: 'General', label: 'General / Estate', icon: Building },
  ];

  const quickLocations = [
    'Emerald Hostel',
    'Diamond Hostel',
    'Girls Hostel',
    'CSE Lab 2',
    'Main Library',
    'Mess Hall'
  ];

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const fetchMyIssues = async () => {
    setLoadingIssues(true);
    try {
      const data = await apiCall('/issues');
      setMyIssues(data);
    } catch (err) {
      console.error("Failed to load issues:", err);
    } finally {
      setLoadingIssues(false);
    }
  };

  useEffect(() => {
    fetchMyIssues();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim() || !location.trim()) {
      showToast('Please specify location and description.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        category,
        location,
        description,
        priority,
        user_type: isGuest ? 'guest' : 'student',
        user_name: isGuest ? (guestName || 'Guest Visitor') : (user?.name || 'Student'),
        user_email: isGuest ? (guestEmail || null) : (user?.email || `${(user?.name || 'student').toLowerCase()}@bitsathy.ac.in`),
        user_phone: isGuest ? (guestPhone || null) : null
      };

      const newIssue = await apiCall('/issues', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showToast(`Ticket #${newIssue.id} submitted`);
      setLocation('');
      setDescription('');
      fetchMyIssues();
    } catch (err) {
      console.error("Submit error:", err);
      showToast('Error submitting ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredIssues = myIssues.filter(i => {
    if (filterTab === 'pending') return i.status !== 'resolved';
    if (filterTab === 'resolved') return i.status === 'resolved';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 transition-colors">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-lg border border-slate-700 animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Clean Header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
          Campus Maintenance Helpdesk
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
          Submit maintenance requests for electrical, plumbing, lab equipment, or hostel facilities.
        </p>
      </div>

      {/* 2-Column Clean Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ================= LEFT: REPORT FORM (7 COLS) ================= */}
        <div className="lg:col-span-7 clean-card p-5 sm:p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Submit a New Request
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Category Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-2">
                Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-semibold'
                          : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Icon size={16} className={isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                      <span className="text-xs">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Guest Details */}
            {isGuest && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800 space-y-2">
                <p className="text-xs font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <User size={13} />
                  Contact Info (Optional)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                Location / Room Number
              </label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Emerald Hostel 304, CSE Lab 2..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Location Suggestions */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {quickLocations.map((loc, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setLocation(loc)}
                    className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-emerald-600 transition-colors cursor-pointer"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                Priority
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'low', label: 'Low (48h)' },
                  { id: 'medium', label: 'Medium (24h)' },
                  { id: 'urgent', label: 'Urgent (SOS)' },
                ].map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setPriority(p.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      priority === p.id
                        ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent'
                        : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                Problem Description
              </label>
              <textarea
                rows={3}
                placeholder="Briefly explain what needs maintenance..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-emerald-500 leading-relaxed"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-emerald py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send size={14} />
              <span>{submitting ? 'Submitting...' : 'Submit Request'}</span>
            </button>

          </form>
        </div>

        {/* ================= RIGHT: TICKET STATUS (5 COLS) ================= */}
        <div className="lg:col-span-5 clean-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Your Requests ({myIssues.length})
            </h2>

            <button
              onClick={fetchMyIssues}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={14} className={loadingIssues ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Open / In Progress' },
              { id: 'resolved', label: 'Resolved' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterTab(t.id)}
                className={`flex-1 py-1 rounded-lg text-center transition-colors cursor-pointer ${
                  filterTab === t.id
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-semibold shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Ticket Stream */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
            {filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                      #{issue.id}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {issue.category}
                    </span>
                  </div>

                  {issue.status === 'resolved' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={12} />
                      Resolved
                    </span>
                  ) : issue.status === 'in_progress' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                      <Clock size={12} />
                      In Progress
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={12} />
                      Open
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-700 dark:text-zinc-300 font-medium">
                  {issue.location}
                </p>

                <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2">
                  {issue.description}
                </p>

                {issue.admin_notes && (
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-[11px] text-emerald-800 dark:text-emerald-300">
                    <span className="font-semibold">Note:</span> {issue.admin_notes}
                  </div>
                )}
              </div>
            ))}

            {filteredIssues.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs">
                No tickets found
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

export default ReportIssuePage;
