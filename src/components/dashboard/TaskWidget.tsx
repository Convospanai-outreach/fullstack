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

export function TaskWidget() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        try {
            const res = await fetch("/api/pipeline/tasks");
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
            await fetch(`/api/pipeline/tasks`, { // Note: for simplicity using POST with ID or we'd need dynamic route
                method: "POST", // Simplified placeholder for update
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: taskId, status: newStatus })
            });
            loadTasks();
        } catch (e) {
            toast.error("Update failed");
        }
    };

    if (loading) return null;

    return (
        <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Pending Tasks <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full">{tasks.filter(t => t.status === 'TODO').length}</span>
                </h3>
                <button className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all">
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-3">
                {tasks.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 text-sm italic">
                        All clear! No pending tasks.
                    </div>
                ) : (
                    tasks.map((task) => (
                        <div
                            key={task.id}
                            className={`group flex items-start gap-4 p-4 rounded-xl border transition-all ${task.status === 'DONE'
                                ? 'bg-white/[0.02] border-transparent opacity-60'
                                : 'bg-white/5 border-white/5 hover:border-white/20'
                                }`}
                        >
                            <button
                                onClick={() => toggleTask(task.id, task.status)}
                                className="mt-0.5"
                            >
                                {task.status === 'DONE' ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                    <Circle className="w-5 h-5 text-gray-600 group-hover:text-blue-500 transition-colors" />
                                )}
                            </button>
                            <div className="flex-1">
                                <div className={`text-sm font-bold tracking-tight ${task.status === 'DONE' ? 'line-through text-gray-600' : 'text-white'}`}>
                                    {task.title}
                                </div>
                                {task.description && (
                                    <div className="text-[10px] text-gray-500 mt-1 line-clamp-1">{task.description}</div>
                                )}
                                <div className="flex items-center gap-4 mt-3">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase">
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

            <button className="w-full py-3 rounded-xl border border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all">
                View All Tasks
            </button>
        </div>
    );
}
