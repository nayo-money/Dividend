import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signOut, signInWithCustomToken,
  GoogleAuthProvider, signInWithPopup, signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, getDoc, collection, onSnapshot, 
  addDoc, deleteDoc, updateDoc, serverTimestamp, query 
} from 'firebase/firestore';
import { 
  TrendingUp, Activity, Trash2, PlusCircle, RefreshCw, 
  DollarSign, List, Layers, LogOut, ShieldCheck, 
  BarChart3, Calendar, Users, AlertCircle, 
  ChevronRight, ChevronDown, ChevronUp, Clock, ArrowRight, Check,
  Globe, BarChart, ExternalLink, Copy, Heart, Save, Send, Sparkles, ArrowUpRight
} from 'lucide-react';

/**
 * nayo money 股利工具 v30.1 - 功能更新版
 * 1. 簡化領息輸入：移除分組內的重複輸入框。
 * 2. 監測盤增加總股數顯示。
 * 3. 投入分組標題增加總股數與總成本顯示。
 */

// --- 1. Firebase 初始化 ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "", 
      authDomain: "dividend-progress-bar-350dd.firebaseapp.com",
      projectId: "dividend-progress-bar-350dd",
      storageBucket: "dividend-progress-bar-350dd.firebasestorage.app",
      messagingSenderId: "250314546689",
      appId: "1:250314546689:web:13111c1368547594e16a00"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'nayo-money-official';

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

  const [txDraft, setTxDraft] = useState({ member: '', symbol: '', cost: '0', shares: '0', date: new Date().toISOString().split('T')[0] });
  const [divDraft, setDivDraft] = useState({ member: '', symbol: '', amount: '0', date: new Date().toISOString().split('T')[0] });
  const [newMemName, setNewMemName] = useState("");
  const [newSymName, setNewSymName] = useState("");

  const [editTx, setEditTx] = useState({});
  const [editDiv, setEditDiv] = useState({});
  const [editSym, setEditSym] = useState({});

  useEffect(() => {
    document.title = "nayo money 股利工具";
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {}
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user) return;
    const getPath = (col) => collection(db, 'artifacts', appId, 'users', user.uid, col);

    const unsubMembers = onSnapshot(getPath('members'), s => {
      const data = s.docs.map(d => ({id: d.id, ...d.data()}));
      setMembers(data);
      if (data.length > 0) {
        if (!txDraft.member) setTxDraft(p => ({ ...p, member: data[0].name }));
        if (!divDraft.member) setDivDraft(p => ({ ...p, member: data[0].name }));
      }
    });

    const unsubSymbols = onSnapshot(getPath('symbols'), s => {
      const data = s.docs.map(d => ({id: d.id, ...d.data()}));
      setSymbols(data);
      if (data.length > 0) {
        if (!txDraft.symbol) setTxDraft(p => ({ ...p, symbol: data[0].name }));
        if (!divDraft.symbol) setDivDraft(p => ({ ...p, symbol: data[0].name }));
      }
    });

    onSnapshot(getPath('dividends'), s => setDividends(s.docs.map(d => ({id: d.id, ...d.data()}))));
    onSnapshot(getPath('transactions'), s => setTransactions(s.docs.map(d => ({id: d.id, ...d.data()}))));
  }, [user]);

  useEffect(() => {
    const txObj = {}; transactions.forEach(t => txObj[t.id] = { ...t }); setEditTx(txObj);
    const divObj = {}; dividends.forEach(d => divObj[d.id] = { ...d }); setEditDiv(divObj);
    const symObj = {}; symbols.forEach(s => symObj[s.id] = { ...s, currentPrice: s.currentPrice || 0 }); setEditSym(symObj);
  }, [transactions, dividends, symbols]);

  const stats = useMemo(() => {
    const fDivs = dividends.filter(d => filterMember === 'all' || d.member === filterMember);
    const fTx = transactions.filter(t => filterMember === 'all' || t.member === filterMember);
    
    const totalDiv = fDivs.reduce((a, b) => a + parseFloat(b.amount || 0), 0);
    const totalCost = fTx.reduce((a, b) => a + parseFloat(b.cost || 0), 0);
    
    const portfolio = {};
    symbols.forEach(s => { 
      portfolio[s.name] = { 
        name: s.name, 
        cost: 0, 
        div: 0, 
        shares: 0, 
        currentPrice: parseFloat(s.currentPrice || 0), 
        lots: [] 
      }; 
    });
    
    fDivs.forEach(d => { if(portfolio[d.symbol]) portfolio[d.symbol].div += parseFloat(d.amount); });
    fTx.forEach(t => {
      if(portfolio[t.symbol]) {
        portfolio[t.symbol].cost += parseFloat(t.cost);
        portfolio[t.symbol].shares = (portfolio[t.symbol].shares * 1000000 + parseFloat(t.shares || 0) * 1000000) / 1000000;
        if (parseFloat(t.cost) > 0) {
          portfolio[t.symbol].lots.push({ 
            id: t.id, 
            date: t.date, 
            cost: parseFloat(t.cost), 
            shares: parseFloat(t.shares || 0) 
          });
        }
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

    return { 
      totalDiv, 
      totalMarketValue, 
      totalCost, 
      recovery: totalCost > 0 ? (totalDiv / totalCost) * 100 : 0, 
      overallReturn: totalCost > 0 ? ((totalMarketValue + totalDiv - totalCost) / totalCost) * 100 : 0, 
      items: Object.values(portfolio).filter(i => i.cost > 0), 
      monthly: Object.entries(monthlyData).sort((a, b) => b[0].localeCompare(a[0])), 
      avgMonthly: Object.keys(monthlyData).length > 0 ? totalDiv / Object.keys(monthlyData).length : 0
    };
  }, [dividends, transactions, symbols, filterMember]);

  const isReady = members.length > 0 && symbols.length > 0;

  const handleUpdate = async (col, id, data) => {
    if (!user) return;
    try { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, col, id), data); } catch (e) {}
  };

  const safeAddDoc = async (colName, data) => {
    if (!user) return;
    try { 
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, colName), { ...data, createdAt: serverTimestamp() }); 
      if (colName === 'transactions') { setInvestExpanded(data.symbol); setTxDraft({ ...txDraft, cost: '0', shares: '0' }); }
      if (colName === 'dividends') { setDivExpanded(data.symbol); setDivDraft({ ...divDraft, amount: '0' }); }
    } catch (e) {}
  };

  if (loading) return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center font-bold text-[#8B9D83]">
      <RefreshCw size={32} className="animate-spin mb-2" />
      <p className="text-xs uppercase tracking-widest italic opacity-60 text-slate-800">Nayo Money Booting</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-900 pb-20 font-sans select-none overflow-x-hidden">
      <header className="bg-[#8B9D83] text-white py-2 px-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Layers size={18} />
            <h1 className="text-base font-black tracking-tight leading-none uppercase">nayo money</h1>
          </div>
          <div className="flex items-center gap-2">
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="bg-white/20 text-white text-xs font-black border-none outline-none rounded-lg px-2 py-1 backdrop-blur-md">
              <option value="all" className="text-slate-900 font-bold">全家人</option>
              {members.map(m => ( <option key={m.id} value={m.name} className="text-slate-900 font-bold">{m.name}</option> ))}
            </select>
            <button onClick={() => signOut(auth)} className="bg-white/10 p-1.5 rounded-md hover:bg-white/20 transition-all"><LogOut size={16} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="總投入" value={`$${Math.round(stats.totalCost).toLocaleString()}`} sub="成本本金" color="#4A4A4A" />
              <StatCard title="總市值" value={`$${Math.round(stats.totalMarketValue).toLocaleString()}`} sub="目前價值" color="#3B82F6" />
              <StatCard title="回本率" value={`${stats.recovery.toFixed(2)}%`} sub="回收比重" color="#8B9D83" />
              <StatCard title="總報酬" value={`${stats.overallReturn.toFixed(1)}%`} sub="含息累積" color={stats.overallReturn >= 0 ? "#10B981" : "#EF4444"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
                  <h3 className="font-black text-slate-800 text-sm tracking-widest uppercase border-b-2 border-slate-50 pb-2 mb-4 flex items-center gap-2">
                    <Globe size={18} className="text-[#8B9D83]"/> 標的回本監測盤
                  </h3>
                  {stats.items.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-12 italic">尚未有投入紀錄</p>
                  ) : (
                    stats.items.map(p => (
                      <div key={p.name} className="space-y-2 bg-slate-50/60 p-4 rounded-3xl mb-3 hover:bg-slate-50 transition border border-transparent hover:border-[#8B9D83]/10">
                        <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedSymbol(expandedSymbol === p.name ? null : p.name)}>
                          <div>
                            <span className="text-lg font-black uppercase text-slate-800">{p.name}</span>
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                              持有: <span className="text-slate-600">{p.shares.toLocaleString()}</span> 股
                              <span className="ml-2 text-slate-300">
                                {expandedSymbol === p.name ? <ChevronUp size={10} className="inline"/> : <ChevronDown size={10} className="inline"/>}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                             <span className="text-[#8B9D83] font-mono font-black text-lg block leading-none">回本 {((p.div/Math.max(p.cost, 1))*100).toFixed(2)}%</span>
                             <span className="text-[10px] font-black text-slate-400 block mt-1">
                               成本: ${p.cost.toLocaleString()} | <span className={p.returnIncDiv >= 0 ? 'text-emerald-600' : 'text-red-500'}>含息: {p.returnIncDiv.toFixed(1)}%</span>
                             </span>
                          </div>
                        </div>
                        <div className="h-2.5 bg-white rounded-full overflow-hidden shadow-inner border border-slate-100">
                          <div className="h-full bg-[#8B9D83] transition-all duration-1000" style={{ width: `${Math.min((p.div/Math.max(p.cost, 1))*100, 100)}%` }}></div>
                        </div>
                        {expandedSymbol === p.name && (
                          <div className="mt-3 space-y-1 pt-2 border-t border-slate-200 animate-in slide-in-from-top-2">
                            {p.lots.map(lot => (
                              <div key={lot.id} className="flex justify-between text-xs font-black text-slate-500">
                                <span><Clock size={12} className="inline mr-1 opacity-40"/>{lot.date} ({lot.shares} 股)</span>
                                <span>${lot.cost.toLocaleString()} ({lot.progress.toFixed(2)}% 回本)</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-gradient-to-br from-[#8B9D83] to-[#7A8C72] rounded-[2.5rem] p-6 text-white shadow-lg relative overflow-hidden group">
                  <div className="relative z-10 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-black text-lg mb-1 flex items-center gap-2 italic"><Sparkles size={20} /> 財富自由充電站</h3>
                      <p className="text-white/80 text-xs font-bold leading-relaxed">探索打造「永不枯竭股利印鈔機」的秘密</p>
                    </div>
                    <a href="https://nayomoney.com/" target="_blank" rel="noopener noreferrer" className="bg-white text-[#8B9D83] p-3 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all">
                      <ArrowUpRight size={24}/>
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
                <div className="flex justify-between items-end border-b-2 border-slate-50 pb-2 mb-4">
                  <h3 className="font-black text-slate-800 text-sm tracking-widest uppercase flex items-center gap-2">
                    <BarChart size={18} className="text-[#8B9D83]"/> 每月領息現金流
                  </h3>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-black leading-none">月平均股利</p>
                    <p className="text-xl font-black text-[#8B9D83] font-mono leading-tight">NT$ {Math.round(stats.avgMonthly).toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
                  {stats.monthly.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-12 italic">尚未有領息紀錄</p>
                  ) : (
                    stats.monthly.map(([month, amount]) => (
                      <div key={month} className="flex justify-between items-center p-4 bg-[#F2E8D5]/30 rounded-3xl hover:bg-[#F2E8D5]/50 transition-colors">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">{month} 合計</span>
                        <p className="text-xl font-black text-[#8B9D83] font-mono">${amount.toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invest' && (
          <div className="space-y-4 animate-in slide-in-from-right-4">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <h2 className="font-black text-lg text-slate-800 flex items-center gap-2 italic"><TrendingUp size={20}/> 投入紀錄管理</h2>
                <div className="bg-[#8B9D83]/10 p-5 rounded-[2rem] border border-[#8B9D83]/20 space-y-4 mb-6">
                   <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-black text-[#8B9D83] uppercase tracking-widest flex items-center gap-1"><PlusCircle size={12}/> 快速建立新投入</span>
                      <input type="date" value={txDraft.date} onChange={e => setTxDraft({...txDraft, date: e.target.value})} className="text-[11px] font-black bg-white rounded-lg px-2 py-1 border border-[#8B9D83]/20 outline-none shadow-sm cursor-pointer" />
                   </div>
                   <div className="flex flex-wrap md:flex-nowrap gap-3 items-center">
                      <div className="flex flex-[2] gap-2 items-center">
                        <select value={txDraft.member} onChange={e => setTxDraft({...txDraft, member: e.target.value})} className="flex-1 bg-white text-sm py-2 px-3 rounded-xl font-black border border-[#8B9D83]/20 shadow-sm">
                          {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                        <select value={txDraft.symbol} onChange={e => setTxDraft({...txDraft, symbol: e.target.value})} className="flex-1 bg-white text-sm py-2 px-3 rounded-xl font-black border border-[#8B9D83]/20 shadow-sm uppercase">
                          {symbols.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-[3] gap-2 items-center">
                        <CompactNumberInput placeholder="碎股數" value={txDraft.shares} onChange={v => setTxDraft({...txDraft, shares: v})} className="flex-1 text-center py-2" />
                        <CompactNumberInput placeholder="成本 NT$" value={txDraft.cost} onChange={v => setTxDraft({...txDraft, cost: v})} className="flex-[2] text-center py-2" />
                        <button onClick={() => safeAddDoc('transactions', txDraft)} className="bg-[#8B9D83] text-white p-2.5 rounded-xl shadow-lg active:scale-90 hover:bg-[#7A8C72] transition-all"><Send size={20} /></button>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {symbols.map(s => {
                    const txList = transactions.filter(t => t.symbol === s.name && (filterMember === 'all' || t.member === filterMember));
                    if (txList.length === 0 && investExpanded !== s.name) return null;
                    
                    // 計算該標的目前過濾後的總合
                    const symTotalShares = txList.reduce((acc, curr) => acc + parseFloat(curr.shares || 0), 0);
                    const symTotalCost = txList.reduce((acc, curr) => acc + parseFloat(curr.cost || 0), 0);

                    return (
                      <div key={s.name} className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-slate-100">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-100" onClick={() => setInvestExpanded(investExpanded === s.name ? null : s.name)}>
                          <div>
                            <span className="text-sm font-black uppercase tracking-wide">{s.name}</span>
                            <div className="text-[10px] font-black text-slate-400">
                               持有: {symTotalShares.toLocaleString()} 股 | 成本: ${symTotalCost.toLocaleString()}
                            </div>
                          </div>
                          <div className="text-slate-400">{investExpanded === s.name ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</div>
                        </div>
                        {investExpanded === s.name && (
                          <div className="p-3 space-y-3">
                            {txList.sort((a,b) => b.date.localeCompare(a.date)).map(t => (
                              <div key={t.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-2 relative group">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-black text-slate-400">{t.date} · {t.member}</span>
                                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', t.id))} className="text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                                </div>
                                <div className="flex justify-between items-center font-black">
                                  <span className="text-xs text-slate-500">股數 {t.shares}</span>
                                  <span className="text-sm text-[#8B9D83] font-mono">成本 ${parseFloat(t.cost).toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
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
          <div className="space-y-4 animate-in slide-in-from-right-4">
            {!isReady ? ( <SetupGuide onGo={() => setActiveTab('masters')} /> ) : (
              <>
                <h2 className="font-black text-lg text-slate-800 flex items-center gap-2 italic"><DollarSign size={20}/> 領息流水管理</h2>
                <div className="bg-[#8B9D83]/10 p-5 rounded-[2rem] border border-[#8B9D83]/20 space-y-4 mb-6">
                   <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-black text-[#8B9D83] uppercase tracking-widest flex items-center gap-1"><PlusCircle size={12}/> 全域快速新增領息</span>
                      <input type="date" value={divDraft.date} onChange={e => setDivDraft({...divDraft, date: e.target.value})} className="text-[11px] font-black bg-white rounded-lg px-2 py-1 border border-[#8B9D83]/20 outline-none shadow-sm cursor-pointer" />
                   </div>
                   <div className="flex flex-wrap md:flex-nowrap gap-3 items-center">
                      <div className="flex flex-[2] gap-2">
                        <select value={divDraft.member} onChange={e => setDivDraft({...divDraft, member: e.target.value})} className="flex-1 bg-white text-sm py-2 px-3 rounded-xl font-black border border-[#8B9D83]/20 shadow-sm">
                          {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                        <select value={divDraft.symbol} onChange={e => setDivDraft({...divDraft, symbol: e.target.value})} className="flex-1 bg-white text-sm py-2 px-3 rounded-xl font-black border border-[#8B9D83]/20 shadow-sm uppercase">
                          {symbols.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-1 gap-2 items-center">
                        <div className="flex-1 bg-white border border-[#8B9D83]/20 rounded-xl px-3 py-1 shadow-inner flex items-center">
                          <span className="text-[10px] text-[#8B9D83] font-black mr-1">NT$</span>
                          <CompactNumberInput value={divDraft.amount} onChange={v => setDivDraft({...divDraft, amount: v})} className="w-full text-right border-none shadow-none focus:ring-0" />
                        </div>
                        <button onClick={() => safeAddDoc('dividends', divDraft)} className="bg-[#8B9D83] text-white p-2.5 rounded-xl shadow-lg active:scale-90 hover:bg-[#7A8C72] transition-all"><Send size={20} /></button>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {symbols.map(s => {
                    const divList = dividends.filter(d => d.symbol === s.name && (filterMember === 'all' || d.member === filterMember));
                    if (divList.length === 0 && divExpanded !== s.name) return null;
                    const symTotalDiv = divList.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
                    
                    return (
                      <div key={s.name} className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-slate-100">
                        <div className="p-4 bg-blue-50/50 border-b border-blue-100 flex justify-between items-center cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => setDivExpanded(divExpanded === s.name ? null : s.name)}>
                          <div>
                            <span className="text-sm font-black uppercase tracking-wide">{s.name}</span>
                            <div className="text-[10px] font-black text-blue-400">累計領息: ${symTotalDiv.toLocaleString()}</div>
                          </div>
                          <div className="text-slate-400">{divExpanded === s.name ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</div>
                        </div>
                        {divExpanded === s.name && (
                          <div className="p-3 space-y-2">
                            {divList.sort((a,b) => b.date.localeCompare(a.date)).map(d => (
                              <div key={d.id} className="p-3 bg-white rounded-2xl border border-slate-50 shadow-sm flex justify-between items-center group">
                                <div>
                                  <div className="text-[9px] font-black text-slate-400">{d.date} · {d.member}</div>
                                  <div className="text-sm font-black text-[#8B9D83] font-mono">${parseFloat(d.amount).toLocaleString()}</div>
                                </div>
                                <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'dividends', d.id))} className="text-slate-200 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                              </div>
                            ))}
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
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-slate-50 space-y-8">
               <section className="space-y-4">
                 <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={18}/> 人員管理中心</h3>
                 <div className="flex gap-2 max-w-md">
                   <input placeholder="輸入姓名 (例如: 媽媽)" className="flex-1 py-3 px-5 text-sm font-black bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 ring-[#8B9D83]/20" value={newMemName} onChange={e => setNewMemName(e.target.value)} />
                   <button onClick={async () => { if(newMemName.trim()) { await safeAddDoc('members', { name: newMemName.trim() }); setNewMemName(""); } }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg">建立</button>
                 </div>
                 <div className="flex flex-wrap gap-2">
                   {members.map(m => (
                     <span key={m.id} className="bg-blue-50 text-xs font-black text-blue-800 px-4 py-2 rounded-xl border border-blue-100 flex items-center gap-2 group">
                       {m.name}
                       <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'members', m.id))} className="text-blue-300 hover:text-red-500 font-black">×</button>
                     </span>
                   ))}
                 </div>
               </section>

               <section className="space-y-4 border-t border-slate-50 pt-8">
                 <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2"><Globe size={18}/> 標的管理中心</h3>
                 <div className="flex gap-2 max-w-md">
                   <input placeholder="標的代碼 (例如: 0050)" className="flex-1 uppercase py-3 px-5 text-sm font-black bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 ring-[#8B9D83]/20" value={newSymName} onChange={e => setNewSymName(e.target.value.toUpperCase())} />
                   <button onClick={async () => { if(newSymName.trim()) { await safeAddDoc('symbols', { name: newSymName.trim(), currentPrice: 0 }); setNewSymName(""); } }} className="bg-[#8B9D83] text-white px-8 py-3 rounded-2xl font-black shadow-lg">新增</button>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                   {symbols.map(s => {
                     const draft = editSym[s.id] || s; 
                     const hasChanged = Number(draft.currentPrice) !== Number(s.currentPrice);
                     return (
                       <div key={s.id} className={`p-4 rounded-[2rem] border-2 transition-all ${hasChanged ? 'border-amber-300 bg-amber-50/20' : 'bg-white border-slate-100'}`}>
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black uppercase text-slate-400">{s.name}</span>
                            <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'symbols', s.id))} className="text-slate-300 hover:text-red-500 text-sm">×</button>
                         </div>
                         <div className="flex items-center gap-1">
                           <CompactNumberInput value={draft.currentPrice} onChange={v => setEditSym({...editSym, [s.id]: {...draft, currentPrice: v}})} className="w-full text-center font-mono text-emerald-600 border-none shadow-none focus:ring-0 p-0" placeholder="0" />
                           {hasChanged && ( <button onClick={() => handleUpdate('symbols', s.id, draft)} className="bg-emerald-600 text-white p-1 rounded-lg"><Check size={12}/></button> )}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </section>
               
               <div className="pt-8 text-center border-t border-slate-50">
                  <a href="https://nayomoney.com/" target="_blank" rel="noopener noreferrer" className="inline-block bg-[#8B9D83] text-white px-12 py-5 rounded-[2.5rem] font-black text-lg shadow-2xl hover:scale-105 active:scale-95 transition-all">探索更多財富秘密 <ExternalLink size={20} className="inline ml-2" /></a>
               </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pointer-events-none">
        <div className="max-w-7xl mx-auto flex justify-center pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-xl border border-slate-200/50 p-2 shadow-2xl rounded-full flex gap-1 md:gap-4 overflow-hidden">
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
  <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 text-center relative overflow-hidden group hover:shadow-md transition-shadow">
    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }}></div>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
    <p className="text-2xl md:text-3xl font-mono font-black tracking-tighter" style={{ color }}>{value}</p>
    <p className="text-[9px] text-slate-400 font-black italic tracking-wider uppercase opacity-60 mt-2">{sub}</p>
  </div>
);

const SetupGuide = ({ onGo }) => (
  <div className="bg-white p-12 rounded-[3rem] text-center space-y-6 shadow-xl border border-slate-50 animate-in zoom-in max-w-md mx-auto mt-12">
    <div className="bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-2"><AlertCircle size={48} /></div>
    <div className="space-y-2">
      <h3 className="text-2xl font-black tracking-tight text-slate-800">尚未初始化數據</h3>
      <p className="text-sm text-slate-500 font-bold px-4">請先前往「管理」分頁建立家庭成員與追蹤標的。</p>
    </div>
    <button onClick={onGo} className="bg-[#8B9D83] text-white w-full py-4 rounded-[1.5rem] font-black shadow-lg flex items-center justify-center gap-2">立即前往 <ArrowRight size={20}/></button>
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 transition-all px-4 py-2 min-w-[70px] rounded-full ${active ? 'bg-[#8B9D83] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
    {icon}
    <span className={`text-[10px] font-black tracking-widest ${active ? 'text-white' : 'text-slate-500'}`}>{label}</span>
  </button>
);
