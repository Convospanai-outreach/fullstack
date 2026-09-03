"use client";

import { useState, useEffect } from "react";
import {
    CheckCircle2,
    Circle,
    Plus,
    Calendar,
    User
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { getBrowserApiBase } from "@/lib/api/browserBase";

export function TaskWidget() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");

    useEffect(() => {
        loadTasks();
    }, []);

    const handleCreateTask = async () => {
        if (!newTaskTitle.trim()) return;

        try {
            const res = await fetch(getBrowserApiBase() + "/pipeline/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newTaskTitle,
                    priority: "MEDIUM"
                })
            });

            if (!res.ok) throw new Error("Failed to create task");

            setNewTaskTitle("");
            setIsCreating(false);
            loadTasks();
            toast.success("Task created");
        } catch (e) {
            toast.error("Failed to create task");
        }
    };

    const loadTasks = async () => {
        try {
            const res = await fetch(getBrowserApiBase() + "/pipeline/tasks");
            const data = await res.json();
            if (data.success) {
                setTasks(data.data);
            }
        } catch (error) {
            console.error("Failed to load tasks", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleTask = async (taskId: string, currentStatus: string) => {
        const newStatus = currentStatus === "TODO" ? "DONE" : "TODO";
        try {
            const res = await fetch(`${getBrowserApiBase()}/pipeline/tasks/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) {
                throw new Error('Update failed');
            }

            loadTasks();
        } catch (e) {
            toast.error("Update failed");
        }
    };

    if (loading) return null;

    return (
        <div className="glass-panel p-6 rounded-2xl border border-border space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    Pending Verification <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full">{tasks.filter(t => t.status === 'TODO').length}</span>
                </h3>
                <button
                    onClick={() => setIsCreating(true)}
                    className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all">
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {/* Creation Form */}
            {isCreating && (
                <div className="p-4 bg-muted rounded-xl border border-border space-y-3 animate-in fade-in slide-in-from-top-2">
                    <input
                        autoFocus
                        type="text"
                        placeholder="What needs to be done?"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setIsCreating(false)}
                            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateTask}
                            disabled={!newTaskTitle.trim()}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50">
                            Add Task
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {tasks.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm italic">
                        All clear! No pending tasks.
                    </div>
                ) : (
                    tasks.map((task) => (
                        <div
                            key={task.id}
                            className={`group flex items-start gap-4 p-4 rounded-xl border transition-all ${task.status === 'DONE'
                                ? 'bg-muted/40 border-transparent opacity-60'
                                : 'bg-muted border-border hover:border-primary/30'
                                }`}
                        >
                            <button
                                onClick={() => toggleTask(task.id, task.status)}
                                className="mt-0.5"
                            >
                                {task.status === 'DONE' ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                    <Circle className="w-5 h-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                                )}
                            </button>
                            <div className="flex-1">
                                <div className={`text-sm font-bold tracking-tight ${task.status === 'DONE' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {task.title}
                                </div>
                                {task.description && (
                                    <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{task.description}</div>
                                )}
                                <div className="flex items-center gap-4 mt-3">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                                        <Calendar className="w-3 h-3" /> {task.dueDate ? formatDistanceToNow(new Date(task.dueDate)) + " ago" : "No date"}
                                    </div>
                                    {task.lead && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400/60 uppercase">
                                            <User className="w-3 h-3" /> {task.lead.fullName}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className={`w-1 h-8 rounded-full ${task.priority === 'HIGH' ? 'bg-red-500' :
                                task.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'
                                }`} />
                        </div>
                    ))
                )}
            </div>

            <button className="w-full py-3 rounded-xl border border-border text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:bg-muted hover:text-foreground transition-all">
                View All Tasks
            </button>
        </div>
    );
}
