/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Coins, 
  Flame, 
  Gamepad2, 
  ScrollText, 
  Camera, 
  Send, 
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Target,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GameState, Message, Transaction } from './types';
import { getChatResponse } from './services/geminiService';
import { cn } from './lib/utils';

// Speech Recognition Types
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    level: 1,
    xp: 0,
    income: 0,
    fixedExpenses: 0,
    goal: '',
    personality: 'master',
    hp: 100,
    maxHp: 100,
    transactions: [],
    isInitialized: false,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    // Setup Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'ar-SA';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const speak = (text: string) => {
    if (!isVoiceEnabled) return;
    
    // Clean markdown for speech
    const cleanText = text.replace(/[#*`_~\[\]()]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsListening(true);
      } else {
        alert('Speech recognition is not supported in this browser.');
      }
    }
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInitialize = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const income = Number(formData.get('income'));
    const fixedExpenses = Number(formData.get('fixedExpenses'));
    const goal = String(formData.get('goal'));
    const personality = (formData.get('personality') as any) || 'master';
    const maxHp = income - fixedExpenses;

    setGameState(prev => ({
      ...prev,
      income,
      fixedExpenses,
      goal,
      personality,
      maxHp,
      hp: maxHp,
      isInitialized: true,
    }));

    const welcomeMsg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: personality === 'professional' 
        ? `مرحباً بك. تم إعداد ملفك المالي بنجاح. ميزانيتك المتاحة هي \`${maxHp} ريال\`. كيف يمكنني مساعدتك في تتبع عملياتك اليوم؟`
        : personality === 'coach'
        ? `أهلاً بك يا بطل! سنعمل معاً لتحقيق هدفك: **"${goal}"**. ميزانيتك الحالية هي \`${maxHp} ريال\`. أخبرني، ماذا أنجزت اليوم؟`
        : `**أهلاً بك يا بطل الـ Feloos!** ⚔️\n\nلقد دخلت اللعبة رسمياً. ميزانيتك الصافية لهذا الشهر هي \`${maxHp} ريال\` وهي تمثل نقاط حياتك (HP). \n\nهدفك (البوص): **"${goal}"** 👹\n\nأنا هنا لأراقب تحركاتك. كيف صرفت اليوم؟`,
      timestamp: Date.now(),
    };
    setMessages([welcomeMsg]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !image) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      image: image || undefined,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setImage(null);
    setIsTyping(true);

    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }]
      }));

      const response = await getChatResponse(userMsg.content, history, gameState.personality, userMsg.image);
      
      // Extract JSON if present
      let finalContent = response;
      let transactionData: any = null;
      
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          transactionData = JSON.parse(jsonMatch[1]).transaction;
          // Strip JSON from visible content
          finalContent = response.replace(/```json\n[\s\S]*?\n```/, '').trim();
        } catch (e) {
          console.error("Failed to parse transaction JSON", e);
        }
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: finalContent,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      speak(finalContent);
      
      // Update state if transaction detected
      setGameState(prev => {
        let newHp = prev.hp;
        let newTransactions = [...prev.transactions];
        
        if (transactionData) {
          newHp = Math.max(0, prev.hp + transactionData.hpImpact);
          const newTx: Transaction = {
            id: Date.now().toString(),
            amount: transactionData.amount,
            description: transactionData.description,
            category: transactionData.category,
            timestamp: Date.now(),
            feedback: finalContent,
          };
          newTransactions.push(newTx);
        }

        const newXp = prev.xp + (transactionData ? 30 : 10);
        const levelUp = Math.floor(newXp / 100) + 1;
        
        return {
          ...prev,
          xp: newXp,
          level: levelUp,
          hp: newHp,
          transactions: newTransactions
        };
      });

    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const hpPercentage = Math.max(0, (gameState.hp / gameState.maxHp) * 100);

  if (!gameState.isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a0a0c] to-[#1a1a24]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full game-card p-8 space-y-6"
        >
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600"> Salam AI </h1>
            <p className="text-gray-400">The Feloos Master is watching...</p>
          </div>

          <form onSubmit={handleInitialize} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-mono text-gray-500 uppercase">Monthly Income (الراتب)</label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                <input 
                  required
                  name="income"
                  type="number"
                  placeholder="0.00"
                  className="w-full bg-[#0a0a0c] border border-[#2d2d35] rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-gray-500 uppercase">Fixed Expenses (الالتزامات)</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                <input 
                  required
                  name="fixedExpenses"
                  type="number"
                  placeholder="0.00"
                  className="w-full bg-[#0a0a0c] border border-[#2d2d35] rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-gray-500 uppercase">Financial Boss (الهدف)</label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                <input 
                  required
                  name="goal"
                  type="text"
                  placeholder="e.g. Buying a new PC"
                  className="w-full bg-[#0a0a0c] border border-[#2d2d35] rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-gray-500 uppercase">Personality (الشخصية)</label>
              <div className="grid grid-cols-3 gap-2">
                <label className="cursor-pointer group">
                  <input type="radio" name="personality" value="master" defaultChecked className="hidden peer" />
                  <div className="p-2 border border-[#2d2d35] rounded-lg text-center peer-checked:border-green-500 peer-checked:bg-green-500/10 group-hover:border-[#3d3d45] transition-all">
                    <span className="text-xs block"> Master 👹</span>
                  </div>
                </label>
                <label className="cursor-pointer group">
                  <input type="radio" name="personality" value="coach" className="hidden peer" />
                  <div className="p-2 border border-[#2d2d35] rounded-lg text-center peer-checked:border-blue-500 peer-checked:bg-blue-500/10 group-hover:border-[#3d3d45] transition-all">
                    <span className="text-xs block"> Coach 🧘</span>
                  </div>
                </label>
                <label className="cursor-pointer group">
                  <input type="radio" name="personality" value="professional" className="hidden peer" />
                  <div className="p-2 border border-[#2d2d35] rounded-lg text-center peer-checked:border-indigo-500 peer-checked:bg-indigo-500/10 group-hover:border-[#3d3d45] transition-all">
                    <span className="text-xs block"> Pro 💼</span>
                  </div>
                </label>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg shadow-green-900/20"
            >
              <Gamepad2 className="w-5 h-5" />
              START THE MISSION
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-game-bg text-slate-100 font-sans overflow-hidden" dir="rtl">
      {/* TOP HUD: Character Stats */}
      <header className="flex flex-col md:flex-row justify-between items-center hud-gradient border-b-2 border-game-border p-4 shadow-2xl z-20">
        <div className="flex items-center gap-4 mb-4 md:mb-0 w-full md:w-auto">
          <div className="relative">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg flex items-center justify-center border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              <span className="text-3xl">👹</span>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full border border-black">
              LVL {gameState.level}
            </div>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white uppercase">محارب الثروة: سلام</h1>
            <p className="text-[10px] text-slate-400 font-mono italic opacity-80 whitespace-nowrap">"الفلوس وسخ دنيا.. بس أنا بحب النظافة!"</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full md:w-auto">
          {/* HP BAR */}
          <div className="w-full sm:w-48">
            <div className="flex justify-between text-[10px] font-bold mb-1">
              <span className="text-emerald-400 uppercase tracking-widest">الطاقة المالية (HP)</span>
              <span className="font-mono text-slate-300">{gameState.hp} / {gameState.maxHp}</span>
            </div>
            <div className="hp-bar-bg">
              <div 
                className={cn(
                  "hp-bar-fill shadow-[0_0_10px_rgba(52,211,153,0.5)]",
                  hpPercentage > 50 ? "bg-gradient-to-l from-emerald-600 to-emerald-400" : hpPercentage > 20 ? "bg-gradient-to-l from-yellow-600 to-yellow-400" : "bg-gradient-to-l from-red-600 to-red-400"
                )}
                style={{ width: `${hpPercentage}%` }}
              />
            </div>
          </div>
          
          {/* XP BAR */}
          <div className="w-full sm:w-48">
            <div className="flex justify-between text-[10px] font-bold mb-1">
              <span className="text-indigo-400 uppercase tracking-widest">الخبرة (XP)</span>
              <span className="font-mono text-slate-300">{gameState.xp % 100} / 100</span>
            </div>
            <div className="hp-bar-bg">
              <div 
                className="h-full bg-gradient-to-l from-indigo-600 to-indigo-400 rounded-full shadow-[0_0_10px_rgba(129,140,248,0.5)] transition-all duration-300"
                style={{ width: `${gameState.xp % 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN GAME AREA */}
      <main className="flex flex-1 gap-4 p-2 md:p-4 min-h-0 overflow-hidden relative flex-col lg:flex-row">
        {/* Animated Background Highlights */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

        {/* STATS PANEL FOR MOBILE (Visible only on mobile/tablet) */}
        <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 scrollbar-none">
          <div className="flex-none p-3 bg-gradient-to-br from-slate-800/80 to-game-card border border-slate-700 rounded-xl shadow-xl min-w-[200px]">
            <div className="text-[8px] text-slate-500 uppercase tracking-widest mb-1">السيولة</div>
            <div className="text-xl font-black text-emerald-400 font-mono">
              {gameState.hp.toLocaleString()}<span className="text-xs ml-1">﷼</span>
            </div>
          </div>
          <div className="flex-none p-3 bg-game-card/50 border border-slate-700/50 rounded-xl flex items-center gap-3 min-w-[180px]">
             <div className="text-3xl shrink-0">💻</div>
             <div className="overflow-hidden">
                <div className="text-[8px] text-slate-500 uppercase truncate">وحش {gameState.goal}</div>
                <div className="h-1 bg-slate-800 rounded-full mt-1">
                  <div className="h-full bg-red-500 w-[40%]" />
                </div>
             </div>
          </div>
        </div>

        {/* LEFT RAIL: The Boss (Desktop only) */}
        <aside className="hidden lg:flex w-64 flex-col gap-4">
          <div className="flex-1 bg-game-card/50 border border-slate-700/50 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 p-2 text-[8px] text-slate-500 font-mono">BOSS_RAID_v1</div>
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-500 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">💻</div>
            <h3 className="text-sm font-bold text-slate-200">وحش الـ {gameState.goal}</h3>
            <div className="w-full mt-4 bg-slate-900/50 rounded border border-slate-800 p-3">
              <div className="text-[10px] mb-2 text-slate-400">حالة الهجوم</div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500/80 transition-all duration-1000"
                  style={{ width: `${Math.min(100, (gameState.xp / 1000) * 100)}%` }}
                />
              </div>
              <p className="text-[9px] mt-2 text-red-400 italic">"الوحش بانتظارك.. جمّع XP!"</p>
            </div>
          </div>

          <div className="bg-game-card border border-game-border rounded-xl p-4">
            <h4 className="text-[10px] font-bold text-slate-500 mb-3 border-b border-slate-700 pb-2 uppercase tracking-widest">العتاد المالي</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-800/50 p-2 rounded text-center border border-emerald-900/30 hover:border-emerald-500/50 transition-colors">
                <Shield className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                <div className="text-[8px] text-slate-400 uppercase">درع الحماية</div>
              </div>
              <div className="bg-slate-800/50 p-2 rounded text-center border border-indigo-900/30 hover:border-indigo-500/50 transition-colors">
                <Flame className="w-5 h-5 mx-auto mb-1 text-indigo-400" />
                <div className="text-[8px] text-slate-400 uppercase">نصل الادخار</div>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER: Battle Log (Chat) */}
        <section className="flex-1 flex flex-col bg-slate-900/40 border border-slate-800/60 rounded-xl overflow-hidden shadow-inner relative">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scrollbar-thin">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: msg.role === 'user' ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex items-start gap-3",
                    msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-lg",
                    msg.role === 'user' 
                      ? "bg-indigo-900/30 border-indigo-500 text-indigo-400" 
                      : "bg-slate-800 border-slate-600 text-slate-400"
                  )}>
                    {msg.role === 'user' ? '👤' : '🤖'}
                  </div>
                  
                  <div className={cn(
                    "max-w-[85%] p-4 rounded-xl shadow-xl animate-slide-in",
                    msg.role === 'user' 
                      ? "bg-indigo-900/20 border border-indigo-900/50 text-indigo-50" 
                      : "bg-slate-800/40 border border-slate-800/60 text-slate-200"
                  )}>
                    {msg.image && (
                      <img src={msg.image} alt="Upload" className="rounded-lg mb-3 max-h-48 object-cover border border-white/5" />
                    )}
                    <div className="markdown-body text-sm leading-relaxed">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    <div className="mt-2 text-[9px] font-mono opacity-30 text-left">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && (
              <div className="flex gap-1 p-3 bg-slate-800/30 rounded-lg w-14">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Action Input Bar */}
          <div className="p-4 bg-game-card/80 border-t border-slate-800">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <div className="flex-1 relative">
                <input 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="سجل حركتك المالية القادمة..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 px-4 pr-20 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-500">
                  <button 
                    type="button"
                    onClick={toggleListening}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      isListening ? "bg-red-500/20 text-red-500 animate-pulse" : "hover:text-indigo-400"
                    )}
                    title="تحدث"
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                    className="p-1.5 hover:text-indigo-400 transition-colors"
                    title={isVoiceEnabled ? "إيقاف الصوت" : "تشغيل الصوت"}
                  >
                    {isVoiceEnabled ? <Volume2 className="w-5 h-5 text-indigo-400" /> : <VolumeX className="w-5 h-5" />}
                  </button>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 hover:text-indigo-400 transition-colors"
                  >
                    <Camera className={cn("w-5 h-5", image ? "text-emerald-500" : "")} />
                  </button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
              </div>
              <button 
                type="submit"
                disabled={(!inputText.trim() && !image) || isTyping}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-bold text-sm shadow-[0_4px_0_rgb(67,56,202)] active:translate-y-1 active:shadow-none transition-all flex items-center gap-2"
              >
                <span>إرسال</span>
              </button>
            </form>
          </div>
        </section>

        {/* RIGHT RAIL: Stats & Inventory */}
        <aside className="hidden xl:flex w-72 flex-col gap-4">
          <div className="bg-gradient-to-b from-slate-800/80 to-game-card border border-slate-700 rounded-xl p-5 shadow-xl">
            <div className="text-center mb-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">السيولة المتوفرة</div>
              <div className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">
                {gameState.hp.toLocaleString()}<span className="text-sm ml-1">﷼</span>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t border-slate-700/50">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400">الدخل الشهري:</span>
                <span className="text-white font-mono">+{gameState.income}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400">مصاريف ثابتة:</span>
                <span className="text-red-400 font-mono">-{gameState.fixedExpenses}</span>
              </div>
              <div className="h-px bg-slate-800 my-2"></div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-bold uppercase">الصافي المتبقي:</span>
                <span className="text-emerald-400 font-bold font-mono">+{gameState.maxHp}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-game-card/40 border border-slate-800 rounded-xl p-4 overflow-hidden flex flex-col">
            <h4 className="text-[10px] font-bold text-slate-500 mb-3 border-b border-slate-700 pb-2 uppercase tracking-widest italic">سجل العمليات</h4>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {gameState.transactions.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-800 rounded-lg text-center opacity-30">
                  <Gamepad2 className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-[9px]">بانتظار الحركة الأولى...</p>
                </div>
              ) : (
                gameState.transactions.slice().reverse().map(t => (
                  <div key={t.id} className="p-2 bg-slate-900/40 border border-slate-800/60 rounded flex justify-between items-center group hover:border-slate-600 transition-colors">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        t.category === 'saving' ? "bg-emerald-500" : t.category === 'need' ? "bg-blue-500" : "bg-red-500"
                      )} />
                      <span className="text-[10px] text-slate-300 truncate">{t.description}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">{t.amount}﷼</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* FOOTER: System Status */}
      <footer className="px-6 py-2 hidden md:flex justify-between items-center text-[9px] font-mono text-slate-600 border-t border-slate-800/50 bg-[#07090d]">
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> STATUS: ONLINE</span>
          <span className="hidden sm:inline">XP_MULT: 1.0x</span>
          <span className="text-indigo-500/60">SYSTEM: SALAM_AI_v1.0.4</span>
        </div>
        <div className="opacity-50">
          © 2024 SALAM AI - THE FELOOS MASTER
        </div>
      </footer>
    </div>
  );
}
