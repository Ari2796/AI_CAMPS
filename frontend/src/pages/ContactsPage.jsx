import React, { useState } from 'react';
import { 
  Phone, Mail, MapPin, Search, Shield, HeartPulse, Building, 
  Clock, PhoneCall, UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ContactsPage = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const emergencyContacts = [
    {
      title: '24x7 Medical Centre',
      subtitle: 'Dr. M.S. Soundararajan & Dr. V. Sandhya • ICU Ambulance',
      phone: '04295-226108',
      email: 'clinic@bitsathy.ac.in',
      location: 'Health Centre',
      timing: '24x7 Open',
      icon: HeartPulse,
      badge: 'Medical SOS',
      accent: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20'
    },
    {
      title: 'Campus Security & Gate',
      subtitle: 'Main Gate Vigilance, Security & Safety Control Desk',
      phone: '04295-226100',
      email: 'security@bitsathy.ac.in',
      location: 'Main Gate Control',
      timing: '24x7 Open',
      icon: Shield,
      badge: 'Security',
      accent: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20'
    },
    {
      title: 'Admissions Office (2702)',
      subtitle: 'TNEA & Management Admissions Counseling',
      phone: '04295-226086',
      email: 'admissions@bitsathy.ac.in',
      location: 'Admin Block, Ground Floor',
      timing: '8:30 AM - 5:30 PM',
      icon: Building,
      badge: 'Admissions',
      accent: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20'
    }
  ];

  const directory = [
    {
      category: 'academic',
      dept: 'Computer Science & Engineering (CSE)',
      hod: 'Dr. Sasikala D',
      designation: 'Professor & Head of Department',
      phone: '04295-226000',
      email: 'csehod@bitsathy.ac.in',
      location: 'CSE Block, Level 2'
    },
    {
      category: 'academic',
      dept: 'Artificial Intelligence & Data Science (AI&DS)',
      hod: 'Dr. Gomathi R',
      designation: 'Professor & Head of Department',
      phone: '04295-226000',
      email: 'aids_hod@bitsathy.ac.in',
      location: 'AI & DS Block, Room 102'
    },
    {
      category: 'academic',
      dept: 'Artificial Intelligence & Machine Learning (AI&ML)',
      hod: 'Dr. Bharathi A',
      designation: 'Professor & Head of Department',
      phone: '04295-226000',
      email: 'aimlhod@bitsathy.ac.in',
      location: 'AI & ML Sandbox Block'
    },
    {
      category: 'academic',
      dept: 'Information Technology (IT)',
      hod: 'Dr. Naveena S',
      designation: 'Head of Department',
      phone: '04295-226000',
      email: 'ithod@bitsathy.ac.in',
      location: 'IT Block, Room 301'
    },
    {
      category: 'academic',
      dept: 'Electronics & Communication Engineering (ECE)',
      hod: 'Dr. Prakash S P',
      designation: 'Head of Department',
      phone: '04295-226000',
      email: 'ecehod@bitsathy.ac.in',
      location: 'ECE Block, Room 101'
    },
    {
      category: 'academic',
      dept: 'Electrical & Electronics Engineering (EEE)',
      hod: 'Dr. Maheswari K T',
      designation: 'Head of Department',
      phone: '04295-226000',
      email: 'eeehod@bitsathy.ac.in',
      location: 'EEE Block, Room 201'
    },
    {
      category: 'academic',
      dept: 'Mechanical Engineering',
      hod: 'Dr. Ravi Kumar M',
      designation: 'Professor & Head of Department',
      phone: '04295-226000',
      email: 'mechhod@bitsathy.ac.in',
      location: 'Mechanical Block, Room 105'
    },
    {
      category: 'academic',
      dept: 'Mechatronics Engineering',
      hod: 'Dr. Senthil Kumar K L',
      designation: 'Professor & Head of Department',
      phone: '04295-226000',
      email: 'mechatronicshod@bitsathy.ac.in',
      location: 'Mechatronics Block'
    },
    {
      category: 'academic',
      dept: 'Biotechnology',
      hod: 'Dr. Balakrishnaraja R',
      designation: 'Professor & Head of Department',
      phone: '04295-226000',
      email: 'biotechhod@bitsathy.ac.in',
      location: 'Bio Science Block, Room 304'
    },
    {
      category: 'academic',
      dept: 'School of Management Studies (MBA)',
      hod: 'Dr. Murugappan S',
      designation: 'Professor & Director',
      phone: '04295-226000',
      email: 'mbahod@bitsathy.ac.in',
      location: 'Management Studies Block'
    },
    {
      category: 'hostel',
      dept: "Men's Hostels Office",
      hod: 'Sapphire, Emerald, Ruby, Diamond Blocks',
      designation: 'Chief Warden & Residential Admin',
      phone: '04295-226000',
      email: 'boyshostel@bitsathy.ac.in',
      location: 'Hostel Administration Office'
    },
    {
      category: 'hostel',
      dept: "Women's Hostels Office",
      hod: 'Ganga, Yamuna, Cauvery Blocks',
      designation: 'Chief Warden & Residential Admin',
      phone: '04295-226000',
      email: 'girlshostel@bitsathy.ac.in',
      location: 'Ladies Hostel Office'
    },
    {
      category: 'support',
      dept: 'Training & Placements',
      hod: 'Mr. Nirmal Kumar R & Dr. Mathan Kumar P',
      designation: 'Industry Relations Officers',
      phone: '9965617722',
      email: 'placement@bitsathy.ac.in',
      location: 'Placement Centre, Level 1'
    },
    {
      category: 'support',
      dept: 'Admissions Helpline',
      hod: 'Admissions Coordinator Desk',
      designation: 'UG / PG / Lateral Entry Enquiries',
      phone: '04295-226087',
      email: 'admissions@bitsathy.ac.in',
      location: 'Administrative Wing'
    }
  ];

  const filteredDirectory = directory.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = 
      item.dept.toLowerCase().includes(search.toLowerCase()) ||
      item.hod.toLowerCase().includes(search.toLowerCase()) ||
      item.email.toLowerCase().includes(search.toLowerCase()) ||
      item.phone.includes(search);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8 transition-colors">
      
      {/* Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
            Campus Directory & Emergency Contacts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Department heads, hostel wardens, security desks, and 24x7 medical clinic.
          </p>
        </div>

        <a
          href="tel:04295226108"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shrink-0"
        >
          <PhoneCall size={14} />
          <span>Ambulance: 04295-226108</span>
        </a>
      </div>

      {/* Emergency Contacts Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {emergencyContacts.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="clean-card p-5 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${item.accent}`}>
                    {item.badge}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {item.timing}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  {item.subtitle}
                </p>

                <div className="mt-3 text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <MapPin size={13} className="text-slate-400 shrink-0" />
                  <span className="truncate">{item.location}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <a
                  href={`tel:${item.phone}`}
                  className="flex-1 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-zinc-100 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Phone size={12} />
                  {item.phone}
                </a>
                <a
                  href={`mailto:${item.email}`}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors"
                  title={item.email}
                >
                  <Mail size={14} />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Directory Section */}
      <div className="space-y-4">
        
        {/* Controls Bar: Category Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'academic', label: 'Academic HODs' },
              { id: 'hostel', label: 'Hostel' },
              { id: 'support', label: 'Placements & Help' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeCategory === tab.id
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-semibold shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search faculty, dept, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

        </div>

        {/* Directory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDirectory.map((item, idx) => (
            <div
              key={idx}
              className="clean-card p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div>
                <h3 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 leading-snug">
                  {item.dept}
                </h3>

                <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <UserCheck size={13} className="shrink-0" />
                  <span className="truncate">{item.hod}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  {item.designation}
                </p>

                <div className="mt-3 text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <MapPin size={12} className="shrink-0 text-slate-400" />
                  <span className="truncate">{item.location}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2">
                <a
                  href={`tel:${item.phone}`}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Phone size={11} className="text-emerald-600" />
                  {item.phone}
                </a>
                <a
                  href={`mailto:${item.email}`}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Mail size={11} />
                  Email
                </a>
              </div>
            </div>
          ))}
        </div>

        {filteredDirectory.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-xs">
            No contacts found matching "{search}"
          </div>
        )}

      </div>

    </div>
  );
};

export default ContactsPage;
