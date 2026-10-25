import { Component, type ReactNode } from "react";
import { House, RefreshCw, TriangleAlert } from "lucide-react";
import { Ic } from "./Icons";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 🛡️ ErrorBoundary — агар компонент хатогӣ диҳад,
 * саҳифа саҳҳом намемонад (ба ҷои сафедӣ — паймон нишон медиҳад).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string | null }) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="card max-w-md w-full text-center p-8">
            <div className="flex justify-center mb-4 text-rose-400">
              <Ic icon={TriangleAlert} size="3xl" strokeWidth={1.75} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Хатогӣ рух дод
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              {this.state.error?.message || "Намуши номаълум"}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                <Ic icon={RefreshCw} />
                Аз нав кушодан
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                }}
                className="btn-ghost"
              >
                <Ic icon={House} />
                Ба саҳифаи асосӣ
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
