import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Menu, Send, Plus, RefreshCw, ShieldAlert, Globe, 
  Briefcase, Trash2, ShieldCheck, Copy, 
  X, Newspaper, Lightbulb, Target,
  Clock, ExternalLink, User, CloudUpload, 
  LogOut, FileCheck, BookOpen, Award,
  History, TrendingUp, Pin, PinOff, Mic, MicOff, ArrowLeft, Calendar, Bell, ChevronRight,
  Edit2, Save, Trash, Phone, Loader2, Search, Sparkles, Zap, Layers
} from 'lucide-react';
import Navigation from './components/Navigation';
import MarkdownRenderer from './components/MarkdownRenderer';
import ShareButton from './components/ShareButton';
import IncidentChart from './components/IncidentChart';
import { 
  View, ChatMessage, StoredReport, 
  WeeklyTip, UserProfile, SecurityRole, StoredTrainingModule
} from './types';
import { STATIC_TEMPLATES, SECURITY_TRAINING_DB } from './constants';
import { 
  analyzeReportStream, generateWeeklyTip, 
  generateAdvisorStream,
  generateTrainingModuleStream,
  fetchBestPracticesStream,
  getSuggestedTopics
} from './services/geminiService';
import { syncVaultToCloud } from './services/firebaseService';

const AntiRiskLogo = ({ className = "w-24 h-24", light = false }: { className?: string; light?: boolean }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M50 5 L95 85 L5 85 Z" fill={light ? "#1e293b" : "#000000"} />
    <path d="M50 15 L85 80 L15 80 Z" fill={light ? "#334155" : "#000000"} />
    <circle cx="50" cy="55" r="30" fill="white" />
    <text x="50" y="68" fontFamily="Arial, sans-serif" fontSize="38" fontWeight="bold" fill="black" textAnchor="middle">AR</text>
    <rect x="0" y="85" width="100" height="15" fill="#000" />
    <text x="50" y="96" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="bold" fill="white" textAnchor="middle">ANTI-RISK SECURITY</text>
  </svg>
);

const safeParse = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
};

const formatChatTimeFull = (timestamp: number) => {
  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr}, ${timeStr}`;
};

const getDateHeader = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  
  return date.toLocaleDateString([], { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric', 
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
  });
};

function App() {
  const [appState, setAppState] = useState<'SPLASH' | 'PIN_ENTRY' | 'PIN_SETUP' | 'READY'>('SPLASH');
  const [pinInput, setPinInput] = useState('');
  const [setupStep, setSetupStep] = useState(1);
  const [tempPin, setTempPin] = useState('');
  const [isPinError, setIsPinError] = useState(false);
  const [splashProgress, setSplashProgress] = useState(0);
  const [storedPin, setStoredPin] = useState<string | null>(() => localStorage.getItem('security_app_vault_pin'));
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [advisorTab, setAdvisorTab] = useState<'CHAT' | 'PINNED'>('CHAT');

  const [notification, setNotification] = useState<{ 
    message: string; 
    type: 'success' | 'info' | 'syncing' | 'warning';
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [userProfile, setUserProfile] = useState<UserProfile>(() => 
    safeParse('security_app_profile', { name: '', phoneNumber: '', email: '', preferredChannel: 'WhatsApp' })
  );

  const [messages, setMessages] = useState<ChatMessage[]>(() => 
    safeParse('security_app_chat', [{
      id: 'welcome',
      role: 'model',
      text: `Good day, CEO. Tactical Core is active. How can I assist your operations today?`,
      timestamp: Date.now(),
      isPinned: false
    }])
  );

  const [storedReports, setStoredReports] = useState<StoredReport[]>(() => safeParse('security_app_reports', []));
  const [weeklyTips, setWeeklyTips] = useState<WeeklyTip[]>(() => safeParse('security_app_weekly_tips', []));
  const [savedTraining, setSavedTraining] = useState<StoredTrainingModule[]>(() => safeParse('security_app_training', []));
  const [globalTrends, setGlobalTrends] = useState<{ text: string; sources?: Array<{ title: string; url: string }>; lastSync?: number } | null>(() => safeParse('security_app_trends', null));

  const [inputMessage, setInputMessage] = useState('');
  const [isAdvisorThinking, setAdvisorThinking] = useState(false);
  const [reportText, setReportText] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTipLoading, setIsTipLoading] = useState(false);
  const [isTrendsLoading, setIsTrendsLoading] = useState(false);

  const [trainingTarget, setTrainingTarget] = useState<SecurityRole>(SecurityRole.GUARD);
  const [trainingWeek, setTrainingWeek] = useState<number>(1);
  const [trainingTopic, setTrainingTopic] = useState('');
  const [tipTopic, setTipTopic] = useState('');
  const [isTrainingLoading, setIsTrainingLoading] = useState(false);
  const [trainingStreamText, setTrainingStreamText] = useState('');
  const [lastGeneratedTopic, setLastGeneratedTopic] = useState('');

  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [isSuggestingTopics, setIsSuggestingTopics] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionTimeoutRef = useRef<number | null>(null);

  const [editingTipId, setEditingTipId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [editedTopic, setEditedTopic] = useState('');

  useEffect(() => { localStorage.setItem('security_app_profile', JSON.stringify(userProfile)); }, [userProfile]);
  useEffect(() => { localStorage.setItem('security_app_chat', JSON.stringify(messages)); }, [messages]);
  useEffect(() => { localStorage.setItem('security_app_reports', JSON.stringify(storedReports)); }, [storedReports]);
  useEffect(() => { localStorage.setItem('security_app_weekly_tips', JSON.stringify(weeklyTips)); }, [weeklyTips]);
  useEffect(() => { localStorage.setItem('security_app_training', JSON.stringify(savedTraining)); }, [savedTraining]);
  useEffect(() => { localStorage.setItem('security_app_trends', JSON.stringify(globalTrends)); }, [globalTrends]);

  const showNotification = (
    message: string, 
    type: 'success' | 'info' | 'syncing' | 'warning' = 'success',
    actionLabel?: string,
    onAction?: () => void
  ) => {
    setNotification({ message, type, actionLabel, onAction });
    if (type !== 'syncing' && !actionLabel) {
      setTimeout(() => setNotification(null), 4000);
    } else if (actionLabel) {
      setTimeout(() => setNotification(prev => prev?.actionLabel === actionLabel ? null : prev), 8000);
    }
  };

  useEffect(() => {
    if (appState === 'READY') {
      const checkAndSyncTips = async () => {
        const lastTip = weeklyTips[0];
        const weekInMs = 7 * 24 * 60 * 60 * 1000;
        const isStale = lastTip ? (Date.now() - lastTip.timestamp > weekInMs) : true;

        if (isStale && !isTipLoading) {
          showNotification("Automated Strategic Sync Initiated", "syncing");
          await handleSyncDirective();
        }
      };
      
      const timer = setTimeout(checkAndSyncTips, 2000);
      return () => clearTimeout(timer);
    }
  }, [appState]);

  const startVoiceInput = useCallback((targetSetter: (val: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      targetSetter(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening]);

  const handleError = (error: any) => {
    const errorString = typeof error === 'string' ? error : JSON.stringify(error);
    const errorMsg = error?.message || "Operational system delay. Retrying...";
    
    if (errorString.toUpperCase().includes('RESOURCE_EXHAUSTED') || errorString.includes('429')) {
      setApiError("Tactical Core Quota Exceeded. The system is currently at capacity. Please wait 60 seconds or upgrade your API key for higher throughput.");
      showNotification("System Saturation: Quota Limit Reached", "warning");
    } else if (errorMsg.includes("saturated") || errorMsg.includes("congested")) {
      showNotification(errorMsg, "warning");
    } else {
      setApiError(errorMsg);
      setTimeout(() => setApiError(null), 8000);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isAdvisorThinking) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: inputMessage, timestamp: Date.now(), isPinned: false };
    const aiId = Date.now().toString() + 'ai';
    const initialAiMsg: ChatMessage = { id: aiId, role: 'model', text: '', timestamp: Date.now(), isPinned: false };
    
    setMessages(prev => [...prev, userMsg, initialAiMsg]);
    const currentInput = inputMessage;
    setInputMessage('');
    setAdvisorThinking(true);
    setAdvisorTab('CHAT');
    
    try {
      await generateAdvisorStream(
        messages, 
        currentInput,
        (text) => setMessages(prev => prev.map(m => m.id === aiId ? { ...m, text } : m)),
        (sources) => setMessages(prev => prev.map(m => m.id === aiId ? { ...m, sources } : m))
      );
    } catch (err) { 
      handleError(err);
      setMessages(prev => prev.filter(m => m.id !== aiId));
    } finally { 
      setAdvisorThinking(false); 
    }
  };

  const handleClearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'model',
      text: `Good day, CEO. Tactical Core is active. How can I assist your operations today?`,
      timestamp: Date.now(),
      isPinned: false
    }]);
  };

  const togglePinMessage = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isPinned: !m.isPinned } : m));
  };

  const handleSyncDirective = async () => {
    if (isTipLoading) return;
    setIsTipLoading(true);
    try {
      const content = await generateWeeklyTip();
      const newTip: WeeklyTip = { 
        id: Date.now().toString(), 
        weekDate: new Date().toLocaleDateString(), 
        topic: tipTopic || "Strategic Executive Directive", 
        content, 
        isAutoGenerated: true, 
        timestamp: Date.now() 
      };
      setWeeklyTips(prev => [newTip, ...prev]);
      setTipTopic('');
      
      showNotification(
        "Strategic Intelligence Sync Complete", 
        "success", 
        "EDIT", 
        () => {
          setCurrentView(View.WEEKLY_TIPS);
          setEditingTipId(newTip.id);
          setEditedTopic(newTip.topic);
          setEditedContent(newTip.content);
          setNotification(null);
        }
      );
    } catch (err) { 
      handleError(err); 
      setNotification(null);
    } finally { 
      setIsTipLoading(false); 
    }
  };

  const handleUpdateTip = (id: string) => {
    setWeeklyTips(prev => prev.map(tip => tip.id === id ? { ...tip, topic: editedTopic, content: editedContent } : tip));
    setEditingTipId(null);
    setEditedContent('');
    setEditedTopic('');
  };

  const handleDeleteTip = (id: string) => {
    setWeeklyTips(prev => prev.filter(tip => tip.id !== id));
    if (editingTipId === id) setEditingTipId(null);
  };

  const handleClearAllTips = () => {
    setWeeklyTips(prev => prev.filter(tip => !tip.isAutoGenerated));
  };

  const handleSyncTrends = async () => {
    if (isTrendsLoading) return;
    setIsTrendsLoading(true);
    let trendText = "";
    try {
      await fetchBestPracticesStream(undefined, 
        (text) => trendText = text,
        (sources) => {
          setGlobalTrends({ text: trendText, sources, lastSync: Date.now() });
          setCurrentView(View.NEWS_BLOG);
          showNotification("Regulatory Intel Synced");
        }
      );
    } catch (err) { handleError(err); } finally { setIsTrendsLoading(false); }
  };

  const handleGenerateTraining = async () => {
    if (!trainingTopic || isTrainingLoading) return;
    const currentTopic = trainingTopic;
    const currentRole = trainingTarget;
    const currentWeek = trainingWeek;

    setIsTrainingLoading(true);
    setTrainingStreamText('');
    setLastGeneratedTopic(currentTopic);
    setShowSuggestions(false);
    
    try {
      await generateTrainingModuleStream(currentTopic, currentWeek, currentRole, 
        (text) => setTrainingStreamText(text),
        () => {
          const newModule: StoredTrainingModule = {
            id: Date.now().toString(),
            targetAudience: currentRole,
            topic: `${currentTopic} (${currentRole} - Week ${currentWeek})`,
            content: '', 
            generatedDate: new Date().toLocaleDateString(),
            timestamp: Date.now()
          };
          
          setSavedTraining(prev => {
             newModule.content = trainingStreamText;
             return [newModule, ...prev];
          });

          showNotification("Syllabus Architected & Archived");
        }
      );
    } catch (err) { 
      handleError(err); 
    } finally { 
      setIsTrainingLoading(false); 
    }
  };

  const handleAnalyzeReport = async () => {
    if (!reportText.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisResult('');
    try {
      await analyzeReportStream(reportText, 'GENERAL',
        (text) => setAnalysisResult(text),
        (fullText) => {
          setStoredReports(prev => [{ id: Date.now().toString(), timestamp: Date.now(), dateStr: new Date().toLocaleDateString(), content: reportText, analysis: fullText }, ...prev]);
          showNotification("Audit Complete: Strategic Findings Logged");
        }
      );
    } catch (err) { handleError(err); } finally { setIsAnalyzing(false); }
  };

  const handleTopicChange = (val: string) => {
    setTrainingTopic(val);
    if (!val.trim()) {
      setTopicSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const localMatches: string[] = [];
    Object.values(SECURITY_TRAINING_DB).forEach(list => {
      list.forEach(item => {
        if (item.toLowerCase().includes(val.toLowerCase()) && !localMatches.includes(item)) {
          localMatches.push(item);
        }
      });
    });

    setTopicSuggestions(localMatches.slice(0, 5));
    setShowSuggestions(true);

    if (suggestionTimeoutRef.current) window.clearTimeout(suggestionTimeoutRef.current);
    suggestionTimeoutRef.current = window.setTimeout(async () => {
      if (val.length >= 3) {
        setIsSuggestingTopics(true);
        try {
          const aiSugs = await getSuggestedTopics(val);
          setTopicSuggestions(prev => {
            const combined = [...prev, ...aiSugs.filter(s => !prev.includes(s))];
            return combined.slice(0, 8);
          });
        } catch (e) {
          console.error("Suggestion error", e);
        } finally {
          setIsSuggestingTopics(false);
        }
      }
    }, 800);
  };

  const selectSuggestion = (s: string) => {
    setTrainingTopic(s);
    setShowSuggestions(false);
    if (suggestionTimeoutRef.current) window.clearTimeout(suggestionTimeoutRef.current);
  };

  useEffect(() => {
    if (appState === 'SPLASH') {
      const timer = setInterval(() => {
        setSplashProgress(prev => {
          if (prev >= 100) {
            clearInterval(timer);
            setTimeout(() => setAppState(storedPin ? 'PIN_ENTRY' : 'PIN_SETUP'), 400);
            return 100;
          }
          return prev + 5;
        });
      }, 50);
      return () => clearInterval(timer);
    }
  }, [appState, storedPin]);

  const handlePinDigit = (digit: string) => {
    if (pinInput.length >= 4) return;
    const newPin = pinInput + digit;
    setPinInput(newPin);
    if (newPin.length === 4) {
      if (appState === 'PIN_ENTRY') {
        if (newPin === storedPin) setAppState('READY');
        else { 
          setIsPinError(true); 
          setTimeout(() => {
            setPinInput(''); 
            setIsPinError(false);
          }, 500); 
        }
      } else {
        if (setupStep === 1) { 
          setTempPin(newPin); 
          setSetupStep(2); 
          setPinInput(''); 
        } else {
          if (newPin === tempPin) { 
            localStorage.setItem('security_app_vault_pin', newPin); 
            setStoredPin(newPin); 
            setAppState('READY');
          } else { 
            setIsPinError(true); 
            setSetupStep(1); 
            setPinInput(''); 
          }
        }
      }
    }
  };

  const displayedMessages = advisorTab === 'CHAT' ? messages : messages.filter(m => m.isPinned);

  const ViewHeader = ({ title, subtitle, onExit }: { title: string; subtitle?: string; onExit: () => void }) => (
    <div className="flex justify-between items-center mb-6 sm:mb-10 border-b border-slate-800 pb-6 sm:pb-8 animate-in slide-in-from-top-4 duration-500">
      <div className="flex-1 min-w-0 pr-4">
        <h2 className="text-xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter text-white truncate">
          {title.split(' ').slice(0, -1).join(' ')} <span className="text-blue-500">{title.split(' ').pop()}</span>
        </h2>
        {subtitle && <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1 sm:mt-2 truncate">{subtitle}</p>}
      </div>
      <button 
        onClick={onExit}
        className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl sm:rounded-2xl border border-slate-700/50 transition-all active:scale-95 group shadow-xl shrink-0"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">Exit</span>
      </button>
    </div>
  );

  if (appState === 'SPLASH') return (
    <div className="fixed inset-0 bg-[#0a0f1a] flex flex-col items-center justify-center p-6 z-[200]">
      <AntiRiskLogo className="w-20 h-20 mb-10 animate-pulse-blue" light={true} />
      <div className="w-full max-w-[240px] space-y-5 text-center">
        <div className="h-1 bg-slate-800/50 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all duration-300 shadow-[0_0_15px_rgba(37,99,235,0.4)]" style={{ width: `${splashProgress}%` }}></div>
        </div>
        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Encrypting Operations...</p>
      </div>
    </div>
  );

  if (appState === 'PIN_ENTRY' || appState === 'PIN_SETUP') return (
    <div className="fixed inset-0 bg-[#0a0f1a] flex flex-col items-center justify-center p-6 z-[200]">
      <AntiRiskLogo className="w-14 h-14 mb-8" />
      <h2 className="text-lg sm:text-xl font-bold text-white mb-8 tracking-widest uppercase text-center px-4">
        {appState === 'PIN_SETUP' ? (setupStep === 1 ? 'Create Vault PIN' : 'Confirm Vault PIN') : 'Secure Entry'}
      </h2>
      <div className="flex gap-4 sm:gap-5 mb-12">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 transition-all duration-300 ${pinInput.length > i ? (isPinError ? 'bg-red-500 border-red-500 scale-110' : 'bg-blue-500 border-blue-500 scale-110 shadow-[0_0_10px_rgba(37,99,235,0.5)]') : 'border-slate-800'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-[280px]">
        {[1,2,3,4,5,6,7,8,9].map(num => (
          <button key={num} onClick={() => handlePinDigit(num.toString())} className="aspect-square bg-slate-800/30 border border-slate-700/50 rounded-2xl text-xl font-bold text-white flex items-center justify-center hover:bg-slate-800/60 active:scale-95 transition-all">{num}</button>
        ))}
        <button onClick={() => setPinInput('')} className="aspect-square bg-slate-800/30 border border-slate-700/50 rounded-2xl flex items-center justify-center text-red-500 active:scale-95"><Trash2 size={24} /></button>
        <button onClick={() => handlePinDigit('0')} className="aspect-square bg-slate-800/30 border border-slate-700/50 rounded-2xl text-xl font-bold text-white flex items-center justify-center hover:bg-slate-800/60 active:scale-95 transition-all">0</button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] bg-[#0a0f1a] text-slate-100 overflow-hidden relative">
      <Navigation 
        currentView={currentView} 
        setView={setCurrentView} 
        isMobileMenuOpen={isMobileMenuOpen} 
        closeMobileMenu={() => setIsMobileMenuOpen(false)} 
        onOpenSettings={() => setShowSettings(true)} 
      />
      
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative w-full">
        <div className="lg:hidden h-14 sm:h-16 border-b border-slate-800/40 flex justify-between items-center px-4 sm:px-6 bg-[#0a1222]/95 backdrop-blur-md z-[80] shrink-0">
          <div className="flex items-center gap-2 sm:gap-3" onClick={() => setCurrentView(View.DASHBOARD)}>
            <AntiRiskLogo className="w-7 h-7 sm:w-8 sm:h-8" />
            <h1 className="font-black text-xs sm:text-sm text-white uppercase tracking-widest">AntiRisk</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-white bg-slate-800/50 rounded-lg sm:rounded-xl hover:bg-slate-800 transition-colors">
            <Menu size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 lg:p-14 scrollbar-hide pb-20 sm:pb-24">
          
          {notification && (
            <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top-4 duration-300 pointer-events-none w-full max-w-xs sm:max-w-md px-4">
              <div className={`bg-slate-900/90 backdrop-blur-2xl border ${notification.type === 'syncing' ? 'border-blue-500/30' : notification.type === 'warning' ? 'border-amber-500/30' : 'border-emerald-500/30'} px-5 py-3.5 rounded-2xl flex items-center gap-4 shadow-2xl ring-1 ring-white/10 transition-colors duration-500`}>
                <div className={`w-10 h-10 rounded-xl ${notification.type === 'syncing' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : notification.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'} flex items-center justify-center shrink-0 border`}>
                  {notification.type === 'syncing' ? <RefreshCw size={20} className="animate-spin" /> : notification.type === 'warning' ? <Zap size={20} className="animate-bounce" /> : <ShieldCheck size={20} className="animate-pulse" />}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] text-white truncate">
                    {notification.type === 'syncing' ? 'Automated Ops Sync' : notification.type === 'warning' ? 'Link Saturation' : 'Operational Alert'}
                  </p>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                    {notification.message}
                  </p>
                </div>
                {notification.actionLabel && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); notification.onAction?.(); }}
                    className="ml-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg active:scale-95 transition-all pointer-events-auto shrink-0 border border-blue-400/50"
                  >
                    {notification.actionLabel}
                  </button>
                )}
              </div>
            </div>
          )}

          {apiError && (
            <div className="max-w-4xl mx-auto mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-top-4 shadow-lg">
              <div className="flex items-center gap-3">
                <ShieldAlert className="text-red-500 shrink-0" size={18} />
                <p className="text-red-200 font-bold text-[10px] sm:text-xs md:text-sm leading-tight">{apiError}</p>
              </div>
              <button onClick={() => setApiError(null)} className="p-1 hover:bg-red-500/20 rounded shrink-0">
                <X size={16}/>
              </button>
            </div>
          )}
          
          {currentView === View.DASHBOARD && (
            <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto animate-in fade-in duration-500">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#122b6a] to-[#0a1222] border border-blue-500/20 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 md:p-16 text-white shadow-2xl">
                <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-10"><AntiRiskLogo className="w-32 h-32 sm:w-48 sm:h-48" /></div>
                
                <div className="absolute top-4 right-4 sm:top-10 sm:right-10 flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-blue-300">Tactical Availability: Optimal</span>
                </div>

                <h2 className="text-2xl sm:text-5xl md:text-7xl font-black mb-2 sm:mb-3 uppercase tracking-tighter leading-none">Command <br className="xs:hidden" /><span className="text-blue-400">Vault</span></h2>
                <p className="text-blue-100/70 text-xs sm:text-xl md:text-2xl font-medium max-w-xl leading-snug">Premium risk intelligence and manpower oversight for the Security CEO.</p>
                <div className="mt-6 sm:mt-10 flex flex-wrap gap-2 sm:gap-4">
                  <button onClick={handleSyncDirective} disabled={isTipLoading} className="flex-1 xs:flex-none bg-blue-600/20 border border-blue-500/30 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-xs font-black flex items-center justify-center gap-2 sm:gap-3 hover:bg-blue-600/30 transition-all uppercase tracking-widest active:scale-95 disabled:opacity-50">
                    {isTipLoading ? <RefreshCw size={14} className="animate-spin" /> : <Lightbulb size={14} />} Sync Strategy
                  </button>
                  <button onClick={handleSyncTrends} disabled={isTrendsLoading} className="flex-1 xs:flex-none bg-emerald-600/20 border border-emerald-500/30 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-xs font-black flex items-center justify-center gap-2 sm:gap-3 hover:bg-emerald-600/30 transition-all uppercase tracking-widest active:scale-95 disabled:opacity-50">
                    {isTrendsLoading ? <RefreshCw size={14} className="animate-spin" /> : <Newspaper size={14} />} Sync Regulatory Intel
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
                {[
                  { id: View.ADVISOR, label: 'AI Advisor', icon: ShieldAlert, color: 'text-blue-400', desc: 'Consultation' },
                  { id: View.NEWS_BLOG, label: 'Regulatory Feed', icon: Globe, color: 'text-emerald-400', desc: 'Compliance Intel' },
                  { id: View.TRAINING, label: 'Architect', icon: BookOpen, color: 'text-amber-400', desc: 'Curriculum' },
                  { id: View.TOOLKIT, label: 'Ops Vault', icon: Briefcase, color: 'text-indigo-400', desc: 'SOPs & Audits' }
                ].map(item => (
                  <button key={item.label} onClick={() => setCurrentView(item.id)} className="bg-[#1b2537] p-6 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-slate-700/40 hover:border-blue-500/50 transition-all group text-left shadow-lg hover:shadow-blue-900/10 active:scale-[0.98]">
                    <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-900 flex items-center justify-center mb-4 sm:mb-6 ${item.color} group-hover:scale-110 transition-transform shadow-lg`}>
                      <item.icon size={22} />
                    </div>
                    <h3 className="font-black text-lg sm:text-xl text-white uppercase tracking-tight">{item.label}</h3>
                    <p className="text-[8px] sm:text-xs font-bold text-slate-500 mt-1 sm:mt-2 uppercase tracking-widest">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentView === View.ADVISOR && (
            <div className="max-w-4xl mx-auto flex flex-col h-[75vh] sm:h-[78vh] md:h-[82vh] bg-[#1b2537] rounded-3xl sm:rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl relative animate-in fade-in">
              <div className="flex flex-col">
                <div className="p-4 sm:p-6 pb-0">
                  <ViewHeader 
                    title="Intelligence Advisor" 
                    subtitle="Secure Strategic Consultation" 
                    onExit={() => setCurrentView(View.DASHBOARD)} 
                  />
                </div>
                <div className="px-4 sm:px-8 py-3 sm:py-4 bg-slate-900/50 border-y border-slate-800 flex justify-between items-center gap-2">
                  <div className="flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
                    <button 
                      onClick={() => setAdvisorTab('CHAT')} 
                      className={`whitespace-nowrap text-[8px] sm:text-xs font-black uppercase tracking-widest px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all ${advisorTab === 'CHAT' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                    >
                      Strategy Feed
                    </button>
                    <button 
                      onClick={() => setAdvisorTab('PINNED')} 
                      className={`whitespace-nowrap text-[8px] sm:text-xs font-black uppercase tracking-widest px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all flex items-center gap-2 ${advisorTab === 'PINNED' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                    >
                      <Pin size={12} className={advisorTab === 'PINNED' ? 'fill-white' : ''} /> Pinned
                    </button>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    {advisorTab === 'CHAT' && messages.length > 1 && (
                      <button 
                        onClick={handleClearChat}
                        className="p-1.5 sm:p-2 text-slate-500 hover:text-red-500 bg-slate-800/30 hover:bg-red-500/10 rounded-lg sm:rounded-xl transition-all active:scale-95 flex items-center gap-1 sm:gap-2 group"
                        title="Clear Vault History"
                      >
                        <Trash2 size={14} className="group-hover:animate-bounce" />
                        <span className="text-[8px] font-black uppercase tracking-widest hidden md:inline">Clear Log</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 sm:space-y-12 scrollbar-hide">
                {displayedMessages.length === 0 && advisorTab === 'PINNED' && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-10 opacity-40">
                    <PinOff size={40} className="mb-4" />
                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest">No strategic pins found in the vault.</p>
                  </div>
                )}

                {displayedMessages.map((m, idx) => {
                  const showDateHeader = idx === 0 || new Date(m.timestamp).toDateString() !== new Date(displayedMessages[idx-1].timestamp).toDateString();
                  const isThinking = m.role === 'model' && !m.text && isAdvisorThinking;
                  
                  return (
                    <React.Fragment key={m.id}>
                      {showDateHeader && (
                        <div className="flex items-center justify-center gap-2 sm:gap-4 py-4 sm:py-8 animate-in fade-in">
                          <div className="h-px bg-slate-800 flex-1"></div>
                          <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 bg-slate-900/50 rounded-full border border-slate-800 shadow-lg shrink-0">
                            <Calendar size={10} className="text-blue-500" />
                            <span className="text-[7px] sm:text-[9px] font-black uppercase text-slate-500 tracking-[0.25em]">
                              {getDateHeader(m.timestamp)}
                            </span>
                          </div>
                          <div className="h-px bg-slate-800 flex-1"></div>
                        </div>
                      )}
                      <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 group`}>
                        <div className={`relative ${m.role === 'user' ? 'max-w-[90%] sm:max-w-[75%]' : 'w-full'}`}>
                          <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800/40 text-slate-100 rounded-bl-none border border-slate-700/50 min-h-[60px] sm:min-h-[80px]'}`}>
                            {isThinking ? (
                              <div className="flex items-center gap-2 sm:gap-3 text-blue-400 font-black uppercase tracking-widest text-[10px] sm:text-xs animate-pulse">
                                <Loader2 size={14} className="animate-spin" />
                                Intelligence Core...
                              </div>
                            ) : (
                              <>
                                <MarkdownRenderer content={m.text} />
                                {m.sources && m.sources.length > 0 && (
                                  <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700/30">
                                    <h5 className="text-[8px] sm:text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Sources</h5>
                                    <div className="flex flex-wrap gap-2">
                                      {m.sources.map((s, idx) => (
                                        <a key={idx} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest bg-slate-900/50 px-2 py-1 rounded-lg text-blue-400 border border-blue-500/20 hover:text-white hover:bg-blue-600 transition-all">
                                          {s.title}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                            
                            <div className={`mt-3 sm:mt-4 flex items-center gap-1 text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.1em] ${m.role === 'user' ? 'text-blue-100/60 justify-end' : 'text-slate-500 justify-start'}`}>
                              <Clock size={8} className="opacity-70" /> {formatChatTimeFull(m.timestamp)}
                            </div>
                          </div>

                          {m.role === 'model' && !isThinking && (
                            <button 
                              onClick={() => togglePinMessage(m.id)}
                              className={`absolute -top-2 -right-2 sm:-top-3 sm:-right-3 p-1.5 sm:p-2.5 rounded-full shadow-lg transition-all duration-300 transform border backdrop-blur-md ${m.isPinned ? 'bg-indigo-600 text-white border-indigo-400 scale-110 shadow-indigo-900/40 opacity-100' : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-white hover:scale-110 opacity-0 group-hover:opacity-100'}`}
                              title={m.isPinned ? "Unpin" : "Pin"}
                            >
                              <Pin size={12} className={m.isPinned ? 'fill-white' : ''} />
                            </button>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="p-3 sm:p-5 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex gap-2 sm:gap-3">
                <button 
                  onClick={() => startVoiceInput(setInputMessage)} 
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white animate-mic-active shadow-lg shadow-red-900/40' : 'bg-slate-800 text-slate-400 hover:text-blue-500'}`}
                  title="Speak Prompt"
                >
                  <Mic size={20} />
                </button>
                <input 
                  value={inputMessage} 
                  onChange={e => setInputMessage(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                  className="flex-1 bg-slate-800 border-none rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-base focus:ring-1 sm:focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-600" 
                  placeholder="Strategy query..." 
                />
                <button 
                  onClick={handleSendMessage} 
                  disabled={isAdvisorThinking || !inputMessage.trim()} 
                  className="bg-blue-600 p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl hover:bg-blue-500 transition-all disabled:opacity-50 active:scale-95 shadow-lg flex items-center justify-center min-w-[48px] sm:min-w-[64px]"
                >
                  {isAdvisorThinking ? <Loader2 size={20} className="animate-spin text-white" /> : <Send size={20} />}
                </button>
              </div>
            </div>
          )}

          {currentView === View.TRAINING && (
            <div className="max-w-4xl mx-auto space-y-6 sm:space-y-12 animate-in fade-in pb-16">
              <ViewHeader 
                title="Lesson Architect" 
                subtitle="Weekly Progression Builder" 
                onExit={() => setCurrentView(View.DASHBOARD)} 
              />

              <div className="space-y-8 sm:space-y-12">
                <div className="bg-[#1b2537] rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 border border-slate-700/50 space-y-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                  
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-6 sm:gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-2">
                        <User size={12} className="text-amber-500" /> Operational Role
                      </label>
                      <select 
                        value={trainingTarget}
                        onChange={e => setTrainingTarget(e.target.value as SecurityRole)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-xs sm:text-sm font-bold text-white focus:ring-1 focus:ring-amber-500 outline-none transition-all cursor-pointer hover:border-slate-700"
                      >
                        <option value={SecurityRole.GUARD}>Security Guard</option>
                        <option value={SecurityRole.SUPERVISOR}>Site Supervisor</option>
                        <option value={SecurityRole.GEN_SUPERVISOR}>General Supervisor</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-2">
                        <Clock size={12} className="text-amber-500" /> Syllabus Stage
                      </label>
                      <select 
                        value={trainingWeek}
                        onChange={e => setTrainingWeek(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-xs sm:text-sm font-bold text-white focus:ring-1 focus:ring-amber-500 outline-none transition-all cursor-pointer hover:border-slate-700"
                      >
                        <option value={1}>Week 1 - Foundational</option>
                        <option value={2}>Week 2 - Tactical Application</option>
                        <option value={3}>Week 3 - Advanced Mastery</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 relative z-50">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 flex justify-between">
                      Training Topic
                      {isListening && <span className="text-red-500 flex items-center gap-1 animate-pulse"><Mic size={10}/></span>}
                    </label>
                    <div className="flex gap-3 relative">
                      <div className="relative flex-1">
                        <input 
                          value={trainingTopic} 
                          onChange={e => handleTopicChange(e.target.value)}
                          onFocus={() => trainingTopic.length > 0 && setShowSuggestions(true)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-4 text-xs sm:text-sm focus:ring-1 focus:ring-amber-500 outline-none transition-all font-bold placeholder:text-slate-700"
                          placeholder="Ex: Anti-Siphoning Protocols..."
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      </div>
                      <button 
                        onClick={() => startVoiceInput(handleTopicChange)}
                        className={`px-5 rounded-xl border border-slate-800 transition-all shadow-lg active:scale-95 ${isListening ? 'bg-red-500 border-red-500 text-white animate-mic-active' : 'bg-slate-900 text-slate-400 hover:text-amber-500'}`}
                      >
                        <Mic size={20} />
                      </button>
                    </div>

                    {showSuggestions && topicSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-[#0a1222] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                          {topicSuggestions.map((s, i) => (
                            <button 
                              key={i} 
                              onClick={() => selectSuggestion(s)}
                              className="w-full flex items-center justify-between text-left px-4 py-3.5 hover:bg-slate-800 rounded-lg transition-colors group"
                            >
                              <span className="text-[10px] sm:text-xs font-bold text-slate-300 truncate">{s}</span>
                              <Sparkles size={12} className="text-amber-500/30 group-hover:text-amber-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="h-px bg-slate-800/50 w-full" />

                  <button 
                    onClick={handleGenerateTraining} 
                    disabled={isTrainingLoading || !trainingTopic} 
                    className="w-full bg-amber-600 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest hover:bg-amber-500 transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 text-xs sm:text-sm"
                  >
                    {isTrainingLoading ? <Loader2 className="animate-spin" size={20} /> : <Award size={20} />} 
                    Architect Week {trainingWeek} Syllabus
                  </button>
                </div>

                {trainingStreamText && (
                  <div className="bg-slate-800/40 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 border border-amber-500/30 animate-in slide-in-from-bottom-5 shadow-2xl relative">
                    <div className="absolute top-4 right-4 sm:top-6 sm:right-10 flex items-center gap-4">
                      <ShareButton 
                        title={`${lastGeneratedTopic} (Week ${trainingWeek})`} 
                        content={trainingStreamText} 
                        triggerClassName="p-2.5 bg-slate-900 rounded-xl hover:text-amber-500 border border-slate-800 transition-all active:scale-90"
                      />
                      <button 
                        onClick={() => setTrainingStreamText('')}
                        className="p-2.5 bg-slate-900 text-slate-500 hover:text-red-500 border border-slate-800 rounded-xl transition-all active:scale-90"
                        title="Dismiss Content"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    
                    <div className="mt-8 sm:mt-0">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-amber-500">Focus Analysis: {lastGeneratedTopic}</span>
                      </div>
                      <MarkdownRenderer content={trainingStreamText} />
                    </div>
                  </div>
                )}

                <div className="space-y-6 sm:space-y-8 animate-in fade-in delay-200">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <h3 className="text-xl sm:text-2xl font-black uppercase flex items-center gap-4 tracking-tighter">
                      <History className="text-slate-500" size={24} /> 
                      Syllabus <span className="text-amber-500">History</span>
                    </h3>
                    {savedTraining.length > 0 && (
                      <button 
                        onClick={() => setSavedTraining([])}
                        className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-red-500 transition-colors flex items-center gap-2"
                      >
                        <Trash2 size={12} /> Purge Vault
                      </button>
                    )}
                  </div>

                  {savedTraining.length === 0 ? (
                    <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl p-12 text-center">
                      <Layers className="mx-auto text-slate-800 mb-4" size={40} />
                      <p className="text-[10px] sm:text-xs font-black uppercase text-slate-500 tracking-[0.2em]">Curriculum Vault Empty</p>
                      <p className="text-[9px] sm:text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-2">Generate your first week of training above.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 sm:gap-8">
                      {savedTraining.map((module) => (
                        <div key={module.id} className="bg-[#1b2537] border border-slate-800/50 rounded-3xl p-6 sm:p-8 shadow-xl hover:border-amber-500/30 transition-all group">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                            <div className="space-y-2 max-w-full overflow-hidden">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                  module.topic.includes('Week 1') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : 
                                  module.topic.includes('Week 2') ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 
                                  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                  {module.topic.split(' - ').pop()?.replace(')', '') || 'Stage Logged'}
                                </span>
                                <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">{module.generatedDate}</span>
                              </div>
                              <h4 className="text-sm sm:text-xl font-black text-white uppercase tracking-tight truncate leading-tight">
                                {module.topic.split(' (')[0]}
                              </h4>
                              <p className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                Assigned to: <span className="text-slate-300">{module.targetAudience}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                              <button 
                                onClick={() => setSavedTraining(prev => prev.filter(m => m.id !== module.id))}
                                className="flex-1 sm:flex-none p-3 bg-slate-800 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-slate-700/50 active:scale-95 flex items-center justify-center gap-2"
                                title="Delete Module"
                              >
                                <Trash size={14} /> <span className="sm:hidden text-[9px] font-black uppercase tracking-widest">Delete</span>
                              </button>
                              <ShareButton 
                                title={module.topic} 
                                content={module.content} 
                                triggerClassName="flex-1 sm:flex-none flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl transition-all font-black text-[9px] sm:text-xs shadow-lg shadow-blue-900/20 active:scale-95" 
                              />
                            </div>
                          </div>
                          <div className="bg-slate-900/40 rounded-2xl p-4 sm:p-6 max-h-[250px] overflow-y-auto scrollbar-hide border border-slate-800/30">
                            <MarkdownRenderer content={module.content} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentView === View.NEWS_BLOG && (
            <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in">
              <ViewHeader 
                title="Regulatory Intel" 
                subtitle="Sector Compliance & Governance Feed" 
                onExit={() => setCurrentView(View.DASHBOARD)} 
              />

              <div className="flex justify-end mb-4">
                <button 
                  onClick={handleSyncTrends} 
                  disabled={isTrendsLoading} 
                  className="w-full sm:w-auto px-6 py-3 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs flex items-center justify-center gap-2 sm:gap-3 transition-all active:scale-95 disabled:opacity-50 bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20"
                >
                  {isTrendsLoading ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />} 
                  Sync Regulatory Feed
                </button>
              </div>

              {isTrendsLoading ? (
                <div className="flex flex-col items-center justify-center py-24 sm:py-32 space-y-4 sm:space-y-6">
                  <RefreshCw size={40} className="animate-spin text-blue-500"/>
                  <p className="text-[10px] sm:text-sm font-black tracking-widest text-blue-400 uppercase text-center">Architecting Compliance Briefing...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {!globalTrends ? (
                    <div className="bg-slate-800/30 rounded-3xl sm:rounded-[2.5rem] p-10 sm:p-16 text-center border-2 border-dashed border-slate-700/50">
                      <Globe className="w-12 h-12 sm:w-16 sm:h-16 text-indigo-500 mx-auto mb-4 sm:mb-6" />
                      <h3 className="text-xl sm:text-2xl font-black uppercase text-white mb-4">No Regulatory Intel</h3>
                      <button onClick={handleSyncTrends} className="bg-indigo-600 px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-500 shadow-xl transition-all active:scale-95 text-xs">Initiate Feed Sync</button>
                    </div>
                  ) : (
                    <div className="bg-[#1b2537] rounded-3xl sm:rounded-[2.5rem] border border-slate-700/50 p-6 sm:p-10 md:p-14 shadow-2xl relative animate-in fade-in">
                      <MarkdownRenderer content={globalTrends.text} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {currentView === View.TOOLKIT && (
            <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12 animate-in fade-in">
              <ViewHeader 
                title="Operations Vault" 
                subtitle="Risk Audits" 
                onExit={() => setCurrentView(View.DASHBOARD)} 
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10">
                <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                  <h3 className="text-xl sm:text-2xl font-black uppercase flex items-center gap-3 tracking-tighter"><ShieldCheck className="text-emerald-500 shrink-0" size={24} /> Audit Core</h3>
                  <div className="bg-[#1b2537] rounded-3xl sm:rounded-[2.5rem] border border-slate-700/50 p-6 sm:p-10 shadow-2xl">
                    <textarea value={reportText} onChange={e => setReportText(e.target.value)} className="w-full bg-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-xs sm:text-base border-none focus:ring-1 focus:ring-emerald-500 outline-none h-48 sm:h-64 mb-4 sm:mb-6 scrollbar-hide resize-none transition-all placeholder:text-slate-700" placeholder="Paste daily logs for risk auditing..." />
                    <button onClick={handleAnalyzeReport} disabled={isAnalyzing || !reportText.trim()} className="w-full bg-emerald-600 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl active:scale-95 text-xs sm:text-sm">Execute Audit</button>
                  </div>
                  {analysisResult && (
                    <div className="bg-slate-800/40 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 border border-slate-700/50 animate-in slide-in-from-bottom-8 shadow-xl">
                      <h4 className="text-[10px] font-black text-emerald-400 mb-6 flex items-center gap-2 uppercase tracking-widest">Findings</h4>
                      <MarkdownRenderer content={analysisResult} />
                    </div>
                  )}
                  {storedReports.length > 0 && <IncidentChart reports={storedReports} />}
                </div>
                <div className="space-y-6 sm:space-y-8">
                  <h3 className="text-xl sm:text-2xl font-black uppercase flex items-center gap-3 tracking-tighter"><FileCheck className="text-blue-500 shrink-0" size={24} /> Templates</h3>
                  <div className="grid gap-4 sm:gap-5">
                    {STATIC_TEMPLATES.map(t => (
                      <div key={t.id} className="bg-[#1b2537] p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-slate-700/50 flex justify-between items-center group hover:bg-slate-800/50 transition-all shadow-lg active:scale-[0.98]">
                        <div className="max-w-[70%]">
                          <h4 className="font-black text-sm sm:text-lg text-white mb-1 uppercase tracking-tight truncate">{t.title}</h4>
                          <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider line-clamp-1">{t.description}</p>
                        </div>
                        <button onClick={() => {navigator.clipboard.writeText(t.content); alert('Template copied.');}} className="p-3 sm:p-4 bg-slate-900 rounded-xl sm:rounded-2xl hover:text-blue-500 border border-slate-800 transition-all active:scale-90"><Copy size={18} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === View.WEEKLY_TIPS && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-12 pt-2">
              <ViewHeader 
                title="Weekly Strategy" 
                subtitle="Strategic Focus & Automation" 
                onExit={() => setCurrentView(View.DASHBOARD)} 
              />

              <div className="max-w-xl mx-auto space-y-6">
                <div className="flex items-center gap-3 sm:gap-4 mb-2 px-1">
                  <div className="text-yellow-500 shrink-0">
                    <Lightbulb size={24} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Active Curriculum</h2>
                    <p className="text-[9px] sm:text-[11px] text-slate-500 font-medium leading-tight">Automated curriculum for site personnel.</p>
                  </div>
                  {weeklyTips.some(t => t.isAutoGenerated) && (
                    <button 
                      onClick={handleClearAllTips}
                      className="text-[8px] sm:text-[10px] font-black text-slate-500 hover:text-red-500 uppercase tracking-widest border border-slate-800 px-3 py-1.5 rounded-lg transition-all"
                    >
                      Purge AI Tips
                    </button>
                  )}
                </div>

                <div className="px-1">
                  <input 
                    type="text" 
                    value={tipTopic}
                    onChange={(e) => setTipTopic(e.target.value)}
                    placeholder="Focus Topic (Optional)"
                    className="w-full bg-[#1b2537] border border-slate-800/60 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-700"
                  />
                </div>

                <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 px-1">
                  <button className="flex-1 bg-[#1b2537] border border-slate-800/60 py-3 rounded-xl text-[10px] sm:text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                    Manual Entry
                  </button>
                  <button 
                    onClick={handleSyncDirective}
                    disabled={isTipLoading}
                    className="flex-[1.5] bg-[#d97706] py-3 rounded-xl text-[10px] sm:text-[11px] font-bold text-white flex items-center justify-center gap-2 hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isTipLoading ? <Loader2 className="animate-spin" size={12} /> : <Plus size={12} />} 
                    Generate Focus
                  </button>
                </div>

                {weeklyTips.length === 0 && !isTipLoading ? (
                  <div className="bg-[#1b2537]/60 rounded-3xl border border-slate-800/40 p-10 sm:p-12 flex flex-col items-center text-center shadow-xl min-h-[350px] sm:min-h-[400px] justify-center">
                    <Lightbulb size={40} className="text-slate-800 mb-6" />
                    <h3 className="text-lg font-bold text-white mb-3">No Tips Generated</h3>
                    <p className="text-[11px] sm:text-[13px] text-slate-600 font-medium px-4 leading-relaxed max-w-[280px]">
                      Initiate a strategic focus briefing using AI.
                    </p>
                    <button 
                      onClick={handleSyncDirective}
                      className="mt-10 bg-[#d97706] hover:bg-amber-600 px-10 py-3.5 rounded-xl font-bold text-white text-xs sm:text-[15px] transition-all active:scale-95"
                    >
                      Start Automation
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 px-1">
                    {isTipLoading && (
                      <div className="flex flex-col items-center py-10 space-y-3">
                        <RefreshCw size={24} className="animate-spin text-amber-500" />
                        <p className="text-[8px] sm:text-[10px] font-black uppercase text-amber-500 tracking-widest">Architecting Focus...</p>
                      </div>
                    )}
                    {weeklyTips.map(tip => (
                      <div key={tip.id} className="bg-[#1b2537] rounded-2xl border border-slate-800/40 p-5 sm:p-6 shadow-xl animate-in slide-in-from-bottom-2">
                         <div className="flex justify-between items-start mb-4 gap-2">
                          {editingTipId === tip.id ? (
                             <input 
                                type="text"
                                value={editedTopic}
                                onChange={(e) => setEditedTopic(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-white focus:ring-1 focus:ring-blue-500 outline-none w-full"
                                placeholder="Tip Topic"
                             />
                          ) : (
                            <h4 className="text-[11px] sm:text-sm font-bold text-white uppercase tracking-tight line-clamp-2">{tip.topic}</h4>
                          )}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {editingTipId !== tip.id && (
                              <button onClick={() => { setEditingTipId(tip.id); setEditedContent(tip.content); setEditedTopic(tip.topic); }} className="p-1.5 text-slate-500 hover:text-blue-400 transition-colors">
                                <Edit2 size={14} />
                              </button>
                            )}
                            <button onClick={() => handleDeleteTip(tip.id)} className="p-1.5 text-slate-500 hover:text-red-500 transition-colors" title="Delete Directive">
                              <Trash size={14} />
                            </button>
                            <ShareButton title={tip.topic} content={tip.content} triggerClassName="p-1.5 bg-transparent border-none text-slate-500 hover:text-white" />
                          </div>
                        </div>
                        
                        {editingTipId === tip.id ? (
                          <div className="space-y-4 animate-in fade-in duration-300">
                            <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-[12px] text-slate-300 min-h-[200px] sm:min-h-[300px] focus:ring-1 focus:ring-blue-500 outline-none scrollbar-hide resize-none font-mono" placeholder="Strategy content..." />
                            <div className="flex gap-2"><button onClick={() => handleUpdateTip(tip.id)} className="flex-1 bg-blue-600 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-500"><Save size={12} /> Save</button><button onClick={() => setEditingTipId(null)} className="px-4 bg-slate-800 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white">Cancel</button></div>
                          </div>
                        ) : (
                          <MarkdownRenderer content={tip.content} />
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center gap-2 text-[8px] sm:text-[9px] font-bold text-slate-600 uppercase">
                          <Clock size={10} /> {tip.weekDate} {tip.isAutoGenerated && <span className="ml-auto text-blue-500 opacity-50 lowercase tracking-normal font-normal">AI Synchronized</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-[#0a1222] w-full max-w-lg rounded-[2rem] sm:rounded-[3rem] border border-slate-800 p-8 sm:p-12 space-y-8 sm:space-y-10 shadow-2xl overflow-y-auto max-h-[90vh] ring-1 ring-white/10">
            <h3 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tighter">CEO Identity</h3>
            <div className="space-y-5 sm:space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Name</label>
                <input value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm font-bold text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="Full Name" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Email</label>
                <input value={userProfile.email} onChange={e => setUserProfile({...userProfile, email: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm font-bold text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="ceo@company.com" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-2">WhatsApp <Phone size={10} /></label>
                <input value={userProfile.phoneNumber} onChange={e => setUserProfile({...userProfile, phoneNumber: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm font-bold text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="+234 ..." />
              </div>
            </div>
            <div className="flex flex-col xs:flex-row gap-3 sm:gap-4 pt-2">
              <button onClick={() => {syncVaultToCloud(btoa(userProfile.email || 'guest'), { profile: userProfile }); alert('Synced.');}} className="w-full xs:flex-1 bg-indigo-600 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 sm:gap-3 hover:bg-indigo-500 active:scale-95 transition-all text-[10px] sm:text-xs"><CloudUpload size={16}/> Backup</button>
              <button onClick={() => setShowSettings(false)} className="w-full xs:flex-1 bg-slate-800 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest hover:bg-slate-700 active:scale-95 transition-all text-[10px] sm:text-xs text-slate-300">Close</button>
            </div>
          </div>
        </div>
      )}

      {appState === 'READY' && (
        <button onClick={() => setAppState('PIN_ENTRY')} className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 p-3 sm:p-4 bg-slate-800/80 backdrop-blur rounded-xl sm:rounded-2xl border border-slate-700 hover:bg-red-500/20 hover:border-red-500/50 transition-all text-slate-400 hover:text-red-500 z-[90] group shadow-xl active:scale-90">
          <LogOut size={18} className="group-hover:scale-110 transition-transform" />
        </button>
      )}
    </div>
  );
}

export default App;