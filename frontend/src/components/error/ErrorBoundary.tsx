import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { env } from '@/config/env';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  errorRefId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    errorRefId: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const errorRefId = `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    return { hasError: true, error, errorRefId };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Sanitize error logging to ensure tokens and secrets are not dumped to console
    const sanitizedMessage = error.message.replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]');
    if (!env.isProduction) {
      console.error(`[ErrorBoundary] Captured error in ${this.props.sectionName || 'Root'}:`, sanitizedMessage, errorInfo);
    } else {
      console.error(`[ErrorBoundary] Critical UI Error [Ref: ${this.state.errorRefId}]:`, sanitizedMessage);
    }
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      errorRefId: null,
    });
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="p-6 my-4 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm text-slate-800"
        >
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-amber-100 rounded-xl text-amber-700">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900">
                {this.props.sectionName
                  ? `An unexpected error occurred in ${this.props.sectionName}`
                  : 'Something went wrong'}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                The application encountered an unexpected issue while rendering this section. Other
                features and your session remain active.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={this.handleReset}
                  className="flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Again</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.toggleDetails}
                  className="flex items-center space-x-1.5 text-slate-600 border-slate-300"
                >
                  <span>{this.state.showDetails ? 'Hide Details' : 'Show Error Details'}</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {this.state.showDetails && (
                <div className="mt-4 p-3 bg-white rounded-lg border border-amber-200 text-xs font-mono text-slate-800 overflow-x-auto max-h-48">
                  {env.isProduction ? (
                    <div className="flex items-center space-x-2 text-slate-600">
                      <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>
                        Stack traces are suppressed in production for security. Error reference:{' '}
                        <strong className="text-slate-900 font-semibold">{this.state.errorRefId}</strong>.
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="font-semibold text-rose-800">
                        {this.state.error?.toString()}
                      </div>
                      {this.state.errorInfo?.componentStack && (
                        <pre className="mt-2 text-slate-500 whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
