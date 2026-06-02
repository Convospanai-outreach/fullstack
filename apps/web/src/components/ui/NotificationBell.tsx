"use client";

import { useState, useEffect } from "react";

import Link from "next/link";

import { useSession } from "next-auth/react";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

export function NotificationBell() {
    const { status } = useSession();
    const [count, setCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        if (status === "authenticated") {
            fetch(getBrowserApiUrl("/notifications"))
                .then(res => {
                    if (res.ok) return res.json();
                    return [];
                })
                .then(data => {
                    if (!cancelled) {
                        setCount(Array.isArray(data) ? data.length : 0);
                    }
                })
                .catch(() => {
                    if (!cancelled) {
                        setCount(0);
                    }
                });
        }

        return () => {
            cancelled = true;
        };
    }, [status]);

    if (status !== "authenticated") {
        return null;
    }

    return (
        <Link href="/notifications" aria-label={`View notifications${count > 0 ? `, ${count} unread` : ''}`}>
            <div className="relative p-2 text-gray-400 hover:text-white transition-colors cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {count > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
                        {count}
                    </span>
                )}
            </div>
        </Link>
    );
}
