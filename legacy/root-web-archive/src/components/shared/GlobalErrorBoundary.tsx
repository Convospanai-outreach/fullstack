
"use client";

import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("GlobalErrorBoundary caught:", error, errorInfo);
        // Here you would send to Sentry/LogRocket
    }

    override render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="p-4 border border-red-200 bg-red-50 rounded-md flex items-center gap-3 text-red-800">
                    <AlertTriangle className="h-5 w-5" />
                    <div>
                        <h3 className="font-semibold">Component Error</h3>
                        <p className="text-sm">Something went wrong in this section.</p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
