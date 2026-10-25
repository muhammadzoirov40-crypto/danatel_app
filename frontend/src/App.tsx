import { ShieldAlert } from "lucide-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";
import Footer from "./components/Footer";
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

        {/* 🦶 Футери касбӣ ва расмӣ */}
        <Footer />
      </BrowserRouter>
    </AppProvider>
  );
}
