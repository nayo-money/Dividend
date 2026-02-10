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
  Globe, BarChart, ExternalLink, Copy, Heart
} from 'lucide-react';

/**
 * nayo money 股利工具 v11.3 - 品牌服務推薦版
 * 更新重點：
 * 1. 廣告加入：在「管理」分頁最下方新增推薦服務連結 (nayomoney.com)。
 * 2. 分頁優化：document.title 設定為「nayo money股利工具」。
 * 3. 極致壓縮：維持高度扁平化 UI，解決欄位過高的問題。
 * 4. 存檔邏輯：手動「打勾」確認存檔，防止跳號與資料誤觸。
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

const configSource = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : REAL_CONFIG;

const app = initializeApp(configSource);
const auth = getAuth(app);
const db = getFirestore(app);
const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'nayo-money-official';

// --- 2. 緊湊型輸入組件 ---
const CompactInput = ({ value, onChange, className, type = "text", placeholder }) => {
  return (
    <input
      type={type}
      className={`${className} text-base font-black py-1.5 px-3 text-slate-800 outline-none transition-all border border-slate-100 rounded-lg focus:ring-2 ring-[#8B9D83]/10`}
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

  // 瀏覽器分頁標題與小圖示
  useEffect(() => {
    document.title = "nayo money股利工具";
    const faviconSvg = `
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
        <rect width='100' height='100' rx='30' fill='%238B9D83'/>
        <text y='72' x='28' font-size='60' font-weight='bold' fill='white' font-family='Arial'>$</text>
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
            <p className="text-[10px] font-medium leading-relaxed text-slate-500">請至 Firebase Console 加入白名單。</p>
            <button onClick={() => {
              const temp = document.createElement('input'); temp.value = domain;
              document.body.appendChild(temp); temp.select(); document.execCommand('copy');
              document.body.removeChild(temp);
            }} className="bg-red-100 px-3 py-1 rounded text-[9px] font-black uppercase text-red-600">複製網域</button>
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
      <div className="animate-spin mb-2"><RefreshCw size={32} /></div>
      <p className="text-xs">系統載入中...</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#F2E8D5] flex items-center justify-center p-6 text-center">
      <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-[#D9C5B2]/20">
        <div className="bg-[#8B9D83] p-5 rounded-2xl text-white shadow-xl mb-6 mx-auto w-16 h-16 flex items-center justify-center">
          <ShieldCheck size={36} />
        </div>
        <h1 className="text-xl font-black text-[#4A4A4A]">nayo money</h1>
        <p className="text-[#8B9D83] text-[10px] mt-1 font-bold italic mb-8">理財指揮官 v11.3</p>
        <button onClick={handleGoogleLogin} className="w-full bg-white border border-slate-200 py-3.5 rounded-xl flex items-center justify-center gap-3 font-black text-slate-700 hover:bg-slate-50 transition-all shadow-md">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-5 h-5" />
          Google 帳號登入
        </button>
        {error && <div className="mt-4 p-3 bg-red-50 rounded-lg text-red-500 text-[10px] font-bold">{error}</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2E8D5] text-slate-800 pb-24 font-sans select-none overflow-x-hidden">
      <header className="bg-[#8B9D83] text-white py-1.5 px-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Layers size={16} />
            <h1 className="text-sm md:text-base font-black leading-none">nayo money股利工具</h1>
          </div>
          <div className="flex items-center gap-2">
              <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="bg-white/20 text-white text-[9px] font-black border-none outline-none rounded-md px-2 py-0.5 backdrop-blur-md cursor-pointer appearance-none shadow-sm">
                <option value="all" className="text-slate-800 bg-white font-bold">全家人</option>
                {members.map(m => <option key={m.id} value={m.name} className="text-slate-800 bg-white">{m.name}</option>)}
              </select>
              <button onClick={() => signOut(auth)} className="bg-white/10 p-1 rounded-md hover:bg-white/20 transition-all text-white"><LogOut size={12} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-2 md:p-4 space-y-3">
        {activeTab === 'overview' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatCard title="總成本" value={`$${Math.round(stats.totalCost).toLocaleString()}`} sub="本金" color="#4A4A4A" />
              <StatCard title="總市值" value={`$${Math.round(stats.totalMarketValue).toLocaleString()}`} sub="現值" color="#3B82F6" />
              <StatCard title="回本率" value={`${stats.recovery.toFixed(1)}%`} sub="回收" color="#8B9D83" />
              <StatCard title="總報酬" value={`${stats.overallReturn.toFixed(1)}%`} sub="含息" color={stats.overallReturn >= 0 ? "#10B981" : "#EF4444"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-3 shadow-sm space-y-2 border border-slate-50">
                <h3 className="font-black text-slate-800 text-[10px] tracking-widest uppercase border-b pb-1 flex items-center gap-2"><Globe size={12}/> 標的回本監測</h3>
                {stats.items.length === 0 ? <p className="text-center text-slate-400 text-[9px] py-4 italic">無資料</p> : 
                  stats.items.map(p => (
                    <div key={p.name} className="space-y-1 bg-slate-50/50 p-2 rounded-lg border border-transparent hover:border-[#8B9D83]/20 transition shadow-sm mb-1.5">
                      <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedSymbol(expandedSymbol === p.name ? null : p.name)}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{p.name}</span>
                          {expandedSymbol === p.name ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                        </div>
                        <div className="text-right">
                           <span className="text-[#8B9D83] font-mono font-black text-xs">回本 {Math.round((p.div/Math.max(p.cost, 1))*100)}%</span>
                           <span className={`text-[8px] font-bold ml-2 ${p.returnIncDiv >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>含息: {p.returnIncDiv.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white rounded-full overflow-hidden shadow-inner border border-slate-50">
                        <div className="h-full bg-[#8B9D83] transition-all duration-1000 shadow-[0_0_10px_rgba(139,157,131,0.3)]" style={{ width: `${Math.min((p.div/Math.max(p.cost, 1))*100, 100)}%` }}></div>
                      </div>
                      {expandedSymbol === p.name && (
                        <div className="mt-2 space-y-1 pt-1 border-t border-slate-200/50 animate-in slide-in-from-top-4">
                          {p.lots.map(lot => (
                            <div key={lot.id} className="flex justify-between text-[9px] font-bold text-slate-500">
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

              <div className="bg-white rounded-xl p-3 shadow-sm space-y-2 border border-slate-50 text-center md:text-left">
                <h3 className="font-black text-slate-800 text-[10px] tracking-widest uppercase border-b pb-1 flex items-center gap-2 justify-center md:justify-start"><BarChart size={12}/> 每月領息流水</h3>
                <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                  {stats.monthly.length === 0 ? <p className="text-center text-slate-400 text-[9px] py-4 italic mx-auto">無紀錄</p> : 
                    stats.monthly.map(([month, amount]) => (
                      <div key={month} className="flex justify-between items-center p-2 bg-[#F2E8D5]/30 rounded-lg">
                        <span className="text-[9px] text-slate-600 font-black uppercase">{month} 合計</span>
                        <p className="text-sm font-black text-[#8B9D83] font-mono">${amount.toLocaleString()}</p>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invest' && (
          <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <div className="flex justify-between items-center px-2">
                    <h2 className="font-black text-sm text-slate-800 flex items-center gap-2 italic"><TrendingUp size={16}/> 投入明細</h2>
                    <button onClick={() => safeAddDoc('transactions', { member: members[0]?.name || '本人', symbol: symbols[0]?.name || '0050', cost: 0, shares: 0, date: new Date().toISOString().split('T')[0] })} className="bg-[#8B9D83] text-white p-1.5 rounded-lg shadow-md active:scale-95 transition-all"><PlusCircle size={16}/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {symbols.map(s => {
                    const txList = transactions.filter(t => t.symbol === s.name && (filterMember === 'all' || t.member === filterMember));
                    if (txList.length === 0 && investExpanded !== s.name) return null;
                    return (
                      <div key={s.name} className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-100">
                        <div className="p-2 bg-[#8B9D83]/5 border-b border-slate-50 flex justify-between items-center cursor-pointer" onClick={() => setInvestExpanded(investExpanded === s.name ? null : s.name)}>
                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{s.name} <span className="text-[8px] text-slate-400">({txList.length})</span></span>
                          {investExpanded === s.name ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                        </div>
                        {investExpanded === s.name && (
                          <div className="p-2 space-y-1.5">
                            {txList.sort((a,b) => b.date.localeCompare(a.date)).map(t => {
                              const cur = editTx[t.id] || t;
                              const isChanged = JSON.stringify(cur) !== JSON.stringify(t);
                              return (
                                <div key={t.id} className={`p-2 rounded-lg border transition-all space-y-1.5 relative ${isChanged ? 'border-amber-300 bg-amber-50/20 shadow-md' : 'border-slate-50 bg-slate-50/30'}`}>
                                  <div className="flex justify-between items-center">
                                    <input type="date" value={cur.date} onChange={(e) => setEditTx({...editTx, [t.id]: {...cur, date: e.target.value}})} className="text-[9px] font-black outline-none italic bg-transparent text-slate-600" />
                                    <div className="flex items-center gap-2">
                                      {isChanged && ( <button onClick={() => handleUpdate('transactions', t.id, cur)} className="bg-emerald-500 text-white p-0.5 rounded shadow-sm hover:scale-110"><Check size={10}/></button> )}
                                      <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'transactions', t.id))} className="text-slate-400 hover:text-red-500 p-0.5"><Trash2 size={12}/></button>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <select value={cur.member} onChange={(e) => setEditTx({...editTx, [t.id]: {...cur, member: e.target.value}})} className="flex-1 bg-white text-[9px] p-1 rounded font-black text-slate-700 border border-slate-50 outline-none">
                                      {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                    </select>
                                    <input type="number" value={cur.shares} onChange={e => setEditTx({...editTx, [t.id]: {...cur, shares: Number(e.target.value)}})} className="w-14 bg-white border border-slate-50 rounded p-1 text-[9px] font-bold text-center text-slate-800" placeholder="股數" />
                                    <input type="number" value={cur.cost} onChange={e => setEditTx({...editTx, [t.id]: {...cur, cost: Number(e.target.value)}})} className="w-16 bg-white border border-slate-50 rounded p-1 text-[9px] font-bold text-center text-[#8B9D83]" placeholder="成本" />
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
          <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <div className="flex justify-between items-center px-2">
                    <h2 className="font-black text-sm text-slate-800 flex items-center gap-2 italic"><DollarSign size={16}/> 領息流水</h2>
                    <button onClick={() => safeAddDoc('dividends', { member: members[0]?.name || '本人', symbol: symbols[0]?.name || '0050', amount: 0, date: new Date().toISOString().split('T')[0] })} className="bg-[#8B9D83] text-white p-1.5 rounded-lg shadow-md active:rotate-90 transition-all"><PlusCircle size={16}/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-800">
                  {dividends.sort((a,b) => b.date.localeCompare(a.date)).map(d => {
                    const cur = editDiv[d.id] || d;
                    const isChanged = JSON.stringify(cur) !== JSON.stringify(d);
                    return (
                      <div key={d.id} className={`p-2 rounded-xl shadow-sm flex items-center gap-3 border transition-all relative ${isChanged ? 'border-amber-300 bg-amber-50/20' : 'border-slate-50 bg-white hover:border-[#8B9D83]/20'}`}>
                        <div className="flex-1 space-y-0 text-left">
                          <input type="date" value={cur.date} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...cur, date: e.target.value}})} className="text-[8px] font-black outline-none italic bg-transparent text-slate-500" />
                          <div className="flex gap-2 items-center">
                            <select value={cur.member} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...cur, member: e.target.value}})} className="bg-[#F2E8D5]/60 text-[8px] p-1 rounded font-black text-slate-700 border-none outline-none">
                              {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                            </select>
                            <select value={cur.symbol} onChange={(e) => setEditDiv({...editDiv, [d.id]: {...cur, symbol: e.target.value}})} className="font-black text-slate-800 text-[10px] bg-transparent border-none outline-none">
                              {symbols.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="bg-[#F2E8D5]/60 px-2 py-1 rounded-lg flex items-center gap-1 font-mono shadow-inner border border-[#8B9D83]/10">
                            <span className="text-[8px] text-[#8B9D83] font-black">NT$</span>
                            <input type="number" value={cur.amount} onChange={e => setEditDiv({...editDiv, [d.id]: {...cur, amount: Number(e.target.value)}})} className="bg-transparent text-right font-black text-[#8B9D83] w-16 outline-none text-xs" />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isChanged && ( <button onClick={() => handleUpdate('dividends', d.id, cur)} className="bg-emerald-500 text-white p-0.5 rounded shadow-sm hover:scale-110"><Check size={10}/></button> )}
                          <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'dividends', d.id))} className="text-slate-400 hover:text-red-500 p-0.5 transition-all"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'masters' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300 text-slate-800">
            <div className="bg-white p-4 rounded-xl shadow-sm space-y-4 border border-slate-50 text-center md:text-left">
               <div className="space-y-2">
                 <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start"><Users size={12}/> 人員管理</h3>
                 <div className="flex gap-2">
                   <CompactInput id="memIn" placeholder="例如: 媽媽" className="flex-1" onChange={() => {}} />
                   <button onClick={async () => {
                     const el = document.getElementById('memIn'); const val = el.value.trim();
                     if(val) { await safeAddDoc('members', { name: val }); el.value = ''; }
                   }} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-black text-xs shadow-md active:scale-95">建立</button>
                 </div>
                 <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                   {members.map(m => (
                     <span key={m.id} className="bg-blue-50 text-[9px] font-black text-blue-800 px-2 py-1 rounded border border-blue-100 flex items-center gap-2 group">
                       {m.name}
                       <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'members', m.id))} className="text-blue-300 hover:text-red-500">×</button>
                     </span>
                   ))}
                 </div>
               </div>

               <div className="border-t border-slate-50 pt-3 space-y-2">
                 <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start"><Globe size={12}/> 股票與現價</h3>
                 <div className="flex gap-2">
                   <CompactInput id="symbolIn" placeholder="例如: 0050" className="flex-1 uppercase" onChange={() => {}} />
                   <button onClick={async () => {
                     const el = document.getElementById('symbolIn'); const val = el.value.toUpperCase().trim();
                     if(val) { await safeAddDoc('symbols', { name: val, currentPrice: 0 }); el.value = ''; }
                   }} className="bg-[#8B9D83] text-white px-4 py-1.5 rounded-lg font-black text-xs shadow-md active:scale-95">新增</button>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   {symbols.map(s => {
                     const cur = editSym[s.id] || s; const isChanged = cur.currentPrice !== s.currentPrice;
                     return (
                       <div key={s.id} className={`p-2 rounded-lg border transition-all ${isChanged ? 'border-amber-300 bg-amber-50/20 shadow-md' : 'bg-white border-slate-50 shadow-sm'}`}>
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-slate-800 uppercase">{s.name}</span>
                            <div className="flex items-center gap-1">
                               {isChanged && ( <button onClick={() => handleUpdate('symbols', s.id, cur)} className="bg-emerald-500 text-white p-0.5 rounded shadow-sm hover:scale-110"><Check size={8}/></button> )}
                               <button onClick={() => deleteDoc(doc(db, 'artifacts', currentAppId, 'users', user.uid, 'symbols', s.id))} className="text-slate-300 hover:text-red-500 transition-all"><Trash2 size={8}/></button>
                            </div>
                         </div>
                         <div className="flex items-center gap-1.5">
                           <span className="text-[7px] text-slate-400 font-black uppercase whitespace-nowrap">市價</span>
                           <input type="number" value={cur.currentPrice} onChange={e => setEditSym({...editSym, [s.id]: {...cur, currentPrice: Number(e.target.value)}})} className="w-full bg-slate-50 border border-slate-50 rounded p-1 text-center font-mono text-[#8B9D83] font-bold outline-none text-[9px]" placeholder="0" />
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>

               {/* 推薦服務廣告區塊 */}
               <div className="border-t-2 border-[#8B9D83]/10 pt-6 pb-2 text-center">
                 <p className="text-[10px] text-slate-400 font-black tracking-[0.3em] uppercase mb-3">Partner Service</p>
                 <div className="inline-block group">
                   <a 
                    href="https://nayomoney.com/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-3 bg-[#8B9D83]/10 px-6 py-3 rounded-2xl border border-transparent group-hover:border-[#8B9D83]/30 transition-all shadow-sm group-active:scale-95"
                   >
                     <div className="bg-[#8B9D83] p-2 rounded-xl text-white shadow-md shadow-[#8B9D83]/20">
                       <Heart size={16} fill="white" />
                     </div>
                     <div className="text-left leading-tight">
                       <p className="text-[#8B9D83] font-black text-xs">推薦服務：nayomoney.com</p>
                       <p className="text-[9px] text-slate-400 font-bold">點擊探索更多財務自由密碼</p>
                     </div>
                     <ExternalLink size={14} className="text-[#8B9D83] opacity-40 group-hover:opacity-100 transition-opacity ml-2" />
                   </a>
                 </div>
               </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-2 py-1.5 flex justify-center shadow-[0_-8px_30px_rgba(0,0,0,0.05)] z-50 rounded-t-2xl">
        <div className="max-w-2xl w-full flex justify-around items-end">
          <NavBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={22}/>} label="監測" />
          <NavBtn active={activeTab === 'dividends'} onClick={() => setActiveTab('dividends')} icon={<DollarSign size={22}/>} label="領息" />
          <NavBtn active={activeTab === 'invest'} onClick={() => setActiveTab('invest')} icon={<TrendingUp size={22}/>} label="投入" />
          <NavBtn active={activeTab === 'masters'} onClick={() => setActiveTab('masters')} icon={<Users size={22}/>} label="管理" />
        </div>
      </nav>
    </div>
  );
}

// --- 子組件 ---
const SetupGuide = ({ onGo }) => (
  <div className="bg-white p-8 rounded-2xl text-center space-y-4 shadow-xl border border-amber-50 animate-in zoom-in max-w-lg mx-auto mt-4 text-slate-800 text-center">
    <div className="bg-amber-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-amber-500 shadow-inner"><AlertCircle size={32} /></div>
    <div className="space-y-1 text-center">
      <h3 className="text-lg font-black tracking-tight text-center">尚未完成設定</h3>
      <p className="text-xs text-slate-500 font-bold px-4 leading-relaxed text-center">請先前往「管理」分頁建立人員與標的。</p>
    </div>
    <button onClick={onGo} className="bg-blue-600 text-white w-full max-w-xs py-3 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all mx-auto tracking-widest uppercase">立即前往 <ArrowRight size={14}/></button>
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${active ? 'text-[#8B9D83] scale-105' : 'text-slate-400'}`}>
    <div className={`${active ? 'bg-[#8B9D83]/10 p-1.5 rounded-xl shadow-sm' : 'p-1'} transition-all`}>{icon}</div>
    <span className={`text-[8px] font-black tracking-widest ${active ? 'text-[#8B9D83]' : 'text-slate-500'}`}>{label}</span>
  </button>
);

const StatCard = ({ title, value, sub, color }) => (
  <div className="bg-white p-2.5 md:p-3 rounded-xl shadow-sm border border-slate-50 active:scale-95 transition-transform text-center relative overflow-hidden group">
    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color, opacity: 0.3 }}></div>
    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{title}</p>
    <p className={`text-base md:text-lg font-mono font-black tracking-tighter text-slate-800`} style={{ color }}>{value}</p>
    <p className="text-[7px] text-slate-400 font-black italic tracking-wider uppercase opacity-70 leading-none">{sub}</p>
  </div>
);