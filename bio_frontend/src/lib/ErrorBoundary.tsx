"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, Home, RefreshCw } from "lucide-react";

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
        <div className="error-boundary-container">
          <div className="error-boundary-card">
            <div className="error-boundary-icon-ring">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="error-boundary-title">Đã xảy ra lỗi</h2>
            <p className="error-boundary-subtitle">
              Ứng dụng gặp sự cố không mong muốn. Vui lòng thử lại hoặc quay về trang chủ.
            </p>
            {this.state.error && (
              <pre className="error-boundary-detail">
                {this.state.error.message}
              </pre>
            )}
            <div className="error-boundary-actions">
              <button onClick={this.handleRetry} className="error-boundary-btn-primary">
                <RefreshCw className="h-4 w-4" />
                Thử lại
              </button>
              <button onClick={this.handleGoHome} className="error-boundary-btn-secondary">
                <Home className="h-4 w-4" />
                Trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
