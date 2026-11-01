"use client";

import { useState } from "react";
import { instagramBlockHref } from "./instagramFollow";

// Settings for a selected Instagram follow button. Only a valid handle changes the link; an invalid one
// is shown here and the link stays as it was. The handle is not read back from the link, so the field starts empty.
interface Props {
    onApply: (href: string) => void;
}

const inputClass = "w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100";

export default function InstagramSettingsPanel({ onApply }: Props) {
    const [handle, setHandle] = useState("");
    const result = handle === "" ? null : instagramBlockHref(handle);

    function change(value: string) {
        setHandle(value);
        const next = instagramBlockHref(value);
        if ("href" in next) onApply(next.href);
    }

    return (
        <div className="space-y-2 text-sm text-slate-200">
            <label className="block space-y-1">
                <span className="text-xs text-slate-400">Instagram handle (without the @)</span>
                <input className={inputClass} placeholder="yourhandle" value={handle} onChange={(e) => change(e.target.value)} />
            </label>
            {result && "problem" in result ? (
                <p className="text-xs text-rose-300">{result.problem} (the link is not changed until fixed)</p>
            ) : null}
        </div>
    );
}
