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
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
            },
            borderRadius: {
                lg: "0.75rem", // Clerk uses softer rounded corners
                md: "calc(0.75rem - 2px)",
                sm: "calc(0.75rem - 4px)",
            },
            fontFamily: {
                sans: ["var(--font-inter)", "sans-serif"], // Clerk's primary font
                mono: ["var(--font-jetbrains-mono)", "monospace"], // For the code-heavy Antigravity UI
            },
            boxShadow: {
                'clerk': '0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.05), 0 12px 24px rgba(0,0,0,0.05)',
            }
        },
    },
    plugins: [require("tailwindcss-animate")],
}
