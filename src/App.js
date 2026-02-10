import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithCustomToken,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  TrendingUp,
  Activity,
  Trash2,
  PlusCircle,
  RefreshCw,
  DollarSign,
  List,
  Layers,
  LogOut,
  ShieldCheck,
  BarChart3,
  Calendar,
  Users,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowRight,
  Check,
  Globe,
  BarChart,
  ExternalLink,
  Copy,
} from "lucide-react";

/**
 * nayo money 股利工具 v10.7 - 部署環境全相容版
 * * 修正重點：
 * 1. 語法安全：修復 JSX 特殊符號轉義，確保 Vercel Build 成功。
 * 2. 佈局：電腦版 1280px 滿版，手機版自動縮放。
 * 3. 登入：僅限 Google 帳號，並提供網域授權複製工具。
 * 4. 計算：手動輸入市價，自動帶出含息/未含息報酬率。
 */

// --- 0. 樣式修復：自動注入 Tailwind ---
if (typeof document !== "undefined") {
  const tailwindScript = document.getElementById("tailwind-cdn");
  if (!tailwindScript) {
    const script = document.createElement("script");
    script.id = "tailwind-cdn";
    script.src = "https://cdn.tailwindcss.com";
    document.head.appendChild(script);
  }
}

// --- 1. Firebase 配置 ---
// 💡 請務必在 Firebase Console 點擊 </> 獲取正確的 appId 後填入
const REAL_CONFIG = {
  apiKey: "AIzaSyB75a0ZSk4qIqoRctwfFKRQjvpuH6uPEkg",
  authDomain: "dividend-progress-bar-350dd.firebaseapp.com",
  projectId: "dividend-progress-bar-350dd",
  storageBucket: "dividend-progress-bar-350dd.firebasestorage.app",
  messagingSenderId: "250314546689",
  appId: "1:250314546689:web:13111c1368547594e16a00",
};

const configSource =
  typeof __firebase_config !== "undefined"
    ? JSON.parse(__firebase_config)
    : REAL_CONFIG;

const app = initializeApp(configSource);
const auth = getAuth(app);
const db = getFirestore(app);
const currentAppId =
  typeof __app_id !== "undefined" ? __app_id : "nayo-money-official";

// --- 2. 大型化輸入組件 ---
const BigManualInput = ({
  value,
  onChange,
  className,
  type = "text",
  placeholder,
}) => {
  return (
    <input
      type={type}
      className={`${className} text-lg md:text-xl font-black p-5 md:p-6 text-slate-800 outline-none transition-all focus:ring-4 ring-[#8B9D83]/10`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
    />
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState(null);
  const [expandedSymbol, setExpandedSymbol] = useState(null);
  const [investExpanded, setInvestExpanded] = useState(null);

  const [members, setMembers] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [dividends, setDividends] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filterMember, setFilterMember] = useState("all");

  const [editTx, setEditTx] = useState({});
  const [editDiv, setEditDiv] = useState({});
  const [editSym, setEditSym] = useState({});

  // 1. 認證
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (e) {}
      }
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // 2. Google 登入
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setError(null);
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === "auth/unauthorized-domain") {
        const domain = window.location.hostname;
        setError(
          <div className="text-left space-y-3">
            <p className="font-black text-sm">網域尚未授權：{domain}</p>
            <p className="text-xs font-medium leading-relaxed">
              請至 Firebase 控制台 {" > "} Authentication {" > "} 設定 {" > "}{" "}
              授權網域，將此網域加入白名單。
            </p>
            <button
              onClick={() => {
                const temp = document.createElement("input");
                temp.value = domain;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand("copy");
                document.body.removeChild(temp);
              }}
              className="flex items-center gap-2 bg-red-100 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-200 transition"
            >
              <Copy size={12} /> 複製此網域以便貼上
            </button>
          </div>
        );
      } else {
        setError("登入失敗：" + err.message);
      }
    }
  };

  // 3. 實時監聽
  useEffect(() => {
    if (!user) return;
    const userPath = (col) =>
      collection(db, "artifacts", currentAppId, "users", user.uid, col);

    const unsub1 = onSnapshot(
      userPath("members"),
      (s) => setMembers(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setError("權限不足：請檢查 Firebase Rules 設定")
    );
    const unsub2 = onSnapshot(userPath("symbols"), (s) =>
      setSymbols(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub3 = onSnapshot(userPath("dividends"), (s) =>
      setDividends(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub4 = onSnapshot(userPath("transactions"), (s) =>
      setTransactions(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [user]);

  // 4. 同步編輯緩衝
  useEffect(() => {
    const txObj = {};
    transactions.forEach((t) => (txObj[t.id] = { ...t }));
    setEditTx(txObj);
    const divObj = {};
    dividends.forEach((d) => (divObj[d.id] = { ...d }));
    setEditDiv(divObj);
    const symObj = {};
    symbols.forEach(
      (s) => (symObj[s.id] = { ...s, currentPrice: s.currentPrice || 0 })
    );
    setEditSym(symObj);
  }, [transactions, dividends, symbols]);

  // 5. 統計引擎
  const stats = useMemo(() => {
    const fDivs = dividends.filter(
      (d) => filterMember === "all" || d.member === filterMember
    );
    const fTx = transactions.filter(
      (t) => filterMember === "all" || t.member === filterMember
    );

    const totalDiv = fDivs.reduce((a, b) => a + Number(b.amount || 0), 0);
    const totalCost = fTx.reduce((a, b) => a + Number(b.cost || 0), 0);

    const portfolio = {};
    symbols.forEach((s) => {
      portfolio[s.name] = {
        name: s.name,
        cost: 0,
        div: 0,
        shares: 0,
        currentPrice: Number(s.currentPrice || 0),
        lots: [],
      };
    });

    fDivs.forEach((d) => {
      if (portfolio[d.symbol]) portfolio[d.symbol].div += Number(d.amount);
    });
    fTx.forEach((t) => {
      if (portfolio[t.symbol]) {
        portfolio[t.symbol].cost += Number(t.cost);
        portfolio[t.symbol].shares += Number(t.shares || 0);
        if (Number(t.cost) > 0) {
          portfolio[t.symbol].lots.push({
            id: t.id,
            date: t.date,
            cost: Number(t.cost),
            shares: Number(t.shares || 0),
          });
        }
      }
    });

    let totalMarketValue = 0;
    Object.values(portfolio).forEach((p) => {
      totalMarketValue += p.shares * p.currentPrice;
      p.lots.forEach((lot) => {
        const ratio = p.shares > 0 ? lot.shares / p.shares : 0;
        const lotDiv = p.div * ratio;
        lot.progress = lot.cost > 0 ? (lotDiv / lot.cost) * 100 : 0;
      });
      p.lots.sort((a, b) => b.date.localeCompare(a.date));
      p.marketValue = p.shares * p.currentPrice;
      p.returnExDiv =
        p.cost > 0 ? ((p.marketValue - p.cost) / p.cost) * 100 : 0;
      p.returnIncDiv =
        p.cost > 0 ? ((p.marketValue + p.div - p.cost) / p.cost) * 100 : 0;
    });

    const monthlyData = {};
    fDivs.forEach((d) => {
      const date = new Date(d.date);
      if (isNaN(date)) return;
      const key = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
      monthlyData[key] = (monthlyData[key] || 0) + Number(d.amount);
    });

    return {
      totalDiv,
      totalMarketValue,
      totalCost,
      recovery:
        totalCost > 0 ? (totalDiv / totalCost) * 100 : totalDiv > 0 ? 100 : 0,
      overallReturn:
        totalCost > 0
          ? ((totalMarketValue + totalDiv - totalCost) / totalCost) * 100
          : 0,
      items: Object.values(portfolio).filter(
        (i) =>
          i.cost !== 0 ||
          i.div > 0 ||
          transactions.some((t) => t.symbol === i.name)
      ),
      monthly: Object.entries(monthlyData).sort((a, b) =>
        b[0].localeCompare(a[0])
      ),
      avgMonthly:
        Object.keys(monthlyData).length > 0
          ? totalDiv / Object.keys(monthlyData).length
          : 0,
    };
  }, [dividends, transactions, symbols, filterMember]);

  const isReady = members.length > 0 && symbols.length > 0;

  const safeAddDoc = async (colName, data) => {
    if (!user) return;
    try {
      setError(null);
      if (colName === "transactions") setInvestExpanded(data.symbol);
      await addDoc(
        collection(db, "artifacts", currentAppId, "users", user.uid, colName),
        {
          ...data,
          createdAt: serverTimestamp(),
        }
      );
    } catch (e) {
      setError("寫入失敗，請確認 Firebase Rules 設定。");
    }
  };

  const handleUpdate = async (col, id, data) => {
    if (!user) return;
    try {
      setError(null);
      await updateDoc(
        doc(db, "artifacts", currentAppId, "users", user.uid, col, id),
        data
      );
    } catch (e) {
      setError("更新失敗。");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#F2E8D5] flex flex-col items-center justify-center font-bold text-[#8B9D83]">
        <div className="animate-spin mb-4">
          <RefreshCw size={44} />
        </div>
        <p className="tracking-widest text-lg italic text-[#8B9D83]">
          nayo money 能量載入中...
        </p>
      </div>
    );

  // 登入畫面
  if (!user)
    return (
      <div className="min-h-screen bg-[#F2E8D5] flex items-center justify-center p-6 text-center font-sans">
        <div className="bg-white w-full max-w-md rounded-[4rem] p-12 lg:p-16 shadow-2xl border border-[#D9C5B2]/20">
          <div className="flex flex-col items-center mb-12">
            <div className="bg-[#8B9D83] p-8 rounded-[2.8rem] text-white shadow-xl mb-8 shadow-[#8B9D83]/20 animate-in zoom-in duration-700 mx-auto">
              <ShieldCheck size={56} />
            </div>
            <h1 className="text-3xl font-black text-[#4A4A4A] tracking-tighter">
              nayo money股利工具
            </h1>
            <p className="text-[#8B9D83] text-base mt-4 font-bold italic">
              守護全家人的財富底氣
            </p>
          </div>

          <p className="text-sm text-slate-500 mb-8 font-medium">
            僅供 Google 帳號登入管理
          </p>

          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white border-2 border-slate-100 py-6 rounded-[2rem] flex items-center justify-center gap-4 font-black text-slate-700 hover:bg-slate-50 transition-all shadow-xl shadow-slate-200/50 hover:scale-[1.02] active:scale-95 mx-auto"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className="w-7 h-7"
            />
            Google 帳號登入
          </button>

          {error && (
            <div className="mt-8 p-6 bg-red-50 border border-red-100 rounded-3xl text-red-500 animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 mt-1" />
                <div className="text-xs font-bold leading-relaxed">{error}</div>
              </div>
              <div className="flex gap-4 mt-4">
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-600 hover:underline"
                >
                  前往 Firebase 後台 <ExternalLink size={12} />
                </a>
                <button
                  onClick={() => setError(null)}
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-auto"
                >
                  關閉提示
                </button>
              </div>
            </div>
          )}

          <div className="mt-12 text-center">
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.3em]">
              nayo money family security
            </p>
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#F2E8D5] text-[#4A4A4A] pb-44 font-sans select-none overflow-x-hidden">
      <header className="bg-[#8B9D83] text-white p-6 sticky top-0 z-50 shadow-lg rounded-b-[3.5rem]">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md shadow-inner">
              <Layers size={24} />
            </div>
            <h1 className="text-xl md:text-2xl font-black leading-none tracking-tight text-white">
              nayo money股利工具
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
              className="bg-white/20 text-white text-sm font-black border-none outline-none rounded-xl px-5 py-3 backdrop-blur-md cursor-pointer appearance-none shadow-sm"
            >
              <option value="all" className="text-slate-800 bg-white font-bold">
                全家人總結
              </option>
              {members.map((m) => (
                <option
                  key={m.id}
                  value={m.name}
                  className="text-slate-800 bg-white font-bold"
                >
                  {m.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => signOut(auth)}
              className="bg-white/10 p-3 rounded-2xl hover:bg-white/20 transition-colors shadow-sm text-white"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 mt-4 text-slate-800">
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
              <StatCard
                title="總投入成本"
                value={`$${Math.round(stats.totalCost).toLocaleString()}`}
                sub="家庭原始本金"
                color="#4A4A4A"
              />
              <StatCard
                title="當前總市值"
                value={`$${Math.round(
                  stats.totalMarketValue
                ).toLocaleString()}`}
                sub="目前估值損益"
                color="#3B82F6"
              />
              <StatCard
                title="累積回本率"
                value={`${stats.recovery.toFixed(1)}%`}
                sub="股利回收率"
                color="#8B9D83"
              />
              <StatCard
                title="含息總報酬"
                value={`${stats.overallReturn.toFixed(1)}%`}
                sub="最終總能產出"
                color={stats.overallReturn >= 0 ? "#10B981" : "#EF4444"}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-[4rem] p-10 shadow-sm space-y-8 border border-slate-100">
                <h3 className="font-black text-slate-800 text-lg tracking-widest uppercase border-b pb-4 flex items-center gap-3">
                  <Globe size={20} className="text-[#8B9D83]" /> 標的回本監測盤
                </h3>
                {stats.items.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-12 italic text-slate-800">
                    請先輸入資料
                  </p>
                ) : (
                  stats.items.map((p) => (
                    <div
                      key={p.name}
                      className="space-y-4 bg-slate-50/50 p-6 rounded-[2.5rem] border border-transparent hover:border-[#8B9D83]/20 transition shadow-sm"
                    >
                      <div
                        className="flex justify-between items-center cursor-pointer"
                        onClick={() =>
                          setExpandedSymbol(
                            expandedSymbol === p.name ? null : p.name
                          )
                        }
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base font-black text-slate-800 tracking-wider uppercase">
                            {p.name}
                          </span>
                          {expandedSymbol === p.name ? (
                            <ChevronUp size={18} className="text-slate-600" />
                          ) : (
                            <ChevronDown size={18} className="text-slate-600" />
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-[#8B9D83] font-mono font-black text-xl leading-none">
                            回本{" "}
                            {Math.round((p.div / Math.max(p.cost, 1)) * 100)}%
                          </p>
                          <p
                            className={`text-xs font-bold mt-1 ${
                              p.returnIncDiv >= 0
                                ? "text-emerald-500"
                                : "text-red-400"
                            }`}
                          >
                            含息報酬: {p.returnIncDiv.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="h-4 bg-white rounded-full overflow-hidden shadow-inner border border-slate-100">
                        <div
                          className="h-full bg-[#8B9D83] transition-all duration-700"
                          style={{
                            width: `${Math.min(
                              (p.div / Math.max(p.cost, 1)) * 100,
                              100
                            )}%`,
                          }}
                        ></div>
                      </div>

                      {expandedSymbol === p.name && (
                        <div className="mt-5 space-y-5 pt-5 border-t border-slate-200/50 animate-in slide-in-from-top-3">
                          {p.lots.length === 0 ? (
                            <p className="text-xs text-slate-500 italic text-slate-800 text-center">
                              暫無買入紀錄
                            </p>
                          ) : (
                            p.lots.map((lot) => (
                              <div
                                key={lot.id}
                                className="space-y-2 text-slate-800"
                              >
                                <div className="flex justify-between text-xs font-black text-slate-800">
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} /> {lot.date}
                                  </span>
                                  <span>
                                    成本: $ {lot.cost.toLocaleString()}
                                  </span>
                                  <span className="text-[#D9C5B2] font-black">
                                    {Math.round(lot.progress)}% 回本
                                  </span>
                                </div>
                                <div className="h-2 bg-white rounded-full overflow-hidden shadow-sm">
                                  <div
                                    className="h-full bg-[#D9C5B2] transition-all duration-1000"
                                    style={{
                                      width: `${Math.min(lot.progress, 100)}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="bg-white rounded-[4rem] p-10 shadow-sm space-y-8 border border-slate-100">
                <h3 className="font-black text-slate-800 text-lg tracking-widest uppercase border-b pb-4 flex items-center gap-3">
                  <BarChart size={20} className="text-[#8B9D83]" />{" "}
                  每月領息現金流
                </h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 font-mono">
                  {stats.monthly.length === 0 ? (
                    <p className="text-center text-slate-500 text-sm py-20 italic text-slate-800 text-center mx-auto">
                      暫無領息歷史
                    </p>
                  ) : (
                    stats.monthly.map(([month, amount]) => (
                      <div
                        key={month}
                        className="flex justify-between items-center p-6 bg-[#F2E8D5]/20 rounded-[2rem] border border-transparent hover:border-[#8B9D83]/20 transition group"
                      >
                        <div>
                          <p className="text-xs text-slate-600 font-black uppercase tracking-widest">
                            {month}
                          </p>
                          <p className="text-lg font-black text-slate-800">
                            當月合計
                          </p>
                        </div>
                        <p className="text-2xl font-black text-[#8B9D83]">
                          NT$ {amount.toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 投入紀錄 - 手動存檔 */}
        {activeTab === "invest" && (
          <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
            {!isReady ? (
              <SetupGuide onGo={() => setActiveTab("masters")} />
            ) : (
              <>
                <div className="flex justify-between items-center px-4">
                  <h2 className="font-black text-2xl text-slate-800 tracking-tight flex items-center gap-3 italic">
                    <TrendingUp size={28} className="text-[#8B9D83]" />{" "}
                    投入本金明細
                  </h2>
                  <button
                    onClick={() =>
                      safeAddDoc("transactions", {
                        member: members[0]?.name || "本人",
                        symbol: symbols[0]?.name || "0050",
                        cost: 0,
                        shares: 0,
                        date: new Date().toISOString().split("T")[0],
                      })
                    }
                    className="bg-[#8B9D83] text-white p-5 rounded-3xl shadow-2xl active:scale-95 transition-all"
                  >
                    <PlusCircle size={28} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {symbols.map((s) => {
                    const txList = transactions.filter(
                      (t) =>
                        t.symbol === s.name &&
                        (filterMember === "all" || t.member === filterMember)
                    );
                    if (txList.length === 0 && investExpanded !== s.name)
                      return null;
                    return (
                      <div
                        key={s.name}
                        className="bg-white rounded-[3rem] shadow-sm overflow-hidden border border-slate-100 transition-all"
                      >
                        <div className="p-6 bg-[#8B9D83]/5 border-b border-slate-50 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <span className="text-xl font-black text-slate-800 uppercase tracking-wide">
                              {s.name}
                            </span>
                            <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-[#8B9D83] shadow-sm">
                              {txList.length} 筆紀錄
                            </span>
                          </div>
                          <ChevronDown size={20} className="text-slate-400" />
                        </div>
                        <div className="p-6 space-y-6">
                          {txList
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((t) => {
                              const cur = editTx[t.id] || t;
                              const isChanged =
                                JSON.stringify(cur) !== JSON.stringify(t);
                              return (
                                <div
                                  key={t.id}
                                  className={`p-6 rounded-[2.5rem] border-2 transition-all space-y-5 relative ${
                                    isChanged
                                      ? "border-amber-200 bg-amber-50/20"
                                      : "border-slate-50 bg-slate-50/30"
                                  }`}
                                >
                                  <div className="flex justify-between items-center text-slate-800">
                                    <input
                                      type="date"
                                      value={cur.date}
                                      onChange={(e) =>
                                        setEditTx({
                                          ...editTx,
                                          [t.id]: {
                                            ...cur,
                                            date: e.target.value,
                                          },
                                        })
                                      }
                                      className="text-base font-black outline-none italic bg-transparent text-slate-800 cursor-pointer"
                                    />
                                    <div className="flex items-center gap-3">
                                      {isChanged && (
                                        <button
                                          onClick={() =>
                                            handleUpdate(
                                              "transactions",
                                              t.id,
                                              cur
                                            )
                                          }
                                          className="bg-emerald-500 text-white p-2 rounded-full shadow-lg hover:scale-110"
                                        >
                                          <Check size={18} />
                                        </button>
                                      )}
                                      <button
                                        onClick={() =>
                                          deleteDoc(
                                            doc(
                                              db,
                                              "artifacts",
                                              currentAppId,
                                              "users",
                                              user.uid,
                                              "transactions",
                                              t.id
                                            )
                                          )
                                        }
                                        className="text-slate-400 hover:text-red-500 p-2 transition"
                                      >
                                        <Trash2 size={20} />
                                      </button>
                                    </div>
                                  </div>
                                  <select
                                    value={cur.member}
                                    onChange={(e) =>
                                      setEditTx({
                                        ...editTx,
                                        [t.id]: {
                                          ...cur,
                                          member: e.target.value,
                                        },
                                      })
                                    }
                                    className="w-full bg-white text-base p-4 rounded-2xl font-black text-slate-800 border border-slate-100 shadow-sm outline-none"
                                  >
                                    {members.map((m) => (
                                      <option key={m.id} value={m.name}>
                                        {m.name}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                      <p className="text-xs text-slate-600 font-black ml-4 uppercase">
                                        股數 (賣出負數)
                                      </p>
                                      <BigManualInput
                                        type="number"
                                        value={cur.shares}
                                        onChange={(v) =>
                                          setEditTx({
                                            ...editTx,
                                            [t.id]: {
                                              ...cur,
                                              shares: Number(v),
                                            },
                                          })
                                        }
                                        className="w-full bg-white border border-slate-100 rounded-2xl shadow-inner text-slate-800 font-bold"
                                      />
                                    </div>
                                    <div className="space-y-1 font-mono text-[#8B9D83]">
                                      <p className="text-xs text-slate-600 font-black ml-4 uppercase">
                                        成本 (賣出負數)
                                      </p>
                                      <BigManualInput
                                        type="number"
                                        value={cur.cost}
                                        onChange={(v) =>
                                          setEditTx({
                                            ...editTx,
                                            [t.id]: { ...cur, cost: Number(v) },
                                          })
                                        }
                                        className="w-full bg-white border border-slate-100 rounded-2xl shadow-inner font-bold"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* 領息紀錄 */}
        {activeTab === "dividends" && (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
            {!isReady ? (
              <SetupGuide onGo={() => setActiveTab("masters")} />
            ) : (
              <>
                <div className="flex justify-between items-center px-4">
                  <h2 className="font-black text-2xl text-slate-800 tracking-tight flex items-center gap-3 italic">
                    <DollarSign size={28} className="text-[#8B9D83]" />{" "}
                    股利流水系統
                  </h2>
                  <button
                    onClick={() =>
                      safeAddDoc("dividends", {
                        member: members[0]?.name || "本人",
                        symbol: symbols[0]?.name || "0050",
                        amount: 0,
                        date: new Date().toISOString().split("T")[0],
                      })
                    }
                    className="bg-[#8B9D83] text-white p-5 rounded-3xl shadow-2xl active:rotate-90 transition-all duration-500 mx-auto"
                  >
                    <PlusCircle size={28} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-800">
                  {dividends
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((d) => {
                      const cur = editDiv[d.id] || d;
                      const isChanged =
                        JSON.stringify(cur) !== JSON.stringify(d);
                      return (
                        <div
                          key={d.id}
                          className={`p-6 rounded-[2.5rem] shadow-sm flex items-center gap-6 border-2 transition-all relative ${
                            isChanged
                              ? "border-amber-200 bg-amber-50/20"
                              : "border-slate-50 bg-white hover:border-[#8B9D83]/20"
                          }`}
                        >
                          <div className="flex-1 space-y-3 text-slate-800">
                            <input
                              type="date"
                              value={cur.date}
                              onChange={(e) =>
                                setEditDiv({
                                  ...editDiv,
                                  [d.id]: { ...cur, date: e.target.value },
                                })
                              }
                              className="text-sm font-black outline-none italic bg-transparent text-slate-800"
                            />
                            <div className="flex gap-4">
                              <select
                                value={cur.member}
                                onChange={(e) =>
                                  setEditDiv({
                                    ...editDiv,
                                    [d.id]: { ...cur, member: e.target.value },
                                  })
                                }
                                className="bg-[#F2E8D5]/60 text-xs p-3 rounded-2xl font-black text-slate-800 border-none outline-none shadow-sm"
                              >
                                {members.map((m) => (
                                  <option key={m.id} value={m.name}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={cur.symbol}
                                onChange={(e) =>
                                  setEditDiv({
                                    ...editDiv,
                                    [d.id]: { ...cur, symbol: e.target.value },
                                  })
                                }
                                className="font-black text-slate-800 text-lg bg-transparent border-none outline-none shadow-sm px-2"
                              >
                                {symbols.map((s) => (
                                  <option key={s.id} value={s.name}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="bg-[#F2E8D5]/60 px-6 py-4 rounded-3xl flex items-center gap-3 font-mono shadow-inner border border-[#8B9D83]/10">
                            <span className="text-sm text-[#8B9D83] font-black">
                              NT$
                            </span>
                            <ManualInput
                              type="number"
                              value={cur.amount}
                              onChange={(v) =>
                                setEditDiv({
                                  ...editDiv,
                                  [d.id]: { ...cur, amount: Number(v) },
                                })
                              }
                              className="bg-transparent text-right font-black text-[#8B9D83] w-32 md:w-40 outline-none text-xl font-bold"
                            />
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            {isChanged && (
                              <button
                                onClick={() =>
                                  handleUpdate("dividends", d.id, cur)
                                }
                                className="bg-emerald-500 text-white p-2 rounded-full shadow-lg hover:scale-110"
                              >
                                <Check size={18} />
                              </button>
                            )}
                            <button
                              onClick={() =>
                                deleteDoc(
                                  doc(
                                    db,
                                    "artifacts",
                                    currentAppId,
                                    "users",
                                    user.uid,
                                    "dividends",
                                    d.id
                                  )
                                )
                              }
                              className="text-slate-400 hover:text-red-500 p-2 transition text-center"
                            >
                              <Trash2 size={18} />
                            </button>
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
        {activeTab === "masters" && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-white p-12 rounded-[5rem] shadow-sm space-y-16 border border-slate-100">
              <div className="space-y-10">
                <div className="flex items-center gap-5">
                  <div className="bg-blue-500/10 p-5 rounded-[2.5rem] text-blue-600">
                    <Users size={40} />
                  </div>
                  <h3 className="font-black text-3xl text-slate-800 tracking-tight uppercase text-center md:text-left w-full">
                    家庭成員管理主檔
                  </h3>
                </div>
                <div className="flex gap-6 flex-col md:flex-row">
                  <input
                    id="memIn"
                    placeholder="人員 例如:媽媽"
                    className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] p-8 text-2xl font-black outline-none placeholder-slate-400 shadow-inner focus:border-blue-300 transition-all text-slate-800"
                  />
                  <button
                    onClick={async () => {
                      const el = document.getElementById("memIn");
                      const val = el.value.trim();
                      if (val) {
                        await safeAddDoc("members", { name: val });
                        el.value = "";
                      }
                    }}
                    className="bg-blue-600 text-white px-16 py-8 md:py-0 rounded-[2.5rem] font-black text-2xl shadow-2xl hover:bg-blue-700 active:scale-95 transition-all tracking-widest uppercase"
                  >
                    建立成員
                  </button>
                </div>
                <div className="flex flex-wrap gap-6 pt-4 text-slate-800">
                  {members.map((m) => (
                    <span
                      key={m.id}
                      className="bg-blue-50 text-xl font-black text-blue-800 px-10 py-6 rounded-[2.5rem] border-2 border-blue-100 flex items-center gap-5 shadow-sm group"
                    >
                      {m.name}
                      <button
                        onClick={() =>
                          deleteDoc(
                            doc(
                              db,
                              "artifacts",
                              currentAppId,
                              "users",
                              user.uid,
                              "members",
                              m.id
                            )
                          )
                        }
                        className="text-blue-300 hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-16 space-y-12">
                <div className="flex items-center gap-5">
                  <div className="bg-[#8B9D83]/10 p-5 rounded-[2.5rem] text-[#8B9D83]">
                    <Globe size={40} />
                  </div>
                  <h3 className="font-black text-3xl text-slate-800 tracking-tight uppercase text-center md:text-left w-full">
                    股票代碼與現價管理
                  </h3>
                </div>
                <div className="flex gap-6 flex-col md:flex-row">
                  <input
                    id="symbolIn"
                    placeholder="股票代碼 例如:0050"
                    className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] p-8 text-2xl font-black outline-none placeholder-slate-400 shadow-inner uppercase focus:border-[#8B9D83]/40 transition-all text-slate-800"
                  />
                  <button
                    onClick={async () => {
                      const el = document.getElementById("symbolIn");
                      const val = el.value.toUpperCase().trim();
                      if (val) {
                        await safeAddDoc("symbols", {
                          name: val,
                          currentPrice: 0,
                        });
                        el.value = "";
                      }
                    }}
                    className="bg-[#8B9D83] text-white px-16 py-8 md:py-0 rounded-[2.5rem] font-black text-2xl shadow-2xl hover:bg-[#7A8C72] active:scale-95 transition-all tracking-widest uppercase"
                  >
                    新增標的
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-6">
                  {symbols.map((s) => {
                    const cur = editSym[s.id] || s;
                    const isChanged = cur.currentPrice !== s.currentPrice;
                    return (
                      <div
                        key={s.id}
                        className={`p-8 rounded-[3.5rem] border-2 transition-all ${
                          isChanged
                            ? "border-amber-200 bg-amber-50/20"
                            : "bg-white border-slate-100 shadow-md"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-6">
                          <span className="text-2xl font-black text-slate-800 uppercase">
                            {s.name}
                          </span>
                          <div className="flex items-center gap-3">
                            {isChanged && (
                              <button
                                onClick={() =>
                                  handleUpdate("symbols", s.id, cur)
                                }
                                className="bg-emerald-500 text-white p-2.5 rounded-full shadow-lg transition-transform hover:scale-110"
                              >
                                <Check size={20} />
                              </button>
                            )}
                            <button
                              onClick={() =>
                                deleteDoc(
                                  doc(
                                    db,
                                    "artifacts",
                                    currentAppId,
                                    "users",
                                    user.uid,
                                    "symbols",
                                    s.id
                                  )
                                )
                              }
                              className="text-slate-300 hover:text-red-500 p-2 transition"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-slate-600 font-black ml-6 uppercase text-center md:text-left">
                            當下成交市價 (計算含息報酬)
                          </p>
                          <BigManualInput
                            type="number"
                            value={cur.currentPrice}
                            onChange={(v) =>
                              setEditSym({
                                ...editSym,
                                [s.id]: { ...cur, currentPrice: Number(v) },
                              })
                            }
                            className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] shadow-inner font-mono text-[#8B9D83] font-bold text-center"
                            placeholder="輸入股價"
                          />
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

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-[#D9C5B2]/20 px-8 py-10 flex justify-center shadow-[0_-20px_80px_rgba(0,0,0,0.15)] z-50 rounded-t-[5rem]">
        <div className="max-w-5xl w-full flex justify-around items-end">
          <NavBtn
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            icon={<Activity size={36} />}
            label="監測"
          />
          <NavBtn
            active={activeTab === "dividends"}
            onClick={() => setActiveTab("dividends")}
            icon={<DollarSign size={36} />}
            label="領息"
          />
          <NavBtn
            active={activeTab === "invest"}
            onClick={() => setActiveTab("invest")}
            icon={<TrendingUp size={36} />}
            label="投入"
          />
          <NavBtn
            active={activeTab === "masters"}
            onClick={() => setActiveTab("masters")}
            icon={<Users size={36} />}
            label="管理"
          />
        </div>
      </nav>
    </div>
  );
}

// --- 子組件 ---

const SetupGuide = ({ onGo }) => (
  <div className="bg-white p-20 rounded-[6rem] text-center space-y-12 shadow-2xl border border-amber-100 animate-in zoom-in duration-700 max-w-4xl mx-auto mt-20 text-slate-800 mx-auto">
    <div className="bg-amber-50 w-40 h-40 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-8 shadow-inner">
      <AlertCircle size={100} />
    </div>
    <div className="space-y-6 text-center">
      <h3 className="text-5xl font-black tracking-tight text-slate-800">
        尚未完成初始設定
      </h3>
      <p className="text-2xl text-slate-600 leading-relaxed font-bold px-12 text-center">
        請先前往「管理」分頁建立人員與標的，系統將為妳解鎖所有功能。
      </p>
    </div>
    <button
      onClick={onGo}
      className="bg-blue-600 text-white w-full max-w-2xl py-8 rounded-[3rem] font-black text-3xl shadow-2xl shadow-blue-500/40 flex items-center justify-center gap-5 hover:scale-[1.02] active:scale-95 transition-all mx-auto tracking-widest uppercase"
    >
      立即前往管理主檔 <ArrowRight size={36} />
    </button>
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-4 transition-all duration-500 ${
      active ? "text-[#8B9D83] scale-110" : "text-slate-400"
    }`}
  >
    <div
      className={`${
        active ? "bg-[#8B9D83]/15 p-6 rounded-[2.5rem] shadow-sm" : "p-4"
      } transition-all`}
    >
      {icon}
    </div>
    <span
      className={`text-base font-black tracking-[0.2em] ${
        active ? "text-[#8B9D83]" : "text-slate-700"
      }`}
    >
      {label}
    </span>
  </button>
);

const StatCard = ({ title, value, sub, color }) => (
  <div className="bg-white p-10 rounded-[4rem] shadow-md border border-slate-50 active:scale-95 transition-transform text-center relative overflow-hidden group">
    <div
      className="absolute top-0 left-0 w-full h-2"
      style={{ backgroundColor: color, opacity: 0.3 }}
    ></div>
    <p className="text-sm font-black text-slate-600 uppercase tracking-widest mb-5">
      {title}
    </p>
    <p
      className={`text-4xl font-mono font-black tracking-tighter`}
      style={{ color }}
    >
      {value}
    </p>
    <p className="text-sm text-slate-600 mt-4 font-bold italic tracking-wider uppercase opacity-80">
      {sub}
    </p>
  </div>
);

const ManualInput = ({
  value,
  onChange,
  className,
  type = "text",
  placeholder,
}) => {
  return (
    <input
      type={type}
      className={`${className} text-base font-bold p-4 text-slate-800`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
    />
  );
};
