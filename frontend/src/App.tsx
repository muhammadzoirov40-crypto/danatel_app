import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import GameDetail from "./pages/GameDetail";
import OrderPage from "./pages/OrderPage";
import Admin from "./pages/admin/Admin";
import Login from "./pages/Login";
import Profile from "./pages/Profile";

function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <div className="text-6xl mb-4">🧭</div>
      <h1 className="text-2xl font-bold mb-2">404</h1>
      <a href="/" className="btn-primary mt-4 inline-flex">
        🏠 danatel.tj
      </a>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Navbar />
        <main className="min-h-[calc(100vh-4rem)] pb-20 md:pb-0">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/game/:slug" element={<GameDetail />} />
              <Route path="/order/:id" element={<OrderPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </main>

        {/* 📱 Навигатсияи поёнӣ дар телефон */}
        <BottomNav />

        {/* Поён — responsive */}
        <footer className="border-t border-slate-200 bg-white mt-10">
          <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs sm:text-sm text-slate-500">
            <div className="font-semibold text-slate-700 mb-1">💎 danatel.tj</div>
            ⚠️ Барои донат фақат Player ID лозим аст — паролро ба касе надиҳед!
            <div className="mt-2 opacity-70">© {new Date().getFullYear()} — Ҳуқуқҳо ҳифз шудаанд</div>
          </div>
        </footer>
      </BrowserRouter>
    </AppProvider>
  );
}
