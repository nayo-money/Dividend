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
  Globe, BarChart, ExternalLink, Copy, Heart, Save, Send, PiggyBank
} from 'lucide-react';

/**
 * nayo money 股利工具 v17.0 - 連動新增優化版
 * 更新重點：
 * 1. 投入連動領息：在「投入」分頁展開標的後，直接提供「紀錄此標的配息」功能，無需切換分頁。
 * 2. 交互修復：摺疊箭頭點擊區域優化，輸入框 0 自動清空邏輯優化。
 * 3. 視覺精煉：針對截圖紅框問題，持續維持底部導覽列 h-12 極扁平化。
 * 4. RWD 右縮排：電腦大螢幕導覽列懸浮於右下角，視野最大化。
 */

// --- 0. 樣式修復 ---
if (typeof document !== 'undefined') {
  const tailwindScript = document.getElementById('tailwind-cdn');
  if (!tailwindScript) {
    const script = document.createElement('script');
    script.id = 'tailwind-cdn';
    script.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(script);
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

// --- 2. 智慧型 RWD 輸入組件 ---
const SmartInput = ({ value, onChange, className, type = "text", placeholder, ...props }) => {
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
      type={type}
      inputMode={type === "number" ? "decimal" : "text"}
      className={`${className} text-xs md:text-sm font-black py-1 px-1.5 text-slate-800 outline-none transition-all border border-slate-200 rounded-lg focus:ring-2 ring-[#8B9D83]/20 bg-white shadow-inner`}
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

  const [members, setMembers] = useState([]); 
  const [symbols, setSymbols] = useState([]); 
  const [dividends, setDividends] = useState([]); 
  const [transactions, setTransactions] = useState([]); 
  const [filterMember, setFilterMember] = useState('all');

  // 草稿狀態 (頂部快速新增用)
  const [txDraft, setTxDraft] = useState({ member: '', symbol: '', cost: '0', shares: '0', date: new Date().toISOString().split('T')[0] });
  const [divDraft, setDivDraft] = useState({ member: '', symbol: '', amount: '0', date: new Date().toISOString().split('T')[0] });
  
  // 投入明細內的「內嵌配息」草稿
  const [inlineDivDraft, setInlineDivDraft] = useState({});

  // 管理分頁的新增輸入狀態
  const [newMemberName, setNewMemberName] = useState("");
  const [newSymbolName, setNewSymbolName] = useState("");

  const [editTx, setEditTx] = useState({});
  const [editDiv, setEditDiv] = useState({});
  const [editSym, setEditSym] = useState({});

  useEffect(() => {
    document.title = "nayo money股利工具";
    const faviconSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='30' fill='%238B9D83'/><text y='72' x='28' font-size='60' font-weight='bold' fill='white' font-family='Arial'>$</text></svg>`.trim();
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/svg+xml'; link.rel = 'icon';
    link.href = `data:image/svg+xml,${faviconSvg.replace(/#/g, '%23')}`;
    document.getElementsByTagName('head')[0].appendChild(link);
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
      if (err.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        setError(`網域尚未授權：${domain}。請至 Firebase Console 加入白名單。`);
      } else { setError("登入失敗：" + err.message); }
    }
  };

  useEffect(() => {
    if (!user) return;
    const userPath = (col) => collection(db, 'artifacts', currentAppId, 'users', user.uid, col);
    const unsub1 = onSnapshot(userPath('members'), s => {
      const data = s.docs.map(d => ({id: d.id, ...d.data()}));
      setMembers(data);
      if (data.length > 0 && !txDraft.member) {
        setTxDraft(prev => ({ ...prev, member: data[0].name }));
        setDivDraft(prev => ({ ...prev, member: data[0].name }));
      }
    });
    const unsub2 = onSnapshot(userPath('symbols'), s => {
      const data = s.docs.map(d => ({id: d.id, ...d.data()}));
      setSymbols(data);
      if (data.length > 0 && !txDraft.symbol) {
        setTxDraft(prev => ({ ...prev, symbol: data[0].name }));
        setDivDraft(prev => ({ ...prev, symbol: data[0].name }));
      }
    });
    const unsub3 = onSnapshot(userPath('dividends'), s => setDividends(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsub4 = onSnapshot(userPath('transactions'), s => setTransactions(s.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [user]);

  useEffect(() => {
    const txObj = {}; transactions.forEach(t => txObj[t.id] = { ...t }); setEditTx(txObj);
    const divObj = {}; dividends.forEach(d => divObj[d.id] = { ...d }); setEditDiv(divObj);
    const symObj = {}; symbols.forEach(s => symObj[s.id] = { ...s, currentPrice: s.currentPrice || 0 }); setEditSym(symObj);
  }, [transactions, dividends, symbols]);

  const stats = useMemo(() => {
    const fDivs = dividends.filter(d => filterMember === 'all' || d.member === filterMember);
    const fTx = transactions.filter(t => filterMember === 'all' || t.member === filterMember);
    const totalDiv = fDivs.reduce((a, b) => a + Number(b.amount || 0), 0);
    const totalCost = fTx.reduce((a, b) => a + Number(b.cost || 0), 0);
    const portfolio = {};
    symbols.forEach(s => { portfolio[s.name] = { name: s.name, cost: 0, div: 0, shares: 0, currentPrice: Number(s.currentPrice || 0), lots: [] }; });
    fDivs.forEach(d => { if(portfolio[d.symbol]) portfolio[d.symbol].div += Number(d.amount); });
    fTx.forEach(t => {
      if(portfolio[t.symbol]) {
        portfolio[t.symbol].cost += Number(t.cost);
        portfolio[t.symbol].shares += Number(t.shares || 0);
        if (Number(t.cost) > 0) portfolio[t.symbol].lots.push({ id: t.id, date: t.date, cost: Number(t.cost), shares: Number(t.shares || 0) });
      }
    });
    let totalMarketValue = 0;
    Object.values(portfolio).forEach(p => {
      totalMarketValue += p.shares * p.currentPrice;
      p.lots.forEach(lot => {
        const lotDivs = fDivs.filter(d => d.symbol === p.name && d.date >= lot.date);
        const ratio = p.shares > 0 ? lot.shares / p.shares : 0;
        lot.progress = lot.cost > 0 ? (lotDivs.reduce((s, d) => s + Number(d.amount), 0) * ratio / lot.cost) * 100 : 0;
      });
      p.lots.sort((a,b) => b.date.localeCompare(a.date));
      p.returnIncDiv = p.cost > 0 ? ((p.shares * p.currentPrice + p.div - p.cost) / p.cost) * 100 : 0;
    });
    const monthlyData = {};
    fDivs.forEach(d => {
      const date = new Date(d.date); if (isNaN(date)) return;
      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      monthlyData[key] = (monthlyData[key] || 0) + Number(d.amount);
    });
    return {
      totalDiv, totalMarketValue, totalCost,
      recovery: totalCost > 0 ? (totalDiv / totalCost) * 100 : 0,
      overallReturn: totalCost > 0 ? ((totalMarketValue + totalDiv - totalCost) / totalCost) * 100 : 0,
      items: Object.values(portfolio).filter(i => i.cost !== 0 || i.div > 0 || transactions.some(t => t.symbol === i.name)),
      monthly: Object.entries(monthlyData).sort((a,b) => b[0].localeCompare(a[0])),
    };
  }, [dividends, transactions, symbols, filterMember]);

  const isReady = members.length > 0 && symbols.length > 0;

  const handleUpdate = async (col, id, data) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, col, id), data);
      if (col === 'transactions') { const n = {...editTx}; delete n[id]; setEditTx(n); }
      else if (col === 'dividends') { const n = {...editDiv}; delete n[id]; setEditDiv(n); }
      else if (col === 'symbols') { const n = {...editSym}; delete n[id]; setEditSym(n); }
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
      <RefreshCw size={28} className="animate-spin mb-2" />
      <p className="text-[10px] uppercase tracking-widest italic opacity-60">nayo money booting</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6 text-center">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl border border-[#D9C5B2]/20 animate-in zoom-in mx-auto">
        <div className="bg-[#8B9D83] p-7 rounded-[2rem] text-white shadow-xl mb-6 mx-auto w-20 h-20 flex items-center justify-center">
          <ShieldCheck size={44} />
        </div>
        <h1 className="text-3xl font-black text-[#4A4A4A] tracking-tighter">nayo money</h1>
        <p className="text-[#8B9D83] text-sm mt-2 font-bold mb-10 italic">全家人的理財指揮官</p>
        <button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-slate-100 py-4 rounded-2xl flex items-center justify-center gap-4 font-black text-slate-700 hover:bg-slate-50 transition-all shadow-md active:scale-95 mx-auto">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-6 h-6" />
          Google 帳號登入
        </button>
        {error && <div className="mt-6 p-4 bg-red-50 text-red-500 text-xs font-bold rounded-xl border border-red-100 text-left">{error}</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-900 pb-16 font-sans select-none overflow-x-hidden">
      {/* 頂部 Header */}
      <header className="bg-[#8B9D83] text-white py-1.5 px-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Layers size={16} />
            <h1 className="text-sm md:text-base font-black tracking-tight leading-none text-white">nayo money股利工具</h1>
          </div>
          <div className="flex items-center gap-2">
              <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="bg-white/20 text-white text-[9px] font-black border-none outline-none rounded px-1 py-0.5 backdrop-blur-md cursor-pointer appearance-none">
                <option value="all" className="text-slate-800 bg-white font-bold">全家人</option>
                {members.map(m => <option key={m.id} value={m.name} className="text-slate-800 bg-white font-bold">{m.name}</option>)}
              </select>
              <button onClick={() => signOut(auth)} className="bg-white/10 p-1 rounded-md hover:bg-white/20 transition-all"><LogOut size={12} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-2 md:p-6 lg:p-10 space-y-3 lg:space-y-6">
        
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-center">
              <StatCard title="總投入" value={`$${Math.round(stats.totalCost).toLocaleString()}`} sub="成本" color="#4A4A4A" />
              <StatCard title="總市值" value={`$${Math.round(stats.totalMarketValue).toLocaleString()}`} sub="估值" color="#3B82F6" />
              <StatCard title="回本率" value={`${stats.recovery.toFixed(1)}%`} sub="回收" color="#8B9D83" />
              <StatCard title="總報酬" value={`${stats.overallReturn.toFixed(1)}%`} sub="含息" color={stats.overallReturn >= 0 ? "#10B981" : "#EF4444"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-8 text-left">
              <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-800 text-[10px] md:text-xs tracking-widest uppercase border-b-2 pb-1.5 mb-3 flex items-center gap-2"><Globe size={14} className="text-[#8B9D83]"/> 標的回本監測盤</h3>
                {stats.items.length === 0 ? <p className="text-center text-slate-400 text-xs py-10 italic mx-auto">無紀錄</p> : 
                  stats.items.map(p => (
                    <div key={p.name} className="space-y-1.5 bg-slate-50/50 p-3 rounded-2xl border border-transparent hover:border-[#8B9D83]/20 transition shadow-sm mb-2 text-left">
                      <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => setExpandedSymbol(expandedSymbol === p.name ? null : p.name)}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black uppercase text-slate-700">{p.name}</span>
                          <div className="text-slate-400">{expandedSymbol === p.name ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</div>
                        </div>
                        <div className="text-right">
                           <span className="text-[#8B9D83] font-mono font-black text-base">回本 {Math.round((p.div/Math.max(p.cost, 1))*100)}%</span>
                           <span className={`text-[10px] font-black ml-2 ${p.returnIncDiv >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>含息: {p.returnIncDiv.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1 bg-white rounded-full overflow-hidden shadow-inner border border-slate-50">
                        <div className="h-full bg-[#8B9D83] transition-all duration-1000 shadow-[0_0_10px_rgba(139,157,131,0.2)]" style={{ width: `${Math.min((p.div/Math.max(p.cost, 1))*100, 100)}%` }}></div>
                      </div>
                      {expandedSymbol === p.name && (
                        <div className="mt-2 space-y-1.5 pt-1.5 border-t border-slate-200 animate-in slide-in-from-top-2 text-slate-900">
                          {p.lots.map(lot => (
                            <div key={lot.id} className="flex justify-between text-[10px] font-black">
                              <span><Clock size={10} className="inline mr-1 opacity-50"/>{lot.date}</span>
                              <span>成本 $ {lot.cost.toLocaleString()} ({Math.round(lot.progress)}% 回本)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>

              <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100 h-fit text-left">
                <h3 className="font-black text-slate-800 text-[10px] md:text-xs tracking-widest uppercase border-b-2 pb-1.5 mb-3 flex items-center gap-2 text-left"><BarChart size={14} className="text-[#8B9D83]"/> 每月領息現金流</h3>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1 font-mono text-slate-800">
                  {stats.monthly.length === 0 ? <p className="text-center text-slate-400 text-xs py-10 italic mx-auto">無數據</p> : 
                    stats.monthly.map(([month, amount]) => (
                      <div key={month} className="flex justify-between items-center p-3 bg-[#F2E8D5]/40 rounded-xl shadow-sm hover:bg-[#F2E8D5]/60 transition-colors">
                        <span className="text-[10px] font-black uppercase tracking-wider">{month} 合計</span>
                        <p className="text-base font-black text-[#8B9D83] font-mono">${amount.toLocaleString()}</p>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 投入紀錄 - 加入連動領息功能 */}
        {activeTab === 'invest' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 text-slate-900">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <div className="px-2 mb-2 flex items-center gap-2">
                    <h2 className="font-black text-base md:text-lg text-slate-800 flex items-center gap-2 italic"><TrendingUp size={20} className="text-[#8B9D83]"/> 投入紀錄管理</h2>
                </div>

                {/* 快速新增投入區 */}
                <div className="bg-[#8B9D83]/10 p-3 rounded-2xl border border-[#8B9D83]/20 shadow-sm space-y-3 mb-4">
                   <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-black text-[#8B9D83] uppercase tracking-widest flex items-center gap-1"><PlusCircle size={12}/> 快速新增投入</span>
                      <input type="date" value={txDraft.date} onChange={e => setTxDraft({...txDraft, date: e.target.value})} className="text-[10px] font-black bg-white rounded-md px-2 py-0.5 border border-[#8B9D83]/20 outline-none cursor-pointer" />
                   </div>
                   <div className="flex flex-wrap md:flex-nowrap gap-2 items-center text-slate-800">
                      <div className="flex flex-1 gap-2">
                        <select value={txDraft.member} onChange={e => setTxDraft({...txDraft, member: e.target.value})} className="flex-1 bg-white text-[10px] md:text-xs py-1 px-2 rounded-lg font-black border border-[#8B9D83]/20 outline-none">
                          {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                        <select value={txDraft.symbol} onChange={e => setTxDraft({...txDraft, symbol: e.target.value})} className="flex-1 bg-white text-[10px] md:text-xs py-1 px-2 rounded-lg font-black border border-[#8B9D83]/20 outline-none">
                          {symbols.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-1 gap-2">
                        <SmartInput type="number" placeholder="股數" value={txDraft.shares} onChange={v => setTxDraft({...txDraft, shares: v})} className="w-12 md:w-16 text-center" />
                        <SmartInput type="number" placeholder="成本" value={txDraft.cost} onChange={v => setTxDraft({...txDraft, cost: v})} className="flex-1 text-center" />
                        <button onClick={() => safeAddDoc('transactions', txDraft)} className="bg-[#8B9D83] text-white p-2 rounded-xl shadow-md active:scale-90 hover:bg-[#7A8C72] transition-all flex items-center justify-center">
                          <Send size={16} />
                        </button>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-slate-800">
                  {symbols.map(s => {
                    const txList = transactions.filter(t => t.symbol === s.name && (filterMember === 'all' || t.member === filterMember));
                    if (txList.length === 0 && investExpanded !== s.name) return null;
                    
                    // 💡 內嵌配息草稿邏輯
                    const currentInline = inlineDivDraft[s.name] || { amount: '0', member: members[0]?.name || '', date: new Date().toISOString().split('T')[0] };

                    return (
                      <div key={s.name} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 h-fit transition-all hover:shadow-md text-left text-slate-800">
                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setInvestExpanded(investExpanded === s.name ? null : s.name)}>
                          <span className="text-sm font-black text-slate-700 uppercase tracking-tight">{s.name} <span className="text-[10px] opacity-40">({txList.length} 筆)</span></span>
                          <div className="text-slate-400">{investExpanded === s.name ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</div>
                        </div>
                        {investExpanded === s.name && (
                          <div className="p-2.5 space-y-3 animate-in slide-in-from-top-2 text-slate-900">
                            
                            {/* 💡 標的專屬配息連動區 (妳要求的功能) */}
                            <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100 space-y-2 mb-2">
                               <div className="flex justify-between items-center">
                                  <p className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-1"><DollarSign size={10}/> 紀錄此標的配息</p>
                                  <input type="date" value={currentInline.date} onChange={e => setInlineDivDraft({...inlineDivDraft, [s.name]: {...currentInline, date: e.target.value}})} className="text-[8px] bg-transparent outline-none text-blue-500 font-bold cursor-pointer" />
                               </div>
                               <div className="flex gap-2 items-center">
                                  <select value={currentInline.member} onChange={e => setInlineDivDraft({...inlineDivDraft, [s.name]: {...currentInline, member: e.target.value}})} className="bg-white text-[9px] p-1 rounded-md font-black border border-blue-100 outline-none text-slate-700">
                                    {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                  </select>
                                  <div className="flex-1 flex items-center bg-white border border-blue-100 rounded-md px-2 py-0.5 shadow-inner">
                                      <span className="text-[8px] text-blue-400 font-black mr-1">NT$</span>
                                      <SmartInput type="number" placeholder="金額" value={currentInline.amount} onChange={v => setInlineDivDraft({...inlineDivDraft, [s.name]: {...currentInline, amount: v}})} className="w-full text-right bg-transparent border-none shadow-none focus:ring-0 text-[#8B9D83] font-bold" />
                                  </div>
                                  <button 
                                    onClick={async () => {
                                      await safeAddDoc('dividends', { ...currentInline, symbol: s.name });
                                      setInlineDivDraft({...inlineDivDraft, [s.name]: {...currentInline, amount: '0'}});
                                    }}
                                    className="bg-blue-600 text-white p-1.5 rounded-lg shadow active:scale-90 transition-all"
                                  >
                                    <Send size={14} />
                                  </button>
                               </div>
                            </div>

                            <div className="border-t border-slate-100 pt-2 space-y-3">
                              {txList.sort((a,b) => b.date.localeCompare(a.date)).map(t => {
                                const draft = editTx[t.id] || t;
                                const hasChanged = JSON.stringify(draft) !== JSON.stringify(t);
                                return (
                                  <div key={t.id} className={`p-3 rounded-2xl border-2 transition-all space-y-3 relative ${hasChanged ? 'border-amber-300 bg-amber-50/20 shadow-md scale-[1.01]' : 'border-slate-50 bg-white shadow-sm'}`}>
                                    <div className="flex justify-between items-start">
                                      <input type="date" value={draft.date} onChange={(e) => setEditTx({...editTx, [t.id]: {...draft, date: e.target.value}})} className="text-[10px] md:text-xs font-black outline-none bg-transparent text-slate-700 cursor-pointer" />
                                      <div className="flex items-center gap-1.5">
                                        {hasChanged && ( 
                                          <button onClick={() => handleUpdate('transactions', t.id, draft)} className="bg-emerald-600 text-white px-2 py-0.5 rounded-lg shadow-md hover:scale-105 active:scale-95 flex items-center gap-1 animate-pulse border border-emerald-500/10">
                                            <Check size={14}/> <span className="text-[9px] font-black">儲存</span>
                                          </button> 
                                        )}
                                        <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'transactions', t.id))} className="text-slate-300 hover:text-red-500 p-0.5 transition-all"><Trash2 size={16}/></button>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap md:flex-nowrap gap-1.5 items-center">
                                      <div className="flex flex-1 gap-1">
                                        <select value={draft.member} onChange={(e) => setEditTx({...editTx, [t.id]: {...draft, member: e.target.value}})} className="flex-1 bg-white text-[9px] md:text-[10px] p-0.5 rounded-lg font-black text-slate-800 border border-slate-200 outline-none">
                                          {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                        </select>
                                        <select value={draft.symbol} onChange={(e) => setEditTx({...editTx, [t.id]: {...draft, symbol: e.target.value}})} className="flex-1 bg-white text-[9px] md:text-[10px] p-0.5 rounded-lg font-black text-slate-800 border border-slate-200 outline-none">
                                          {symbols.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                      </div>
                                      <div className="flex-1 flex gap-1">
                                        <SmartInput type="number" value={draft.shares} onChange={v => setEditTx({...editTx, [t.id]: {...draft, shares: v}})} className="w-12 md:w-14 text-center shadow-inner" placeholder="股數" />
                                        <SmartInput type="number" value={draft.cost} onChange={v => setEditTx({...editTx, [t.id]: {...draft, cost: v}})} className="flex-1 text-center text-[#8B9D83] shadow-inner" placeholder="成本" />
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

        {/* 領息流水分頁 */}
        {activeTab === 'dividends' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 text-left text-slate-900">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <div className="px-2 mb-2">
                    <h2 className="font-black text-lg md:text-2xl text-slate-800 flex items-center gap-2 italic"><DollarSign size={24} className="text-[#8B9D83]"/> 領息流水管理</h2>
                </div>

                <div className="bg-[#8B9D83]/10 p-3 rounded-2xl border border-[#8B9D83]/20 shadow-sm space-y-3 mb-4 text-slate-800">
                   <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-black text-[#8B9D83] uppercase tracking-widest flex items-center gap-1"><PlusCircle size={12}/> 快速新增領息</span>
                      <input type="date" value={divDraft.date} onChange={e => setDivDraft({...divDraft, date: e.target.value})} className="text-[10px] font-black bg-white rounded-md px-2 py-0.5 border border-[#8B9D83]/20 outline-none" />
                   </div>
                   <div className="flex flex-wrap md:flex-nowrap gap-2 items-center text-slate-800">
                      <div className="flex flex-1 gap-2">
                        <select value={divDraft.member} onChange={e => setDivDraft({...divDraft, member: e.target.value})} className="flex-1 bg-white text-[10px] md:text-xs py-1 px-2 rounded-lg font-black border border-[#8B9D83]/20 outline-none">
                          {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                        <select value={divDraft.symbol} onChange={e => setDivDraft({...divDraft, symbol: e.target.value})} className="flex-1 bg-white text-[10px] md:text-xs py-1 px-2 rounded-lg font-black border border-[#8B9D83]/20 outline-none">
                          {symbols.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-1 gap-2">
                        <div className="flex-1 flex items-center bg-white border border-[#8B9D83]/20 rounded-lg px-2 py-1 shadow-inner">
                            <span className="text-[9px] text-[#8B9D83] font-black mr-1">NT$</span>
                            <input type="number" value={divDraft.amount} onFocus={e => {if(divDraft.amount==="0") setDivDraft({...divDraft, amount:''}); else e.target.select();}} onBlur={e => {if(e.target.value==="") setDivDraft({...divDraft, amount:'0'})}} onChange={e => setDivDraft({...divDraft, amount: e.target.value})} className="w-full text-right outline-none text-xs font-black bg-transparent text-[#8B9D83]" placeholder="金額" />
                        </div>
                        <button onClick={() => safeAddDoc('dividends', divDraft)} className="bg-[#8B9D83] text-white p-2 rounded-xl shadow-md active:scale-90 hover:bg-[#7A8C72] transition-all">
                          <Send size={16} />
                        </button>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-left">
                  {dividends.sort((a,b) => b.date.localeCompare(a.date)).map(d => {
                    const draft = editDiv[d.id] || d;
                    const hasChanged = JSON.stringify(draft) !== JSON.stringify(d);
                    return (
                      <div key={d.id} className={`p-3 rounded-2xl shadow-sm flex items-center gap-4 border-2 transition-all relative ${hasChanged ? 'border-amber-300 bg-amber-50/20 shadow-md scale-[1.02]' : 'border-slate-50 bg-white shadow-sm hover:border-slate-200'}`}>
                        <div className="flex-1 space-y-1 text-left min-w-0">
                          <input type="date" value={draft.date} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...draft, date: e.target.value}})} className="text-[9px] md:text-xs font-black outline-none italic bg-transparent text-slate-500" />
                          <div className="flex gap-2 items-center truncate text-slate-800">
                            <select value={draft.member} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...draft, member: e.target.value}})} className="bg-[#F2E8D5]/60 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded font-black text-slate-800 border-none outline-none">
                              {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                            </select>
                            <select value={draft.symbol} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...draft, symbol: e.target.value}})} className="font-black text-slate-800 text-[11px] md:text-[12px] bg-transparent border-none outline-none cursor-pointer">
                              {symbols.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="bg-[#F2E8D5]/60 px-2 py-1 rounded-2xl flex items-center gap-1 font-mono shadow-inner border border-[#8B9D83]/10 min-w-[70px]">
                            <span className="text-[9px] text-[#8B9D83] font-black">NT$</span>
                            <SmartInput type="number" value={draft.amount} onChange={v => setEditDiv({...editDiv, [d.id]: {...draft, amount: v}})} className="bg-transparent text-right font-black text-[#8B9D83] w-12 md:w-14 outline-none text-xs border-none focus:ring-0 p-0" />
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-center">
                          {hasChanged && ( 
                            <button onClick={() => handleUpdate('dividends', d.id, draft)} className="bg-emerald-600 text-white p-1 rounded-lg shadow-md hover:scale-110 animate-pulse border border-emerald-500/30">
                              <Check size={18}/>
                            </button> 
                          )}
                          <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'dividends', d.id))} className="text-slate-300 hover:text-red-500 p-0.5 transition-all"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* 管理分頁 */}
        {activeTab === 'masters' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300 text-slate-900 pb-16 text-left">
            <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm space-y-10 border border-slate-50 text-left">
               <div className="space-y-4">
                 <h3 className="font-black text-xs md:text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start text-left mx-auto md:mx-0"><Users size={16}/> 人員管理中心</h3>
                 <div className="flex gap-2 max-w-sm">
                   <SmartInput 
                     placeholder="人員名稱" 
                     className="flex-1 py-2.5 px-4 text-slate-800" 
                     value={newMemberName}
                     onChange={v => setNewMemberName(v)}
                   />
                   <button onClick={async () => {
                     if(newMemberName.trim()) { await safeAddDoc('members', { name: newMemberName.trim() }); setNewMemberName(""); }
                   }} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-black text-sm shadow-md active:scale-95 transition-all hover:bg-blue-700">建立</button>
                 </div>
                 <div className="flex flex-wrap gap-3">
                   {members.map(m => (
                     <span key={m.id} className="bg-blue-50 text-[10px] md:text-xs font-black text-blue-800 px-5 py-2.5 rounded-2xl border border-blue-100 flex items-center gap-2 group shadow-sm transition-all hover:bg-blue-100">
                       {m.name}
                       <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'members', m.id))} className="text-blue-300 hover:text-red-500 transition-colors text-xs font-bold px-1">×</button>
                     </span>
                   ))}
                 </div>
               </div>

               <div className="border-t border-slate-50 pt-10 space-y-4 text-left text-slate-800">
                 <h3 className="font-black text-xs md:text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start text-left mx-auto md:mx-0"><Globe size={16}/> 股票代碼與市價設定</h3>
                 <div className="flex gap-2 max-w-sm text-left">
                   <SmartInput 
                     placeholder="例如: 0050" 
                     className="flex-1 uppercase py-2.5 px-4 text-slate-800" 
                     value={newSymbolName}
                     onChange={v => setNewSymbolName(v.toUpperCase())}
                   />
                   <button onClick={async () => {
                     if(newSymbolName.trim()) { await safeAddDoc('symbols', { name: newSymbolName.trim(), currentPrice: 0 }); setNewSymbolName(""); }
                   }} className="bg-[#8B9D83] text-white px-8 py-2.5 rounded-xl font-black text-sm shadow-md active:scale-95 hover:bg-[#7A8C72] transition-all">新增</button>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6 text-slate-800">
                   {symbols.map(s => {
                     const draft = editSym[s.id] || s; const hasChanged = Number(draft.currentPrice) !== Number(s.currentPrice);
                     return (
                       <div key={s.id} className={`p-5 rounded-3xl border-2 transition-all ${hasChanged ? 'border-amber-300 bg-amber-50/20 shadow-md scale-[1.05]' : 'bg-white border-slate-100 shadow-sm hover:border-slate-300'}`}>
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] font-black uppercase text-slate-800 tracking-wider text-slate-800">{s.name}</span>
                            <div className="flex items-center gap-1 text-slate-800">
                               {hasChanged && ( 
                                 <button onClick={() => handleUpdate('symbols', s.id, draft)} className="bg-emerald-600 text-white p-1.5 rounded-lg shadow-md hover:scale-110 border border-emerald-500/10">
                                   <Check size={14}/>
                                 </button> 
                               )}
                               <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'symbols', s.id))} className="text-slate-300 hover:text-red-500 transition-all p-1 text-[12px]">×</button>
                            </div>
                         </div>
                         <div className="flex items-center gap-1.5 pt-1 text-slate-800">
                           <span className="text-[7px] text-slate-400 font-black uppercase whitespace-nowrap">市價</span>
                           <SmartInput type="number" value={draft.currentPrice} onChange={v => setEditSym({...editSym, [s.id]: {...draft, currentPrice: v}})} className="w-full bg-slate-50 border-none shadow-none focus:ring-0 px-0 text-center font-mono text-[#8B9D83]" placeholder="0" />
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>

               <div className="border-t-2 border-[#8B9D83]/10 pt-12 pb-6 text-center mx-auto text-slate-800">
                 <div className="inline-block group mx-auto">
                   <a href="https://nayomoney.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-5 bg-[#8B9D83]/10 px-10 py-6 rounded-[2.5rem] border-2 border-transparent group-hover:border-[#8B9D83]/20 transition-all shadow-md active:scale-95 mx-auto">
                     <div className="bg-[#8B9D83] p-3 rounded-2xl text-white shadow-lg group-hover:rotate-12 transition-transform">
                       <Heart size={24} fill="white" />
                     </div>
                     <div className="text-left leading-tight">
                       <p className="text-[#8B9D83] font-black text-sm md:text-lg text-left">推薦服務：nayomoney.com</p>
                       <p className="text-[10px] md:text-xs text-slate-500 font-bold mt-1.5 text-left">點擊探索更多財務自由密碼</p>
                     </div>
                     <ExternalLink size={20} className="text-[#8B9D83] opacity-30 group-hover:opacity-100 transition-opacity ml-3" />
                   </a>
                 </div>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* 底部導覽 - 極度扁平 RWD 版 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none md:pb-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto w-full flex justify-center md:justify-end pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-md border border-slate-200 px-4 md:px-10 py-1 shadow-[0_-8px_40px_rgba(0,0,0,0.1)] flex justify-around items-center h-12 md:h-14 w-full md:w-fit md:rounded-full md:gap-10 animate-in slide-in-from-bottom-10 duration-700 text-slate-900">
            <NavBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={24}/>} label="監測" />
            <NavBtn active={activeTab === 'dividends'} onClick={() => setActiveTab('dividends')} icon={<DollarSign size={24}/>} label="領息" />
            <NavBtn active={activeTab === 'invest'} onClick={() => setActiveTab('invest')} icon={<TrendingUp size={24}/>} label="投入" />
            <NavBtn active={activeTab === 'masters'} onClick={() => setActiveTab('masters')} icon={<Users size={24}/>} label="管理" />
          </div>
        </div>
      </nav>
    </div>
  );
}

// --- 子組件 ---
const SetupGuide = ({ onGo }) => (
  <div className="bg-white p-14 rounded-[4rem] text-center space-y-6 shadow-2xl border border-amber-50 animate-in zoom-in max-w-xl mx-auto mt-12 text-slate-800 mx-auto">
    <div className="bg-amber-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-amber-500 shadow-inner mb-3"><AlertCircle size={56} /></div>
    <div className="space-y-2 text-center mx-auto text-slate-800">
      <h3 className="text-3xl font-black tracking-tight text-center">尚未完成初始化</h3>
      <p className="text-base text-slate-500 font-bold px-8 leading-relaxed text-center">請前往「管理」分頁建立人員與標的。</p>
    </div>
    <button onClick={onGo} className="bg-blue-600 text-white w-full max-w-xs py-5 rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all mx-auto tracking-widest uppercase flex items-center justify-center gap-3">立即前往 <ArrowRight size={24}/></button>
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-0.5 transition-all duration-300 px-4 ${active ? 'text-[#8B9D83] scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
    <div className={`${active ? 'bg-[#8B9D83]/10 p-2 rounded-2xl shadow-sm' : 'p-2'} transition-all`}>
      {icon}
    </div>
    <span className={`text-[10px] md:text-sm font-black tracking-widest leading-none ${active ? 'text-[#8B9D83]' : 'text-slate-500'}`}>{label}</span>
  </button>
);

const StatCard = ({ title, value, sub, color }) => (
  <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-50 active:scale-95 transition-transform text-center relative overflow-hidden group hover:shadow-xl mx-auto text-slate-800">
    <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: color, opacity: 0.4 }}></div>
    <p className="text-[11px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-3 leading-none">{title}</p>
    <p className={`text-2xl md:text-4xl font-mono font-black tracking-tighter leading-none`} style={{ color }}>{value}</p>
    <p className="text-[9px] md:text-[11px] text-slate-400 font-black italic tracking-wider uppercase opacity-80 mt-4 leading-none">{sub}</p>
  </div>
);
