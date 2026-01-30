
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Command, LayoutDashboard, Shield, Users, Mail, Settings, Zap } from 'lucide-react';

export const CommandPalette: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const router = useRouter();

    const actions = [
        { id: 'dashboard', name: 'Go to Dashboard', icon: LayoutDashboard, shortcut: 'G D', url: '/dashboard' },
        { id: 'governance', name: 'View Governance & Firewall', icon: Shield, shortcut: 'G G', url: '/governance' },
        { id: 'leads', name: 'Manage Leads', icon: Users, shortcut: 'G L', url: '/leads' },
        { id: 'campaigns', name: 'View Campaigns', icon: Mail, shortcut: 'G C', url: '/campaigns' },
        { id: 'crm', name: 'CRM Sync Status', icon: Zap, shortcut: 'G S', url: '/crm' },
        { id: 'settings', name: 'Organization Settings', icon: Settings, shortcut: 'G O', url: '/settings' },
    ];

    const filteredActions = actions.filter(action =>
        action.name.toLowerCase().includes(search.toLowerCase())
    );

    const togglePalette = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setIsOpen(prev => !prev);
        }
        if (e.key === 'Escape') {
            setIsOpen(false);
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', togglePalette);
        return () => window.removeEventListener('keydown', togglePalette);
    }, [togglePalette]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4 backdrop-blur-md bg-black/40 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-slate-900/80 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden glass-morphism">
                <div className="relative flex items-center p-4 border-b border-slate-700/50">
                    <Search className="w-5 h-5 text-slate-400 mr-3" />
                    <input
                        autoFocus
                        type="text"
                        placeholder="Type a command or search..."
                        className="bg-transparent border-none outline-none text-white w-full text-lg placeholder:text-slate-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">
                        <Command className="w-3 h-3" />
                        <span>K</span>
                    </div>
                </div>

                <div className="max-h-[50vh] overflow-y-auto p-2 scrollbar-hide">
                    {filteredActions.length > 0 ? (
                        filteredActions.map((action) => (
                            <button
                                key={action.id}
                                onClick={() => {
                                    router.push(action.url);
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/10 transition-colors group text-left"
                            >
                                <div className="flex items-center">
                                    <div className="p-2 rounded-lg bg-slate-800 mr-4 group-hover:bg-indigo-500/20 transition-colors">
                                        <action.icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
                                    </div>
                                    <span className="text-slate-200 font-medium group-hover:text-white">{action.name}</span>
                                </div>
                                <span className="text-xs text-slate-500 font-mono group-hover:text-slate-400">{action.shortcut}</span>
                            </button>
                        ))
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            No commands found for "{search}"
                        </div>
                    )}
                </div>

                <div className="p-3 bg-slate-950/50 border-t border-slate-700/30 flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest">
                    <span>Navigation</span>
                    <div className="flex gap-4">
                        <span><kbd className="bg-slate-800 px-1 rounded mr-1">↑↓</kbd> Select</span>
                        <span><kbd className="bg-slate-800 px-1 rounded mr-1">⏎</kbd> Confirm</span>
                        <span><kbd className="bg-slate-800 px-1 rounded mr-1">ESC</kbd> Close</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
