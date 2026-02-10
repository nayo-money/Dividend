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
  Globe, BarChart, ExternalLink, Copy, Heart, Save, Send
} from 'lucide-react';

/**
 * nayo money 股利工具 v19.0 - 終極穩定收合版
 * 更新重點：
 * 1. 管理功能修復：解決手機版點擊「建立」按鈕無效的問題，改用標準受控輸入框。
 * 2. 領息收合化：領息分頁全面比照投入分頁，改為「代碼分群、摺疊收合」樣式。
 * 3. 快速連動：每個標的收合區內建「快速配息紀錄」功能，先選代碼再新增。
 * 4. 寬度精修：股數與金額框 w-12，徹底解決手機版溢出與按鈕重疊。
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

// --- 2. 數字專用輸入組件 (修復 0 不能刪問題) ---
const NumberInput = ({ value, onChange, className, placeholder, ...props }) => {
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
  const handleChange = (e) => {
    let val = e.target.value;
    // 自動去零：090 -> 90
    if (val.length > 1 && val.startsWith('0')) val = val.replace(/^0+/, '') || '0';
    onChange(val);
  };

  return (
    <input
      {...props}
      type="number"
      inputMode="decimal"
      className={`${className} text-xs md:text-sm font-black py-1 px-1 text-slate-800 outline-none transition-all border border-slate-200 rounded-lg focus:ring-2 ring-[#8B9D83]/20 bg-white shadow-inner`}
      value={value}
      placeholder={placeholder}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
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

  // 草稿狀態
  const [txDraft, setTxDraft] = useState({ member: '', symbol: '', cost: '0', shares: '0', date: new Date().toISOString().split('T')[0] });
  const [divDrafts, setDivDrafts] = useState({});

  // 管理頁面新增輸入框狀態 (分開處理以修復手機點擊問題)
  const [newMemName, setNewMemName] = useState("");
  const [newSymName, setNewSymName] = useState("");

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
      }
    });
    const unsub2 = onSnapshot(userPath('symbols'), s => {
      const data = s.docs.map(d => ({id: d.id, ...d.data()}));
      setSymbols(data);
      if (data.length > 0 && !txDraft.symbol) {
        setTxDraft(prev => ({ ...prev, symbol: data[0].name }));
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
    } catch (e) { setError("連線失敗。"); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center font-bold text-[#8B9D83]">
      <RefreshCw size={28} className="animate-spin mb-2" />
      <p className="text-[10px] uppercase tracking-widest opacity-60">nayo money booting</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6 text-center">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl border border-[#D9C5B2]/20 animate-in zoom-in mx-auto text-slate-800">
        <div className="bg-[#8B9D83] p-7 rounded-[2rem] text-white shadow-xl mb-6 mx-auto w-20 h-20 flex items-center justify-center">
          <ShieldCheck size={44} />
        </div>
        <h1 className="text-3xl font-black tracking-tighter">nayo money</h1>
        <p className="text-[#8B9D83] text-sm mt-2 font-bold mb-10 italic">全家人的理財指揮官</p>
        <button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-slate-100 py-4 rounded-2xl flex items-center justify-center gap-4 font-black text-slate-700 hover:bg-slate-50 shadow-md active:scale-95">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-6 h-6" />
          Google 帳號登入
        </button>
        {error && <div className="mt-6 p-4 bg-red-50 text-red-500 text-xs font-bold rounded-xl">{error}</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-900 pb-16 font-sans select-none overflow-x-hidden">
      <header className="bg-[#8B9D83] text-white py-1.5 px-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Layers size={16} />
            <h1 className="text-sm md:text-base font-black tracking-tight leading-none text-white">nayo money股利工具</h1>
          </div>
          <div className="flex items-center gap-2 text-slate-800">
              <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="bg-white/20 text-white text-[9px] font-black border-none outline-none rounded px-1.5 py-0.5 backdrop-blur-md cursor-pointer appearance-none">
                <option value="all" className="bg-white font-bold">全家人</option>
                {members.map(m => <option key={m.id} value={m.name} className="bg-white font-bold">{m.name}</option>)}
              </select>
              <button onClick={() => signOut(auth)} className="bg-white/10 p-1 rounded-md hover:bg-white/20 transition-all text-white"><LogOut size={12} /></button>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-8 text-left text-slate-800">
              <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-800 text-[10px] md:text-xs tracking-widest uppercase border-b-2 pb-1.5 mb-3 flex items-center gap-2"><Globe size={14} className="text-[#8B9D83]"/> 標的回本監測盤</h3>
                {stats.items.length === 0 ? <p className="text-center text-slate-400 text-xs py-10 italic mx-auto">無紀錄</p> : 
                  stats.items.map(p => (
                    <div key={p.name} className="space-y-1.5 bg-slate-50/50 p-3 rounded-2xl border border-transparent hover:border-[#8B9D83]/20 transition shadow-sm mb-2 text-left">
                      <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => setExpandedSymbol(expandedSymbol === p.name ? null : p.name)}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black uppercase">{p.name}</span>
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

              <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100 h-fit text-left text-slate-800">
                <h3 className="font-black text-slate-800 text-[10px] md:text-xs tracking-widest uppercase border-b-2 pb-1.5 mb-3 flex items-center gap-2 text-left text-slate-800"><BarChart size={14} className="text-[#8B9D83]"/> 每月領息現金流</h3>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1 font-mono text-slate-800">
                  {stats.monthly.length === 0 ? <p className="text-center text-slate-400 text-xs py-10 italic mx-auto text-slate-800">無數據</p> : 
                    stats.monthly.map(([month, amount]) => (
                      <div key={month} className="flex justify-between items-center p-3 bg-[#F2E8D5]/40 rounded-xl shadow-sm hover:bg-[#F2E8D5]/60 transition-colors text-slate-800">
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

        {activeTab === 'invest' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 text-slate-900">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <div className="px-2 mb-2">
                    <h2 className="font-black text-base md:text-lg text-slate-800 flex items-center gap-2 italic"><TrendingUp size={20} className="text-[#8B9D83]"/> 投入紀錄管理</h2>
                </div>

                {/* 快速新增投入 */}
                <div className="bg-[#8B9D83]/10 p-3 rounded-2xl border border-[#8B9D83]/20 shadow-sm space-y-3 mb-4 text-slate-800">
                   <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-black text-[#8B9D83] uppercase tracking-widest flex items-center gap-1 text-slate-800"><PlusCircle size={12}/> 快速新增投入</span>
                      <input type="date" value={txDraft.date} onChange={e => setTxDraft({...txDraft, date: e.target.value})} className="text-[10px] font-black bg-white rounded-md px-2 py-0.5 border border-[#8B9D83]/20 outline-none text-slate-800" />
                   </div>
                   <div className="flex flex-wrap md:flex-nowrap gap-2 items-center text-slate-800">
                      <div className="flex flex-1 gap-1">
                        <select value={txDraft.member} onChange={e => setTxDraft({...txDraft, member: e.target.value})} className="flex-1 bg-white text-[9px] md:text-xs py-1 px-1 rounded-lg font-black border border-[#8B9D83]/20 text-slate-800">
                          {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                        <select value={txDraft.symbol} onChange={e => setTxDraft({...txDraft, symbol: e.target.value})} className="flex-1 bg-white text-[9px] md:text-xs py-1 px-1 rounded-lg font-black border border-[#8B9D83]/20 text-slate-800">
                          {symbols.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-1 gap-1 items-center">
                        <NumberInput placeholder="股數" value={txDraft.shares} onChange={v => setTxDraft({...txDraft, shares: v})} className="w-12 md:w-16 text-center" />
                        <NumberInput placeholder="成本" value={txDraft.cost} onChange={v => setTxDraft({...txDraft, cost: v})} className="flex-1 text-center" />
                        <button onClick={() => safeAddDoc('transactions', txDraft)} className="bg-[#8B9D83] text-white p-2 rounded-xl shadow-md active:scale-90 flex items-center justify-center">
                          <Send size={14} />
                        </button>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {symbols.map(s => {
                    const txList = transactions.filter(t => t.symbol === s.name && (filterMember === 'all' || t.member === filterMember));
                    if (txList.length === 0 && investExpanded !== s.name) return null;
                    return (
                      <div key={s.name} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 h-fit text-slate-800">
                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center cursor-pointer" onClick={() => setInvestExpanded(investExpanded === s.name ? null : s.name)}>
                          <span className="text-sm font-black uppercase text-slate-700">{s.name} <span className="text-[10px] opacity-40">({txList.length})</span></span>
                          <div className="text-slate-400">{investExpanded === s.name ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</div>
                        </div>
                        {investExpanded === s.name && (
                          <div className="p-2 space-y-3 animate-in slide-in-from-top-2 text-slate-900">
                            {txList.sort((a,b) => b.date.localeCompare(a.date)).map(t => {
                              const draft = editTx[t.id] || t;
                              const hasChanged = JSON.stringify(draft) !== JSON.stringify(t);
                              return (
                                <div key={t.id} className={`p-3 rounded-2xl border-2 transition-all space-y-2 relative ${hasChanged ? 'border-amber-300 bg-amber-50/20 shadow-md scale-[1.01]' : 'border-slate-50 bg-white shadow-sm'}`}>
                                  <div className="flex justify-between items-start">
                                    <input type="date" value={draft.date} onChange={(e) => setEditTx({...editTx, [t.id]: {...draft, date: e.target.value}})} className="text-[10px] md:text-xs font-black outline-none bg-transparent text-slate-700 cursor-pointer" />
                                    <div className="flex items-center gap-1.5">
                                      {hasChanged && ( 
                                        <button onClick={() => handleUpdate('transactions', t.id, draft)} className="bg-emerald-600 text-white px-2 py-0.5 rounded-lg shadow-md flex items-center gap-1 animate-pulse">
                                          <Check size={14}/> <span className="text-[9px] font-black">存</span>
                                        </button> 
                                      )}
                                      <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'transactions', t.id))} className="text-slate-300 hover:text-red-500 p-0.5"><Trash2 size={16}/></button>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap md:flex-nowrap gap-1 items-center">
                                    <div className="flex flex-1 gap-1">
                                      <select value={draft.member} onChange={(e) => setEditTx({...editTx, [t.id]: {...draft, member: e.target.value}})} className="flex-1 bg-white text-[9px] p-0.5 rounded-lg font-black text-slate-800 border border-slate-200">
                                        {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                      </select>
                                      <select value={draft.symbol} onChange={(e) => setEditTx({...editTx, [t.id]: {...draft, symbol: e.target.value}})} className="flex-1 bg-white text-[9px] p-0.5 rounded-lg font-black text-slate-800 border border-slate-200">
                                        {symbols.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                      </select>
                                    </div>
                                    <div className="flex flex-1 gap-1">
                                      <NumberInput value={draft.shares} onChange={v => setEditTx({...editTx, [t.id]: {...draft, shares: v}})} className="w-12 md:w-14 text-center" placeholder="股數" />
                                      <NumberInput value={draft.cost} onChange={v => setEditTx({...editTx, [t.id]: {...draft, cost: v}})} className="flex-1 text-center text-[#8B9D83]" placeholder="成本" />
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

        {/* 領息紀錄 - 同步投入的摺疊分群樣式 */}
        {activeTab === 'dividends' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 text-slate-900">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <div className="px-2 mb-2">
                    <h2 className="font-black text-base md:text-lg text-slate-800 flex items-center gap-2 italic"><DollarSign size={24} className="text-[#8B9D83]"/> 領息紀錄管理</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {symbols.map(s => {
                    const divList = dividends.filter(d => d.symbol === s.name && (filterMember === 'all' || d.member === filterMember));
                    if (divList.length === 0 && divExpanded !== s.name) return null;

                    // 標的專屬領息草稿
                    const currentDraft = divDrafts[s.name] || { amount: '0', member: members[0]?.name || '', date: new Date().toISOString().split('T')[0] };

                    return (
                      <div key={s.name} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 h-fit text-slate-800">
                        {/* 摺疊標題 */}
                        <div 
                          className="p-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center cursor-pointer hover:bg-blue-100 transition-colors" 
                          onClick={() => setDivExpanded(divExpanded === s.name ? null : s.name)}
                        >
                          <span className="text-sm font-black text-slate-700 uppercase tracking-tight">{s.name} <span className="text-[10px] opacity-40">({divList.length} 筆)</span></span>
                          <div className="text-slate-400">{divExpanded === s.name ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</div>
                        </div>

                        {divExpanded === s.name && (
                          <div className="p-2.5 space-y-3 animate-in slide-in-from-top-2 text-slate-900">
                            
                            {/* 快速新增此標的領息 */}
                            <div className="bg-[#8B9D83]/10 p-2 rounded-xl border border-[#8B9D83]/20 space-y-2 mb-2 text-slate-800">
                               <div className="flex justify-between items-center">
                                  <p className="text-[9px] font-black text-[#8B9D83] uppercase flex items-center gap-1"><PlusCircle size={10}/> 紀錄此標的配息</p>
                                  <input type="date" value={currentDraft.date} onChange={e => setDivDrafts({...divDrafts, [s.name]: {...currentDraft, date: e.target.value}})} className="text-[8px] bg-transparent outline-none text-[#8B9D83] font-bold cursor-pointer" />
                               </div>
                               <div className="flex gap-1.5 items-center">
                                  <select value={currentDraft.member} onChange={e => setDivDrafts({...divDrafts, [s.name]: {...currentDraft, member: e.target.value}})} className="bg-white text-[9px] p-1 rounded-md font-black border border-[#8B9D83]/20 outline-none text-slate-800">
                                    {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                  </select>
                                  <div className="flex-1 flex items-center bg-white border border-[#8B9D83]/20 rounded-md px-1.5 py-0.5 shadow-inner">
                                      <span className="text-[8px] text-[#8B9D83] font-black mr-0.5">NT$</span>
                                      <NumberInput placeholder="金額" value={currentDraft.amount} onChange={v => setDivDrafts({...divDrafts, [s.name]: {...currentDraft, amount: v}})} className="w-full text-right bg-transparent border-none shadow-none focus:ring-0 font-bold" />
                                  </div>
                                  <button 
                                    onClick={async () => {
                                      await safeAddDoc('dividends', { ...currentDraft, symbol: s.name });
                                      setDivDrafts({...divDrafts, [s.name]: {...currentDraft, amount: '0'}});
                                    }}
                                    className="bg-[#8B9D83] text-white p-1.5 rounded-lg shadow active:scale-90 flex items-center justify-center"
                                  >
                                    <Send size={14} />
                                  </button>
                               </div>
                            </div>

                            <div className="border-t border-slate-100 pt-2 space-y-2.5">
                              {divList.sort((a,b) => b.date.localeCompare(a.date)).map(d => {
                                const draft = editDiv[d.id] || d;
                                const hasChanged = JSON.stringify(draft) !== JSON.stringify(d);
                                return (
                                  <div key={d.id} className={`p-2.5 rounded-2xl border-2 transition-all relative ${hasChanged ? 'border-amber-300 bg-amber-50/20 shadow-md' : 'border-slate-50 bg-white shadow-sm'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                      <input type="date" value={draft.date} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...draft, date: e.target.value}})} className="text-[9px] font-black outline-none bg-transparent text-slate-500 cursor-pointer" />
                                      <div className="flex items-center gap-1">
                                        {hasChanged && ( 
                                          <button onClick={() => handleUpdate('dividends', d.id, draft)} className="bg-emerald-600 text-white p-1 rounded-lg shadow-md animate-pulse border border-emerald-500/10">
                                            <Check size={12}/>
                                          </button> 
                                        )}
                                        <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'dividends', d.id))} className="text-slate-300 hover:text-red-500 p-0.5"><Trash2 size={16}/></button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <select value={draft.member} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...draft, member: e.target.value}})} className="w-18 md:w-22 bg-[#F2E8D5]/60 text-[9px] p-0.5 rounded font-black text-slate-800 border-none outline-none">
                                        {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                      </select>
                                      <div className="flex-1 flex items-center bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5">
                                          <span className="text-[8px] text-slate-400 font-black mr-0.5">NT$</span>
                                          <NumberInput value={draft.amount} onChange={v => setEditDiv({...editDiv, [d.id]: {...draft, amount: v}})} className="bg-transparent text-right font-black text-slate-800 w-full outline-none text-xs border-none focus:ring-0 p-0" />
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

        {/* 管理分頁 */}
        {activeTab === 'masters' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300 text-slate-900 pb-16 text-left">
            <div className="bg-white p-6 md:p-12 rounded-[2.5rem] shadow-sm space-y-8 border border-slate-50 text-left">
               <div className="space-y-4">
                 <h3 className="font-black text-xs md:text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2 text-left mx-auto md:mx-0"><Users size={16}/> 人員管理中心</h3>
                 <div className="flex gap-2 max-w-sm">
                   {/* 💡 修復手機按鈕點擊：改回普通 input 並去除複雜 focus 邏輯 */}
                   <input 
                     placeholder="人員名稱" 
                     className="flex-1 py-2 px-4 text-sm font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 ring-[#8B9D83]/20" 
                     value={newMemName}
                     onChange={e => setNewMemName(e.target.value)}
                   />
                   <button 
                    onClick={async () => { if(newMemName.trim()) { await safeAddDoc('members', { name: newMemName.trim() }); setNewMemName(""); } }} 
                    className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-sm shadow-md active:scale-90 transition-all hover:bg-blue-700"
                   >建立</button>
                 </div>
                 <div className="flex flex-wrap gap-2">
                   {members.map(m => (
                     <span key={m.id} className="bg-blue-50 text-[10px] md:text-xs font-black text-blue-800 px-4 py-2 rounded-xl border border-blue-100 flex items-center gap-2 group shadow-sm">
                       {m.name}
                       <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'members', m.id))} className="text-blue-300 hover:text-red-500 font-bold px-1 transition-colors">×</button>
                     </span>
                   ))}
                 </div>
               </div>

               <div className="border-t border-slate-50 pt-8 space-y-4 text-left">
                 <h3 className="font-black text-xs md:text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2 text-left mx-auto md:mx-0"><Globe size={16}/> 股票代碼與現價設定</h3>
                 <div className="flex gap-2 max-w-sm text-left">
                   <input 
                     placeholder="例如: 0050" 
                     className="flex-1 uppercase py-2 px-4 text-sm font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 ring-[#8B9D83]/20" 
                     value={newSymName}
                     onChange={e => setNewSymName(e.target.value.toUpperCase())}
                   />
                   <button 
                    onClick={async () => { if(newSymName.trim()) { await safeAddDoc('symbols', { name: newSymName.trim(), currentPrice: 0 }); setNewSymName(""); } }} 
                    className="bg-[#8B9D83] text-white px-6 py-2 rounded-xl font-black text-sm shadow-md active:scale-90 transition-all hover:bg-[#7A8C72]"
                   >新增</button>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-5 text-slate-800">
                   {symbols.map(s => {
                     const draft = editSym[s.id] || s; const hasChanged = Number(draft.currentPrice) !== Number(s.currentPrice);
                     return (
                       <div key={s.id} className={`p-4 rounded-3xl border-2 transition-all ${hasChanged ? 'border-amber-300 bg-amber-50/20 shadow-md scale-[1.05]' : 'bg-white border-slate-100 shadow-sm hover:border-slate-300'}`}>
                         <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[11px] font-black uppercase text-slate-800 tracking-wider">{s.name}</span>
                            <div className="flex items-center gap-1 text-slate-800">
                               {hasChanged && ( 
                                 <button onClick={() => handleUpdate('symbols', s.id, draft)} className="bg-emerald-600 text-white p-1 rounded-lg shadow-md border border-emerald-500/10">
                                   <Check size={14}/>
                                 </button> 
                               )}
                               <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'symbols', s.id))} className="text-slate-300 hover:text-red-500 transition-all p-1 text-[12px]">×</button>
                            </div>
                         </div>
                         <div className="flex items-center gap-1 pt-1">
                           <span className="text-[7px] text-slate-400 font-black uppercase">現價</span>
                           <NumberInput value={draft.currentPrice} onChange={v => setEditSym({...editSym, [s.id]: {...draft, currentPrice: v}})} className="w-full text-center font-mono text-[#8B9D83] border-none shadow-none focus:ring-0 px-0" placeholder="0" />
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>

               <div className="border-t-2 border-[#8B9D83]/10 pt-10 pb-6 text-center mx-auto text-slate-800">
                 <div className="inline-block group mx-auto">
                   <a href="https://nayomoney.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-[#8B9D83]/10 px-8 py-5 rounded-[2rem] border-2 border-transparent group-hover:border-[#8B9D83]/20 transition-all shadow-md active:scale-95 mx-auto">
                     <div className="bg-[#8B9D83] p-2.5 rounded-2xl text-white shadow-lg group-hover:rotate-12 transition-transform">
                       <Heart size={20} fill="white" />
                     </div>
                     <div className="text-left leading-tight">
                       <p className="text-[#8B9D83] font-black text-sm md:text-base text-left">推薦服務：nayomoney.com</p>
                       <p className="text-[10px] md:text-xs text-slate-500 font-bold mt-1.5 text-left">探索更多財務自由密碼</p>
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
  <div className="bg-white p-14 rounded-[4rem] text-center space-y-6 shadow-2xl border border-amber-50 animate-in zoom-in max-w-xl mx-auto mt-12 text-slate-800 mx-auto text-slate-800">
    <div className="bg-amber-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-amber-500 shadow-inner mb-3"><AlertCircle size={56} /></div>
    <div className="space-y-2 text-center mx-auto text-slate-800">
      <h3 className="text-3xl font-black tracking-tight text-center text-slate-800">尚未完成初始化</h3>
      <p className="text-base text-slate-500 font-bold px-8 leading-relaxed text-center text-slate-800">請前往「管理」分頁建立人員與標的，開啟資產全方位監控。</p>
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
    <p className="text-[11px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-3 leading-none text-slate-800">{title}</p>
    <p className={`text-2xl md:text-4xl font-mono font-black tracking-tighter leading-none text-slate-800`} style={{ color }}>{value}</p>
    <p className="text-[9px] md:text-[11px] text-slate-400 font-black italic tracking-wider uppercase opacity-80 mt-4 leading-none text-slate-800">{sub}</p>
  </div>
);
