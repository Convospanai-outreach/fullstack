"use client"

import * as React from "react"


interface ToneSliderProps {
    label: string
    leftLabel: string
    rightLabel: string
    defaultValue?: number
    onChange?: (value: number) => void
}

export function ToneSlider({ label, leftLabel, rightLabel, defaultValue = 50, onChange }: ToneSliderProps) {
    const [value, setValue] = React.useState(defaultValue)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = Number(e.target.value)
        setValue(newValue)
        if (onChange) onChange(newValue)
    }

    return (
        <div className="w-full space-y-3">
            <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-text-primary">{label}</span>
                <span className="text-xs text-text-muted">{value}%</span>
            </div>

            <div className="relative group">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    onChange={handleChange}
                    className="w-full h-2 bg-bg-glassStrong rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent-blue/50"
                />
                {/* Custom thumb styles would go here via standard CSS or extensive Tailwind classes if strictly needed, keeping it simple for now */}
            </div>

            <div className="flex justify-between text-xs text-text-secondary font-medium">
                <span>{leftLabel}</span>
                <span>{rightLabel}</span>
            </div>
        </div>
    )
}
