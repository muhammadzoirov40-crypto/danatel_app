import { ShieldAlert } from "lucide-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";
import Logo from "./components/Logo";
import { Ic } from "./components/Icons";
import Home from "./pages/Home";
import GameDetail from "./pages/GameDetail";
import OrderPage from "./pages/OrderPage";
import Admin from "./pages/admin/Admin";
import Login from "./pages/Login";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Navbar />
        <main className="relative min-h-[calc(100vh-4rem)] pb-20 md:pb-0">
          {/* 🌅 Камарбанди кабуди ягона — дар ҳамаи саҳифаҳо якхела */}
          <div className="page-band" aria-hidden />
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/game/:slug" element={<GameDetail />} />
              <Route path="/order/:id" element={<OrderPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />

              {/* 🔁 Роҳҳои нопурра → ба саҳифаи асосӣ */}
              <Route path="/index.html" element={<Navigate to="/" replace />} />
              <Route path="/game" element={<Navigate to="/" replace />} />
              <Route path="/game/" element={<Navigate to="/" replace />} />
              <Route path="/catalog" element={<Navigate to="/" replace />} />

              {/* 🔁 Ҳар роҳи номаълум → ба асосӣ (ба ҷои 404) */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>

        {/* 📱 Навигатсияи поёнӣ дар телефон */}
        <BottomNav />

        {/* Поён — responsive */}
        <footer className="border-t border-slate-200 bg-white mt-10">
          <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs sm:text-sm text-slate-500">
            <div className="flex items-center justify-center gap-2 font-semibold text-slate-700 mb-1">
              <Logo size={20} withText textClass="text-sm" />
            </div>
            <div className="flex items-center justify-center gap-2 font-medium">
              <Ic icon={ShieldAlert} size="xs" className="shrink-0 text-amber-500" />
              <span>Барои донат фақат Player ID лозим аст — паролро ба касе надиҳед!</span>
            </div>
            <div className="mt-2 opacity-70">© {new Date().getFullYear()} — Ҳуқуқҳо ҳифз шудаанд</div>
          </div>
        </footer>
      </BrowserRouter>
    </AppProvider>
  );
}
