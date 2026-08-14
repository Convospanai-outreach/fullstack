"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import StepPicker from "./StepPicker";

export default function AddStepButton({
    linkedinLocked,
    onSelect,
}: {
    linkedinLocked: boolean;
    onSelect: (stepType: string) => void;
}) {
    const [open, setOpen] = useState(false);

    function handleSelect(stepType: string) {
        onSelect(stepType);
        setOpen(false);
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/50 px-4 py-2 text-sm font-medium text-blue-500 transition hover:bg-blue-500/10"
                >
                    <Plus className="h-4 w-4" /> Add step
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-80 p-0">
                <StepPicker linkedinLocked={linkedinLocked} onSelect={handleSelect} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
