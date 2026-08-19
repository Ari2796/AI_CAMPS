import React from 'react';
import { Sparkles } from 'lucide-react';

const SuggestedChips = ({ onSelect }) => {
  const suggestions = [
    "How do I apply for Admission?",
    "What are the hostel facilities?",
    "Tell me about the CSE Department.",
    "Recent placement statistics",
    "How to pay college fees?",
    "Upcoming campus events"
  ];

  return (
    <div className="w-full overflow-x-auto pb-4 pt-2 no-scrollbar">
      <div className="flex gap-2 min-w-max px-4">
        {suggestions.map((text, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(text)}
            className="flex items-center gap-2 px-4 py-2 rounded-full glass-panel hover:bg-white/10 transition-all border-blue-500/20 hover:border-cyan-400/50 text-sm text-gray-200"
          >
            <Sparkles size={14} className="text-cyan-400" />
            {text}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SuggestedChips;
