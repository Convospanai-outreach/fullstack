"use client";

import { useEffect, useState } from 'react';
import { offlineStore } from '@/lib/offline-store';
import { useLiveQuery } from 'dexie-react-hooks';

export default function OfflineIndicator() {
    const queue = useLiveQuery(() => offlineStore.getPendingRequests());
    const count = queue?.length || 0;
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (count === 0 && isOnline) return null;

    return (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 backdrop-blur-md border ${isOnline ? 'bg-warning/80 border-warning/30' : 'bg-destructive/80 border-destructive/30'}`}>
            <div className={`w-3 h-3 rounded-full animate-pulse ${isOnline ? 'bg-warning' : 'bg-destructive'}`} />
            <div>
                <h4 className="font-bold text-sm text-foreground">
                    {isOnline ? 'Syncing...' : 'Offline Mode'}
                </h4>
                <p className="text-xs text-foreground/80">
                    {count} Request{count !== 1 ? 's' : ''} Queued
                </p>
            </div>
            {isOnline && (
                <button
                    className="ml-2 text-xs bg-foreground/10 hover:bg-foreground/20 px-2 py-1 rounded"
                    onClick={() => alert("Syncing now...")}
                >
                    Force Sync
                </button>
            )}
        </div>
    );
}
