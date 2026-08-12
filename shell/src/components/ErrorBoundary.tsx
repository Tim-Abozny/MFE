import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  sectionName: string;
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RemoteErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[ErrorBoundary] Error in section ${this.props.sectionName}:`,
      error,
      errorInfo,
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "20px",
            border: "2px dashed red",
            borderRadius: "8px",
            margin: "20px",
          }}
        >
          <h2>Section "{this.props.sectionName}" temporary not available</h2>
          <p style={{ color: "#555" }}>
            Error occured while loading the section. Please try again later or
            contact support if the issue persists.
          </p>

          <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: "8px 16px",
                background: "#0070f3",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              🔄 Retry
            </button>

            <a
              href="/"
              style={{
                padding: "8px 16px",
                background: "#eaeaea",
                color: "#000",
                textDecoration: "none",
                borderRadius: "4px",
              }}
            >
              🏠 Home
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
