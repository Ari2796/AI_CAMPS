import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, Mic, MicOff, Volume2, VolumeX, 
  Sparkles, Copy, Check, User, CheckCircle2,
  ThumbsUp, ThumbsDown, MapPin, ArrowRight,
  Navigation, Footprints, Clock, Compass, ChevronRight, CornerDownRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiCall } from '../services/api';
import AnimeMascot3D from '../components/AnimeMascot3D';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CAMPUS_PLACES } from '../data/campus_map_data';
import { SEARCH_INDEX, DETAILS_MAP } from '../data/campus_map_full_dataset';
import { findShortestRoadRoute } from '../data/campus_road_navigator';

const QUICK_START_LOCATIONS = [
  { id: 'main-gate', label: 'Main Gate 1', icon: '🚩' },
  { id: 'bus', label: 'Bus Bay Terminal', icon: '🚌' },
  { id: 'sapphire', label: 'Men\'s Hostels (Sapphire/Emerald)', icon: '🛏️' },
  { id: 'ganga', label: 'Women\'s Hostels (Ganga/Yamuna)', icon: '🛏️' },
  { id: 'library', label: 'Central Library', icon: '📚' }
];

const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', langKey: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'ta-IN', langKey: 'ta', label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'ml-IN', langKey: 'ml', label: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { code: 'hi-IN', langKey: 'hi', label: 'Hindi', native: 'हिंदी', flag: '🇮🇳' }
];

const WELCOME_MESSAGES = {
  'en-IN': "Welcome to Bannari Amman Institute of Technology! 🌟 I'm Aura, your AI campus guide. How can I help you explore our campus, departments, or facilities today?",
  'ta-IN': "பன்னாரி அம்மன் தொழில்நுட்பக் கல்லூரிக்கு (BIT) உங்களை அன்புடன் வரவேற்கிறோம்! 🌟 நான் ஆரா (Aura), உங்கள் வளாக வழிகாட்டி. வகுப்பறைகள், ஆய்வகங்கள், சேர்க்கை அல்லது வழிகள் பற்றி என்னிடம் கேளுங்கள்!",
  'ml-IN': "ബന്നാരി അമ്മൻ ഇൻസ്റ്റിറ്റ്യൂട്ട് ഓഫ് ടെക്നോളജിയിലേക്ക് സ്വാഗതം! 🌟 ഞാൻ ഓറ (Aura), നിങ്ങളുടെ കാമ്പസ് ഗൈഡ്. ഡിപ്പാർട്ട്‌മെന്റുകൾ, ലാബുകൾ, അഡ്മിഷൻ അല്ലെങ്കിൽ വഴികൾ എന്നിവയെക്കുറിച്ച് എന്നോട് ചോദിക്കാം!",
  'hi-IN': "बन्नारी अम्मन इंस्टीट्यूट ऑफ टेक्नोलॉजी (BIT) में आपका स्वागत है! 🌟 मैं ऑरा (Aura) हूँ, आपकी डिजिटल कैंपस गाइड। विभागों, लैब्स, प्रवेश या रास्तों के बारे में मुझसे पूछें!"
};

const ChatPage = () => {
  const { user, isGuest } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // Unique User Storage Identifier (Prevents cross-user history leakage)
  const userKey = user?.email || user?.roll || (isGuest ? `guest_${user?.name || 'visitor'}` : 'anonymous');
  const msgKey = `bit_chat_messages_${userKey}`;
  const sessKey = `bit_chat_session_${userKey}`;
  const routeKey = `bit_chat_route_${userKey}`;

  // Persistent Language selection
  const [voiceLang, setVoiceLang] = useState(() => {
    return sessionStorage.getItem('bit_chat_voice_lang') || 'en-IN';
  });

  // Persistent Session ID per user
  const [sessionId, setSessionId] = useState(() => {
    let existing = sessionStorage.getItem(sessKey);
    if (!existing) {
      existing = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(sessKey, existing);
    }
    return existing;
  });

  // Persistent Messages per user
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(msgKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    const initialLang = sessionStorage.getItem('bit_chat_voice_lang') || 'en-IN';
    return [
      {
        id: 1,
        text: WELCOME_MESSAGES[initialLang] || WELCOME_MESSAGES['en-IN'],
        isAI: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechMuted, setSpeechMuted] = useState(false);
  const [currentResponse, setCurrentResponse] = useState(
    `Welcome ${user?.name || ''}! How can I help you explore the BIT campus today?`
  );
  const [copiedId, setCopiedId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [actionOverride, setActionOverride] = useState(null);
  const [feedbackGiven, setFeedbackGiven] = useState({});
  
  // Persistent route selection per user
  const [selectedRouteOrigin, setSelectedRouteOrigin] = useState(() => {
    try {
      const saved = sessionStorage.getItem(routeKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  const messagesEndRef = useRef(null);

  // Reload history whenever active user changes
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(msgKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (e) {}
    
    // Fresh welcome for this user
    setMessages([
      {
        id: 1,
        text: WELCOME_MESSAGES[voiceLang] || WELCOME_MESSAGES['en-IN'],
        isAI: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  }, [userKey]);

  // Sync messages, language & route origin to user-specific sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(msgKey, JSON.stringify(messages));
    } catch (e) {}
  }, [messages, msgKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem('bit_chat_voice_lang', voiceLang);
    } catch (e) {}
  }, [voiceLang]);

  useEffect(() => {
    try {
      sessionStorage.setItem(routeKey, JSON.stringify(selectedRouteOrigin));
    } catch (e) {}
  }, [selectedRouteOrigin, routeKey]);

  const handleLanguageChange = (langCode) => {
    setVoiceLang(langCode);
    sessionStorage.setItem('bit_chat_voice_lang', langCode);
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
    showToast(`Switched language to ${langObj?.native || langObj?.label}`);

    // If conversation only contains initial greeting, update it to the new language
    if (messages.length <= 1) {
      const updatedMsgs = [
        {
          id: 1,
          text: WELCOME_MESSAGES[langCode] || WELCOME_MESSAGES['en-IN'],
          isAI: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ];
      setMessages(updatedMsgs);
      setCurrentResponse(WELCOME_MESSAGES[langCode] || WELCOME_MESSAGES['en-IN']);
    }
  };

  const handleNewChat = () => {
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newId);
    sessionStorage.setItem(sessKey, newId);
    const initialMsgs = [
      {
        id: 1,
        text: WELCOME_MESSAGES[voiceLang] || WELCOME_MESSAGES['en-IN'],
        isAI: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ];
    setMessages(initialMsgs);
    sessionStorage.setItem(msgKey, JSON.stringify(initialMsgs));
    setSelectedRouteOrigin({});
    sessionStorage.removeItem(routeKey);
    showToast("Started new chat session!");
  };

  const suggestedQuestions = [
    'Where is the CT & AIDS Library?',
    'Where is the AI Lab located?',
    'I need to go to Placement Cell',
    'Where is the Central Library located?',
    'What are the highest placement salary packages at BIT?'
  ];

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const isLocationOrDirectionQuery = (text) => {
    if (!text) return false;
    const lower = text.toLowerCase();

    // If query is about non-spatial topics (fees, scholarships, syllabus, HODs), disallow map cards
    const nonSpatialKeywords = [
      'fee', 'fees', 'tuition', 'cost', 'charge', 'scholarship', 'cutoff', 'cut-off',
      'package', 'salary', 'highest package', 'average package', 'placed', 'recruiter', 'company', 'eligible', 'eligibility',
      'who is', 'hod', 'principal', 'faculty', 'professor', 'syllabus', 'curriculum',
      'exam', 'attendance', 'rule', 'rules', 'dress code', 'leave', 'holiday', 'timing', 'admission',
      'கட்டணம்', 'சம்பளம்', 'பாடத்திட்டம்', 'யார்', 'தேர்வு', 'விதிகள்', 'ഫീസ്', 'ശമ്പളം', 'फीस', 'वेतन'
    ];
    if (nonSpatialKeywords.some(kw => lower.includes(kw))) {
      return false;
    }

    const spatialKeywords = [
      // English
      'where', 'how to reach', 'how to go', 'direction', 'directions', 'route', 'path',
      'navigate', 'location', 'way to', 'located', 'situated', 'find', 'map',
      'lab', 'room', 'block', 'hostel', 'canteen', 'mess', 'ground', 'auditorium', 'library', 'gate',
      // Tamil
      'எங்கே', 'எங்கு', 'எங்குள்ளது', 'நூலகம்', 'ஆய்வகம்', 'விடுதி', 'ஹாஸ்டல்', 'உணவகம்', 'கேண்டீன்', 
      'அரங்கம்', 'நுழைவாயில்', 'செல்லும் வழி', 'எப்படி போவது', 'அமைந்துள்ளது', 'இடம்', 'வரைபடம்', 'செல்ல வேண்டும்',
      // Malayalam
      'എവിടെ', 'എവിടെയാണ്', 'ലൈബ്രറി', 'ലാബ്', 'ഹോസ്റ്റൽ', 'കാന്റീൻ', 'ഓഡിറ്റോറിയം', 'ഗേറ്റ്', 'വഴി', 'എങ്ങനെ പോകാം',
      // Hindi
      'कहाँ', 'कहाँ है', 'किधर', 'पुस्तकालय', 'लाइब्रेरी', 'प्रयोगशाला', 'लैब', 'हॉस्टल', 'कैंटीन', 'सभागार', 'रास्ता', 'दिशा', 'कैसे जाएँ'
    ];
    return spatialKeywords.some(kw => lower.includes(kw));
  };

  const detectCampusPlace = (text) => {
    if (!text) return null;
    
    // Strip out helper prompt examples like "(e.g., Main Gate 1, the Central Library...)"
    let cleanText = text.replace(/\(e\.g\.[^)]+\)/gi, '');
    cleanText = cleanText.replace(/where are you starting from[^?]*\?/gi, '');
    cleanText = cleanText.replace(/நீங்கள் எங்கிருந்து தொடங்குகிறீர்கள்[^?]*\?/gi, '');
    const lower = cleanText.toLowerCase().trim();

    // 1. Central Library (English, Tamil, Malayalam, Hindi)
    if (
      lower.includes('central library') || lower.includes('library') || 
      lower.includes('நூலகம்') || lower.includes('மத்திய நூலகம்') || 
      lower.includes('ലൈബ്രറി') || lower.includes('സെൻട്രൽ ലൈബ്രറി') || 
      lower.includes('पुस्तकालय') || lower.includes('लाइब्रेरी')
    ) {
      // Differentiate CT & AIDS Library
      if (lower.includes('aids library') || lower.includes('ct & aids') || lower.includes('சிடி & ஏஐடிஎஸ்')) {
        return {
          id: 'ib-rib-3',
          name: 'CT & AIDS Library',
          building: 'IB rib 3 (IB Block)',
          floor: 'Ground Floor, IB Block',
          shortName: 'CT & AIDS Library',
          category: 'academic'
        };
      }
      return {
        id: 'library',
        name: 'Dr. S.V. Balasubramaniam Central Library',
        building: 'Central Library Building',
        floor: 'Ground to 3rd Floor (Opposite Main Auditorium)',
        shortName: 'Central Library',
        category: 'academic'
      };
    }

    // 2. Direct AI Lab match (English, Tamil, Malayalam, Hindi)
    if (
      lower.includes('ai lab') || lower.includes('artificial intelligence lab') ||
      lower.includes('ஏஐ லேப்') || lower.includes('ஆய்வகம்') || lower.includes('செயற்கை நுண்ணறிவு ஆய்வகம்') ||
      lower.includes('എഐ ലാബ്') || lower.includes('एआई लैब')
    ) {
      return {
        id: 'as-main-right',
        name: 'AI Lab',
        building: 'Special Labs (AS Block)',
        floor: 'Second Floor, AS Block',
        shortName: 'AI Lab (Special Labs)',
        category: 'academic'
      };
    }

    // 3. Placement and Training Cell (English, Tamil, Malayalam, Hindi)
    if (
      lower.includes('placement cell') || lower.includes('training cell') || lower.includes('training & placement') ||
      lower.includes('பிளேஸ்மென்ட்') || lower.includes('வேலைவாய்ப்பு பிரிவு') ||
      lower.includes('പ്ലേസ്‌മെന്റ്') || lower.includes('प्लेसमेंट सेल') ||
      (lower.includes('placement') && (lower.includes('where') || lower.includes('எங்கே')))
    ) {
      return {
        id: 'ib-block-2',
        name: 'Placement & Training Cell',
        building: 'IB Block (Information & Computing Block)',
        floor: 'Ground Floor, Entrance Lobby',
        shortName: 'Placement Cell (IB Block)',
        category: 'academic'
      };
    }

    // 4. Main Auditorium (English, Tamil, Malayalam, Hindi)
    if (
      lower.includes('main auditorium') || lower.includes('auditorium') ||
      lower.includes('அரங்கம்') || lower.includes('ஆடிட்டோரியம்') ||
      lower.includes('ഓഡിറ്റോറിയം') || lower.includes('सभागार') || lower.includes('ऑडिटोरियम')
    ) {
      return {
        id: 'main-auditorium',
        name: 'Main Auditorium',
        building: 'Auditorium Complex',
        floor: 'Ground Floor (Opposite Central Library)',
        shortName: 'Main Auditorium',
        category: 'academic'
      };
    }

    // 5. Cafeteria / Food Court (English, Tamil, Malayalam, Hindi)
    if (
      lower.includes('cafeteria') || lower.includes('food court') || lower.includes('canteen') ||
      lower.includes('உணவகம்') || lower.includes('கேண்டீன்') || lower.includes('உணவுக்கூடம்') ||
      lower.includes('കാന്റീൻ') || lower.includes('कैंटीन') || lower.includes('कैफेटेरिया')
    ) {
      return {
        id: 'cafeteria',
        name: 'Food Court & Cafeteria',
        building: 'Campus Food Court',
        floor: 'Ground Floor',
        shortName: 'Cafeteria',
        category: 'amenities'
      };
    }

    // 4. Check all 496 official room search items (longest match first)
    if (SEARCH_INDEX && SEARCH_INDEX.length > 0) {
      const sortedSearch = [...SEARCH_INDEX].sort((a, b) => b.match.length - a.match.length);
      for (const item of sortedSearch) {
        const itemMatchLower = item.match.toLowerCase();
        // Ignore single common words to avoid false triggers
        if (itemMatchLower.length < 3) continue;
        if (lower.includes(itemMatchLower)) {
          const det = DETAILS_MAP[item.id] || {};
          return {
            id: item.id,
            name: item.match,
            building: `${det.name || item.name} (${det.main || item.main})`,
            floor: item.floor,
            shortName: item.match,
            category: 'academic'
          };
        }
      }
    }
    if (lower.includes('sunflower') || lower.includes('sf block') || lower.includes('ece') || lower.includes('eee') || lower.includes('eie')) {
      return {
        id: 'sf-block',
        name: 'Sunflower (SF) Engineering Block',
        building: 'SF Block',
        floor: 'Ground to 3rd Floor',
        shortName: 'SF Block',
        category: 'academic'
      };
    }
    if (lower.includes('as block') || lower.includes('applied science') || lower.includes('first year')) {
      return {
        id: 'as-main-left',
        name: 'AS Block (Applied Science & Humanities)',
        building: 'AS Block',
        floor: 'Ground to 2nd Floor',
        shortName: 'AS Block',
        category: 'academic'
      };
    }
    if (lower.includes('mech') || lower.includes('mechanical') || lower.includes('mechatronics') || lower.includes('workshop')) {
      return {
        id: 'mechanic-back',
        name: 'Mechanical & Mechatronics Block',
        building: 'Mechanical Block',
        floor: 'Ground & 1st Floor',
        shortName: 'Mechanic Block',
        category: 'academic'
      };
    }

    // 3. Central Amenities
    if (lower.includes('library') || lower.includes('balasubramaniam')) {
      return {
        id: 'library',
        name: 'Dr. S.V. Balasubramaniam Central Library',
        building: 'Central Library',
        floor: '4-Storey Knowledge Hub',
        shortName: 'Central Library',
        category: 'amenities'
      };
    }
    if (lower.includes('canteen') || lower.includes('food court') || lower.includes('cafeteria')) {
      return {
        id: 'cafeteria',
        name: 'Central Campus Cafeteria & Food Court',
        building: 'Central Food Court',
        floor: 'Ground Floor',
        shortName: 'Central Food Court',
        category: 'dining'
      };
    }
    if (lower.includes('medical') || lower.includes('clinic') || lower.includes('doctor') || lower.includes('ambulance') || lower.includes('hospital')) {
      return {
        id: 'medical-centre',
        name: '24/7 Campus Medical Centre & Ambulance Base',
        building: 'Medical Centre (Near West Gate 2)',
        floor: 'Ground Floor Clinic',
        shortName: 'Medical Centre (24x7)',
        category: 'amenities'
      };
    }
    if (lower.includes('auditorium') || lower.includes('convention')) {
      return {
        id: 'main-auditorium',
        name: 'Main Auditorium & Convention Hall',
        building: 'Auditorium Complex',
        floor: 'Main Stage & Balcony',
        shortName: 'Main Auditorium',
        category: 'amenities'
      };
    }
    if (lower.includes('principal') || lower.includes('admin') || lower.includes('admission office') || lower.includes('cashier')) {
      return {
        id: 'principal-office',
        name: 'Principal Office & Administrative Block',
        building: 'Admin Block (Near Gate 1)',
        floor: 'Ground & 1st Floor',
        shortName: 'Admin & Principal Office',
        category: 'amenities'
      };
    }

    // 4. Hostels
    if (lower.includes('sapphire')) return { id: 'sapphire', name: 'Sapphire Men\'s Hostel', building: 'Sapphire Block', floor: 'Men\'s Hostel', shortName: 'Sapphire Hostel', category: 'hostels' };
    if (lower.includes('emerald')) return { id: 'emerald', name: 'Emerald Men\'s Hostel', building: 'Emerald Block', floor: 'Men\'s Hostel', shortName: 'Emerald Hostel', category: 'hostels' };
    if (lower.includes('ruby')) return { id: 'ruby', name: 'Ruby Men\'s Hostel', building: 'Ruby Block', floor: 'Senior Men\'s Hostel', shortName: 'Ruby Hostel', category: 'hostels' };
    if (lower.includes('diamond')) return { id: 'diamond', name: 'Diamond Men\'s Hostel', building: 'Diamond Block', floor: 'Senior Men\'s Hostel', shortName: 'Diamond Hostel', category: 'hostels' };
    if (lower.includes('pearl')) return { id: 'pearl', name: 'Pearl Men\'s Hostel', building: 'Pearl Block', floor: 'Men\'s Hostel', shortName: 'Pearl Hostel', category: 'hostels' };
    if (lower.includes('ganga')) return { id: 'ganga', name: 'Ganga Women\'s Hostel', building: 'Ganga Block', floor: 'Women\'s Hostel', shortName: 'Ganga Hostel', category: 'hostels' };
    if (lower.includes('yamuna')) return { id: 'yamuna', name: 'Yamuna Women\'s Hostel', building: 'Yamuna Block', floor: 'Women\'s Hostel', shortName: 'Yamuna Hostel', category: 'hostels' };
    if (lower.includes('narmadha')) return { id: 'narmadha', name: 'Narmadha Women\'s Hostel', building: 'Narmadha Block', floor: 'Women\'s Hostel', shortName: 'Narmadha Hostel', category: 'hostels' };
    if (lower.includes('kaveri') || lower.includes('cauvery')) return { id: 'kaveri', name: 'Kaveri Women\'s Hostel', building: 'Kaveri Block', floor: 'Women\'s Hostel', shortName: 'Kaveri Hostel', category: 'hostels' };
    if (lower.includes('bhavani')) return { id: 'middle-bhavani', name: 'Bhavani Women\'s Hostel', building: 'Bhavani Block', floor: 'Women\'s Hostel', shortName: 'Bhavani Hostel', category: 'hostels' };

    // 5. Gates & Transport
    if (lower.includes('main gate') || lower.includes('gate 1')) return { id: 'main-gate', name: 'Main Gate 1 (Sathy-Bhavani Road)', building: 'Main Gate 1', floor: 'Security Outpost', shortName: 'Main Gate 1', category: 'gates' };
    if (lower.includes('bus') || lower.includes('transport') || lower.includes('bus bay')) return { id: 'bus', name: 'Day Scholar College Bus Bay & Terminal', building: 'Bus Bay', floor: 'Bus Terminal', shortName: 'Bus Bay', category: 'gates' };

    return null;
  };

  // Helper to detect starting origin from user responses like "i am in library", "from main gate", etc.
  const detectOriginFromText = (text) => {
    if (!text) return null;
    const lower = text.toLowerCase();
    if (lower.includes('library') || lower.includes('balasubramaniam')) return 'library';
    if (lower.includes('main gate') || lower.includes('gate 1') || lower.includes('gate')) return 'main-gate';
    if (lower.includes('bus') || lower.includes('bus bay')) return 'bus';
    if (lower.includes('sapphire') || lower.includes('emerald') || lower.includes('boys hostel') || lower.includes('men hostel')) return 'sapphire';
    if (lower.includes('ganga') || lower.includes('yamuna') || lower.includes('girls hostel') || lower.includes('women hostel') || lower.includes('cauvery') || lower.includes('kaveri')) return 'ganga';
    if (lower.includes('cafeteria') || lower.includes('canteen') || lower.includes('food court')) return 'cafeteria';
    if (lower.includes('sf block') || lower.includes('sunflower')) return 'sf-block';
    if (lower.includes('as block') || lower.includes('applied science')) return 'as-main-left';
    return null;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, selectedRouteOrigin]);

  const recognitionRef = useRef(null);

  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Speech recognition is not supported on this browser. Please use Chrome or Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = voiceLang; // 'en-IN', 'ta-IN', 'ml-IN', 'hi-IN'
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        const langObj = SUPPORTED_LANGUAGES.find(l => l.code === voiceLang);
        showToast(`🎙️ Listening in ${langObj?.native || langObj?.label}... Speak now!`);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          showToast("Microphone access denied. Please allow microphone permissions.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
      showToast("Could not start microphone.");
    }
  };

  const handleSend = async (text = input) => {
    if (!text.trim()) return;
    
    const userMsg = {
      id: Date.now(),
      text,
      isAI: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setIsSpeaking(false);
    setCurrentResponse('');

    try {
      const activeLang = voiceLang.startsWith('ta') ? 'ta' : (voiceLang.startsWith('hi') ? 'hi' : (voiceLang.startsWith('ml') ? 'ml' : 'en'));
      
      // Pass full conversation history so AI remembers destination and context
      const historyPayload = messages.slice(-6).map(m => ({
        text: m.text,
        isAI: m.isAI
      }));

      const data = await apiCall('/chat', {
        method: 'POST',
        body: JSON.stringify({ 
          message: text, 
          session_id: sessionId,
          language: activeLang,
          user_name: user?.name || (isGuest ? 'Guest Visitor' : 'Student'),
          user_type: isGuest ? 'guest' : 'student',
          history: historyPayload
        }),
      });

      const aiResponseText = data.response || "Here is the official information from Bannari Amman Institute of Technology.";

      const aiMsg = {
        id: Date.now() + 1,
        text: aiResponseText,
        isAI: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: data.sources || [],
        isComplaint: data.is_complaint || false,
      };

      setMessages(prev => [...prev, aiMsg]);
      setCurrentResponse(aiResponseText);
      setIsTyping(false);

      // Trigger Avatar speech & gestures
      if (!speechMuted) {
        setIsSpeaking(true);
        setActionOverride('talk');
      }

    } catch (err) {
      console.error(err);
      const errorMsg = {
        id: Date.now() + 1,
        text: "I am having trouble connecting to the campus server. Please try again shortly.",
        isAI: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
      setIsTyping(false);
    }
  };

  const copyToClipboard = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFeedback = (id, type) => {
    setFeedbackGiven(prev => ({ ...prev, [id]: type }));
    showToast(type === 'up' ? "Thank you for your feedback!" : "Feedback recorded.");
  };

  const handleSelectOrigin = (msgId, originId) => {
    setSelectedRouteOrigin(prev => ({ ...prev, [msgId]: originId }));
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 font-sans">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-lg animate-in fade-in duration-200">
          {toastMessage}
        </div>
      )}

      {/* ================= LEFT: 3D ANIME AVATAR ================= */}
      <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] flex-col border-r border-slate-200/80 dark:border-zinc-800/80 p-5 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md justify-between">
        
        {/* Top Assistant Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Aura AI</h2>
              <p className="text-[11px] text-slate-400 font-medium">BIT Campus Companion</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSpeechMuted(!speechMuted)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                speechMuted 
                  ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700' 
                  : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
              }`}
              title={speechMuted ? "Unmute Voice" : "Mute Voice"}
            >
              {speechMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          </div>
        </div>

        {/* 3D Mascot Canvas */}
        <div className="relative w-full h-[320px] flex items-center justify-center my-auto">
          <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner">
            <AnimeMascot3D
              isSpeaking={isSpeaking}
              actionOverride={actionOverride}
              language={voiceLang}
              textToSpeak={currentResponse}
              onSpeechEnd={() => setIsSpeaking(false)}
            />
          </div>
        </div>

        {/* Live Subtitle & Gesture Bar */}
        <div className="space-y-3 pt-2">
          {currentResponse && (
            <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800/60 text-center">
              <p className="text-xs text-slate-700 dark:text-zinc-300 line-clamp-2 leading-relaxed font-medium">
                "{currentResponse}"
              </p>
            </div>
          )}

          {/* Voice Chat Trigger Button */}
          <button
            onClick={toggleVoiceInput}
            className={`w-full py-2.5 px-4 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600 animate-pulse shadow-rose-500/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 shadow-emerald-600/20'
            }`}
          >
            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
            <span>
              {isListening 
                ? "Listening... (Click to stop)" 
                : `Voice Chat (${SUPPORTED_LANGUAGES.find(l => l.code === voiceLang)?.native || 'Voice'})`}
            </span>
          </button>

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => {
                setActionOverride('wave');
                setTimeout(() => setActionOverride(null), 3000);
              }}
              className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-medium transition-colors cursor-pointer"
            >
              Wave
            </button>
            <button
              onClick={() => {
                setActionOverride('dance');
                setTimeout(() => setActionOverride(null), 3000);
              }}
              className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-medium transition-colors cursor-pointer"
            >
              Pose
            </button>
          </div>
        </div>

      </div>

      {/* ================= RIGHT: CLEAN CHAT STREAM ================= */}
      <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-[#09090b]">
        
        {/* Top Session Header, Language Selector & New Chat Button */}
        <div className="px-4 py-2.5 border-b border-slate-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Campus AI Companion
            </span>
          </div>

          {/* Multilingual Selector Pills (English, தமிழ், മലയാളം, हिंदी) */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = voiceLang === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-800/60'
                  }`}
                  title={`Switch Aura to ${lang.label}`}
                >
                  <span className="text-[11px]">{lang.flag}</span>
                  <span>{lang.native}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 border border-slate-200 dark:border-zinc-800 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            title="Start a fresh conversation"
          >
            <span>🔄</span>
            <span>New Chat</span>
          </button>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5 custom-scrollbar">
          
          {/* Suggested Questions if new conversation */}
          {messages.length <= 1 && (
            <div className="max-w-2xl mx-auto py-6 space-y-3">
              <p className="text-xs font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider text-center">
                Popular Inquiries
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q)}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-zinc-800 text-xs font-medium transition-colors shadow-2xs hover:border-slate-300 dark:hover:border-zinc-700 cursor-pointer text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, msgIdx) => {
            // ONLY render a location/route card if the user asked a real navigation query
            let detectedPlace = null;
            if (msg.isAI && msgIdx > 0 && !messages[msgIdx - 1].isAI) {
              const userPrompt = messages[msgIdx - 1].text;
              if (isLocationOrDirectionQuery(userPrompt)) {
                detectedPlace = detectCampusPlace(userPrompt) || detectCampusPlace(msg.text);
              }
            }

            // Check if user clicked a starting pill OR typed a starting origin (e.g. "i am in library")
            let chosenOriginId = selectedRouteOrigin[msg.id] || null;
            if (!chosenOriginId && msg.isAI && msgIdx > 0 && !messages[msgIdx - 1].isAI && detectedPlace) {
              chosenOriginId = detectOriginFromText(messages[msgIdx - 1].text);
            }
            // Prevent self-routing (e.g. origin === destination)
            if (chosenOriginId && detectedPlace && chosenOriginId === detectedPlace.id) {
              chosenOriginId = null;
            }

            const routeDetails = chosenOriginId && detectedPlace 
              ? findShortestRoadRoute(chosenOriginId, detectedPlace.id)
              : null;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isAI ? 'items-start' : 'items-end'}`}
              >
                {/* Message Header */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400 font-medium">
                  <span>{msg.isAI ? 'Aura' : (user?.name || 'You')}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Message Body Bubble */}
                <div
                  className={`max-w-2xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    msg.isAI
                      ? 'bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 shadow-2xs'
                      : 'bg-emerald-600 text-white font-medium shadow-xs'
                  }`}
                >
                  {msg.isAI ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-slate-800 dark:text-zinc-100">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ node, ...props }) => <p className="mb-2.5 last:mb-0 leading-relaxed" {...props} />,
                          strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900 dark:text-zinc-100" {...props} />,
                          ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                          h1: ({ node, ...props }) => <h1 className="font-bold text-base text-slate-900 dark:text-zinc-100 mt-3 mb-1.5" {...props} />,
                          h2: ({ node, ...props }) => <h2 className="font-semibold text-sm text-slate-900 dark:text-zinc-100 mt-3 mb-1.5" {...props} />,
                          h3: ({ node, ...props }) => <h3 className="font-semibold text-xs text-slate-900 dark:text-zinc-100 mt-2 mb-1" {...props} />
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                  )}

                  {/* ================= INTERACTIVE CAMPUS MAP & NAVIGATION WIDGET ================= */}
                  {msg.isAI && detectedPlace && (
                    <div className="mt-4 pt-3.5 border-t border-slate-200 dark:border-zinc-800 space-y-3">
                      
                      {/* Destination Highlight Pill */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <MapPin size={16} />
                          </div>
                          <div>
                            <div className="font-bold text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
                              {detectedPlace.name}
                            </div>
                            <div className="text-[11px] text-emerald-600/90 dark:text-emerald-400">
                              📍 {detectedPlace.building} • {detectedPlace.floor}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => navigate(`/map?to=${detectedPlace.id}`)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-600/20 shrink-0 cursor-pointer"
                        >
                          <span>View on Map</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>

                      {/* Interactive Route Query & Quick Starting Points */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
                          <Compass size={14} className="text-emerald-500" />
                          <span>Where are you starting from right now?</span>
                        </div>

                        {/* Quick Selection Chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_START_LOCATIONS.map((loc) => (
                            <button
                              key={loc.id}
                              onClick={() => handleSelectOrigin(msg.id, loc.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                chosenOriginId === loc.id
                                  ? 'bg-emerald-600 text-white shadow-xs scale-105'
                                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:text-slate-900 dark:hover:text-zinc-200 hover:border-slate-300'
                              }`}
                            >
                              <span>{loc.icon}</span>
                              <span>{loc.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Calculated Turn-by-Turn Route Guidance */}
                        {routeDetails && (
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-800/80 space-y-2.5 animate-in fade-in duration-200">
                            
                            {/* Route Distance & Walking Time Badge */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-900 text-xs">
                              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                                <Footprints size={14} />
                                <span>~{routeDetails.distance} meters</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                                <Clock size={14} />
                                <span>~{Math.max(1, Math.round(routeDetails.distance / 75))} min walk</span>
                              </div>
                            </div>

                            {/* Step-by-step route steps */}
                            <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                              <div className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                  1
                                </span>
                                <span>Start from <strong>{QUICK_START_LOCATIONS.find(l => l.id === chosenOriginId)?.label || chosenOriginId}</strong> and follow the paved walkway.</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                  2
                                </span>
                                <span>Proceed along the shaded campus road straight towards <strong>{detectedPlace.building}</strong>.</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                  3
                                </span>
                                <span>Enter the main entrance — <strong>{detectedPlace.name}</strong> is located at <strong>{detectedPlace.floor}</strong>.</span>
                              </div>
                            </div>

                            {/* Open Live Navigation Button */}
                            <button
                              onClick={() => navigate(`/map?from=${chosenOriginId}&to=${detectedPlace.id}`)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer mt-2"
                            >
                              <Navigation size={14} />
                              <span>Open Live Route on Campus Map</span>
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* Complaint Notice */}
                  {msg.isComplaint && (
                    <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      <span>Campus ticket registered. You can track this in Report Issue.</span>
                    </div>
                  )}
                </div>

                {/* Message Action Toolbar */}
                {msg.isAI && (
                  <div className="flex items-center gap-1.5 mt-1 px-1 text-slate-400">
                    <button
                      onClick={() => copyToClipboard(msg.id, msg.text)}
                      className="p-1 rounded hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                      title="Copy"
                    >
                      {copiedId === msg.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    </button>
                    <button
                      onClick={() => handleFeedback(msg.id, 'up')}
                      className={`p-1 rounded transition-colors cursor-pointer ${feedbackGiven[msg.id] === 'up' ? 'text-emerald-600' : 'hover:text-slate-700 dark:hover:text-zinc-200'}`}
                      title="Helpful"
                    >
                      <ThumbsUp size={12} />
                    </button>
                    <button
                      onClick={() => handleFeedback(msg.id, 'down')}
                      className={`p-1 rounded transition-colors cursor-pointer ${feedbackGiven[msg.id] === 'down' ? 'text-rose-500' : 'hover:text-slate-700 dark:hover:text-zinc-200'}`}
                      title="Not helpful"
                    >
                      <ThumbsDown size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-1.5 p-3 max-w-[80px] rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Bar with Voice Chat & Send Buttons */}
        <div className="p-3 sm:p-4 bg-white dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <input
              type="text"
              placeholder={isListening ? "🎙️ Listening... Speak now in your selected language!" : "Ask anything about BIT campus, locations, or placements..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs sm:text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />

            {/* Microphone Voice Chat Button */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-center cursor-pointer ${
                isListening
                  ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600 animate-pulse shadow-lg shadow-rose-500/30'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-2xs'
              }`}
              title={isListening ? "Stop listening" : `Voice Input (${SUPPORTED_LANGUAGES.find(l => l.code === voiceLang)?.label || 'Voice'})`}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Send Message Button */}
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center"
              title="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};

export default ChatPage;
