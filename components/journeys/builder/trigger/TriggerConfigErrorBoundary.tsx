'use client';

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface TriggerConfigErrorBoundaryProps {
  children: ReactNode;
}

interface TriggerConfigErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/** Simple error boundary to protect the trigger configuration panel from runtime errors. */
export class TriggerConfigErrorBoundary extends Component<
  TriggerConfigErrorBoundaryProps,
  TriggerConfigErrorBoundaryState
> {
  constructor(props: TriggerConfigErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): TriggerConfigErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('TriggerConfigErrorBoundary caught error', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="mb-3 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Trigger configuration failed to load</h3>
          </div>
          <p className="text-sm text-red-700">
            Something went wrong rendering the trigger panel. Try again or refresh the page.
          </p>
          {this.state.error ? (
            <details className="mt-3 space-y-2 rounded bg-red-100 p-3 text-xs text-red-700">
              <summary className="cursor-pointer font-semibold">Error details</summary>
              <pre className="whitespace-pre-wrap break-words">{this.state.error.message}</pre>
            </details>
          ) : null}
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-4 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
