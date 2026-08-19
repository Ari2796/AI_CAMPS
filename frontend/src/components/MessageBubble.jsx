import React from 'react';
import { User, Bot, Info } from 'lucide-react';

const MessageBubble = ({ message, isAI, timestamp, citations }) => {
  return (
    <div className={`flex w-full mb-6 ${isAI ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[85%] ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full mt-1 
          ${isAI ? 'bg-gradient-to-br from-blue-500 to-cyan-500 mr-3' : 'bg-white/10 ml-3'}`}>
          {isAI ? <Bot size={16} className="text-white" /> : <User size={16} className="text-gray-300" />}
        </div>

        {/* Message Content */}
        <div className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}>
          <div className={`px-4 py-3 rounded-2xl shadow-sm
            ${isAI 
              ? 'glass-panel rounded-tl-none border-blue-500/20 text-gray-100' 
              : 'bg-blue-600 rounded-tr-none text-white'
            }`}>
            <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{message}</p>
          </div>
          
          {/* Citations */}
          {isAI && citations && citations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {citations.map((cite, i) => (
                <span key={i} className="inline-flex items-center text-xs px-2 py-1 rounded bg-white/5 text-gray-400 border border-white/5">
                  <Info size={10} className="mr-1" /> {cite}
                </span>
              ))}
            </div>
          )}
          
          {/* Timestamp */}
          <span className="text-xs text-gray-500 mt-1 px-1">
            {timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
