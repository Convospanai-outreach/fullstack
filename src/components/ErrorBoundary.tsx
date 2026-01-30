"use client";

import React, { Component, ReactNode } from 'react';
import { Button } from './ui/button';
import { GlassCard } from './ui/GlassCard';
import { AlertTriangle } from 'lucide-react';
import { AuditService } from '@/modules/audit/auditService';

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
        // Log error to console for development
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Log to database for tracking and debugging
        AuditService.log(
            'SYSTEM', // teamId - system-wide error
            null, // userId - system error, no user context
            'ERROR_CAPTURED',
            'ErrorBoundary',
            null, // no specific resource ID
            {
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
                timestamp: new Date().toISOString(),
                userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
            }
        ).catch(err => {
            // Fail silently to avoid error loop
            console.error('Failed to log error to audit service:', err);
        });
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
                                    variant="default"
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
