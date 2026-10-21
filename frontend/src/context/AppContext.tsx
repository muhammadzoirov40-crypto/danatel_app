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

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  isAdmin: boolean;
  setAdmin: (v: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);

const LANG_KEY = "danatel_lang";

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    return saved && ["tj", "ru", "en", "uz"].includes(saved) ? saved : "tj";
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(
    () => !!localStorage.getItem("danatel_token"),
  );

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
    document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key: string) => translate(lang, key), [lang]);

  const value = useMemo(
    () => ({ lang, setLang, t, isAdmin, setAdmin: setIsAdmin }),
    [lang, setLang, t, isAdmin],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
