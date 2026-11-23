import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { useApp } from "../context/AppContext";
import { api, ApiError } from "../api/client";
import { Ic } from "../components/Icons";
import CountrySelect from "../components/CountrySelect";
import { COUNTRIES, fullPhone, type Country } from "../data/countries";

/**
 * 🔑 Вуруд / Қайд — як саҳифаи ягона (эталони нав).
 */
export default function Login() {
  const { t, lang, refreshUser } = useApp();
  const nav = useNavigate();

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

  const wantRegister = searchParams.get("register") === "1";
  const [mode, setMode] = useState<"login" | "register">(
    refCode || wantRegister ? "register" : "login",
  );
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [scrollable, setScrollable] = useState(false);

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
      setPhone(v.replace(/[^\d+]/g, ""));
      return;
    }
    setPhone(v.replace(/\D/g, ""));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");

    const digits = fullPhone(country.dial, phone);
    if (digits.length < 9) {
      setErr(t("invalidPhone"));
      return;
    }
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
        localStorage.removeItem("danatel_ref");
        await refreshUser();
        nav("/profile");
      }
    } catch (e2) {
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

  // document.title
  useEffect(() => {
    document.title = mode === "login" ? "DonatShop — Вуруд" : "DonatShop — Қайд шудан";
  }, [mode]);

  // Ин саҳифа ҳамеша торик аст (новобаста аз мавзӯи сайт/OS)
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    if (!wasDark) document.documentElement.classList.add("dark");
    return () => {
      if (!wasDark) document.documentElement.classList.remove("dark");
    };
  }, []);

  // Клавиатураи мобилӣ: агар майдон пинҳон шавад, скролли дохилиро иҷозат деҳ
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const keyboardOpen = vv.height < window.innerHeight * 0.75;
      setScrollable(keyboardOpen);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const isRegister = mode === "register";

  return (
    <div className={`auth-page ${scrollable ? "auth-scrollable" : ""}`}>
      {/* ⬅️ пасзамина: градиент + хатҳо + шашкунҷаҳо + дурахшҳо */}
      <div className="auth-bg" aria-hidden />

      <div className="auth-wrap">
        <div className="auth-card">
          {/* 🌀 ЛОГО (шаффоф, БЕ background/border-radius/overflow) */}
          <div className="auth-logo-wrap">
            <img
              src="/icons/donatshop-logo.png"
              alt="donatshop"
              className="auth-logo"
              onError={(e) => {
                e.currentTarget.src = "/icons/favicon-32.png";
                e.currentTarget.onerror = null;
              }}
            />
          </div>

          {/* SEO: сарлавҳаи пинҳон */}
          <h1 className="sr-only">
            {isRegister ? t("register") : t("login")}
          </h1>

          {/* 🔁 ТАБ-ҲОИ ИВАЗКУНӢ */}
          <div className="auth-tabs" role="tablist">
            <span
              className={`auth-thumb ${isRegister ? "auth-thumb-left" : "auth-thumb-right"}`}
              aria-hidden
            />
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              onClick={() => { setMode("register"); setErr(""); }}
              className={`auth-tab ${isRegister ? "auth-tab-active" : ""}`}
            >
              {t("register")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              onClick={() => { setMode("login"); setErr(""); }}
              className={`auth-tab ${!isRegister ? "auth-tab-active" : ""}`}
            >
              {t("login")}
            </button>
          </div>

          {/* 📋 ФОРМА */}
          <form onSubmit={submit} className="auth-form">
            {isRegister && refCode && (
              <div className="auth-ref">
                <span>{t("refCodeLabel")}:</span>
                <code className="auth-ref-code">{refCode}</code>
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-phone">
                {t("phone")} <span className="auth-star">*</span>
              </label>
              <div className={`auth-phone-box ${err ? "auth-phone-error" : ""}`}>
                <CountrySelect value={country.code} onChange={setCountry} />
                <span className="auth-phone-divider" aria-hidden />
                <input
                  id="auth-phone"
                  className="auth-phone-input"
                  type="tel"
                  inputMode="numeric"
                  placeholder="900000000"
                  value={phone}
                  onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  autoComplete="tel-national"
                  maxLength={9}
                  aria-label={t("phone")}
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-password">
                {t("password")} <span className="auth-star">*</span>
              </label>
              <input
                id="auth-password"
                className="auth-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
            </div>

            <div className={`auth-name-wrap ${isRegister ? "auth-name-open" : "auth-name-closed"}`}>
              <div className="auth-name-inner">
                <div className="auth-field">
                  <label className="auth-label" htmlFor="auth-name">
                    {t("fullName")}
                  </label>
                  <input
                    id="auth-name"
                    className="auth-input"
                    placeholder={t("fullName")}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              </div>
            </div>

            {err && (
              <div className="auth-error">{err}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="auth-submit"
            >
              {loading ? (
                <>
                  <Ic icon={Loader2} size="md" className="animate-spin" /> {t("loading")}
                </>
              ) : isRegister ? (
                <>
                  <Ic icon={UserPlus} size="md" /> {t("register")}
                </>
              ) : (
                <>
                  <Ic icon={LogIn} size="md" /> {t("login")}
                </>
              )}
            </button>
          </form>

          {/* матни поён нест — иваз танҳо бо табҳо */}
        </div>
      </div>
    </div>
  );
}