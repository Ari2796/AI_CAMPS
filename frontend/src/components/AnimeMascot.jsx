import React, { useState, useEffect, useRef } from 'react';

const AnimeMascot = ({ 
  isSpeaking = false, 
  isListening = false, 
  isTyping = false, 
  spokenText = '', 
  size = 'lg', // sm, md, lg, xl
  interactive = true,
  actionOverride = null, // idle, talking, thinking, listening, power_blast, wave
  onSpeechEnd = () => {}
}) => {
  const [mouthShape, setMouthShape] = useState('smile'); // closed, small_o, wide_a, open_o, smile
  const [isBlinking, setIsBlinking] = useState(false);
  const [currentAction, setCurrentAction] = useState('idle');
  const [speechMuted, setSpeechMuted] = useState(false);
  const utteranceRef = useRef(null);

  // Sync action state
  useEffect(() => {
    if (actionOverride) {
      setCurrentAction(actionOverride);
    } else if (isSpeaking) {
      setCurrentAction('talking');
    } else if (isTyping) {
      setCurrentAction('thinking');
    } else if (isListening) {
      setCurrentAction('listening');
    } else {
      setCurrentAction('idle');
    }
  }, [isSpeaking, isTyping, isListening, actionOverride]);

  // Auto Blinking cycle
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 160);
    }, 4000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Lip sync mouth morph loop during speaking
  useEffect(() => {
    if (currentAction !== 'talking' && !isSpeaking) {
      setMouthShape('smile');
      return;
    }

    const shapes = ['wide_a', 'open_o', 'small_o', 'smile', 'wide_a', 'open_o'];
    let index = 0;

    const syncInterval = setInterval(() => {
      index = (index + 1) % shapes.length;
      setMouthShape(shapes[index]);
    }, 120);

    return () => {
      clearInterval(syncInterval);
      setMouthShape('smile');
    };
  }, [isSpeaking, currentAction]);

  // Web Speech Synthesis with real lip sync
  useEffect(() => {
    if (spokenText && isSpeaking && !speechMuted && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 1.05;
      utterance.pitch = 1.15;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Zira') || v.lang.startsWith('en')));
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onboundary = () => {
        const mouthStates = ['wide_a', 'open_o', 'small_o', 'wide_a'];
        setMouthShape(mouthStates[Math.floor(Math.random() * mouthStates.length)]);
      };

      utterance.onend = () => {
        setMouthShape('smile');
        onSpeechEnd();
      };

      utterance.onerror = () => {
        setMouthShape('smile');
        onSpeechEnd();
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [spokenText, isSpeaking, speechMuted]);

  // Size mapping for STAGE STANCE
  const sizeClasses = {
    sm: 'w-36 h-48',
    md: 'w-48 h-64 sm:w-56 sm:h-72',
    lg: 'w-60 h-72 sm:w-72 sm:h-96',
    xl: 'w-64 h-80 sm:w-80 sm:h-[400px]',
  };

  const triggerAction = (actionName) => {
    setCurrentAction(actionName);
    if (actionName === 'power_blast' || actionName === 'wave') {
      setTimeout(() => {
        setCurrentAction('idle');
      }, 3000);
    }
  };

  return (
    <div className="flex flex-col items-center select-none">
      
      {/* Stage Container */}
      <div className={`relative flex items-center justify-center ${sizeClasses[size] || sizeClasses.lg}`}>
        
        {/* Soft Radial Aura Background Glow */}
        <div className={`absolute inset-[-12%] rounded-full transition-all duration-700 blur-3xl ${
          currentAction === 'power_blast'
            ? 'bg-cyan-400/50 animate-pulse scale-110'
            : isSpeaking
              ? 'bg-sky-300/40 animate-pulse'
              : 'bg-sky-200/30 dark:bg-cyan-500/20'
        }`} />

        {/* FULL-BODY HIGH-END VECTOR ANIME CHARACTER */}
        <div className="relative w-full h-full animate-body-float">
          
          <svg 
            viewBox="0 0 300 400" 
            className="w-full h-full filter drop-shadow(0 15px 25px rgba(0, 242, 254, 0.25))"
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="bodyObsidian" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1E293B" />
                <stop offset="60%" stopColor="#0F172A" />
                <stop offset="100%" stopColor="#090D16" />
              </linearGradient>

              <linearGradient id="cyanArmorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00F2FE" />
                <stop offset="50%" stopColor="#0284C7" />
                <stop offset="100%" stopColor="#0369A1" />
              </linearGradient>

              <radialGradient id="coreGemGlow">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="40%" stopColor="#00F2FE" />
                <stop offset="100%" stopColor="#0284C7" />
              </radialGradient>

              <radialGradient id="eyeIrisCyan">
                <stop offset="0%" stopColor="#00F2FE" />
                <stop offset="60%" stopColor="#0284C7" />
                <stop offset="100%" stopColor="#090D16" />
              </radialGradient>
            </defs>

            {/* === 0. GLOWING PODIUM PLATFORM RING === */}
            <ellipse cx="150" cy="375" rx="75" ry="14" fill="#00F2FE" opacity="0.2" className="animate-podium-ring" />
            <ellipse cx="150" cy="375" rx="55" ry="9" stroke="#00F2FE" strokeWidth="2.5" opacity="0.6" strokeDasharray="6 4" />

            {/* === 1. LIGHTNING TAIL === */}
            <g className="animate-tail-sway">
              <path 
                d="M 120 270 L 65 315 L 90 265 L 35 285 L 80 215 L 105 235 Z" 
                fill="url(#cyanArmorGrad)" 
                stroke="#0f172a" 
                strokeWidth="2.5" 
              />
              <path d="M 85 265 L 55 295 L 75 255 L 45 270 L 75 225 Z" fill="#FFFFFF" opacity="0.8" />
            </g>

            {/* === 2. LEGS & FEET === */}
            <path d="M 105 260 L 95 345 L 125 360 L 135 270 Z" fill="url(#bodyObsidian)" stroke="#00F2FE" strokeWidth="2" />
            <ellipse cx="110" cy="360" rx="20" ry="9" fill="url(#cyanArmorGrad)" />

            <path d="M 195 260 L 205 345 L 175 360 L 165 270 Z" fill="url(#bodyObsidian)" stroke="#00F2FE" strokeWidth="2" />
            <ellipse cx="190" cy="360" rx="20" ry="9" fill="url(#cyanArmorGrad)" />

            {/* === 3. TORSO & CHEST VEST === */}
            <path 
              d="M 110 155 C 90 195, 95 265, 150 280 C 205 265, 210 195, 190 155 Z" 
              fill="url(#bodyObsidian)" 
              stroke="#00F2FE" 
              strokeWidth="2.5" 
            />
            {/* Ocean Blue Chest Vest Accent */}
            <path 
              d="M 120 165 C 135 215, 165 215, 180 165 C 170 235, 130 235, 120 165 Z" 
              fill="url(#cyanArmorGrad)" 
            />

            {/* Chest Core Gem */}
            <polygon points="150,190 162,205 150,220 138,205" fill="url(#coreGemGlow)" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="150" cy="205" r="4" fill="#FFFFFF" className="animate-pulse" />

            {/* === 4. ARMS & HAND GESTURES === */}
            {/* Left Arm */}
            <g className={currentAction === 'thinking' ? '' : 'animate-arm-gesture'}>
              {currentAction === 'thinking' ? (
                <path d="M 115 170 C 90 195, 110 225, 135 150 Z" fill="url(#bodyObsidian)" stroke="#00F2FE" strokeWidth="2.5" />
              ) : (
                <path d="M 110 165 C 80 195, 70 225, 85 240 C 95 225, 105 195, 120 175 Z" fill="url(#bodyObsidian)" stroke="#00F2FE" strokeWidth="2.5" />
              )}
              <circle cx={currentAction === 'thinking' ? "135" : "80"} cy={currentAction === 'thinking' ? "148" : "235"} r="10" fill="url(#cyanArmorGrad)" />
            </g>

            {/* Right Arm */}
            <g>
              {currentAction === 'wave' || currentAction === 'talking' ? (
                <path d="M 190 165 C 220 135, 245 115, 235 100 C 220 110, 200 135, 180 175 Z" fill="url(#bodyObsidian)" stroke="#00F2FE" strokeWidth="2.5" />
              ) : (
                <path d="M 190 165 C 220 195, 230 225, 215 240 C 205 225, 195 195, 180 175 Z" fill="url(#bodyObsidian)" stroke="#00F2FE" strokeWidth="2.5" />
              )}
              <circle cx={currentAction === 'wave' || currentAction === 'talking' ? "238" : "220"} cy={currentAction === 'wave' || currentAction === 'talking' ? "100" : "235"} r="10" fill="url(#cyanArmorGrad)" />
            </g>

            {/* === 5. HEAD & ANIME EARS === */}
            {/* Left Ear */}
            <path d="M 110 105 C 65 15, 45 5, 125 65 Z" fill="url(#bodyObsidian)" stroke="#00F2FE" strokeWidth="2.5" />
            <path d="M 108 90 C 72 30, 58 25, 118 67 Z" fill="url(#cyanArmorGrad)" />

            {/* Right Ear */}
            <path d="M 190 105 C 235 15, 255 5, 175 65 Z" fill="url(#bodyObsidian)" stroke="#00F2FE" strokeWidth="2.5" />
            <path d="M 192 90 C 228 30, 242 25, 182 67 Z" fill="url(#cyanArmorGrad)" />

            {/* Head Base */}
            <ellipse cx="150" cy="120" rx="56" ry="48" fill="url(#bodyObsidian)" stroke="#00F2FE" strokeWidth="2.5" />

            {/* Cheek Blushes */}
            <ellipse cx="112" cy="132" rx="9" ry="5" fill="#F43F5E" opacity="0.4" />
            <ellipse cx="188" cy="132" rx="9" ry="5" fill="#F43F5E" opacity="0.4" />

            {/* Eyes with Triple Gloss Sparkles */}
            {/* Left Eye */}
            <g>
              <ellipse cx="125" cy="112" rx="12" ry="16" fill="#0F172A" />
              <ellipse cx="125" cy="113" rx="10" ry="14" fill="url(#eyeIrisCyan)" />
              {isBlinking ? (
                <path d="M 113 112 Q 125 120 137 112" stroke="#00F2FE" strokeWidth="3.5" strokeLinecap="round" />
              ) : (
                <>
                  <circle cx="121" cy="106" r="4.5" fill="#FFFFFF" />
                  <circle cx="129" cy="118" r="2" fill="#00F2FE" />
                  <circle cx="120" cy="118" r="1" fill="#FFFFFF" opacity="0.8" />
                </>
              )}
            </g>

            {/* Right Eye */}
            <g>
              <ellipse cx="175" cy="112" rx="12" ry="16" fill="#0F172A" />
              <ellipse cx="175" cy="113" rx="10" ry="14" fill="url(#eyeIrisCyan)" />
              {isBlinking ? (
                <path d="M 163 112 Q 175 120 187 112" stroke="#00F2FE" strokeWidth="3.5" strokeLinecap="round" />
              ) : (
                <>
                  <circle cx="171" cy="106" r="4.5" fill="#FFFFFF" />
                  <circle cx="179" cy="118" r="2" fill="#00F2FE" />
                  <circle cx="170" cy="118" r="1" fill="#FFFFFF" opacity="0.8" />
                </>
              )}
            </g>

            {/* Nose */}
            <polygon points="148,124 152,124 150,126" fill="#00F2FE" />

            {/* Lip Sync Mouth Shapes */}
            <g>
              {mouthShape === 'closed' && (
                <path d="M 140 134 Q 150 137 160 134" fill="none" stroke="#00F2FE" strokeWidth="2.5" strokeLinecap="round" />
              )}
              {mouthShape === 'small_o' && (
                <ellipse cx="150" cy="135" rx="5" ry="7" fill="#00F2FE" stroke="#FFFFFF" strokeWidth="1.5" />
              )}
              {mouthShape === 'wide_a' && (
                <path d="M 138 131 Q 150 126 162 131 Q 160 144 150 144 Q 140 144 138 131 Z" fill="#00F2FE" stroke="#FFFFFF" strokeWidth="1.5" />
              )}
              {mouthShape === 'open_o' && (
                <ellipse cx="150" cy="136" rx="8" ry="10" fill="#0284C7" stroke="#FFFFFF" strokeWidth="1.5" />
              )}
              {mouthShape === 'smile' && (
                <path d="M 138 132 Q 150 142 162 132" fill="none" stroke="#00F2FE" strokeWidth="2.5" strokeLinecap="round" />
              )}
            </g>

            {/* Antenna */}
            <circle cx="150" cy="68" r="6" fill="url(#cyanArmorGrad)" stroke="#00F2FE" strokeWidth="1.5" />
            <path d="M 150 68 L 150 74" stroke="#00F2FE" strokeWidth="2.5" strokeLinecap="round" />

          </svg>
        </div>
      </div>

      {/* Action Buttons */}
      {interactive && (
        <div className="flex flex-wrap justify-center gap-2 mt-2 z-20">
          <button 
            onClick={() => triggerAction('power_blast')}
            className="px-3.5 py-1.5 btn-ocean dark:btn-gradient-cyan text-xs font-bold shadow-xs hover:scale-105 transition-all"
          >
            ⚡ Power Stance
          </button>
          <button 
            onClick={() => triggerAction('wave')}
            className="px-3.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-cyan-500/30 rounded-xl text-xs font-bold hover:scale-105 transition-all"
          >
            👋 Wave
          </button>
          <button 
            onClick={() => triggerAction('thinking')}
            className="px-3.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-cyan-500/30 rounded-xl text-xs font-bold hover:scale-105 transition-all"
          >
            🤔 Focus Energy
          </button>
        </div>
      )}

    </div>
  );
};

export default AnimeMascot;
