"use client";

import React, { Component, ReactNode } from 'react';
import { Button } from './ui/button';
import { GlassCard } from './ui/GlassCard';
import { AlertTriangle } from 'lucide-react';
import { getBrowserApiBase } from "@/lib/api/browserBase";
import { APP_URL } from "../../config/appUrl.mjs";

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

        // Log error to server
        this.logErrorToServer(error, errorInfo);
    }

    private logErrorToServer = async (error: Error, errorInfo: React.ErrorInfo) => {
        try {
            await fetch(getBrowserApiBase() + '/errors/client', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: error.message,
                    stack: error.stack,
                    componentStack: errorInfo.componentStack,
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    metadata: {
                        errorName: error.name,
                        timestamp: new Date().toISOString()
                    }
                })
            });
        } catch (loggingError) {
            // Fail silently - don't break the app if logging fails
            console.error('Failed to log error to server:', loggingError);
        }
    };

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
                <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-primary/80 to-background">
                    <GlassCard className="max-w-md w-full p-8">
                        <div className="text-center">
                            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
                            <h1 className="text-2xl font-bold text-foreground mb-2">
                                Something went wrong
                            </h1>
                            <p className="text-muted-foreground mb-6">
                                We encountered an unexpected error. Please try again.
                            </p>

                            {process.env['NODE_ENV'] === 'development' && this.state.error && (
                                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-left">
                                    <p className="text-destructive text-sm font-mono break-all">
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
                                    onClick={() => window.location.assign(`${APP_URL}/dashboard`)}
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
