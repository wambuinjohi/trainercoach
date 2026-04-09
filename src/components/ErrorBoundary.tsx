import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.href = '/';
  };

  handleClearCache = () => {
    window.location.href = '/clear-cache';
  };

  render() {
    if (this.state.hasError) {
      const isReactHookError = this.state.error?.message?.includes('reading') && 
                               (this.state.error?.message?.includes('useState') || 
                                this.state.error?.message?.includes('useRef') ||
                                this.state.error?.message?.includes('useContext'));

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
              <CardDescription>
                {isReactHookError 
                  ? 'The app encountered a React initialization error. This usually resolves after clearing the cache.'
                  : 'An unexpected error occurred.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isReactHookError && (
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  <p className="font-medium mb-1">Quick fix:</p>
                  <p>Click "Clear Cache & Reload" below to resolve this issue.</p>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <Button onClick={this.handleClearCache} className="w-full">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Clear Cache & Reload
                </Button>
                <Button onClick={this.handleReset} variant="outline" className="w-full">
                  Try Again
                </Button>
              </div>

              {this.state.error && (
                <details className="text-xs text-muted-foreground mt-4">
                  <summary className="cursor-pointer font-medium">Error details</summary>
                  <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
