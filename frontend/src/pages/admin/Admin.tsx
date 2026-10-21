import { useState, type FormEvent } from "react";
import { api } from "../../api/client";
import { useApp } from "../../context/AppContext";
import Dashboard from "./Dashboard";
import Orders from "./Orders";
import Products from "./Products";

type Tab = "dashboard" | "orders" | "products";

/** Панели идора — танҳо бо вуруди админ */
export default function Admin() {
  const { t, isAdmin, setAdmin } = useApp();
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!isAdmin) return <LoginGate />;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "dashboard", label: t("dashboard"), icon: "📊" },
    { id: "orders", label: t("orders"), icon: "📦" },
    { id: "products", label: t("products"), icon: "💎" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <h1 className="text-xl font-bold">🛠️ {t("adminPanel")}</h1>
        <button onClick={() => setAdmin(false)} className="btn-ghost text-sm">
          ⎋ {t("logout")}
        </button>
      </div>

      {/* Табҳо — мобилӣ: уфуқӣ, мезанад */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`btn text-sm whitespace-nowrap ${
              tab === x.id
                ? "bg-brand-600 text-white"
                : "bg-white border border-slate-200 text-slate-700"
            }`}
          >
            {x.icon} {x.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <Dashboard />}
      {tab === "orders" && <Orders />}
      {tab === "products" && <Products />}
    </div>
  );
}

/** Дарвозаи вуруд */
function LoginGate() {
  const { t, setAdmin } = useApp();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await api.login(phone, password);
      setAdmin(true);
    } catch (ex) {
      setErr((ex as Error)?.message || t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] grid place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="grid place-items-center w-14 h-14 mx-auto rounded-2xl bg-brand-600 text-white text-2xl mb-3">
            ⚙️
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
          {loading ? t("loading") : `🔓 ${t("login")}`}
        </button>
      </form>
    </div>
  );
}
