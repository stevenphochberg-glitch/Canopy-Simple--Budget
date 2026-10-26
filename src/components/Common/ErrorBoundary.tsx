import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[Canopy Error Boundary Caught]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || '';
      const is401OrAuthDrop =
        errorMessage.includes('401') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('unauthenticated') ||
        errorMessage.includes('permission-denied') ||
        errorMessage.includes('token') ||
        errorMessage.includes('WebSocket');

      return (
        <div className="min-h-screen bg-beige-50 flex items-center justify-center p-4 sm:p-6 selection:bg-sage-200">
          <div className="max-w-lg w-full bg-white border-2 border-beige-300 rounded-3xl p-6 sm:p-8 shadow-md space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            {/* Icon Header */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-beige-100 border border-beige-300 flex items-center justify-center text-brown-800 shadow-inner">
              {is401OrAuthDrop ? (
                <ShieldAlert className="w-8 h-8 text-brown-700" />
              ) : (
                <AlertCircle className="w-8 h-8 text-alert-red-600" />
              )}
            </div>

            {/* Error Copy */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-beige-200 text-brown-900 px-3 py-1 rounded-full inline-block">
                {is401OrAuthDrop ? 'Session Refresh Needed' : 'Application Recovered'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-dark-green-950 font-serif">
                {is401OrAuthDrop
                  ? 'Preview Session Reconnecting'
                  : 'An Unexpected Issue Occurred'}
              </h2>
              <p className="text-xs sm:text-sm text-dark-grey-600 leading-relaxed max-w-md mx-auto">
                {is401OrAuthDrop
                  ? 'The development environment session token expired or briefly reconnected. Your household budget data is safely stored in the cloud.'
                  : 'Canopy caught an error and prevented the screen from locking up. You can safely return to your budget dashboard.'}
              </p>
            </div>

            {/* Technical Detail Collapsible / Drawer (Truncated & Safe) */}
            {errorMessage && (
              <div className="p-3 bg-beige-50 rounded-xl border border-beige-200 text-left overflow-hidden">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brown-700 block mb-1">
                  Diagnostic Note
                </span>
                <p className="text-[11px] font-mono text-dark-grey-600 break-words line-clamp-3">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Return to Dashboard</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-beige-100 hover:bg-beige-200 text-dark-green-900 text-xs sm:text-sm font-extrabold rounded-xl border border-beige-300 transition active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Session</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
