'use client';

import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AISidebar: React.FC = () => {
  const { isAiSidebarOpen, toggleAiSidebar, createTask } = useStore();
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([
    {
      role: 'ai',
      text: '👋 Welcome! I have analyzed the current project state. I can analyze risks or generate a simple schedule optimization plan for you.'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    if (!inputVal.trim()) return;
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', text: inputVal }]);
    const currentInput = inputVal;
    setInputVal('');
    setIsTyping(true);

    // Mock AI response
    setTimeout(() => {
      setIsTyping(false);
      
      // Simple mock logic for demonstration
      if (currentInput.toLowerCase().includes('task') || currentInput.includes('任务')) {
        setMessages(prev => [...prev, { 
          role: 'ai', 
          text: 'Sure, I have created a new task for you. Check it out!' 
        }]);
        createTask({
          title: 'AI Generated Task',
          status: 'todo',
          priority: 'medium',
          plannedStart: '2026-05-15',
          plannedEnd: '2026-05-18',
          progress: 0
        });
      } else {
        setMessages(prev => [...prev, { 
          role: 'ai', 
          text: 'I have received your feedback. The project schedule recommendations will be dynamically updated for better execution. Is there anything else you need help with?' 
        }]);
      }
    }, 1000);
  };

  return (
    <AnimatePresence>
      {isAiSidebarOpen && (
        <motion.aside 
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 300, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          className="h-full border-l border-slate-200 bg-slate-50 flex flex-col shrink-0 z-20 overflow-hidden"
        >
          <div className="w-[300px] flex flex-col h-full bg-slate-50">
            <div className="h-14 px-4 flex items-center border-b border-slate-200 bg-white shrink-0">
              <span className="p-1.5 bg-indigo-100 rounded text-indigo-600 mr-2 flex items-center justify-center text-lg leading-none">🤖</span>
              <h2 className="text-sm font-bold text-slate-800">AI Assistant</h2>
              <button onClick={toggleAiSidebar} className="ml-auto text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-sm hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-500 text-lg leading-none">🚨</span>
                  <h3 className="text-xs font-bold text-red-900">Delay Risk Warning</h3>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">
                  Frontend infrastructure development is falling behind. This could delay downstream development by <strong>3 days</strong> if not adjusted.
                </p>
                <button 
                  onClick={() => {
                    setMessages(prev => [...prev, { role: 'user', text: 'Accept Schedule Adjustments' }]);
                    setIsTyping(true);
                    setTimeout(() => {
                      setIsTyping(false);
                      setMessages(prev => [...prev, { role: 'ai', text: 'Schedule recommendations accepted. All affected tasks have been postponed accordingly.' }]);
                    }, 800);
                  }}
                  className="mt-3 w-full py-1.5 bg-red-600 text-white text-[10px] font-bold rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                >
                  ⚡ Accept Schedule Adjustments
                </button>
              </div>

              <div className="text-center mt-2">
                <span className="text-[10px] text-slate-400 font-medium bg-slate-200/50 px-2 py-1 rounded">Current Session</span>
              </div>

              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`
                    max-w-[85%] p-3 rounded-2xl shadow-sm text-xs leading-normal
                    ${msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}
                  `}>
                    {msg.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5 w-12">
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <div className="relative">
                <input 
                  type="text" 
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask AI to help with scheduling..." 
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
                />
                <button 
                  onClick={handleSend}
                  disabled={!inputVal.trim() || isTyping}
                  className="absolute right-2 top-[5px] p-[5px] bg-indigo-600 text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center justify-center"
                >
                  <Send size={14} />
                </button>
              </div>
              <p className="text-[9px] text-slate-400 text-center mt-2 font-medium">
                Current Model: <span className="text-indigo-500">Gemini 1.5 Pro</span>
              </p>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
