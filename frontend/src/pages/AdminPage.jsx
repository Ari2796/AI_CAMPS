import React, { useState, useEffect } from 'react';
import { 
  Users, MessageSquare, AlertTriangle, FileText, CheckCircle2, 
  Clock, Trash2, RefreshCw, Search, Send, Mail, Phone, MapPin, 
  Check, ArrowUpRight, Shield, ShieldCheck, Sparkles, Filter, 
  ChevronRight, Upload, Globe, GraduationCap, Settings as SettingsIcon,
  X, CheckSquare, Eye, ExternalLink, HelpCircle
} from 'lucide-react';
import { apiCall } from '../services/api';
import { useAuth } from '../context/AuthContext';

const AdminPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('student_reports'); // student_reports, guest_reports, student_chats, guest_chats, documents, settings
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Data states
  const [issues, setIssues] = useState([]);
  const [chatLogs, setChatLogs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [analytics, setAnalytics] = useState({
    total_users: 0,
    total_queries: 0,
    issues_by_status: {},
    top_languages: {}
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, open, in_progress, resolved
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Solve / Resolution Modal state
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [resolutionStatus, setResolutionStatus] = useState('resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const [submittingResolution, setSubmittingResolution] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    temperature: 0.3,
    system_prompt: '',
    smtp_server: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    notification_email: '',
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Analytics
      const analyticsData = await apiCall('/admin/analytics');
      setAnalytics(analyticsData);

      // 2. Fetch All Issues
      const issuesData = await apiCall('/issues');
      setIssues(issuesData);

      // 3. Fetch Chat Logs
      const chatsData = await apiCall('/admin/chatlogs');
      setChatLogs(chatsData);

      // 4. Fetch Documents
      const docsData = await apiCall('/admin/documents');
      setDocuments(docsData);

      // 5. Fetch Settings
      const settingsData = await apiCall('/admin/settings');
      if (settingsData?.settings) {
        setSettingsForm(prev => ({ ...prev, ...settingsData.settings }));
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      showToast('❌ Error loading dashboard data: ' + (err.message || 'Server error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Split Issues into Student vs Guest
  const studentReports = issues.filter(i => (i.user_type === 'student' || !i.user_type));
  const guestReports = issues.filter(i => i.user_type === 'guest');

  // Split Chats into Student vs Guest
  const studentChats = chatLogs.filter(c => (c.user_type === 'student' || !c.user_type));
  const guestChats = chatLogs.filter(c => c.user_type === 'guest');

  // Filter helper for Reports
  const filterReports = (reportsList) => {
    return reportsList.filter(item => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesSearch = 
        (item.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.user_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.id).includes(searchQuery);
      return matchesStatus && matchesCategory && matchesSearch;
    });
  };

  // Filter helper for Chats
  const filterChats = (chatsList) => {
    return chatsList.filter(item => {
      const matchesSearch = 
        (item.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.message || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.response || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.session_id || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  };

  // Open Solve Modal
  const openSolveModal = (issue) => {
    setSelectedIssue(issue);
    setResolutionStatus(issue.status === 'open' ? 'resolved' : issue.status);
    setResolutionNotes(issue.admin_notes || '');
    setSendEmailNotification(true);
  };

  // Submit Resolution & Send Email
  const handleSolveIssue = async (e) => {
    e.preventDefault();
    if (!selectedIssue) return;

    setSubmittingResolution(true);
    try {
      const updated = await apiCall(`/issues/${selectedIssue.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: resolutionStatus,
          admin_notes: resolutionNotes,
          send_email: sendEmailNotification
        })
      });

      // Update in state
      setIssues(prev => prev.map(i => i.id === updated.id ? updated : i));
      
      const emailTarget = selectedIssue.user_email || (selectedIssue.user_type === 'student' ? `${selectedIssue.user_name}@bitsathy.ac.in` : null);
      if (resolutionStatus === 'resolved' && sendEmailNotification && emailTarget) {
        showToast(`✅ Issue #${selectedIssue.id} solved & confirmation email dispatched to ${emailTarget}!`);
      } else {
        showToast(`✅ Issue #${selectedIssue.id} status updated to ${resolutionStatus.toUpperCase()}!`);
      }

      setSelectedIssue(null);
    } catch (err) {
      console.error("Resolution submit error:", err);
      showToast('❌ Error updating issue: ' + (err.message || 'Server error'));
    } finally {
      setSubmittingResolution(false);
    }
  };

  // Upload PDF handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.pdf')) {
      alert('Only PDF files are supported for vector indexing');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      showToast('⏳ Uploading and indexing PDF into vector database...');
      await apiCall('/admin/documents/upload', {
        method: 'POST',
        body: formData
      });
      showToast('✅ PDF uploaded & indexed successfully!');
      fetchDashboardData();
    } catch (err) {
      console.error("Upload error:", err);
      showToast('❌ Failed to upload PDF: ' + (err.message || 'Server error'));
    }
  };

  // Delete Document
  const handleDeleteDoc = async (docId) => {
    if (!confirm('Are you sure you want to delete this document from the campus knowledge base?')) return;
    try {
      await apiCall(`/admin/documents/${docId}`, { method: 'DELETE' });
      showToast('✅ Document deleted.');
      fetchDashboardData();
    } catch (err) {
      console.error("Delete doc error:", err);
      showToast('❌ Failed to delete document.');
    }
  };

  // Reindex FAISS
  const handleReindex = async () => {
    try {
      showToast('⏳ Rebuilding FAISS vector index...');
      const res = await apiCall('/admin/documents/reindex', { method: 'POST' });
      showToast(`✅ Vector index rebuilt with ${res.total_chunks || 0} chunks!`);
      fetchDashboardData();
    } catch (err) {
      console.error("Reindex error:", err);
      showToast('❌ Reindex failed.');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await apiCall('/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settingsForm)
      });
      showToast('✅ Admin system settings saved successfully!');
    } catch (err) {
      console.error("Save settings error:", err);
      showToast('❌ Failed to save settings.');
    }
  };

  const getPriorityBadge = (p) => {
    const priority = (p || 'medium').toLowerCase();
    if (priority === 'high' || priority === 'urgent') {
      return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">URGENT</span>;
    }
    if (priority === 'low') {
      return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">LOW</span>;
    }
    return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">MEDIUM</span>;
  };

  const getStatusBadge = (s) => {
    const status = (s || 'open').toLowerCase();
    if (status === 'resolved') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={12} />
          Resolved
        </span>
      );
    }
    if (status === 'in_progress') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
          <Clock size={12} />
          In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <AlertTriangle size={12} />
        Open
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-xl bg-slate-900 dark:bg-zinc-800 text-white text-xs font-bold shadow-xl border border-slate-700 dark:border-zinc-700 animate-in fade-in slide-in-from-top-4">
          {toastMessage}
        </div>
      )}

      {/* Main Full-Screen Layout */}
      <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Top Header & Refresh Control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
              <ShieldCheck size={14} />
              Administrative Command Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Campus Intelligence & Issue Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
              Control student & guest issue reports, monitor conversations, resolve complaints with automated email alerts, and manage RAG documents.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold transition-all border border-slate-200 dark:border-zinc-700 shadow-xs cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Sync Data
            </button>
            <label className="btn-emerald text-xs px-4 py-2.5 font-bold flex items-center gap-2 cursor-pointer shadow-xs">
              <Upload size={14} />
              Upload PDF
              <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* KPI Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Student Reports</p>
              <p className="text-xl font-black text-slate-900 dark:text-zinc-100">{studentReports.length}</p>
            </div>
          </div>

          <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Guest Reports</p>
              <p className="text-xl font-black text-slate-900 dark:text-zinc-100">{guestReports.length}</p>
            </div>
          </div>

          <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <MessageSquare size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Total Queries</p>
              <p className="text-xl font-black text-slate-900 dark:text-zinc-100">{analytics.total_queries || chatLogs.length}</p>
            </div>
          </div>

          <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Solved Issues</p>
              <p className="text-xl font-black text-slate-900 dark:text-zinc-100">
                {issues.filter(i => i.status === 'resolved').length}
              </p>
            </div>
          </div>

          <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-3.5 col-span-2 sm:col-span-1">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Indexed Docs</p>
              <p className="text-xl font-black text-slate-900 dark:text-zinc-100">{documents.length}</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-zinc-800 custom-scrollbar">
          {[
            { id: 'student_reports', label: '🎓 Student Reports', count: studentReports.length, color: 'text-emerald-500' },
            { id: 'guest_reports', label: '👤 Guest Reports', count: guestReports.length, color: 'text-amber-500' },
            { id: 'student_chats', label: '💬 Student Chats', count: studentChats.length, color: 'text-sky-500' },
            { id: 'guest_chats', label: '🌐 Guest Chats', count: guestChats.length, color: 'text-purple-500' },
            { id: 'documents', label: '📚 Knowledge Base', count: documents.length, color: 'text-slate-500' },
            { id: 'settings', label: '⚙️ Settings', count: null, color: 'text-slate-500' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === tab.id 
                    ? 'bg-emerald-500 text-white dark:bg-emerald-600' 
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Global Search & Filters Bar (for Reports & Chats) */}
        {(activeTab.includes('reports') || activeTab.includes('chats')) && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={activeTab.includes('reports') ? "Search reports by student name, email, location, description, or #ID..." : "Search chat queries, responses, or visitor names..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-emerald-500 transition-colors"
              />
            </div>

            {activeTab.includes('reports') && (
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 focus:outline-hidden"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open Only</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 focus:outline-hidden"
                >
                  <option value="all">All Categories</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Hostel">Hostel</option>
                  <option value="Labs">Labs & IT</option>
                  <option value="Cafeteria">Cafeteria</option>
                  <option value="General">General</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB 1: STUDENT REPORTS (LIST FORMAT) ----------------- */}
        {activeTab === 'student_reports' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <GraduationCap size={18} className="text-emerald-500" />
                Registered Student Complaints & Issues ({filterReports(studentReports).length})
              </h2>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Click "Solve Issue" to record resolution notes and send automated email confirmation.
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">#ID & Category</th>
                      <th className="py-3.5 px-4">Student Info</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4">Issue Description</th>
                      <th className="py-3.5 px-4">Priority</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Reported On</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium">
                    {filterReports(studentReports).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <span className="text-emerald-600 dark:text-emerald-400 font-black">#{item.id}</span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-[10px] font-bold text-slate-700 dark:text-zinc-300">
                              {item.category}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-zinc-100">{item.user_name || 'Student'}</div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                            <Mail size={11} className="text-slate-400" />
                            {item.user_email || `${(item.user_name || 'student').toLowerCase()}@bitsathy.ac.in`}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 text-slate-700 dark:text-zinc-300">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span className="font-semibold">{item.location}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="text-slate-800 dark:text-zinc-200 line-clamp-2" title={item.description}>
                            {item.description}
                          </p>
                          {item.admin_notes && (
                            <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              <strong>Note:</strong> {item.admin_notes}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {getPriorityBadge(item.priority)}
                        </td>

                        <td className="py-3.5 px-4">
                          {getStatusBadge(item.status)}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 text-[11px] whitespace-nowrap">
                          {new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => openSolveModal(item)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            <CheckSquare size={13} className="text-emerald-400" />
                            Solve / Update
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filterReports(studentReports).length === 0 && (
                      <tr>
                        <td colSpan="8" className="text-center py-12 text-slate-500 dark:text-zinc-400">
                          <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                          <p className="font-bold text-sm text-slate-700 dark:text-zinc-300">No student reports found</p>
                          <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">All student complaints matching the current filter are resolved.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- TAB 2: GUEST REPORTS (SEPARATE LIST) ----------------- */}
        {activeTab === 'guest_reports' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Users size={18} className="text-amber-500" />
                Guest & Visitor Issues ({filterReports(guestReports).length})
              </h2>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Issues reported by prospective students, parents, and campus guests.
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">#ID & Category</th>
                      <th className="py-3.5 px-4">Guest Contact Info</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4">Description</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Reported On</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium">
                    {filterReports(guestReports).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <span className="text-amber-500 font-black">#{item.id}</span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-[10px] font-bold text-slate-700 dark:text-zinc-300">
                              {item.category}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-zinc-100">{item.user_name || 'Guest Visitor'}</div>
                          {item.user_email ? (
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                              <Mail size={11} className="text-slate-400" />
                              {item.user_email}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic">No email provided</div>
                          )}
                          {item.user_phone && (
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                              <Phone size={11} className="text-slate-400" />
                              {item.user_phone}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 text-slate-700 dark:text-zinc-300 font-semibold">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span>{item.location}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="text-slate-800 dark:text-zinc-200 line-clamp-2" title={item.description}>
                            {item.description}
                          </p>
                          {item.admin_notes && (
                            <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              <strong>Resolution:</strong> {item.admin_notes}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {getStatusBadge(item.status)}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 text-[11px] whitespace-nowrap">
                          {new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => openSolveModal(item)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            <CheckSquare size={13} className="text-amber-400" />
                            Solve / Update
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filterReports(guestReports).length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-slate-500 dark:text-zinc-400">
                          <CheckCircle2 size={36} className="mx-auto text-amber-500 mb-2 opacity-80" />
                          <p className="font-bold text-sm text-slate-700 dark:text-zinc-300">No guest reports found</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- TAB 3: STUDENT CHATS ----------------- */}
        {activeTab === 'student_chats' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <GraduationCap size={18} className="text-sky-500" />
                Student AI Companion Conversations ({filterChats(studentChats).length})
              </h2>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Live RAG queries and responses by enrolled students.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filterChats(studentChats).map((log) => (
                <div key={log.id} className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-zinc-100">{log.user_name || 'Student'}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400">
                          {log.language === 'ta' ? 'தமிழ்' : 'English'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* User Question */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-100 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-zinc-100">
                      <span className="text-slate-400 mr-1.5">Q:</span>
                      {log.message}
                    </div>

                    {/* AI Mascot Response */}
                    <div className="mt-2 p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 text-xs text-slate-800 dark:text-zinc-200 leading-relaxed">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold mr-1.5">AI Aura-Lucario:</span>
                      {log.response}
                    </div>
                  </div>

                  {log.sources && log.sources.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400">
                      <FileText size={12} className="text-slate-400" />
                      <span>Retrieved from: {log.sources.map(s => s.source || 'Campus DB').join(', ')}</span>
                    </div>
                  )}
                </div>
              ))}

              {filterChats(studentChats).length === 0 && (
                <div className="col-span-2 text-center py-12 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800">
                  <MessageSquare size={36} className="mx-auto text-slate-400 mb-2 opacity-60" />
                  <p className="font-bold text-sm text-slate-700 dark:text-zinc-300">No student chats recorded yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- TAB 4: GUEST CHATS (SEPARATE VIEW) ----------------- */}
        {activeTab === 'guest_chats' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Globe size={18} className="text-purple-500" />
                Guest & Visitor AI Conversations ({filterChats(guestChats).length})
              </h2>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Inquiries by prospective applicants, parents, and website guests.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filterChats(guestChats).map((log) => (
                <div key={log.id} className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-zinc-100">{log.user_name || 'Guest Visitor'}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          {log.language === 'ta' ? 'தமிழ்' : 'English'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-100 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-zinc-100">
                      <span className="text-slate-400 mr-1.5">Q:</span>
                      {log.message}
                    </div>

                    <div className="mt-2 p-3 rounded-xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/10 text-xs text-slate-800 dark:text-zinc-200 leading-relaxed">
                      <span className="text-purple-600 dark:text-purple-400 font-bold mr-1.5">AI Aura-Lucario:</span>
                      {log.response}
                    </div>
                  </div>

                  {log.sources && log.sources.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400">
                      <FileText size={12} className="text-slate-400" />
                      <span>Retrieved from: {log.sources.map(s => s.source || 'Campus DB').join(', ')}</span>
                    </div>
                  )}
                </div>
              ))}

              {filterChats(guestChats).length === 0 && (
                <div className="col-span-2 text-center py-12 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800">
                  <Globe size={36} className="mx-auto text-slate-400 mb-2 opacity-60" />
                  <p className="font-bold text-sm text-slate-700 dark:text-zinc-300">No guest chats recorded yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- TAB 5: KNOWLEDGE BASE & PDFS ----------------- */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <FileText size={18} className="text-purple-500" />
                  Campus Knowledge Base & RAG Index ({documents.length} Files)
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Uploaded PDF documents are indexed into the FAISS vector store for 3D Mascot retrieval.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleReindex}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold transition-all border border-slate-200 dark:border-zinc-700 cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw size={13} />
                  Rebuild FAISS Index
                </button>
                <label className="btn-emerald text-xs px-4 py-2 font-bold flex items-center gap-2 cursor-pointer shadow-xs">
                  <Upload size={14} />
                  Upload New PDF
                  <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between group hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <FileText size={20} />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {doc.chunk_count || 3} Chunks
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100 mt-3 break-all">
                      {doc.filename}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                      Uploaded: {new Date(doc.uploaded_at).toLocaleDateString([], { dateStyle: 'medium' })}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Active in Vector Store
                    </span>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- TAB 6: SETTINGS ----------------- */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
                <SettingsIcon size={18} className="text-slate-500" />
                AI Digital Human & SMTP Alert Configurations
              </h2>

              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-medium">
                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1.5">
                    System Instruction Prompt (3D Companion Persona)
                  </label>
                  <textarea
                    rows={3}
                    value={settingsForm.system_prompt}
                    onChange={(e) => setSettingsForm({ ...settingsForm, system_prompt: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1.5">
                      SMTP Outgoing Server
                    </label>
                    <input
                      type="text"
                      value={settingsForm.smtp_server}
                      onChange={(e) => setSettingsForm({ ...settingsForm, smtp_server: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1.5">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      value={settingsForm.smtp_port}
                      onChange={(e) => setSettingsForm({ ...settingsForm, smtp_port: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1.5">
                      Admin Alert Recipient Email
                    </label>
                    <input
                      type="email"
                      placeholder="admin@bitsathy.ac.in"
                      value={settingsForm.notification_email}
                      onChange={(e) => setSettingsForm({ ...settingsForm, notification_email: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button type="submit" className="btn-emerald text-xs px-5 py-2.5 font-bold shadow-xs">
                    Save System Settings
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* ----------------- SOLVE & EMAIL NOTIFICATION MODAL ----------------- */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Issue Resolution & User Dispatch
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-zinc-100">
                  Update Report #{selectedIssue.id} ({selectedIssue.category})
                </h3>
              </div>
              <button
                onClick={() => setSelectedIssue(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Issue Summary Pill */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-zinc-100">
                <span>User: {selectedIssue.user_name} ({selectedIssue.user_type || 'student'})</span>
                <span className="text-slate-500">{selectedIssue.location}</span>
              </div>
              <p className="text-slate-600 dark:text-zinc-300 italic">
                "{selectedIssue.description}"
              </p>
            </div>

            <form onSubmit={handleSolveIssue} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1.5">
                  Update Issue Status
                </label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 font-bold"
                >
                  <option value="resolved">✅ Resolved / Solved</option>
                  <option value="in_progress">⏳ In Progress (Maintenance Dispatched)</option>
                  <option value="open">⚠️ Open / Pending Review</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1.5">
                  Admin Resolution Remarks (Included in Email to User)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Electrical maintenance replaced the circuit breaker. Tested and working properly."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                />
              </div>

              {/* Automated Email Checkbox */}
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="send_email_checkbox"
                  checked={sendEmailNotification}
                  onChange={(e) => setSendEmailNotification(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="send_email_checkbox" className="text-xs text-slate-800 dark:text-zinc-200 font-semibold cursor-pointer">
                  <span>Send automated resolution email notification to user</span>
                  <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                    Recipient: {selectedIssue.user_email || (selectedIssue.user_type === 'student' ? `${selectedIssue.user_name.toLowerCase()}@bitsathy.ac.in` : 'Guest (Simulated Alert)')}
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedIssue(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResolution}
                  className="btn-emerald text-xs px-5 py-2.5 font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Send size={13} />
                  {submittingResolution ? 'Dispatching...' : 'Save & Dispatch Email'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPage;
