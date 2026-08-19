import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Globe, Mic, CheckCircle2, Award, BookOpen, Sparkles, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AnimeMascot from '../components/AnimeMascot';

const LandingPage = () => {
  const { isAuthenticated, isAdmin } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const images = [
    '/images/campus/pic1.png',
    '/images/campus/pic2.png',
    '/images/campus/pic3.png'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  if (isAuthenticated && isAdmin) return <Navigate to="/admin" />;
  if (isAuthenticated) return <Navigate to="/chat" />;

  return (
    <div className="vh-page-container flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Background Campus Slideshow */}
      <div className="absolute inset-0 z-0 opacity-15 pointer-events-none">
        {images.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img src={img} alt="Bannari Amman Institute Campus" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      {/* Main Hero Stage */}
      <div className="z-10 text-center max-w-4xl mx-auto mt-2">
        
        {/* Accreditation Seal */}
        <div className="inline-flex items-center gap-2 bg-white px-4 py-2 mb-6 border border-slate-200 shadow-xs rounded-full">
          <Award size={16} className="text-sky-600" />
          <span className="text-xs font-extrabold tracking-wide text-slate-800 uppercase">
            Bannari Amman Institute of Technology
          </span>
          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 size={10} /> NAAC A+ Grade
          </span>
        </div>

        {/* Virtual Human Stage */}
        <div className="relative mx-auto mb-4 flex flex-col items-center">
          <AnimeMascot isSpeaking={false} size="md" interactive={true} />
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl font-black mb-4 leading-tight tracking-tight text-slate-900">
          Meet Your Official <br />
          <span className="text-ocean-gradient">AI Campus Virtual Human</span>
        </h1>

        <p className="text-slate-600 text-base sm:text-lg mb-8 max-w-2xl mx-auto font-medium leading-relaxed">
          Talk to our intelligent Virtual Human companion about admissions, engineering branches, fees, and hostels. Dialogue in <span className="text-sky-700 font-bold">English</span> and <span className="text-sky-700 font-bold">Tamil</span>.
        </p>

        {/* Trust Seals Line */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10 text-xs font-bold text-slate-700">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-xs">
            <ShieldCheck size={15} className="text-sky-600" />
            <span>Official Campus Handbooks</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-xs">
            <BookOpen size={15} className="text-sky-600" />
            <span>RAG Verified Citations</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-xs">
            <Globe size={15} className="text-sky-600" />
            <span>Multilingual Voice & Dialogue</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-12">
          <Link to="/login" className="vh-btn-primary flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 text-base font-bold">
            <span>Talk to Virtual Human</span>
            <ArrowRight size={18} />
          </Link>
          <Link to="/login?guest=true" className="vh-btn-secondary flex items-center justify-center w-full sm:w-auto px-8 py-3.5 text-base font-bold">
            Continue as Guest
          </Link>
        </div>

      </div>

      {/* Feature Showcase Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl w-full z-10 pb-6 px-2">
        
        <div className="vh-card p-5 flex flex-col items-center text-center group hover:-translate-y-1 transition-all">
          <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mb-3 border border-sky-200">
            <Mic size={22} />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Voice & Lip Sync</h3>
          <p className="text-slate-500 text-xs leading-relaxed font-medium">Speak naturally — the Virtual Human responds with real-time lip sync.</p>
        </div>

        <div className="vh-card p-5 flex flex-col items-center text-center group hover:-translate-y-1 transition-all">
          <div className="w-12 h-12 bg-cyan-50 text-cyan-600 rounded-2xl flex items-center justify-center mb-3 border border-cyan-200">
            <Globe size={22} />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Multilingual RAG</h3>
          <p className="text-slate-500 text-xs leading-relaxed font-medium">Understands English & Tamil queries automatically.</p>
        </div>

        <div className="vh-card p-5 flex flex-col items-center text-center group hover:-translate-y-1 transition-all">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-3 border border-emerald-200">
            <Building2 size={22} />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Campus Dispatch</h3>
          <p className="text-slate-500 text-xs leading-relaxed font-medium">Report hostel room issues directly to college admins.</p>
        </div>

        <div className="vh-card p-5 flex flex-col items-center text-center group hover:-translate-y-1 transition-all">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-3 border border-indigo-200">
            <ShieldCheck size={22} />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">100% Official Data</h3>
          <p className="text-slate-500 text-xs leading-relaxed font-medium">Answers are verified against college handbooks.</p>
        </div>

      </div>

    </div>
  );
};

export default LandingPage;
