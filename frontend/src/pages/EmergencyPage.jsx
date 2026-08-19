import React from 'react';
import { Phone, Shield, Plus, AlertTriangle, Users, Book, Building, ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const EmergencyPage = () => {
  const { theme } = useTheme();

  const contacts = [
    { title: 'Security Office (24x7)', phone: '04295-226000', icon: Shield },
    { title: 'Campus Health Centre', phone: '04295-226001', icon: Plus },
    { title: 'Anti-Ragging Squad', phone: '04295-226002', icon: AlertTriangle },
    { title: 'Women\'s Safety Cell', phone: '04295-226003', icon: Users },
    { title: 'Placement Office', phone: '04295-226004', icon: Building },
    { title: 'Admissions Desk', phone: '04295-226005', icon: Book },
  ];

  return (
    <div className="vh-page-container transition-colors duration-300">
      
      {/* Header */}
      <div className="text-center mb-10 mt-4">
        <div className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-full border border-slate-200 dark:border-cyan-500/30 text-xs font-bold text-slate-800 dark:text-cyan-300 mb-4 shadow-xs">
          <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
          <span>Official BIT Hotlines & Emergency Response</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
          Emergency & Important Helplines
        </h1>
        <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm sm:text-base font-medium leading-relaxed">
          Bannari Amman Institute of Technology provides 24x7 immediate assistance. Click to call directly from any mobile or desktop device.
        </p>
      </div>

      {/* Grid of Helpline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contacts.map((contact, idx) => {
          const Icon = contact.icon;
          return (
            <div key={idx} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-cyan-500/20 shadow-xs flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-cyan-500/20 text-sky-600 dark:text-cyan-300 flex items-center justify-center mb-4 border border-sky-200 dark:border-cyan-500/30">
                <Icon size={28} />
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white mb-1">{contact.title}</h2>
              <p className="text-2xl font-black text-sky-700 dark:text-cyan-400 mb-6 font-mono tracking-wider">{contact.phone}</p>
              <a 
                href={`tel:${contact.phone}`}
                className="w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold btn-ocean dark:btn-gradient-cyan text-sm"
              >
                <Phone size={16} /> Call Department
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmergencyPage;
