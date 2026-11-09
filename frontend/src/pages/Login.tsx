import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { useApp } from "../context/AppContext";
import { api, ApiError } from "../api/client";
import Logo from "../components/Logo";
import { Ic } from "../components/Icons";
import CountrySelect from "../components/CountrySelect";
import { COUNTRIES, fullPhone, type Country } from "../data/countries";

/**
 * 🔑 Вуруд / Қайд — як саҳифаи ягона.
 *
 *  - Вуруд: телефон + парол
 *  - Қайд: телефон + парол + ном (ихтиёрӣ)
 *  - Баланс: 0 сомонӣ ҳангоми қайд
 *  - Face ID 07.11.2026 ПУРААН нест карда шуд (талаби соҳиб)
 */
export default function Login() {
  const { t, lang, refreshUser } = useApp();
  const nav = useNavigate();

  // 🔗 Линки даъвати дӯст (?ref=CODE) — агар мавҷуд бошад, қайдро
  //    пешакӣ мекушоем ва кодро ҳангоми қайд мефиристем.
  //    Дӯст линкро дар саҳифаи асосӣ кушод → RefCapture онро дар
  //    localStorage нигоҳ дошт → дар ин ҷо хонда мешавад.
  const [searchParams] = useSearchParams();
  let savedRef: string | null = null;
  try {
    savedRef = localStorage.getItem("danatel_ref");
  } catch {
    /* localStorage маҳдуд */
  }
  const refCode = (searchParams.get("ref") || savedRef || "")
    .trim()
    .slice(0, 16);

  // 🔘 Аз sidebar-меню тугмаи «Ба қайд гирифтан» → /login?register=1
  const wantRegister = searchParams.get("register") === "1";
  const [mode, setMode] = useState<"login" | "register">(
    refCode || wantRegister ? "register" : "login",
  );
  const [phone, setPhone] = useState("");
  /** 🌍 Коди кишвари телефон (талаби соҳиб: корбар кодро интихоб мекунад,
   *    `+`-ро худаш ворид намекунад) — Тоҷикистон пешфарз */
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * 📱 Қабули рақами телефон:
   *   · «+992…» навишта → коди кишвар худкор муайян ва интихоб мешавад,
   *     дар майдон танҳо рақами миллӣ мемонад;
   *   · бе «+» → танҳо рақамҳо (фосила/тире пок) → корбар `+` ворид НАмекунад.
   */
  const onPhoneChange = (v: string) => {
    if (v.trimStart().startsWith("+")) {
      const d = v.replace(/\D/g, "");
      const m = [...COUNTRIES]
        .sort((a, b) => b.dial.length - a.dial.length)
        .find((c) => d.startsWith(c.dial));
      if (m) {
        setCountry(m);
        setPhone(d.slice(m.dial.length));
        return;
      }
      // код ҳанӯз пурра навишта нашуда → «+» дар майдон мемонад
      setPhone(v.replace(/[^\d+]/g, ""));
      return;
    }
    setPhone(v.replace(/\D/g, ""));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");

    // Санҷиши пешакӣ — рақами ПУРРА (коди кишвар + рақами миллӣ)
    const digits = fullPhone(country.dial, phone);
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
        await api.login(digits, password);
        await refreshUser();
        nav("/profile");
      } else {
        await api.register({
          phone: digits,
          password,
          full_name: fullName.trim() || undefined,
          language: lang,
          referral_code: refCode || undefined,
        });
        // Коди даъват танҳо як дафъа истифода мешавад → пок
        localStorage.removeItem("danatel_ref");
        // 😶 Face ID нест шуд (07.11.2026) → рост ба профил
        await refreshUser();
        nav("/profile");
      }
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
    <div className="mx-auto max-w-md px-4 py-6 -mb-20 md:mb-0">
      {/* ⬅️ «Бозгашт» дар login/register НЕСТ — талаби соҳиб (31.10.2026).
          `-mb-20 md:mb-0` → padding-и `pb-20`-и main (ҷои navbar-и поёнӣ, ки
          дар ин саҳифа пинҳон аст) бекор мешавад → қайд бе скролл дар 320×700. */}
      <div className="card p-6 sm:p-8">
        <div className="text-center mb-4">
          <div className="flex justify-center mb-2">
            <Logo size={46} animate />
          </div>
          <h1 className="text-xl font-bold">
            {mode === "login" ? t("login") : t("register")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "login" ? t("noAccount") : t("haveAccount")}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {/* 🔗 Линки даъват (?ref=… / `danatel_ref`) — коди даъвати
              даъваткунанда дар форма нишон дода мешавад, то корбар бидонад
              кадом код ҳангоми қайд истифода мешавад (талаби соҳиб) */}
          {mode === "register" && refCode && (
            <div className="flex items-center gap-2 flex-wrap rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700">
              <span>{t("refCodeLabel")}:</span>
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-700">
                {refCode}
              </code>
            </div>
          )}
          <div>
            <label className="label">{t("phone")} *</label>
            {/* 🌍 Коди кишвар ИНТИХОБ мешавад → корбар танҳо рақами
                миллӣ менависад, `+` лозим нест (талаби соҳиб, 05.11.2026) */}
            <div className="flex gap-2">
              <CountrySelect value={country.code} onChange={setCountry} />
              <input
                className="input flex-1 min-w-0"
                inputMode="tel"
                placeholder="XXXXXXXXX"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                autoComplete="tel-national"
                aria-label={t("phone")}
              />
            </div>
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
