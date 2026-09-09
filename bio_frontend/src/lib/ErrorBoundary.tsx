"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, Home, RefreshCw } from "lucide-react";
import { useLanguage } from "./i18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[BioLab AI] Uncaught render error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <ErrorFallbackView
          error={this.state.error}
          onRetry={this.handleRetry}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorFallbackView({
  error,
  onRetry,
  onGoHome,
}: {
  error: Error | null;
  onRetry: () => void;
  onGoHome: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="error-boundary-container">
      <div className="error-boundary-card">
        <div className="error-boundary-icon-ring">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="error-boundary-title">{t("error.somethingWrong")}</h2>
        <p className="error-boundary-subtitle">{t("error.description")}</p>
        {error && (
          <pre className="error-boundary-detail">
            {error.message}
          </pre>
        )}
        <div className="error-boundary-actions">
          <button onClick={onRetry} className="error-boundary-btn-primary">
            <RefreshCw className="h-4 w-4" />
            {t("error.tryAgain")}
          </button>
          <button onClick={onGoHome} className="error-boundary-btn-secondary">
            <Home className="h-4 w-4" />
            {t("error.home")}
          </button>
        </div>
      </div>
    </div>
  );
}
