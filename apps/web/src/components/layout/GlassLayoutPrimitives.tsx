"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Glassmorphic 3-Pane Layout Primitives (Apollo.io UX Structure)
 * 
 * 1. AppRail: Collapsible 16w / 48w left navigation rail
 * 2. FilterSidebar: Sticky 72w filter panel over glass
 * 3. MainDataGrid: High-density main data grid container
 * 4. DetailDrawer: Glass slide-over drawer for lead details / intelligence
 */

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  return (
    <div className={cn("relative min-h-screen bg-background text-foreground flex overflow-hidden", className)}>
      {/* Abstract Glowing Wave Backdrop Layer */}
      <div className="backdrop-wave-pattern" aria-hidden="true" />
      <div className="relative z-10 flex w-full min-h-screen">
        {children}
      </div>
    </div>
  );
}

interface AppRailProps {
  collapsed?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function AppRail({ collapsed = false, onToggle, children, className }: AppRailProps) {
  return (
    <aside
      className={cn(
        "h-screen sticky top-0 z-30 transition-all duration-300 flex flex-col justify-between border-r border-white/10 bg-[#0c0c0f]/60 backdrop-blur-[32px]",
        collapsed ? "w-16" : "w-48",
        className
      )}
    >
      <div className="flex-1 flex flex-col overflow-y-auto p-2">
        {children}
      </div>
      {onToggle && (
        <button
          onClick={onToggle}
          className="h-10 w-full flex items-center justify-center text-muted-foreground hover:text-foreground border-t border-white/10 hover:bg-white/5 transition-colors"
          title={collapsed ? "Expand rail" : "Collapse rail"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      )}
    </aside>
  );
}

interface FilterSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function FilterSidebar({ collapsed = false, onToggle, title = "Filters", children, className }: FilterSidebarProps) {
  if (collapsed) return null;

  return (
    <aside
      className={cn(
        "w-72 shrink-0 h-screen sticky top-0 z-20 border-r border-white/10 bg-[#0c0c0f]/50 backdrop-blur-[32px] flex flex-col overflow-hidden",
        className
      )}
    >
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">{title}</h3>
        {onToggle && (
          <button
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-white/5 transition"
            title="Close filter panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
        {children}
      </div>
    </aside>
  );
}

interface MainDataGridProps {
  children: React.ReactNode;
  className?: string;
}

export function MainDataGrid({ children, className }: MainDataGridProps) {
  return (
    <main className={cn("flex-1 min-w-0 flex flex-col h-screen overflow-hidden relative", className)}>
      <div className="flex-1 overflow-auto p-4 lg:p-6 custom-scrollbar space-y-6">
        {children}
      </div>
    </main>
  );
}

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  width?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function DetailDrawer({ isOpen, onClose, title = "Details", width = "md", children }: DetailDrawerProps) {
  if (!isOpen) return null;

  const widthClass = width === "sm" ? "w-[400px]" : width === "lg" ? "w-[640px]" : "w-[512px]";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-opacity">
      <div
        className={cn(
          "h-full bg-[#0c0c0f]/80 backdrop-blur-[32px] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300",
          widthClass
        )}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
            title="Close detail panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
