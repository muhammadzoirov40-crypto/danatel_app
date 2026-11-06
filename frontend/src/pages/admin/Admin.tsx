import { useEffect, useState, type FormEvent } from "react";
import {
  Flame,
  Gem,
  LayoutDashboard,
  Loader2,
  LogIn,
  Package,
  Settings,
  Star,
  Users as UsersIcon,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../api/client";
import { useApp } from "../../context/AppContext";
import { Ic } from "../../components/Icons";
import BackButton from "../../components/BackButton";
import Dashboard from "./Dashboard";
import Orders from "./Orders";
import Products from "./Products";
import Users from "./Users";
import Reviews from "./Reviews";
import Topups from "./Topups";
import Fireloot from "./Fireloot";

type Tab = "dashboard" | "orders" | "products" | "users" | "reviews" | "topups" | "fireloot";

/** Панели идора — танҳо бо вуруди админ */
export default function Admin() {
  const { t, isAdmin } = useApp();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [pendingTopups, setPendingTopups] = useState(0);

  // 💳 Баджи зиндаи дархостҳои pending — ҳар 20 сония нав мешавад
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    const tick = async () => {
      try {
        const rows = await api.adminTopups("pending");
        if (alive) setPendingTopups(rows.length);
      } catch {
        /* навсозӣ ноком шуд — дархостҳо дар таб худашон нав мешаванд */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [isAdmin]);

  if (!isAdmin) return <LoginGate />;

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { id: "orders", label: t("orders"), icon: Package },
    { id: "products", label: t("products"), icon: Gem },
    { id: "users", label: t("users"), icon: UsersIcon },
    { id: "reviews", label: t("reviews"), icon: Star },
    { id: "topups", label: t("topupRequests"), icon: Wallet },
    { id: "fireloot", label: "FireLoot", icon: Flame },
  ];

  return (
    /* 📱 `-mb-20 md:mb-0` → padding-и `pb-20`-и main (ҷои navbar-и поёнӣ,
       ки дар /admin ПИНҲОН аст) — барқарории 80px дар мобилӣ. */
    <div className="mx-auto max-w-6xl px-4 py-6 -mb-20 md:mb-0">
      {/* 🔧 Сарлавҳа — ДАР ЯК сатр (мобилӣ 320px):
          Тугмаи «Баромад» АЗ ИН ҶО НАСТ (талаби соҳиб 06.11.2026) —
          баромад танҳо аз Сайдбар («Баромад») сурат мегирад. */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {/* ⬅️ [←] [ном] ДАР ЯК САТР — ҳамон тавр мисли саҳифаҳои корбар
            (талаби соҳиб «dar admin ham doshta boshad») */}
        <div className="flex items-center gap-2 min-w-0">
          <BackButton iconOnly />
          <h1 className="text-base sm:text-xl font-bold text-white inline-flex items-center gap-2 min-w-0">
            <Ic icon={Settings} size="md" className="shrink-0" />
            {t("adminPanel")}
          </h1>
        </div>
      </div>

      {/* Табҳо — қатори пурра, уфуқӣ мезанад (дар мобилӣ) */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            aria-pressed={tab === x.id}
            className={`btn text-sm whitespace-nowrap ${
              tab === x.id
                ? "bg-brand-600 text-white"
                : "bg-white border border-slate-200 text-slate-700"
            }`}
          >
            <Ic icon={x.icon} />
            {x.label}
            {x.id === "topups" && pendingTopups > 0 && (
              <span
                aria-label={`${pendingTopups} ${t("topupWaitReview")}`}
                className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black tabular-nums"
              >
                {pendingTopups}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <Dashboard />}
      {tab === "orders" && <Orders />}
      {tab === "products" && <Products />}
      {tab === "users" && <Users />}
      {tab === "reviews" && <Reviews />}
      {tab === "topups" && <Topups />}
      {tab === "fireloot" && <Fireloot />}
    </div>
  );
}

/** Дарвозаи вуруд */
function LoginGate() {
  const { t, login } = useApp();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const ok = await login(phone, password);
    setLoading(false);
    if (!ok) setErr(t("error"));
  };

  return (
    <div className="min-h-[70vh] grid place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="grid place-items-center w-14 h-14 mx-auto rounded-2xl bg-brand-600 text-white mb-3">
            <Ic icon={Settings} size="xl" strokeWidth={1.75} />
          </div>
          <h1 className="text-lg font-bold">{t("adminPanel")}</h1>
        </div>

        <label className="label">{t("phone")}</label>
        <input
          className="input mb-4"
          placeholder="+992XXXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="username"
        />

        <label className="label">{t("password")}</label>
        <input
          className="input mb-5"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {err && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? (
            <>
              <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
            </>
          ) : (
            <>
              <Ic icon={LogIn} />
              {t("login")}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
