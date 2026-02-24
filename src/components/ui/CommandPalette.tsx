
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
        // Operator Commands
        { id: 'approvals', name: 'View Approval Queue', icon: Shield, shortcut: 'G A', url: '/dashboard?tab=approvals' },
        { id: 'operator-scrapers', name: 'Run: Start All Scrapers', icon: Zap, shortcut: 'R S', url: '/api/admin/actions/start-scrapers', action: true },
        { id: 'operator-pause', name: 'Run: Pause Outreach', icon: Zap, shortcut: 'R P', url: '/api/admin/actions/pause-outreach', action: true },
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

    const openPalette = useCallback(() => {
        setIsOpen(true);
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', togglePalette);
        window.addEventListener('convo:open-command-palette', openPalette);
        return () => {
            window.removeEventListener('keydown', togglePalette);
            window.removeEventListener('convo:open-command-palette', openPalette);
        };
    }, [togglePalette, openPalette]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4 backdrop-blur-sm bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0 duration-200">
            <div className="w-full max-w-2xl bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
                <div className="relative flex items-center p-4 border-b border-border">
                    <Search className="w-5 h-5 text-muted-foreground mr-3" />
                    <input
                        autoFocus
                        type="text"
                        placeholder="Type a command or search..."
                        className="bg-transparent border-none outline-none text-foreground w-full text-lg placeholder:text-muted-foreground"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-[10px] text-muted-foreground font-mono">
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
                                    if ((action as any).action) {
                                        fetch(action.url, { method: 'POST' })
                                            .then(res => {
                                                if (res.ok) alert('Action Triggered: ' + action.name);
                                                else alert('Action Failed');
                                            });
                                    } else {
                                        router.push(action.url);
                                    }
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors group text-left"
                            >
                                <div className="flex items-center">
                                    <div className="p-2 rounded-md bg-muted mr-4 group-hover:bg-brand-500/10 transition-colors">
                                        <action.icon className="w-5 h-5 text-muted-foreground group-hover:text-brand-600" />
                                    </div>
                                    <span className="text-foreground font-medium">{action.name}</span>
                                </div>
                                <span className="text-xs text-muted-foreground font-mono">{action.shortcut}</span>
                            </button>
                        ))
                    ) : (
                        <div className="p-8 text-center text-muted-foreground">
                            No commands found for "{search}"
                        </div>
                    )}
                </div>

                <div className="p-3 bg-muted/50 border-t border-border flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest">
                    <span>Navigation</span>
                    <div className="flex gap-4">
                        <span><kbd className="bg-muted px-1 rounded mr-1 border border-border">↑↓</kbd> Select</span>
                        <span><kbd className="bg-muted px-1 rounded mr-1 border border-border">⏎</kbd> Confirm</span>
                        <span><kbd className="bg-muted px-1 rounded mr-1 border border-border">ESC</kbd> Close</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
