import { ErrorState } from "@/components/ui/ErrorState";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[VidPilot] Unhandled UI error", error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <ErrorState
            title="Something went wrong."
            description="An unexpected error occurred while rendering VidPilot. Try again, and if it keeps happening, check the browser console for details."
            onRetry={this.handleRetry}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
