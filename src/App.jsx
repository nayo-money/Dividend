import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signOut, signInWithCustomToken,
  GoogleAuthProvider, signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, getDoc, collection, onSnapshot, 
  addDoc, deleteDoc, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  TrendingUp, Activity, Trash2, PlusCircle, RefreshCw, 
  DollarSign, List, Layers, LogOut, ShieldCheck, 
  BarChart3, Calendar, Users, AlertCircle, 
  ChevronRight, ChevronDown, ChevronUp, Clock, ArrowRight, Check,
  Globe, BarChart, ExternalLink, Copy, Heart, Save, Send, Sparkles, ArrowUpRight
} from 'lucide-react';

/**
 * nayo money 股利工具 v30.1 - 穩定修復版
 * 更新重點：
 * 1. 修復引用錯誤：補上漏掉的 ArrowUpRight 圖標導入，解決執行期錯誤。
 * 2. 監測盤過濾：標的回本盤根據選取的家人進行過濾，僅顯示該家人有投入的代碼。
 * 3. 廣告效益：首頁與管理頁面置入高強度推薦連結。
 * 4. iPhone 優化：強化 apple-touch-icon 實底圖標，支援全螢幕 App 模式。
 * 5. 碎股精算：處理美股碎股浮點數誤差，精算至小數 2 位。
 */

// --- 0. 樣式與頭部元數據處理 ---
if (typeof document !== 'undefined') {
  const tailwindScript = document.getElementById('tailwind-cdn');
  if (!tailwindScript) {
    const script = document.createElement('script');
    script.id = 'tailwind-cdn';
    script.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(script);
  }

  let viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    viewportMeta.content = "width=device-width, initial-scale=1.0, viewport-fit=cover";
  } else {
    viewportMeta = document.createElement('meta');
    viewportMeta.name = "viewport";
    viewportMeta.content = "width=device-width, initial-scale=1.0, viewport-fit=cover";
    document.head.appendChild(viewportMeta);
  }
}

// --- 1. Firebase 配置 ---
const REAL_CONFIG = {
  apiKey: "AIzaSyB75a0ZSk4qIqoRctwfFKRQjvpuH6uPEkg",
  authDomain: "dividend-progress-bar-350dd.firebaseapp.com",
  projectId: "dividend-progress-bar-350dd",
  storageBucket: "dividend-progress-bar-350dd.firebasestorage.app",
  messagingSenderId: "250314546689",
  appId: "1:250314546689:web:13111c1368547594e16a00"
};

const configSource = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : REAL_CONFIG;
const app = initializeApp(configSource);
const auth = getAuth(app);
const db = getFirestore(app);
const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'nayo-money-official';

// --- 2. 智慧型精簡輸入組件 ---
const CompactNumberInput = ({ value, onChange, className, placeholder, ...props }) => {
  const handleFocus = (e) => {
    if (String(value) === "0" || String(value) === "") {
      onChange("");
    } else {
      e.target.select();
    }
  };
  const handleBlur = (e) => {
    if (e.target.value === "") onChange("0");
  };

  return (
    <input
      {...props}
      type="number"
      step="any" 
      inputMode="decimal"
      className={`${className} text-sm font-black py-1 px-1 text-slate-800 outline-none transition-all border border-slate-200 rounded-lg focus:ring-2 ring-[#8B9D83]/30 bg-white shadow-sm`}
      value={value}
      placeholder={placeholder}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
    />
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState(null);
  const [expandedSymbol, setExpandedSymbol] = useState(null);
  const [investExpanded, setInvestExpanded] = useState(null);
  const [divExpanded, setDivExpanded] = useState(null);

  const [members, setMembers] = useState([]); 
  const [symbols, setSymbols] = useState([]); 
  const [dividends, setDividends] = useState([]); 
  const [transactions, setTransactions] = useState([]); 
  const [filterMember, setFilterMember] = useState('all');

  // 新增狀態
  const [txDraft, setTxDraft] = useState({ member: '', symbol: '', cost: '0', shares: '0', date: new Date().toISOString().split('T')[0] });
  const [divDraft, setDivDraft] = useState({ member: '', symbol: '', amount: '0', date: new Date().toISOString().split('T')[0] });
  const [divDrafts, setDivDrafts] = useState({});
  const [newMemName, setNewMemName] = useState("");
  const [newSymName, setNewSymName] = useState("");

  const [editTx, setEditTx] = useState({});
  const [editDiv, setEditDiv] = useState({});
  const [editSym, setEditSym] = useState({});

  // --- iPhone App 化圖標與 Favicon 深度修復 ---
  useEffect(() => {
    document.title = "nayo money股利工具";
    const iconSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'><rect width='180' height='180' fill='%238B9D83'/><text y='125' x='50' font-size='100' font-weight='bold' fill='white' font-family='Arial'>$</text></svg>`;
    const iconData = `data:image/svg+xml,${iconSvg.replace(/#/g, '%23')}`;
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/svg+xml'; link.rel = 'icon'; link.href = iconData;
    document.head.appendChild(link);
    
    let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleIcon) { appleIcon = document.createElement('link'); appleIcon.rel = 'apple-touch-icon'; document.head.appendChild(appleIcon); }
    appleIcon.href = iconData;

    const metaCap = document.querySelector("meta[name='apple-mobile-web-app-capable']") || document.createElement('meta');
    metaCap.name = 'apple-mobile-web-app-capable'; metaCap.content = 'yes';
    document.head.appendChild(metaCap);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch(e){}
      }
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try { setError(null); await signInWithPopup(auth, provider); } catch (err) {
      setError("登入失敗：" + err.message);
    }
  };

  useEffect(() => {
    if (!user) return;
    const userPath = (col) => collection(db, 'artifacts', currentAppId, 'users', user.uid, col);
    onSnapshot(userPath('members'), s => {
      const data = s.docs.map(d => ({id: d.id, ...d.data()}));
      setMembers(data);
      if (data.length > 0) {
        if (!txDraft.member) setTxDraft(p => ({ ...p, member: data[0].name }));
        if (!divDraft.member) setDivDraft(p => ({ ...p, member: data[0].name }));
      }
    });
    onSnapshot(userPath('symbols'), s => {
      const data = s.docs.map(d => ({id: d.id, ...d.data()}));
      setSymbols(data);
      if (data.length > 0) {
        if (!txDraft.symbol) setTxDraft(p => ({ ...p, symbol: data[0].name }));
        if (!divDraft.symbol) setDivDraft(p => ({ ...p, symbol: data[0].name }));
      }
    });
    onSnapshot(userPath('dividends'), s => setDividends(s.docs.map(d => ({id: d.id, ...d.data()}))));
    onSnapshot(userPath('transactions'), s => setTransactions(s.docs.map(d => ({id: d.id, ...d.data()}))));
  }, [user]);

  useEffect(() => {
    const txObj = {}; transactions.forEach(t => txObj[t.id] = { ...t }); setEditTx(txObj);
    const divObj = {}; dividends.forEach(d => divObj[d.id] = { ...d }); setEditDiv(divObj);
    const symObj = {}; symbols.forEach(s => symObj[s.id] = { ...s, currentPrice: s.currentPrice || 0 }); setEditSym(symObj);
  }, [transactions, dividends, symbols]);

  // --- 3. 核心數據運算邏輯 ---
  const stats = useMemo(() => {
    // 過濾出目前選取家人的數據
    const fDivs = dividends.filter(d => filterMember === 'all' || d.member === filterMember);
    const fTx = transactions.filter(t => filterMember === 'all' || t.member === filterMember);
    
    const totalDiv = fDivs.reduce((a, b) => a + parseFloat(b.amount || 0), 0);
    const totalCost = fTx.reduce((a, b) => a + parseFloat(b.cost || 0), 0);
    
    const portfolio = {};
    symbols.forEach(s => { portfolio[s.name] = { name: s.name, cost: 0, div: 0, shares: 0, currentPrice: parseFloat(s.currentPrice || 0), lots: [] }; });
    
    fDivs.forEach(d => { if(portfolio[d.symbol]) portfolio[d.symbol].div += parseFloat(d.amount); });
    fTx.forEach(t => {
      if(portfolio[t.symbol]) {
        portfolio[t.symbol].cost += parseFloat(t.cost);
        // 使用倍率運算處理碎股
        portfolio[t.symbol].shares = (portfolio[t.symbol].shares * 1000000 + parseFloat(t.shares || 0) * 1000000) / 1000000;
        if (parseFloat(t.cost) > 0) portfolio[t.symbol].lots.push({ id: t.id, date: t.date, cost: parseFloat(t.cost), shares: parseFloat(t.shares || 0) });
      }
    });

    let totalMarketValue = 0;
    Object.values(portfolio).forEach(p => {
      totalMarketValue += p.shares * p.currentPrice;
      p.lots.forEach(lot => {
        const lotDivs = fDivs.filter(d => d.symbol === p.name && d.date >= lot.date);
        const ratio = p.shares > 0 ? lot.shares / p.shares : 0;
        lot.progress = lot.cost > 0 ? (lotDivs.reduce((s, d) => s + parseFloat(d.amount), 0) * ratio / lot.cost) * 100 : 0;
      });
      p.lots.sort((a,b) => b.date.localeCompare(a.date));
      p.returnIncDiv = p.cost > 0 ? ((p.shares * p.currentPrice + p.div - p.cost) / p.cost) * 100 : 0;
    });

    const monthlyData = {};
    fDivs.forEach(d => {
      const date = new Date(d.date);
      if (isNaN(date)) return;
      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      monthlyData[key] = (monthlyData[key] || 0) + parseFloat(d.amount);
    });
    const monthlyCount = Object.keys(monthlyData).length;
    const avgMonthly = monthlyCount > 0 ? totalDiv / monthlyCount : 0;

    return { 
      totalDiv, 
      totalMarketValue, 
      totalCost, 
      recovery: totalCost > 0 ? (totalDiv / totalCost) * 100 : 0, 
      overallReturn: totalCost > 0 ? ((totalMarketValue + totalDiv - totalCost) / totalCost) * 100 : 0, 
      // 💡 僅顯示目前選取家人「有投入成本」的標的
      items: Object.values(portfolio).filter(i => i.cost > 0), 
      monthly: Object.entries(monthlyData).sort((a, b) => b[0].localeCompare(a[0])), 
      avgMonthly 
    };
  }, [dividends, transactions, symbols, filterMember]);

  const isReady = members.length > 0 && symbols.length > 0;

  const handleUpdate = async (col, id, data) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, col, id), data);
      const setters = { 'transactions': setEditTx, 'dividends': setEditDiv, 'symbols': setEditSym };
      if (setters[col]) setters[col](prev => { const n = {...prev}; delete n[id]; return n; });
    } catch (e) { setError("更新失敗。"); }
  };

  const safeAddDoc = async (colName, data) => {
    if (!user) return;
    try { 
      if (colName === 'transactions') setInvestExpanded(data.symbol); 
      await addDoc(collection(db, 'artifacts', currentAppId, 'users', user.uid, colName), { ...data, createdAt: serverTimestamp() }); 
      if (colName === 'transactions') setTxDraft({ ...txDraft, cost: '0', shares: '0' });
      if (colName === 'dividends') setDivDraft({ ...divDraft, amount: '0' });
    } catch (e) { setError("連線失敗。"); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center font-bold text-[#8B9D83]">
      <RefreshCw size={32} className="animate-spin mb-2" />
      <p className="text-xs uppercase tracking-widest italic opacity-60 text-slate-800 text-center">Nayo Money Booting</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6 text-center font-sans text-slate-800">
      <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl border border-[#D9C5B2]/20 animate-in zoom-in mx-auto">
        <div className="bg-[#8B9D83] p-7 rounded-[2rem] text-white shadow-xl mb-6 mx-auto w-20 h-20 flex items-center justify-center">
          <ShieldCheck size={44} />
        </div>
        <h1 className="text-3xl font-black tracking-tighter">nayo money</h1>
        <p className="text-[#8B9D83] text-sm mt-2 font-bold mb-10 italic text-center">全家人的理財指揮官</p>
        <button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-slate-100 py-4 rounded-2xl flex items-center justify-center gap-4 font-black text-slate-700 hover:bg-slate-50 transition-all shadow-md active:scale-95">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-6 h-6" />
          Google 帳號登入
        </button>
        {error && <div className="mt-6 p-4 bg-red-50 text-red-500 text-xs font-bold rounded-xl text-left">{error}</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-900 pb-20 font-sans select-none overflow-x-hidden text-left">
      <header className="bg-[#8B9D83] text-white py-1.5 px-4 sticky top-0 z-50 shadow-sm text-left">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Layers size={16} />
            <h1 className="text-sm md:text-base font-black tracking-tight leading-none text-white">nayo money股利工具</h1>
          </div>
          <div className="flex items-center gap-2">
              <select 
                value={filterMember} 
                onChange={e => setFilterMember(e.target.value)} 
                className="bg-white/20 text-white text-[10px] md:text-sm font-black border-none outline-none rounded-lg px-2.5 py-1 backdrop-blur-md cursor-pointer appearance-none shadow-sm"
              >
                <option value="all" className="text-slate-900 bg-white font-bold">全家人</option>
                {members.map(m => ( <option key={m.id} value={m.name} className="text-slate-900 bg-white font-bold">{m.name}</option> ))}
              </select>
              <button onClick={() => signOut(auth)} className="bg-white/10 p-1.5 rounded-md hover:bg-white/20 transition-all text-white"><LogOut size={14} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 md:p-6 lg:p-12 space-y-4 lg:space-y-8 text-slate-900">
        {activeTab === 'overview' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 text-center text-slate-800">
              <StatCard title="總投入" value={`$${Math.round(stats.totalCost).toLocaleString()}`} sub="成本本金" color="#4A4A4A" />
              <StatCard title="總市值" value={`$${Math.round(stats.totalMarketValue).toLocaleString()}`} sub="目前價值" color="#3B82F6" />
              <StatCard title="回本率" value={`${stats.recovery.toFixed(2)}%`} sub="回收比重" color="#8B9D83" />
              <StatCard title="總報酬" value={`${stats.overallReturn.toFixed(1)}%`} sub="含息累積" color={stats.overallReturn >= 0 ? "#10B981" : "#EF4444"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-10 text-slate-800">
              <div className="space-y-5">
                <div className="bg-white rounded-[2rem] p-5 md:p-8 shadow-sm border border-slate-100 text-left text-slate-800">
                  <h3 className="font-black text-slate-800 text-sm md:text-base tracking-widest uppercase border-b-2 pb-2 mb-4 flex items-center gap-2 text-slate-800 text-left"><Globe size={18} className="text-[#8B9D83]"/> 標的回本監測盤</h3>
                  {stats.items.length === 0 ? <p className="text-center text-slate-400 text-sm py-12 italic mx-auto text-slate-800 text-center">該成員尚未有投入紀錄</p> : 
                    stats.items.map(p => (
                      <div key={p.name} className="space-y-1.5 bg-slate-50/60 p-4 rounded-3xl border border-transparent hover:border-[#8B9D83]/20 transition shadow-sm mb-3 text-left">
                        <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => setExpandedSymbol(expandedSymbol === p.name ? null : p.name)}>
                          <div className="flex items-center gap-2 text-slate-800">
                            <span className="text-base md:text-lg font-black uppercase">{p.name}</span>
                            {/* 💡 監測盤外顯總股數 */}
                            <span className="bg-[#8B9D83]/10 text-[#8B9D83] text-[9px] px-2 py-0.5 rounded-full font-black">{p.shares} 股</span>
                            <div className="text-slate-400">{expandedSymbol === p.name ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</div>
                          </div>
                          <div className="text-right">
                             <span className="text-[#8B9D83] font-mono font-black text-lg block leading-none">回本 {((p.div/Math.max(p.cost, 1))*100).toFixed(2)}%</span>
                             {/* ✅ 新增：領息總額 */}
                             <span className="text-[10px] font-black text-slate-500 block mt-1 text-right">
                               領息總額: NT$ {Math.round(p.div).toLocaleString()}
                             </span>
                             <span className="text-[10px] font-black text-slate-400 block mt-1 text-right">
                               總成本: ${p.cost.toLocaleString()} | <span className={p.returnIncDiv >= 0 ? 'text-emerald-600' : 'text-red-500'}>含息: {p.returnIncDiv.toFixed(1)}%</span>
                             </span>
                          </div>
                        </div>
                        <div className="h-2 bg-white rounded-full overflow-hidden shadow-inner mt-1 border border-slate-100">
                          <div className="h-full bg-[#8B9D83] transition-all duration-1000 shadow-[0_0_8px_rgba(139,157,131,0.25)]" style={{ width: `${Math.min((p.div/Math.max(p.cost, 1))*100, 100)}%` }}></div>
                        </div>
                        {expandedSymbol === p.name && (
                          <div className="mt-3 space-y-2 pt-2 border-t border-slate-200 animate-in slide-in-from-top-2 text-slate-900 text-left">
                            {p.lots.map(lot => (
                              <div key={lot.id} className="flex justify-between text-xs font-black text-slate-600 text-left">
                                <span><Clock size={12} className="inline mr-1 opacity-50"/>{lot.date}</span>
                                <span>成本 $ {lot.cost.toLocaleString()} ({lot.progress.toFixed(2)}% 回本)</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  }
                </div>
                
                <div className="bg-gradient-to-br from-[#8B9D83]/20 to-white rounded-[2rem] p-6 shadow-sm border border-[#8B9D83]/30 animate-in zoom-in text-slate-800 text-left">
                  <div className="flex items-center gap-3 mb-3 text-[#8B9D83]">
                    <Sparkles size={20} fill="#8B9D83"/>
                    <h3 className="text-sm font-black uppercase tracking-widest leading-none">💡 財富自由充電站</h3>
                    <a href="https://nayomoney.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#8B9D83] text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-[#8B9D83]/20 hover:scale-105 active:scale-95 transition-all text-white"><ArrowUpRight size={16}/> 立即前往</a>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] p-5 md:p-8 shadow-sm border border-slate-100 h-fit text-slate-800">
                <div className="flex justify-between items-center border-b-2 pb-2 mb-4 text-slate-800">
                  <h3 className="font-black text-slate-800 text-sm md:text-base tracking-widest uppercase flex items-center gap-2 text-slate-800 text-left text-slate-800"><BarChart size={18} className="text-[#8B9D83]"/> 每月領息現金流</h3>
                  <div className="text-right text-slate-800">
                    <p className="text-[10px] text-slate-400 font-black uppercase leading-none text-right">月平均股利</p>
                    <p className="text-base font-black text-[#8B9D83] font-mono leading-tight text-right">NT$ {Math.round(stats.avgMonthly).toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 font-mono text-slate-800 text-left text-slate-800">
                  {stats.monthly.length === 0 ? <p className="text-center text-slate-400 text-sm py-12 italic mx-auto text-center">尚未有紀錄</p> : 
                    stats.monthly.map(([month, amount]) => (
                      <div key={month} className="flex justify-between items-center p-4 bg-[#F2E8D5]/40 rounded-3xl shadow-sm hover:bg-[#F2E8D5]/60 transition-colors text-slate-800 text-slate-800">
                        <span className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-600 text-left">{month} 合計</span>
                        <p className="text-lg md:text-xl font-black text-[#8B9D83] font-mono text-right">${amount.toLocaleString()}</p>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 投入紀錄區 */}
        {activeTab === 'invest' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 text-slate-900 text-left text-slate-800">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <h2 className="font-black text-base md:text-lg text-slate-800 flex items-center gap-2 italic text-left"><TrendingUp size={20}/> 投入紀錄管理</h2>
                <div className="bg-[#8B9D83]/10 p-4 rounded-[2rem] border border-[#8B9D83]/20 shadow-sm space-y-4 mb-6">
                   <div className="flex justify-between items-center px-1 text-slate-800">
                      <span className="text-xs font-black text-[#8B9D83] uppercase tracking-widest flex items-center gap-1 text-slate-800 text-left"><PlusCircle size={14}/> 快速建立新投入</span>
                      <input type="date" value={txDraft.date} onChange={e => setTxDraft({...txDraft, date: e.target.value})} className="text-xs font-black bg-white rounded-lg px-3 py-1 border border-[#8B9D83]/20 outline-none shadow-sm cursor-pointer text-slate-800 text-left" />
                   </div>
                   <div className="flex flex-wrap md:flex-nowrap gap-3 items-center">
                      <div className="flex flex-1 gap-2 items-center text-slate-800">
                        <select value={txDraft.member} onChange={e => setTxDraft({...txDraft, member: e.target.value})} className="flex-1 bg-white text-sm py-2 px-2 rounded-xl font-black border border-[#8B9D83]/20 text-slate-900 shadow-sm">
                          {members.map(m => <option key={m.id} value={m.name} className="text-slate-900">{m.name}</option>)}
                        </select>
                        <select value={txDraft.symbol} onChange={e => setTxDraft({...txDraft, symbol: e.target.value})} className="w-20 md:w-24 bg-white text-sm py-2 px-2 rounded-xl font-black border border-[#8B9D83]/20 text-slate-900 shadow-sm uppercase">
                          {symbols.map(s => <option key={s.id} value={s.name} className="text-slate-900">{s.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-1 gap-2 items-center text-slate-800 text-slate-800">
                        <CompactNumberInput placeholder="碎股數" value={txDraft.shares} onChange={v => setTxDraft({...txDraft, shares: v})} className="w-24 md:w-32 text-center shadow-inner" />
                        <CompactNumberInput placeholder="成本" value={txDraft.cost} onChange={v => setTxDraft({...txDraft, cost: v})} className="flex-1 text-center shadow-inner" />
                        <button onClick={() => safeAddDoc('transactions', txDraft)} className="bg-[#8B9D83] text-white p-3 rounded-2xl shadow-lg active:scale-90 hover:bg-[#7A8C72] transition-all flex items-center justify-center border-2 border-white/20 text-white"><Send size={18} /></button>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-slate-800 text-left">
                  {symbols.map(s => {
                    const txList = transactions.filter(t => t.symbol === s.name && (filterMember === 'all' || t.member === filterMember));
                    if (txList.length === 0 && investExpanded !== s.name) return null;
                    return (
                      <div key={s.name} className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-slate-100 h-fit transition-all hover:shadow-md text-slate-800 text-left">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors text-slate-800 text-left" onClick={() => setInvestExpanded(investExpanded === s.name ? null : s.name)}>
                          <span className="text-base font-black uppercase tracking-wide text-slate-800 text-left">{s.name} <span className="text-xs opacity-40 text-left">({txList.length})</span></span>
                          <div className="text-slate-400 text-left text-slate-800">{investExpanded === s.name ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</div>
                        </div>
                        {investExpanded === s.name && (
                          <div className="p-3 space-y-4 animate-in slide-in-from-top-2 text-slate-900 text-left">
                            {txList.sort((a,b) => b.date.localeCompare(a.date)).map(t => {
                              const draft = editTx[t.id] || t;
                              const hasChanged = JSON.stringify(draft) !== JSON.stringify(t);
                              return (
                                <div key={t.id} className={`p-4 rounded-[1.5rem] border-2 transition-all space-y-3 relative ${hasChanged ? 'border-amber-300 bg-amber-50/20 shadow-md scale-[1.01]' : 'border-slate-50 bg-white shadow-sm'}`}>
                                  <div className="flex justify-between items-center text-slate-800 gap-2 text-left text-slate-800 text-left">
                                    <div className="flex-1 flex items-center gap-2 text-left text-slate-800">
                                        <input type="date" value={draft.date} onChange={(e) => setEditTx({...editTx, [t.id]: {...draft, date: e.target.value}})} className="text-xs font-black outline-none bg-transparent text-slate-700 cursor-pointer w-24 text-left" />
                                        <select value={draft.member} onChange={(e) => setEditTx({...editTx, [t.id]: {...draft, member: e.target.value}})} className="bg-white text-xs p-1 rounded-lg font-black text-slate-800 border border-slate-200 flex-1 max-w-[80px] shadow-sm text-slate-900 text-left">
                                            {members.map(m => <option key={m.id} value={m.name} className="text-slate-900">{m.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 text-left text-slate-800">
                                      {hasChanged && ( 
                                        <button onClick={() => handleUpdate('transactions', t.id, draft)} className="bg-emerald-600 text-white px-3 py-1 rounded-lg shadow-md flex items-center gap-1 animate-pulse text-white text-[10px] font-black text-white text-left"><Check size={14}/> 存</button> 
                                      )}
                                      <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'transactions', t.id))} className="text-slate-300 hover:text-red-500 p-1 transition-all text-left text-slate-800 text-left"><Trash2 size={18}/></button>
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-2 items-center text-slate-800 text-left text-slate-800 text-left">
                                    <select value={draft.symbol} onChange={(e) => setEditTx({...editTx, [t.id]: {...draft, symbol: e.target.value}})} className="w-16 bg-white text-xs p-1.5 rounded-lg font-black text-slate-800 border border-slate-200 uppercase shadow-sm text-slate-900 text-left">
                                      {symbols.map(s => <option key={s.id} value={s.name} className="text-slate-900">{s.name}</option>)}
                                    </select>
                                    <div className="flex flex-1 gap-1.5 min-w-0 text-left text-slate-800">
                                      <CompactNumberInput value={draft.shares} onChange={v => setEditTx({...editTx, [t.id]: {...draft, shares: v}})} className="w-20 md:w-24 text-center shadow-inner" placeholder="股數" />
                                      <CompactNumberInput value={draft.cost} onChange={v => setEditTx({...editTx, [t.id]: {...draft, cost: v}})} className="flex-1 min-w-[70px] text-center text-[#8B9D83] shadow-inner font-mono text-left" placeholder="成本" />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'dividends' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 text-slate-900 text-left text-slate-800">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <h2 className="font-black text-lg md:text-2xl text-slate-800 flex items-center gap-3 italic text-left text-slate-800 text-slate-800"><DollarSign size={24} className="text-[#8B9D83]"/> 領息流水管理</h2>
                <div className="bg-[#8B9D83]/10 p-4 rounded-[2rem] border border-[#8B9D83]/20 shadow-sm space-y-4 mb-6 text-slate-800 text-left">
                   <div className="flex justify-between items-center px-1 text-left text-slate-800 text-left">
                      <span className="text-xs font-black text-[#8B9D83] uppercase tracking-widest flex items-center gap-1 text-left text-slate-800 text-left text-slate-800"><PlusCircle size={14}/> 全域快速新增領息</span>
                      <input type="date" value={divDraft.date} onChange={e => setDivDraft({...divDraft, date: e.target.value})} className="text-xs font-black bg-white rounded-lg px-3 py-1 border border-[#8B9D83]/20 outline-none shadow-sm cursor-pointer text-slate-800 text-left text-slate-800" />
                   </div>
                  <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                    {/* 左：成員 / 標的 */}
                    <div className="flex w-full md:flex-[2] gap-2">
                      <select
                        value={divDraft.member}
                        onChange={(e) => setDivDraft({ ...divDraft, member: e.target.value })}
                        className="flex-1 bg-white text-sm py-2 px-3 rounded-xl font-black border border-[#8B9D83]/20 text-slate-900 shadow-sm"
                      >
                        {members.map((m) => (
                          <option key={m.id} value={m.name} className="text-slate-900">
                            {m.name}
                          </option>
                        ))}
                      </select>
                  
                      <select
                        value={divDraft.symbol}
                        onChange={(e) => setDivDraft({ ...divDraft, symbol: e.target.value })}
                        className="flex-1 bg-white text-sm py-2 px-3 rounded-xl font-black border border-[#8B9D83]/20 text-slate-900 shadow-sm uppercase"
                      >
                        {symbols.map((s) => (
                          <option key={s.id} value={s.name} className="text-slate-900">
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  
                    {/* 右：金額 + 送出 */}
                    <div className="flex w-full md:flex-1 gap-3 items-center">
                      <div className="flex-1 min-w-[180px] flex items-center bg-white border border-[#8B9D83]/20 rounded-xl px-3 py-2 shadow-inner">
                        <span className="text-[10px] text-[#8B9D83] font-black mr-2">NT$</span>
                        <CompactNumberInput
                          value={divDraft.amount}
                          onChange={(v) => setDivDraft({ ...divDraft, amount: v })}
                          className="w-full text-right border-none shadow-none focus:ring-0 text-base md:text-sm font-black"
                        />
                      </div>
                  
                      <button
                        onClick={() => safeAddDoc('dividends', divDraft)}
                        className="shrink-0 bg-[#8B9D83] text-white p-3 rounded-2xl shadow-lg active:scale-90 hover:bg-[#7A8C72] transition-all flex items-center justify-center border-2 border-white/20"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-slate-800 text-left text-slate-800 text-left">
                  {symbols.map(s => {
                    const divList = dividends.filter(d => d.symbol === s.name && (filterMember === 'all' || d.member === filterMember));
                    const divSum = divList.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

                    const hasInvested = transactions.some(t => t.symbol === s.name);
                    if (!hasInvested && divList.length === 0 && divExpanded !== s.name) return null;
                    const currentDraft = divDrafts[s.name] || { amount: '0', member: members[0]?.name || '', date: new Date().toISOString().split('T')[0] };
                    return (
                      <div key={s.name} className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-slate-100 h-fit text-slate-800 text-left text-slate-800 text-left">
                        <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center cursor-pointer hover:bg-blue-100 transition-colors text-slate-800 text-left text-slate-800 text-left text-slate-800" onClick={() => setDivExpanded(divExpanded === s.name ? null : s.name)}>
<span className="text-base font-black uppercase tracking-wide text-left text-slate-800">
  {s.name}
  <span className="text-xs font-black text-slate-500 ml-2">
    NT$ {Math.round(divSum).toLocaleString()}
  </span>
</span>

                          <div className="text-slate-400 text-left text-slate-800 text-slate-800 text-left text-slate-800 text-left">{divExpanded === s.name ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</div>
                        </div>
                        {divExpanded === s.name && (
                          <div className="p-3 space-y-4 animate-in slide-in-from-top-2 text-slate-900 text-left text-slate-800 text-left">
                            <div className="border-t border-slate-100 pt-3 space-y-3 text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">
                              {divList.sort((a,b) => b.date.localeCompare(a.date)).map(d => {
                                const draft = editDiv[d.id] || d;
                                const hasChanged = JSON.stringify(draft) !== JSON.stringify(d);
                                return (
                                  <div key={d.id} className={`p-4 rounded-[1.5rem] border-2 transition-all relative ${hasChanged ? 'border-amber-300 bg-amber-50/20 shadow-md scale-[1.01]' : 'border-slate-50 bg-white shadow-sm'}`}>
                                    <div className="flex justify-between items-start mb-2 text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">
                                      <input type="date" value={draft.date} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...draft, date: e.target.value}})} className="text-xs font-black outline-none bg-transparent text-slate-500 cursor-pointer text-left text-slate-800 text-left text-slate-800 text-left" />
                                      <div className="flex items-center gap-1 text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">
                                        {hasChanged && ( <button onClick={() => handleUpdate('dividends', d.id, draft)} className="bg-emerald-600 text-white px-2 py-0.5 rounded-lg shadow-md animate-pulse text-white text-left text-slate-800 text-left text-slate-800 text-left font-black text-[10px] text-white text-left">存</button> )}
                                        <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'dividends', d.id))} className="text-slate-300 hover:text-red-500 p-1 transition-all text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">×</button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">
                                      <select value={draft.member} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...draft, member: e.target.value}})} className="w-24 bg-[#F2E8D5]/60 text-xs p-2 rounded-xl font-black text-slate-900 border-none outline-none text-left text-slate-800 text-left">
                                        {members.map(m => <option key={m.id} value={m.name} className="text-slate-900">{m.name}</option>)}
                                      </select>
                                      <div className="flex-1 flex items-center bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-slate-800 shadow-inner text-left text-slate-800 text-left text-slate-800 text-left">
                                          <span className="text-[10px] text-slate-400 font-black mr-1 text-left text-slate-800 text-left text-slate-800 text-left">NT$</span>
                                          <CompactNumberInput value={draft.amount} onChange={v => setEditDiv({...editDiv, [d.id]: {...draft, amount: v}})} className="bg-transparent text-right font-black text-slate-800 w-full outline-none text-sm border-none focus:ring-0 p-0 shadow-none text-left text-slate-800 text-left text-slate-800 text-left" />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'masters' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300 text-slate-900 pb-16 text-left text-slate-800 text-left text-slate-800 text-left">
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-sm space-y-10 border border-slate-50 text-left text-slate-800 text-left text-slate-800 text-left">
               <div className="space-y-4 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">
                 <h3 className="font-black text-xs md:text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2 text-left mx-auto md:mx-0 text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left"><Users size={20}/> 人員管理中心</h3>
                 <div className="flex gap-2 max-w-sm text-left text-slate-800 text-left text-slate-800 text-left">
                   <input placeholder="輸入姓名 (例如: 媽媽)" className="flex-1 py-3 px-5 text-base font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ring-[#8B9D83]/20 shadow-inner text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left" value={newMemName} onChange={e => setNewMemName(e.target.value)} />
                   <button onClick={async () => { if(newMemName.trim()) { await safeAddDoc('members', { name: newMemName.trim() }); setNewMemName(""); } }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-base shadow-xl active:scale-90 transition-all hover:bg-blue-700 text-white text-left text-white text-left text-white text-left text-white text-left">建立</button>
                 </div>
                 <div className="flex flex-wrap gap-2 pt-2 text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">
                   {members.map(m => (
                     <span key={m.id} className="bg-blue-50 text-sm font-black text-blue-800 px-6 py-3 rounded-2xl border border-blue-100 flex items-center gap-3 group shadow-sm text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">
                       {m.name}
                       <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'members', m.id))} className="text-blue-300 hover:text-red-500 font-black px-1 transition-colors text-lg text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">×</button>
                     </span>
                   ))}
                 </div>
               </div>

               <div className="border-t border-slate-100 pt-8 space-y-4 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">
                 <h3 className="font-black text-xs md:text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2 text-left mx-auto md:mx-0 text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left"><Globe size={20}/> 標的管理中心</h3>
                 <div className="flex gap-2 max-w-sm text-left text-slate-800 text-slate-800 text-left text-slate-800 text-left">
                   <input placeholder="標的代碼 (例如: 0050)" className="flex-1 uppercase py-3 px-5 text-base font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 ring-[#8B9D83]/20 shadow-inner text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left" value={newSymName} onChange={e => setNewSymName(e.target.value.toUpperCase())} />
                   <button onClick={async () => { if(newSymName.trim()) { await safeAddDoc('symbols', { name: newSymName.trim(), currentPrice: 0 }); setNewSymName(""); } }} className="bg-[#8B9D83] text-white px-8 py-3 rounded-2xl font-black text-base shadow-xl active:scale-90 transition-all hover:bg-[#7A8C72] text-white text-left text-white text-left text-white text-left text-white text-left">新增</button>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">
                   {symbols.map(s => {
                     const draft = editSym[s.id] || s; const hasChanged = Number(draft.currentPrice) !== Number(s.currentPrice);
                     return (
                       <div key={s.id} className={`p-5 rounded-[2rem] border-2 transition-all ${hasChanged ? 'border-amber-300 bg-amber-50/20 shadow-md scale-[1.05]' : 'bg-white border-slate-100 shadow-sm hover:border-slate-300'}`}>
                         <div className="flex justify-between items-center mb-2 text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">
                            <span className="text-sm font-black uppercase text-slate-800 tracking-wider text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">{s.name}</span>
                            <div className="flex items-center gap-1 text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">
                               {hasChanged && ( <button onClick={() => handleUpdate('symbols', s.id, draft)} className="bg-emerald-600 text-white p-1.5 rounded-lg shadow-md border border-emerald-500/10 text-white text-left text-white text-left font-black text-white text-left"><Check size={14}/></button> )}
                               <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'symbols', s.id))} className="text-slate-300 hover:text-red-500 transition-all p-1 text-[16px] font-black text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">×</button>
                            </div>
                         </div>
                         <div className="flex items-center gap-2 pt-2 border-t border-slate-50 text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left">
                           <span className="text-[10px] text-slate-400 font-black uppercase text-left text-slate-400 text-left text-slate-400 text-left">市價</span>
                           <CompactNumberInput value={draft.currentPrice} onChange={v => setEditSym({...editSym, [s.id]: {...draft, currentPrice: v}})} className="w-full text-center font-mono text-[#8B9D83] border-none shadow-none focus:ring-0 px-0 text-base shadow-none text-left text-slate-800 text-left text-slate-800 text-left text-slate-800 text-left" placeholder="0" />
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
               
               <div className="border-t-4 border-[#8B9D83]/20 pt-12 pb-6 text-center mx-auto text-slate-800 text-left text-slate-800 text-center text-slate-800 text-center">
                 <div className="relative group mx-auto max-w-2xl bg-gradient-to-br from-[#8B9D83] to-[#7A8C72] rounded-[3rem] p-8 shadow-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]">
                   <div className="absolute top-0 right-0 p-4 opacity-10 text-white rotate-12"><Activity size={120} /></div>
                   <div className="absolute bottom-0 left-0 p-4 opacity-10 text-white -rotate-12"><TrendingUp size={100} /></div>
                   <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left text-slate-800 text-center md:text-left text-slate-800 text-center md:text-left">
                     <div className="bg-white/20 p-5 rounded-[2.5rem] backdrop-blur-xl border border-white/30 shadow-inner text-slate-800 text-center md:text-left">
                        <Heart size={44} fill="white" className="text-white animate-pulse" />
                     </div>
                     <div className="text-center md:text-left flex-1 text-slate-800 text-center md:text-left">
                       <h2 className="text-xl md:text-2xl font-black text-white mb-2 tracking-tight text-white text-center md:text-left">探索更多財富自由的秘密</h2>
                       <p className="text-white/80 text-sm font-bold leading-relaxed mb-6 text-white text-center md:text-left text-white text-center md:text-left">不僅是紀錄，更要懂佈局。在 nayomoney.com，我們分享如何打造永不枯竭的股利印鈔機。</p>
                       <a href="https://nayomoney.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-white text-[#8B9D83] px-10 py-4 rounded-[1.8rem] font-black text-base shadow-2xl hover:bg-[#FDFBF7] transition-all text-[#8B9D83] text-center md:text-left"><ExternalLink size={20} /> 立即探索導航</a>
                     </div>
                   </div>
                 </div>
                 <p className="text-[10px] text-slate-400 mt-6 font-black uppercase tracking-[0.3em] opacity-40 italic text-center text-slate-400 text-center text-slate-400 text-center">nayo money official recommendation</p>
               </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-safe">
        <div className="max-w-7xl mx-auto w-full flex justify-center md:justify-end pointer-events-auto px-4 py-3 md:px-12 md:py-8 text-left">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200 px-3 py-2 shadow-2xl flex justify-around items-center w-full md:w-fit md:rounded-full md:gap-10 animate-in slide-in-from-bottom-10 duration-700 text-slate-900 overflow-hidden min-h-[65px] md:min-h-[75px]">
            <NavBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={22}/>} label="監測" />
            <NavBtn active={activeTab === 'dividends'} onClick={() => setActiveTab('dividends')} icon={<DollarSign size={22}/>} label="領息" />
            <NavBtn active={activeTab === 'invest'} onClick={() => setActiveTab('invest')} icon={<TrendingUp size={22}/>} label="投入" />
            <NavBtn active={activeTab === 'masters'} onClick={() => setActiveTab('masters')} icon={<Users size={22}/>} label="管理" />
          </div>
        </div>
      </nav>
    </div>
  );
}

const StatCard = ({ title, value, sub, color }) => (
  <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-[#D9C5B2]/10 active:scale-95 transition-transform text-center relative overflow-hidden group hover:shadow-xl mx-auto text-slate-800 text-center">
    <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: color, opacity: 0.4 }}></div>
    <p className="text-[11px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 leading-none text-center text-slate-400 text-center text-slate-400 text-center text-slate-400 text-center text-slate-400 text-center">{title}</p>
    <p className={`text-3xl md:text-3xl font-mono font-black tracking-tighter leading-none text-center text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center`} style={{ color }}>{value}</p>
    <p className="text-[9px] md:text-[11px] text-slate-400 font-black italic tracking-wider uppercase opacity-80 mt-4 leading-none text-center text-slate-400 text-center text-slate-400 text-center text-slate-400 text-center text-slate-400 text-center text-slate-400 text-center text-slate-400 text-center">{sub}</p>
  </div>
);

const SetupGuide = ({ onGo }) => (
  <div className="bg-white p-14 rounded-[4rem] text-center space-y-6 shadow-2xl border border-amber-50 animate-in zoom-in max-w-xl mx-auto mt-12 text-slate-800 mx-auto text-left text-center text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center">
    <div className="bg-amber-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-amber-500 shadow-inner mb-3 text-amber-500 text-center text-amber-500 text-center text-amber-500 text-center text-amber-500 text-center text-amber-500 text-center"><AlertCircle size={56} /></div>
    <div className="space-y-2 text-center mx-auto text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center">
      <h3 className="text-3xl font-black tracking-tight text-center leading-tight text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center">尚未完成初始化</h3>
      <p className="text-base text-slate-500 font-bold px-8 leading-relaxed text-center text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center text-slate-800 text-center">請前往「管理」分頁建立人員與標的。</p>
    </div>
    <button onClick={onGo} className="bg-blue-600 text-white w-full max-w-xs py-5 rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all mx-auto tracking-widest uppercase flex items-center justify-center gap-3 text-center text-white text-center text-white text-center text-white text-center text-white text-center text-white text-center">立即前往 <ArrowRight size={24}/></button>
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-0.5 transition-all duration-300 px-2 min-w-[65px] flex-shrink-0 ${active ? 'text-[#8B9D83] scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
    <div className={`${active ? 'bg-[#8B9D83]/10 p-2 rounded-2xl shadow-sm' : 'p-2'} transition-all`}>
      {icon}
    </div>
    <span className={`text-[10px] md:text-xs font-black tracking-widest leading-none ${active ? 'text-[#8B9D83]' : 'text-slate-500'}`}>{label}</span>
  </button>
);
