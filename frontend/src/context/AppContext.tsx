import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translate, type Lang } from "../i18n";
import { api, getToken, setToken } from "../api/client";
import type { User } from "../types";

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;

  // 👤 Корбари ҷорӣ (холӣ = бе вуруд)
  user: User | null;
  isAdmin: boolean;
  /** 💰 Баланси ҷорӣ (сонияҳо аз backend гирифта мешавад) */
  balance: number;

  /** 🔄 Навсозии маълумоти корбар аз backend */
  refreshUser: () => Promise<void>;
  /** 🔑 Вуруд + боргирӣ */
  login: (phone: string, password: string) => Promise<boolean>;
  /** 📱 Қайд + боргирӣ */
  register: (data: {
    phone: string;
    password: string;
    full_name?: string;
    language?: string;
  }) => Promise<boolean>;
  /** 🚪 Баромад аз аккаунт */
  logout: () => void;

  setAdmin: (v: boolean) => void;

  /** 🔍 Ҷустуҷӯи муштарак: Navbar (header) менависад → саҳифаи асосӣ филтр мекунад */
  search: string;
  setSearch: (q: string) => void;

  /** 🌙 Мавзӯи равшан / торик (localStorage, бе "флеш") */
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const Ctx = createContext<AppState | null>(null);

const LANG_KEY = "danatel_lang";

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    return saved && ["tj", "ru", "en", "uz"].includes(saved) ? saved : "tj";
  });

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(
    () => !!localStorage.getItem("danatel_token"),
  );
  const [balance, setBalance] = useState<number>(0);
  const [search, setSearch] = useState<string>("");

  // 🌙 Мавзӯи равшан/торик — `.dark` дар <html>, дар localStorage нигоҳ дошта мешавад
  const [theme, setThemeState] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("danatel_theme", theme);
    } catch {
      /* localStorage дастрас нест */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((v) => (v === "dark" ? "light" : "dark"));
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
    document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // 🔄 Боргирӣ вақти оғоз (агар токен бошад)
  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setBalance(0);
      setIsAdmin(false);
      return;
    }
    try {
      const me = await api.me();
      setUser(me);
      setBalance(Number(me.balance ?? 0));
      setIsAdmin(!!me.is_admin);
    } catch {
      // Токен нодуруст ё мӯҳлаташ гузашта
      setToken(null);
      setUser(null);
      setBalance(0);
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (phone: string, password: string) => {
      try {
        const res = await api.login(phone, password);
        setIsAdmin(res.is_admin);
        await refreshUser();
        return true;
      } catch {
        return false;
      }
    },
    [refreshUser],
  );

  const register = useCallback(
    async (data: {
      phone: string;
      password: string;
      full_name?: string;
      language?: string;
    }) => {
      try {
        const res = await api.register(data);
        setIsAdmin(res.is_admin);
        await refreshUser();
        return true;
      } catch {
        return false;
      }
    },
    [refreshUser],
  );

  const logout = useCallback(() => {
    // 🚪 Аввал токенро дар СЕРВЕР бекор мекунем (сеанс дигар кор намекунад)
    void api.logout();
    setToken(null);
    setUser(null);
    setBalance(0);
    setIsAdmin(false);
  }, []);

  const t = useCallback((key: string) => translate(lang, key), [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
      user,
      isAdmin,
      balance,
      refreshUser,
      login,
      register,
      logout,
      setAdmin: setIsAdmin,
      search,
      setSearch,
      theme,
      toggleTheme,
    }),
    [lang, setLang, t, user, isAdmin, balance, refreshUser, login, register, logout, search, theme, toggleTheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
