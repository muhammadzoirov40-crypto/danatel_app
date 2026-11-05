import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, LogIn, ScanFace, UserPlus } from "lucide-react";
import { useApp } from "../context/AppContext";
import { api, ApiError } from "../api/client";
import Logo from "../components/Logo";
import { Ic } from "../components/Icons";
import CountrySelect from "../components/CountrySelect";
import { COUNTRIES, fullPhone, type Country } from "../data/countries";
import FaceAuthModal from "../components/FaceAuthModal";

/**
 * 🔑 Вуруд / Қайд — як саҳифаи ягона.
 *
 *  - Вуруд: телефон + парол **ё чеҳра** (Face Authentication)
 *  - Қайд: телефон + парол + ном (ихтиёрӣ) → баъди қайд пешниҳоди сабти чеҳра
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

  // 😶 Face Authentication — модалкаи вуруд/сабти чеҳра
  const [faceOpen, setFaceOpen] = useState(false);
  /** 🔑 Ticket-и парол аз пеш (пас аз қайд) → дарвозаи такрорӣ лозим не */
  const [faceTicket, setFaceTicket] = useState<string | null>(null);
  /** Оё модалка аз қайд (сабти чеҳра) кушода шуд? */
  const [faceFromRegister, setFaceFromRegister] = useState(false);

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
        // 🔑 Парол ҳамон ҷо навишта шуд → ticket гирифта, рост ба камераи
        //    чеҳра (дарвозаи такрории парол = сустӣ). Ноком → дарвозаи маъмулӣ.
        let ticket: string | null = null;
        try {
          ticket = (await api.faceConfirmPassword(password)).ticket;
        } catch {
          ticket = null;
        }
        await refreshUser();
        // 😶 Баъди қайд → пешниҳоди сабти чеҳра (вақти беҳтарин:
        //    ҳисоб тоза аст, корбар ҳозир аст; «Бекор» = ба профил)
        setFaceFromRegister(true);
        setFaceTicket(ticket);
        setFaceOpen(true);
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

        {/* 😶 ВУРУД БО ЧЕҲРА (танҳо ҳолати вуруд) — парол ҳамеша мемонад */}
        {mode === "login" && (
          <>
            <div className="my-4 flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {t("faceOr")}
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <button
              type="button"
              onClick={() => {
                setFaceFromRegister(false);
                setFaceOpen(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50/70 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 active:scale-[0.98]"
            >
              <Ic icon={ScanFace} />
              {t("faceLoginBtn")}
            </button>
          </>
        )}
      </div>

      {/* 😶 Модалкаи Face Authentication (login / сабт пас аз қайд) */}
      {faceOpen && (
        <FaceAuthModal
          mode={faceFromRegister ? "enroll" : "login"}
          autoTicket={faceFromRegister ? faceTicket : null}
          onClose={() => {
            setFaceOpen(false);
            // қайд анҷомид (токен ҳаст) → корбарро ба профил барем
            if (faceFromRegister) nav("/profile");
          }}
          onSuccess={async () => {
            setFaceOpen(false);
            await refreshUser();
            nav("/profile");
          }}
        />
      )}
    </div>
  );
}
