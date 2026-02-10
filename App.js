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
  Globe, BarChart, ExternalLink, Copy, Heart, Save
} from 'lucide-react';

/**
 * nayo money 股利工具 v12.0 - 視覺美化與交互精準版
 * 更新重點：
 * 1. 導覽壓縮：極致調低底部選單高度，解決截圖中過高的問題。
 * 2. 輸入修復：數字欄位點擊自動清空 0，解決「090」輸入困擾。
 * 3. 溢出修正：縮減金額框寬度，確保領息分頁在手機上 100% 呈現。
 * 4. 摺疊修復：強化投入與監測分頁的摺疊箭頭點擊範圍。
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

// --- 2. 高度精簡輸入組件 (解決 0 不能刪除的問題) ---
const SlimInput = ({ value, onChange, className, type = "text", placeholder }) => {
  const handleFocus = (e) => {
    // 💡 解決預設 0 的困擾：如果值是 0，點擊時自動清空，讓使用者直接輸入
    if (String(value) === "0") {
      onChange("");
    } else {
      e.target.select();
    }
  };

  const handleBlur = (e) => {
    // 💡 如果離開時是空的，自動補回 0
    if (e.target.value === "") {
      onChange("0");
    }
  };

  return (
    <input
      type={type}
      inputMode={type === "number" ? "numeric" : "text"}
      className={`${className} text-sm font-black py-0.5 px-1.5 text-slate-800 outline-none transition-all border border-slate-200 rounded-md focus:ring-2 ring-[#8B9D83]/20 bg-white`}
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
    const unsub1 = onSnapshot(userPath('members'), s => setMembers(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsub2 = onSnapshot(userPath('symbols'), s => setSymbols(s.docs.map(d => ({id: d.id, ...d.data()}))));
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

  const safeAddDoc = async (colName, data) => {
    if (!user) return;
    try { if (colName === 'transactions') setInvestExpanded(data.symbol); await addDoc(collection(db, 'artifacts', currentAppId, 'users', user.uid, colName), { ...data, createdAt: serverTimestamp() }); } catch (e) { setError("連線失敗。"); }
  };

  const handleUpdate = async (col, id, data) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, col, id), data);
      if (col === 'transactions') { const n = {...editTx}; delete n[id]; setEditTx(n); }
      else if (col === 'dividends') { const n = {...editDiv}; delete n[id]; setEditDiv(n); }
      else if (col === 'symbols') { const n = {...editSym}; delete n[id]; setEditSym(n); }
    } catch (e) { setError("更新失敗。"); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F2E8D5] flex flex-col items-center justify-center font-bold text-[#8B9D83]">
      <RefreshCw size={32} className="animate-spin mb-2" />
      <p className="text-xs uppercase tracking-widest">nayo money booting</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#F2E8D5] flex items-center justify-center p-6 text-center">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl border border-[#D9C5B2]/20">
        <div className="bg-[#8B9D83] p-7 rounded-[2rem] text-white shadow-xl mb-6 mx-auto w-20 h-20 flex items-center justify-center animate-in zoom-in duration-500">
          <ShieldCheck size={44} />
        </div>
        <h1 className="text-2xl font-black text-[#4A4A4A] tracking-tighter">nayo money</h1>
        <p className="text-[#8B9D83] text-xs mt-2 font-bold italic mb-10">守護財富底氣 v12.0</p>
        <button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-slate-100 py-4 rounded-2xl flex items-center justify-center gap-4 font-black text-slate-700 hover:bg-slate-50 transition-all shadow-md active:scale-95">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-6 h-6" />
          Google 帳號登入
        </button>
        {error && <div className="mt-8 p-4 bg-red-50 text-red-500 text-xs font-bold leading-relaxed rounded-2xl">{error}</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2E8D5] text-slate-900 pb-16 font-sans select-none overflow-x-hidden">
      {/* Header - 極致壓縮高度 */}
      <header className="bg-[#8B9D83] text-white py-1 px-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Layers size={14} />
            <h1 className="text-sm font-black leading-none tracking-tight">nayo money股利工具</h1>
          </div>
          <div className="flex items-center gap-2">
              <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="bg-white/20 text-white text-[9px] font-black border-none outline-none rounded px-1.5 py-0.5 backdrop-blur-md appearance-none shadow-sm">
                <option value="all" className="text-slate-800 bg-white">全家人</option>
                {members.map(m => <option key={m.id} value={m.name} className="text-slate-800 bg-white">{m.name}</option>)}
              </select>
              <button onClick={() => signOut(auth)} className="bg-white/10 p-1 rounded-md hover:bg-white/20 transition-all"><LogOut size={12} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-2 md:p-4 space-y-2.5">
        {activeTab === 'overview' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
              <StatCard title="總本金" value={`$${Math.round(stats.totalCost).toLocaleString()}`} sub="成本" color="#4A4A4A" />
              <StatCard title="總市值" value={`$${Math.round(stats.totalMarketValue).toLocaleString()}`} sub="現值" color="#3B82F6" />
              <StatCard title="回本率" value={`${stats.recovery.toFixed(1)}%`} sub="回收" color="#8B9D83" />
              <StatCard title="總報酬" value={`${stats.overallReturn.toFixed(1)}%`} sub="含息" color={stats.overallReturn >= 0 ? "#10B981" : "#EF4444"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-3 shadow-sm space-y-1.5 border border-slate-100">
                <h3 className="font-black text-slate-800 text-[9px] tracking-widest uppercase border-b pb-0.5 flex items-center gap-2"><Globe size={10} className="text-[#8B9D83]"/> 回本監測盤</h3>
                {stats.items.length === 0 ? <p className="text-center text-slate-400 text-[9px] py-4 italic">無資料</p> : 
                  stats.items.map(p => (
                    <div key={p.name} className="space-y-1 bg-slate-50/60 p-2 rounded-lg border border-transparent hover:border-[#8B9D83]/20 transition shadow-sm mb-1">
                      <div className="flex justify-between items-center cursor-pointer select-none" onClick={(e) => { e.stopPropagation(); setExpandedSymbol(expandedSymbol === p.name ? null : p.name); }}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black uppercase text-slate-700">{p.name}</span>
                          <div className="text-slate-400">{expandedSymbol === p.name ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}</div>
                        </div>
                        <div className="text-right">
                           <span className="text-[#8B9D83] font-mono font-black text-sm">回本 {Math.round((p.div/Math.max(p.cost, 1))*100)}%</span>
                           <span className={`text-[9px] font-black ml-2 ${p.returnIncDiv >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>含息: {p.returnIncDiv.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1 bg-white rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-[#8B9D83] transition-all duration-1000" style={{ width: `${Math.min((p.div/Math.max(p.cost, 1))*100, 100)}%` }}></div>
                      </div>
                      {expandedSymbol === p.name && (
                        <div className="mt-1 space-y-1 pt-1 border-t border-slate-200/50 animate-in slide-in-from-top-2">
                          {p.lots.map(lot => (
                            <div key={lot.id} className="flex justify-between text-[9px] font-black text-slate-500">
                              <span><Clock size={8} className="inline mr-1"/>{lot.date}</span>
                              <span>$ {lot.cost.toLocaleString()} ({Math.round(lot.progress)}% 回本)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>

              <div className="bg-white rounded-xl p-3 shadow-sm space-y-1.5 border border-slate-100">
                <h3 className="font-black text-slate-800 text-[9px] tracking-widest uppercase border-b pb-0.5 flex items-center gap-2"><BarChart size={10} className="text-[#8B9D83]"/> 每月領息現金流</h3>
                <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                  {stats.monthly.length === 0 ? <p className="text-center text-slate-400 text-[9px] py-4 italic mx-auto text-slate-800">暫無數據</p> : 
                    stats.monthly.map(([month, amount]) => (
                      <div key={month} className="flex justify-between items-center p-2 bg-[#F2E8D5]/30 rounded-xl shadow-sm text-slate-800">
                        <span className="text-[9px] font-black uppercase tracking-wider">{month} 合計</span>
                        <p className="text-sm font-black text-[#8B9D83] font-mono">${amount.toLocaleString()}</p>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 投入紀錄 - 緊湊排版 */}
        {activeTab === 'invest' && (
          <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <div className="flex justify-between items-center px-2">
                    <h2 className="font-black text-sm text-slate-800 flex items-center gap-2 italic"><TrendingUp size={16}/> 投入明細 (點擊儲存)</h2>
                    <button onClick={() => safeAddDoc('transactions', { member: members[0]?.name || '本人', symbol: symbols[0]?.name || '0050', cost: 0, shares: 0, date: new Date().toISOString().split('T')[0] })} className="bg-[#8B9D83] text-white p-1.5 rounded-lg shadow-md active:scale-95 transition-all"><PlusCircle size={16}/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {symbols.map(s => {
                    const txList = transactions.filter(t => t.symbol === s.name && (filterMember === 'all' || t.member === filterMember));
                    if (txList.length === 0 && investExpanded !== s.name) return null;
                    return (
                      <div key={s.name} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
                        <div 
                          className="p-2.5 bg-[#8B9D83]/5 border-b border-slate-50 flex justify-between items-center cursor-pointer select-none" 
                          onClick={(e) => { e.stopPropagation(); setInvestExpanded(investExpanded === s.name ? null : s.name); }}
                        >
                          <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{s.name} <span className="text-[8px] opacity-40">({txList.length})</span></span>
                          <div className="text-slate-400">{investExpanded === s.name ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</div>
                        </div>
                        {investExpanded === s.name && (
                          <div className="p-1.5 space-y-1.5 animate-in slide-in-from-top-2">
                            {txList.sort((a,b) => b.date.localeCompare(a.date)).map(t => {
                              const draft = editTx[t.id] || t;
                              const hasChanged = JSON.stringify(draft) !== JSON.stringify(t);
                              return (
                                <div key={t.id} className={`p-2 rounded-xl border transition-all space-y-1.5 relative ${hasChanged ? 'border-amber-300 bg-amber-50/20 shadow-sm' : 'border-slate-50 bg-slate-50/30'}`}>
                                  <div className="flex justify-between items-center">
                                    <input type="date" value={draft.date} onChange={(e) => setEditTx({...editTx, [t.id]: {...draft, date: e.target.value}})} className="text-[9px] font-black outline-none italic bg-transparent text-slate-700 cursor-pointer" />
                                    <div className="flex items-center gap-1.5">
                                      {hasChanged && ( 
                                        <button onClick={() => handleUpdate('transactions', t.id, draft)} className="bg-emerald-600 text-white px-2 py-0.5 rounded-md shadow-lg transition-all flex items-center gap-1 animate-pulse">
                                          <Check size={14}/> <span className="text-[8px] font-black">儲存</span>
                                        </button> 
                                      )}
                                      <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'transactions', t.id))} className="text-slate-400 hover:text-red-500 p-0.5"><Trash2 size={12}/></button>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 items-center">
                                    <select value={draft.member} onChange={(e) => setEditTx({...editTx, [t.id]: {...draft, member: e.target.value}})} className="w-16 bg-white text-[9px] p-0.5 rounded font-black text-slate-700 border border-slate-200 outline-none">
                                      {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                    </select>
                                    <SlimInput type="number" value={draft.shares} onChange={v => setEditTx({...editTx, [t.id]: {...draft, shares: v}})} className="flex-1 text-center" placeholder="股數" />
                                    <SlimInput type="number" value={draft.cost} onChange={v => setEditTx({...editTx, [t.id]: {...draft, cost: v}})} className="flex-1 text-center text-[#8B9D83]" placeholder="成本" />
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

        {/* 領息紀錄 - 寬度優化 */}
        {activeTab === 'dividends' && (
          <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <div className="flex justify-between items-center px-2">
                    <h2 className="font-black text-sm text-slate-800 flex items-center gap-2 italic"><DollarSign size={18} className="text-[#8B9D83]"/> 領息流水 (點擊儲存)</h2>
                    <button onClick={() => safeAddDoc('dividends', { member: members[0]?.name || '本人', symbol: symbols[0]?.name || '0050', amount: 0, date: new Date().toISOString().split('T')[0] })} className="bg-[#8B9D83] text-white p-1.5 rounded-lg shadow-md active:rotate-90 transition-all"><PlusCircle size={18}/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-900">
                  {dividends.sort((a,b) => b.date.localeCompare(a.date)).map(d => {
                    const draft = editDiv[d.id] || d;
                    const hasChanged = JSON.stringify(draft) !== JSON.stringify(d);
                    return (
                      <div key={d.id} className={`p-2 rounded-xl shadow-sm flex items-center gap-2 border transition-all relative ${hasChanged ? 'border-amber-300 bg-amber-50/20 shadow-md' : 'border-slate-50 bg-white hover:border-[#8B9D83]/20'}`}>
                        <div className="flex-1 space-y-0 text-left min-w-0">
                          <input type="date" value={draft.date} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...draft, date: e.target.value}})} className="text-[8px] font-black outline-none italic bg-transparent text-slate-500 cursor-pointer" />
                          <div className="flex gap-1 items-center truncate">
                            <select value={draft.member} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...draft, member: e.target.value}})} className="bg-[#F2E8D5]/60 text-[8px] px-0.5 py-0 rounded font-black text-slate-800 border-none outline-none">
                              {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                            </select>
                            <select value={draft.symbol} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...draft, symbol: e.target.value}})} className="font-black text-slate-800 text-[10px] bg-transparent border-none outline-none">
                              {symbols.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                          </div>
                        </div>
                        {/* 💡 極致縮短金額框寬度：w-12 */}
                        <div className="bg-[#F2E8D5]/60 px-1.5 py-0.5 rounded-lg flex items-center gap-0.5 font-mono shadow-inner border border-[#8B9D83]/10">
                            <span className="text-[8px] text-[#8B9D83] font-black">NT$</span>
                            <SlimInput type="number" value={draft.amount} onChange={v => setEditDiv({...editDiv, [d.id]: {...draft, amount: v}})} className="bg-transparent text-right font-black text-[#8B9D83] w-12 outline-none text-[11px] border-none focus:ring-0" />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {hasChanged && ( 
                            <button onClick={() => handleUpdate('dividends', d.id, draft)} className="bg-emerald-600 text-white p-1 rounded shadow-md hover:scale-110 transition-all flex items-center animate-pulse">
                              <Check size={14}/>
                            </button> 
                          )}
                          <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'dividends', d.id))} className="text-slate-300 hover:text-red-500 p-0.5 transition-all"><Trash2 size={12}/></button>
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
          <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-300 text-slate-900 pb-10">
            <div className="bg-white p-4 rounded-xl shadow-sm space-y-4 border border-slate-50 text-center md:text-left">
               <div className="space-y-2">
                 <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start"><Users size={12}/> 人員設定</h3>
                 <div className="flex gap-2">
                   <SlimInput id="memIn" placeholder="例如: 媽媽" className="flex-1 shadow-inner" onChange={() => {}} />
                   <button onClick={async () => {
                     const el = document.getElementById('memIn'); const val = el.value.trim();
                     if(val) { await safeAddDoc('members', { name: val }); el.value = ''; }
                   }} className="bg-blue-600 text-white px-4 py-1 rounded-lg font-black text-xs shadow-md active:scale-95 transition-all">建立</button>
                 </div>
                 <div className="flex flex-wrap gap-1 justify-center md:justify-start">
                   {members.map(m => (
                     <span key={m.id} className="bg-blue-50 text-[9px] font-black text-blue-800 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-2 group shadow-sm">
                       {m.name}
                       <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'members', m.id))} className="text-blue-300 hover:text-red-500 transition-all">×</button>
                     </span>
                   ))}
                 </div>
               </div>

               <div className="border-t border-slate-50 pt-3 space-y-2 text-center md:text-left">
                 <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start"><Globe size={12}/> 股票現價 (點擊儲存)</h3>
                 <div className="flex gap-2">
                   <SlimInput id="symbolIn" placeholder="例如: 0050" className="flex-1 uppercase shadow-inner" onChange={() => {}} />
                   <button onClick={async () => {
                     const el = document.getElementById('symbolIn'); const val = el.value.toUpperCase().trim();
                     if(val) { await safeAddDoc('symbols', { name: val, currentPrice: 0 }); el.value = ''; }
                   }} className="bg-[#8B9D83] text-white px-4 py-1 rounded-lg font-black text-xs shadow-md active:scale-95 transition-all">新增</button>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   {symbols.map(s => {
                     const draft = editSym[s.id] || s; const hasChanged = Number(draft.currentPrice) !== Number(s.currentPrice);
                     return (
                       <div key={s.id} className={`p-2 rounded-lg border transition-all ${hasChanged ? 'border-amber-300 bg-amber-50/20 shadow-md' : 'bg-white border-slate-50 shadow-sm'}`}>
                         <div className="flex justify-between items-center mb-1 text-slate-800">
                            <span className="text-[10px] font-black uppercase">{s.name}</span>
                            <div className="flex items-center gap-1">
                               {hasChanged && ( 
                                 <button onClick={() => handleUpdate('symbols', s.id, draft)} className="bg-emerald-600 text-white p-0.5 rounded shadow-md hover:scale-110">
                                   <Check size={12}/>
                                 </button> 
                               )}
                               <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'symbols', s.id))} className="text-slate-300 hover:text-red-500 transition-all p-0.5 text-[10px]">×</button>
                            </div>
                         </div>
                         <div className="flex items-center gap-1.5">
                           <span className="text-[7px] text-slate-400 font-black uppercase">市價</span>
                           <SlimInput type="number" value={draft.currentPrice} onChange={v => setEditSym({...editSym, [s.id]: {...draft, currentPrice: v}})} className="w-full text-center font-mono text-[#8B9D83] border-none shadow-none focus:ring-0 px-0" placeholder="0" />
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>

               <div className="border-t border-[#8B9D83]/10 pt-6 pb-2 text-center">
                 <div className="inline-block group">
                   <a href="https://nayomoney.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-[#8B9D83]/10 px-5 py-3 rounded-2xl border-2 border-transparent group-hover:border-[#8B9D83]/20 transition-all shadow-md active:scale-95 mx-auto">
                     <div className="bg-[#8B9D83] p-1.5 rounded-xl text-white shadow-lg"><Heart size={14} fill="white" /></div>
                     <div className="text-left leading-tight">
                       <p className="text-[#8B9D83] font-black text-[11px] text-left">推薦服務：nayomoney.com</p>
                       <p className="text-[9px] text-slate-500 font-bold text-left">探索財務自由密碼</p>
                     </div>
                     <ExternalLink size={14} className="text-[#8B9D83] opacity-30 group-hover:opacity-100 transition-opacity ml-1" />
                   </a>
                 </div>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* 底部導覽 - 極度扁平化壓縮 (解決紅框太高的問題) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-4 py-1.5 flex justify-center shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-50 rounded-t-2xl">
        <div className="max-w-2xl w-full flex justify-around items-center">
          <NavBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={18}/>} label="監測" />
          <NavBtn active={activeTab === 'dividends'} onClick={() => setActiveTab('dividends')} icon={<DollarSign size={18}/>} label="領息" />
          <NavBtn active={activeTab === 'invest'} onClick={() => setActiveTab('invest')} icon={<TrendingUp size={18}/>} label="投入" />
          <NavBtn active={activeTab === 'masters'} onClick={() => setActiveTab('masters')} icon={<Users size={18}/>} label="管理" />
        </div>
      </nav>
    </div>
  );
}

// --- 子組件 ---
const SetupGuide = ({ onGo }) => (
  <div className="bg-white p-8 rounded-[2.5rem] text-center space-y-4 shadow-xl border border-amber-50 animate-in zoom-in max-w-xl mx-auto mt-6 text-slate-800 text-center">
    <div className="bg-amber-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-amber-500 shadow-inner mb-2"><AlertCircle size={36} /></div>
    <h3 className="text-xl font-black tracking-tight text-[#4A4A4A]">尚未完成初始設定</h3>
    <p className="text-xs text-slate-500 font-black px-4 leading-relaxed">請前往「管理」分頁建立人員與標的。</p>
    <button onClick={onGo} className="bg-blue-600 text-white w-full max-w-xs py-4 rounded-[1.2rem] font-black text-sm shadow-xl active:scale-95 transition-all mx-auto tracking-widest uppercase">立即前往 <ArrowRight size={18} className="inline ml-1"/></button>
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${active ? 'text-[#8B9D83] scale-105' : 'text-slate-400'}`}>
    <div className={`${active ? 'bg-[#8B9D83]/10 p-1.5 rounded-lg' : 'p-1'}`}>{icon}</div>
    <span className={`text-[8px] font-black tracking-widest ${active ? 'text-[#8B9D83]' : 'text-slate-500'}`}>{label}</span>
  </button>
);

const StatCard = ({ title, value, sub, color }) => (
  <div className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-50 active:scale-95 transition-transform text-center relative overflow-hidden group">
    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color, opacity: 0.35 }}></div>
    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5 leading-none">{title}</p>
    <p className={`text-sm font-mono font-black tracking-tighter text-slate-800 leading-none`} style={{ color }}>{value}</p>
    <p className="text-[6px] text-slate-400 font-black italic tracking-wider uppercase opacity-70 mt-0.5">{sub}</p>
  </div>
);