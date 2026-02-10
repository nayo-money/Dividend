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
  Globe, BarChart, ExternalLink, Copy
} from 'lucide-react';

/**
 * nayo money 股利工具 v11.0 - 品牌視覺強化版
 * 更新重點：
 * 1. 分頁標題：自動設定為「nayo money股利工具」。
 * 2. 瀏覽器圖示：動態注入專屬 Favicon (綠底金錢符號)。
 * 3. 視覺壓縮：維持扁平化 UI 與寬螢幕優化。
 * 4. 存檔邏輯：維持手動「打勾」存檔機制。
 */

// --- 0. 樣式與頭部元數據修復 ---
if (typeof document !== 'undefined') {
  // 自動注入 Tailwind
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

const configSource = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : REAL_CONFIG;

const app = initializeApp(configSource);
const auth = getAuth(app);
const db = getFirestore(app);
const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'nayo-money-official';

// --- 2. 扁平化大型輸入組件 ---
const FlatBigInput = ({ value, onChange, className, type = "text", placeholder }) => {
  return (
    <input
      type={type}
      className={`${className} text-lg md:text-xl font-black py-3 px-6 text-slate-800 outline-none transition-all focus:ring-4 ring-[#8B9D83]/10 border-2 border-slate-100 rounded-2xl`}
      value={value}
      placeholder={placeholder}
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

  // --- 瀏覽器標題與圖示動態設定 ---
  useEffect(() => {
    document.title = "nayo money股利工具";
    
    // 建立一個綠底白字的 SVG 作為圖示
    const faviconSvg = `
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
        <rect width='100' height='100' rx='25' fill='%238B9D83'/>
        <text y='75' x='25' font-size='70' font-weight='bold' fill='white' font-family='Arial'>$</text>
      </svg>
    `.trim();

    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/svg+xml';
    link.rel = 'icon';
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
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setError(null);
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        setError(
          <div className="text-left space-y-2">
            <p className="font-black text-sm">網域尚未授權：{domain}</p>
            <p className="text-[10px] font-medium leading-relaxed">請至 Firebase Console 加入白名單。</p>
            <button onClick={() => {
              const temp = document.createElement('input'); temp.value = domain;
              document.body.appendChild(temp); temp.select(); document.execCommand('copy');
              document.body.removeChild(temp);
            }} className="bg-red-100 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">複製網域</button>
          </div>
        );
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
      avgMonthly: Object.keys(monthlyData).length > 0 ? (totalDiv / Object.keys(monthlyData).length) : 0
    };
  }, [dividends, transactions, symbols, filterMember]);

  const isReady = members.length > 0 && symbols.length > 0;

  const safeAddDoc = async (colName, data) => {
    if (!user) return;
    try {
      setError(null);
      if (colName === 'transactions') setInvestExpanded(data.symbol);
      await addDoc(collection(db, 'artifacts', currentAppId, 'users', user.uid, colName), { ...data, createdAt: serverTimestamp() });
    } catch (e) { setError("連線失敗。"); }
  };

  const handleUpdate = async (col, id, data) => {
    if (!user) return;
    try { await updateDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, col, id), data); } catch (e) { setError("更新失敗。"); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F2E8D5] flex flex-col items-center justify-center font-bold text-[#8B9D83]">
      <div className="animate-spin mb-4"><RefreshCw size={40} /></div>
      <p className="tracking-widest">能量載入中...</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#F2E8D5] flex items-center justify-center p-6 text-center font-sans">
      <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-[#D9C5B2]/20 text-center mx-auto">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-[#8B9D83] p-7 rounded-[2rem] text-white shadow-xl mb-6 shadow-[#8B9D83]/20 mx-auto">
            <ShieldCheck size={50} />
          </div>
          <h1 className="text-3xl font-black text-[#4A4A4A] tracking-tighter">nayo money股利工具</h1>
          <p className="text-[#8B9D83] text-sm mt-3 font-bold italic text-center">守護全家人的財富底氣</p>
        </div>
        <button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-slate-100 py-5 rounded-2xl flex items-center justify-center gap-4 font-black text-slate-700 hover:bg-slate-50 transition-all shadow-lg mx-auto">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          Google 帳號登入
        </button>
        {error && <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-500 text-xs font-bold leading-relaxed">{error}</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2E8D5] text-slate-800 pb-36 font-sans select-none overflow-x-hidden">
      <header className="bg-[#8B9D83] text-white p-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md shadow-inner"><Layers size={20} /></div>
            <h1 className="text-lg md:text-xl font-black leading-none text-white">nayo money股利工具</h1>
          </div>
          <div className="flex items-center gap-3">
              <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="bg-white/20 text-white text-xs font-black border-none outline-none rounded-lg px-4 py-2 backdrop-blur-md cursor-pointer appearance-none shadow-sm">
                <option value="all" className="text-slate-800 bg-white font-bold">全家人總結</option>
                {members.map(m => <option key={m.id} value={m.name} className="text-slate-800 bg-white font-bold">{m.name}</option>)}
              </select>
              <button onClick={() => signOut(auth)} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-all text-white"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <StatCard title="總投入成本" value={`$${Math.round(stats.totalCost).toLocaleString()}`} sub="家庭本金" color="#4A4A4A" />
              <StatCard title="當前總市值" value={`$${Math.round(stats.totalMarketValue).toLocaleString()}`} sub="估值損益" color="#3B82F6" />
              <StatCard title="累積回本率" value={`${stats.recovery.toFixed(1)}%`} sub="股利回收" color="#8B9D83" />
              <StatCard title="含息總報酬" value={`${stats.overallReturn.toFixed(1)}%`} sub="最終總能" color={stats.overallReturn >= 0 ? "#10B981" : "#EF4444"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-[2.5rem] p-6 shadow-sm space-y-4 border border-slate-50 text-center md:text-left">
                <h3 className="font-black text-slate-800 text-sm tracking-widest uppercase border-b pb-3 flex items-center gap-2 justify-center md:justify-start"><Globe size={16} className="text-[#8B9D83]"/> 標的回本監測盤</h3>
                {stats.items.length === 0 ? <p className="text-center text-slate-500 text-xs py-10 italic">請先輸入資料</p> : 
                  stats.items.map(p => (
                    <div key={p.name} className="space-y-2 bg-slate-50/50 p-4 rounded-2xl border border-transparent hover:border-[#8B9D83]/20 transition shadow-sm mb-4">
                      <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedSymbol(expandedSymbol === p.name ? null : p.name)}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-800 uppercase">{p.name}</span>
                          {expandedSymbol === p.name ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </div>
                        <div className="text-right">
                           <p className="text-[#8B9D83] font-mono font-black text-lg leading-none">回本 {Math.round((p.div/Math.max(p.cost, 1))*100)}%</p>
                           <p className={`text-[10px] font-bold mt-1 ${p.returnIncDiv >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>含息: {p.returnIncDiv.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="h-3 bg-white rounded-full overflow-hidden shadow-inner border border-slate-100">
                        <div className="h-full bg-[#8B9D83] transition-all duration-1000 shadow-[0_0_10px_rgba(139,157,131,0.3)]" style={{ width: `${Math.min((p.div/Math.max(p.cost, 1))*100, 100)}%` }}></div>
                      </div>
                      {expandedSymbol === p.name && (
                        <div className="mt-4 space-y-3 pt-3 border-t border-slate-200/50 animate-in slide-in-from-top-4">
                          {p.lots.map(lot => (
                            <div key={lot.id} className="space-y-1">
                              <div className="flex justify-between text-[11px] font-bold text-slate-800">
                                <span className="flex items-center gap-1 font-bold"><Clock size={12}/> {lot.date}</span>
                                <span>成本: $ {lot.cost.toLocaleString()} ({Math.round(lot.progress)}% 回本)</span>
                              </div>
                              <div className="h-1.5 bg-white rounded-full overflow-hidden">
                                <div className="h-full bg-[#D9C5B2] transition-all duration-1000" style={{ width: `${Math.min(lot.progress, 100)}%` }}></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>

              <div className="bg-white rounded-[2.5rem] p-6 shadow-sm space-y-4 border border-slate-50">
                <h3 className="font-black text-slate-800 text-sm tracking-widest uppercase border-b pb-3 flex items-center gap-2 justify-center md:justify-start"><BarChart size={16} className="text-[#8B9D83]"/> 每月領息流水</h3>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {stats.monthly.length === 0 ? <p className="text-center text-slate-500 text-xs py-10 italic mx-auto">暫無領息歷史</p> : 
                    stats.monthly.map(([month, amount]) => (
                      <div key={month} className="flex justify-between items-center p-4 bg-[#F2E8D5]/20 rounded-2xl border border-transparent shadow-sm">
                        <span className="text-xs text-slate-600 font-black uppercase tracking-widest">{month} 合計</span>
                        <p className="text-lg font-black text-[#8B9D83]">NT$ {amount.toLocaleString()}</p>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 投入紀錄 */}
        {activeTab === 'invest' && (
          <div className="space-y-4 animate-in slide-in-from-right-6 duration-300">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <div className="flex justify-between items-center px-4">
                    <h2 className="font-black text-xl text-slate-800 flex items-center gap-3 italic"><TrendingUp size={24} className="text-[#8B9D83]"/> 投入本金明細</h2>
                    <button onClick={() => safeAddDoc('transactions', { member: members[0]?.name || '本人', symbol: symbols[0]?.name || '0050', cost: 0, shares: 0, date: new Date().toISOString().split('T')[0] })} className="bg-[#8B9D83] text-white p-3 rounded-xl shadow-lg active:scale-95 transition-all"><PlusCircle size={24}/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {symbols.map(s => {
                    const txList = transactions.filter(t => t.symbol === s.name && (filterMember === 'all' || t.member === filterMember));
                    if (txList.length === 0 && investExpanded !== s.name) return null;
                    return (
                      <div key={s.name} className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-slate-100">
                        <div className="p-4 bg-[#8B9D83]/5 border-b border-slate-50 flex justify-between items-center cursor-pointer" onClick={() => setInvestExpanded(investExpanded === s.name ? null : s.name)}>
                          <span className="text-lg font-black text-slate-800 uppercase tracking-widest">{s.name} <span className="text-[10px] font-bold text-slate-400">({txList.length} 筆)</span></span>
                          {investExpanded === s.name ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                        </div>
                        {investExpanded === s.name && (
                          <div className="p-4 space-y-3 animate-in slide-in-from-top-2">
                            {txList.sort((a,b) => b.date.localeCompare(a.date)).map(t => {
                              const cur = editTx[t.id] || t;
                              const isChanged = JSON.stringify(cur) !== JSON.stringify(t);
                              return (
                                <div key={t.id} className={`p-4 rounded-2xl border-2 transition-all space-y-3 relative ${isChanged ? 'border-amber-300 bg-amber-50/20 shadow-md' : 'border-slate-50 bg-slate-50/30'}`}>
                                  <div className="flex justify-between items-center text-slate-800">
                                    <input type="date" value={cur.date} onChange={(e) => setEditTx({...editTx, [t.id]: {...cur, date: e.target.value}})} className="text-sm font-black outline-none italic bg-transparent text-slate-800 cursor-pointer" />
                                    <div className="flex items-center gap-3">
                                      {isChanged && ( <button onClick={() => handleUpdate('transactions', t.id, cur)} className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-all"><Check size={16}/></button> )}
                                      <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'transactions', t.id))} className="text-slate-400 hover:text-red-500 transition-all p-1"><Trash2 size={18}/></button>
                                    </div>
                                  </div>
                                  <div className="flex gap-4">
                                    <select value={cur.member} onChange={(e) => setEditTx({...editTx, [t.id]: {...cur, member: e.target.value}})} className="flex-1 bg-white text-xs p-3 rounded-xl font-black text-slate-800 border border-slate-100 outline-none shadow-sm">
                                      {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                    </select>
                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                      <input type="number" value={cur.shares} onChange={e => setEditTx({...editTx, [t.id]: {...cur, shares: Number(e.target.value)}})} className="bg-white border border-slate-100 rounded-xl p-2 text-xs font-bold text-center text-slate-800" placeholder="股數" />
                                      <input type="number" value={cur.cost} onChange={e => setEditTx({...editTx, [t.id]: {...cur, cost: Number(e.target.value)}})} className="bg-white border border-slate-100 rounded-xl p-2 text-xs font-bold text-center text-[#8B9D83]" placeholder="成本" />
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

        {/* 領息紀錄 */}
        {activeTab === 'dividends' && (
          <div className="space-y-4 animate-in slide-in-from-right-6 duration-300">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <div className="flex justify-between items-center px-4">
                    <h2 className="font-black text-xl text-slate-800 flex items-center gap-3 italic"><DollarSign size={24} className="text-[#8B9D83]"/> 股利流水系統</h2>
                    <button onClick={() => safeAddDoc('dividends', { member: members[0]?.name || '本人', symbol: symbols[0]?.name || '0050', amount: 0, date: new Date().toISOString().split('T')[0] })} className="bg-[#8B9D83] text-white p-3 rounded-xl shadow-lg active:rotate-90 transition-all"><PlusCircle size={24}/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-800">
                  {dividends.sort((a,b) => b.date.localeCompare(a.date)).map(d => {
                    const cur = editDiv[d.id] || d;
                    const isChanged = JSON.stringify(cur) !== JSON.stringify(d);
                    return (
                      <div key={d.id} className={`p-4 rounded-2xl shadow-sm flex items-center gap-4 border-2 transition-all relative ${isChanged ? 'border-amber-300 bg-amber-50/20 shadow-md' : 'border-slate-50 bg-white hover:border-[#8B9D83]/20'}`}>
                        <div className="flex-1 space-y-1 text-slate-800 text-left">
                          <input type="date" value={cur.date} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...cur, date: e.target.value}})} className="text-[10px] font-black outline-none italic bg-transparent text-slate-600 cursor-pointer" />
                          <div className="flex gap-2">
                            <select value={cur.member} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...cur, member: e.target.value}})} className="bg-[#F2E8D5]/60 text-[10px] p-2 rounded-lg font-black text-slate-800 border-none outline-none">
                              {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                            </select>
                            <select value={cur.symbol} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...cur, symbol: e.target.value}})} className="font-black text-slate-800 text-sm bg-transparent border-none outline-none">
                              {symbols.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="bg-[#F2E8D5]/60 px-4 py-2 rounded-xl flex items-center gap-2 font-mono shadow-inner border border-[#8B9D83]/10">
                            <span className="text-[10px] text-[#8B9D83] font-black">NT$</span>
                            <input type="number" value={cur.amount} onChange={e => setEditDiv({...editDiv, [d.id]: {...cur, amount: Number(e.target.value)}})} className="bg-transparent text-right font-black text-[#8B9D83] w-24 outline-none text-base" />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isChanged && ( <button onClick={() => handleUpdate('dividends', d.id, cur)} className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-all"><Check size={14}/></button> )}
                          <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'dividends', d.id))} className="text-slate-400 hover:text-red-500 p-1 transition-all"><Trash2 size={16}/></button>
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
          <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500 text-slate-800">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm space-y-10 border border-slate-50">
               <div className="space-y-6">
                 <h3 className="font-black text-xl text-slate-800 tracking-tight flex items-center gap-3 justify-center md:justify-start"><Users className="text-blue-500"/> 人員管理主檔</h3>
                 <div className="flex gap-4 flex-col md:flex-row">
                   <FlatBigInput id="memIn" placeholder="人員 例如:媽媽" className="flex-1" onChange={() => {}} />
                   <button onClick={async () => {
                     const el = document.getElementById('memIn'); const val = el.value.trim();
                     if(val) { await safeAddDoc('members', { name: val }); el.value = ''; }
                   }} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-all uppercase tracking-widest">建立成員</button>
                 </div>
                 <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                   {members.map(m => (
                     <span key={m.id} className="bg-blue-50 text-base font-black text-blue-800 px-6 py-3 rounded-2xl border-2 border-blue-100 flex items-center gap-4 shadow-sm group">
                       {m.name}
                       <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'members', m.id))} className="text-blue-300 hover:text-red-500 transition-all">×</button>
                     </span>
                   ))}
                 </div>
               </div>

               <div className="border-t-2 border-slate-50 pt-8 space-y-6">
                 <h3 className="font-black text-xl text-slate-800 tracking-tight flex items-center gap-3 justify-center md:justify-start"><Globe className="text-[#8B9D83]"/> 股票與現價管理</h3>
                 <div className="flex gap-4 flex-col md:flex-row">
                   <FlatBigInput id="symbolIn" placeholder="股票代碼 例如:0050" className="flex-1 uppercase" onChange={() => {}} />
                   <button onClick={async () => {
                     const el = document.getElementById('symbolIn'); const val = el.value.toUpperCase().trim();
                     if(val) { await safeAddDoc('symbols', { name: val, currentPrice: 0 }); el.value = ''; }
                   }} className="bg-[#8B9D83] text-white px-10 py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-[#7A8C72] active:scale-95 transition-all tracking-widest">新增標的</button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {symbols.map(s => {
                     const cur = editSym[s.id] || s; const isChanged = cur.currentPrice !== s.currentPrice;
                     return (
                       <div key={s.id} className={`p-5 rounded-2xl border-2 transition-all ${isChanged ? 'border-amber-300 bg-amber-50/20 shadow-md' : 'bg-white border-slate-100 shadow-sm'}`}>
                         <div className="flex justify-between items-center mb-3">
                            <span className="text-base font-black text-slate-800 uppercase tracking-widest">{s.name}</span>
                            <div className="flex items-center gap-2">
                               {isChanged && ( <button onClick={() => handleUpdate('symbols', s.id, cur)} className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-all"><Check size={16}/></button> )}
                               <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'symbols', s.id))} className="text-slate-300 hover:text-red-500 transition-all p-1"><Trash2 size={16}/></button>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                           <span className="text-[10px] text-slate-500 font-black uppercase whitespace-nowrap">當下市價</span>
                           <input type="number" value={cur.currentPrice} onChange={e => setEditSym({...editSym, [s.id]: {...cur, currentPrice: Number(e.target.value)}})} className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-center font-mono text-[#8B9D83] font-bold outline-none" placeholder="0" />
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-center shadow-[0_-15px_60px_rgba(0,0,0,0.12)] z-50 rounded-t-[3rem]">
        <div className="max-w-4xl w-full flex justify-around items-end">
          <NavBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={28}/>} label="監測" />
          <NavBtn active={activeTab === 'dividends'} onClick={() => setActiveTab('dividends')} icon={<DollarSign size={28}/>} label="領息" />
          <NavBtn active={activeTab === 'invest'} onClick={() => setActiveTab('invest')} icon={<TrendingUp size={28}/>} label="投入" />
          <NavBtn active={activeTab === 'masters'} onClick={() => setActiveTab('masters')} icon={<Users size={28}/>} label="管理" />
        </div>
      </nav>
    </div>
  );
}

// --- 子組件 ---
const SetupGuide = ({ onGo }) => (
  <div className="bg-white p-12 rounded-[4rem] text-center space-y-8 shadow-xl border border-amber-100 animate-in zoom-in duration-500 max-w-2xl mx-auto mt-10 text-slate-800 text-center">
    <div className="bg-amber-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-4 shadow-inner"><AlertCircle size={60} /></div>
    <div className="space-y-4">
      <h3 className="text-3xl font-black tracking-tight text-slate-800 text-center">尚未完成初始設定</h3>
      <p className="text-lg text-slate-700 font-bold px-8 text-center leading-relaxed">請先前往「管理」分頁建立人員與標的，系統將為妳解鎖所有功能。</p>
    </div>
    <button onClick={onGo} className="bg-blue-600 text-white w-full max-w-md py-6 rounded-[2rem] font-black text-2xl shadow-xl shadow-blue-500/30 flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all mx-auto tracking-widest uppercase">立即前往 <ArrowRight size={24} /></button>
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all duration-300 ${active ? 'text-[#8B9D83] scale-110' : 'text-slate-400'}`}>
    <div className={`${active ? 'bg-[#8B9D83]/15 p-4 rounded-2xl shadow-sm' : 'p-2'} transition-all`}>{icon}</div>
    <span className={`text-[10px] font-black tracking-widest ${active ? 'text-[#8B9D83]' : 'text-slate-600'}`}>{label}</span>
  </button>
);

const StatCard = ({ title, value, sub, color }) => (
  <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-50 active:scale-95 transition-transform text-center relative overflow-hidden group">
    <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: color, opacity: 0.3 }}></div>
    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">{title}</p>
    <p className={`text-2xl font-mono font-black tracking-tighter text-slate-800`} style={{ color }}>{value}</p>
    <p className="text-[9px] text-slate-600 mt-2 font-black italic tracking-wider uppercase opacity-90">{sub}</p>
  </div>
);