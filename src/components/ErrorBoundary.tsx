"use client";

import React, { Component, ReactNode } from 'react';
import { Button } from './ui/Button';
import { GlassCard } from './ui/GlassCard';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
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

    override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error to console (can integrate with Sentry/monitoring service)
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // TODO: Send to error tracking service
        // if (process.env.NODE_ENV === 'production') {
        //     Sentry.captureException(error, { extra: errorInfo });
        // }
    }

    handleReset = () => {
        this.setState({ hasError: false });
    };

    override render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
                    <GlassCard className="max-w-md w-full p-8">
                        <div className="text-center">
                            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                            <h1 className="text-2xl font-bold text-white mb-2">
                                Something went wrong
                            </h1>
                            <p className="text-gray-400 mb-6">
                                We encountered an unexpected error. Please try again.
                            </p>

                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-left">
                                    <p className="text-red-300 text-sm font-mono break-all">
                                        {this.state.error.message}
                                    </p>
                                </div>
                            )}

                            <div className="space-y-3">
                                <Button
                                    onClick={this.handleReset}
                                    variant="primary"
                                    className="w-full"
                                >
                                    Try Again
                                </Button>
                                <Button
                                    onClick={() => window.location.href = '/dashboard'}
                                    variant="outline"
                                    className="w-full"
                                >
                                    Go to Dashboard
                                </Button>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            );
        }

        return this.props.children;
    }
}
