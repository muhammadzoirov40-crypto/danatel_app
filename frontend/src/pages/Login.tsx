import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { useApp } from "../context/AppContext";
import { api, ApiError } from "../api/client";
import Logo from "../components/Logo";
import BackButton from "../components/BackButton";
import { Ic } from "../components/Icons";

/**
 * 🔑 Вуруд / Қайд — як саҳифаи ягона.
 *
 *  - Вуруд: телефон + парол
 *  - Қайд: телефон + парол + ном (ихтиёрӣ)
 *  - Баланс: 0 сомонӣ ҳангоми қайд
 */
export default function Login() {
  const { t, lang, refreshUser } = useApp();
  const nav = useNavigate();

  // 🔗 Линки даъвати дӯст (?ref=CODE) — агар мавҷуд бошад, қайдро
  //    пешакӣ мекушоем ва кодро ҳангоми қайд мефиристем.
  //    Дӯст линкро дар саҳифаи асосӣ кушод → RefCapture онро дар
  //    localStorage нигоҳ дошт → дар ин ҷо хонда мешавад.
  const [searchParams] = useSearchParams();
  const refCode = (
    searchParams.get("ref") || localStorage.getItem("danatel_ref") || ""
  )
    .trim()
    .slice(0, 16);

  // 🔘 Аз sidebar-меню тугмаи «Ба қайд гирифтан» → /login?register=1
  const wantRegister = searchParams.get("register") === "1";
  const [mode, setMode] = useState<"login" | "register">(
    refCode || wantRegister ? "register" : "login",
  );
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");

    // Санҷиши пешакӣ
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      setErr(t("invalidPhone"));
      return;
    }
    // Санҷиши дарозии парол ТАНҲО ҳангоми ҚАЙД (вуруд бе маҳдудияти нав)
    if (mode === "register" && password.length < 8) {
      setErr(t("passwordShort"));
      return;
    }
    if (mode === "login" && password.length < 1) {
      setErr(t("passwordShort"));
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await api.login(phone, password);
      } else {
        await api.register({
          phone,
          password,
          full_name: fullName.trim() || undefined,
          language: lang,
          referral_code: refCode || undefined,
        });
        // Коди даъват танҳо як дафъа истифода мешавад → пок
        localStorage.removeItem("danatel_ref");
      }
      await refreshUser();
      nav("/profile");
    } catch (e2) {
      // Паёми бехатарӣ аз рӯи коди хато — бе ифшои оё корбар вуҷуд дорад
      const status = e2 instanceof ApiError ? e2.status : 0;
      setErr(
        status === 401
          ? t("loginFailed")
          : status === 409
            ? t("phoneExists")
            : status === 429
              ? t("tooManyAttempts")
              : e2 instanceof ApiError
                ? e2.message
                : t("error"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      {/* ⬅️ Тугмаи бозгашт (услуби якхела дар ҳамаи саҳифаҳо) */}
      <BackButton />
      <div className="card p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <Logo size={46} />
          </div>
          <h1 className="text-xl font-bold">
            {mode === "login" ? t("login") : t("register")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "login" ? t("noAccount") : t("haveAccount")}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">{t("phone")} *</label>
            <input
              className="input"
              inputMode="tel"
              placeholder="+992XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="label">{t("password")} *</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="label">{t("fullName")}</label>
              <input
                className="input"
                placeholder={t("fullName")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}

          {err && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading ? (
              <>
                <Ic icon={Loader2} className="animate-spin" /> {t("loading")}
              </>
            ) : mode === "login" ? (
              <>
                <Ic icon={LogIn} />
                {t("login")}
              </>
            ) : (
              <>
                <Ic icon={UserPlus} />
                {t("register")}
              </>
            )}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setErr("");
          }}
          className="w-full mt-4 text-sm text-brand-600 hover:underline"
        >
          {mode === "login" ? t("registerNow") : t("login")}
        </button>
      </div>
    </div>
  );
}
