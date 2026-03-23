/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{ts,tsx,js,jsx}"],
    theme: {
        extend: {
            colors: {
                // Clerk's Signature Brand Colors
                brand: {
                    50: '#f5f7ff',
                    100: '#ebf0fe',
                    200: '#ced9fd',
                    400: '#818cf8',
                    500: '#6366f1', // Primary Indigo
                    600: '#4f46e5',
                    700: '#4338ca',
                    900: '#312e81',
                },
                // Antigravity dark-mode surfaces
                surface: {
                    app: '#020617',     // Deepest background
                    panel: '#0f172a',   // Sidebar/Panel background
                    accent: '#1e293b',  // Hover states
                },
                // Token-based accent colors (from tokens.css)
                accent: {
                    blue: '#3b82f6',
                    violet: '#8b5cf6',
                    mint: '#10b981',
                    gold: '#fbbf24',
                    silver: '#94a3b8',
                    crystal: '#60a5fa',
                },
                // Text semantic colors
                text: {
                    primary: '#ffffff',
                    secondary: '#94a3b8',
                    muted: '#64748b',
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
            },
            borderRadius: {
                lg: "0.75rem",
                md: "calc(0.75rem - 2px)",
                sm: "calc(0.75rem - 4px)",
            },
            fontFamily: {
                sans: ["var(--font-inter)", "sans-serif"],
                mono: ["var(--font-jetbrains-mono)", "monospace"],
                outfit: ["var(--font-outfit)", "sans-serif"],
            },
            boxShadow: {
                'clerk': '0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.05), 0 12px 24px rgba(0,0,0,0.05)',
                'glow': '0 0 20px rgba(99, 102, 241, 0.2)',
            },
            keyframes: {
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'reveal': {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-up': {
                    '0%': { opacity: '0', transform: 'translateY(30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'blob': {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                },
            },
            animation: {
                'fade-in-up': 'fade-in-up 0.5s ease-out',
                'reveal': 'reveal 0.6s ease-out',
                'slide-up': 'slide-up 0.5s ease-out both',
                'blob': 'blob 7s infinite',
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}

