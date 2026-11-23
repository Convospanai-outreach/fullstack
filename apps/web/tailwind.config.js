/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{ts,tsx,js,jsx}"],
    theme: {
        extend: {
            colors: {
                // Bordeaux palette. Every colour resolves to the CSS variables in src/app/globals.css.
                brand: {
                    50: 'hsl(var(--secondary))',
                    100: 'hsl(var(--secondary))',
                    200: 'hsl(var(--accent))',
                    300: 'hsl(var(--primary) / 0.7)',
                    400: 'hsl(var(--primary) / 0.85)',
                    500: 'hsl(var(--primary))',
                    600: 'hsl(var(--primary))',
                    700: 'hsl(var(--link-hover))',
                    900: 'hsl(var(--primary) / 0.6)',
                },
                surface: {
                    app: 'hsl(var(--background))',
                    panel: 'hsl(var(--card))',
                    accent: 'hsl(var(--accent))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                    blue: 'hsl(var(--primary))',
                    violet: 'hsl(var(--primary))',
                    mint: 'hsl(var(--success))',
                    gold: 'hsl(var(--warning))',
                    silver: 'hsl(var(--muted-foreground))',
                    crystal: 'hsl(var(--primary))',
                },
                text: {
                    primary: 'hsl(var(--foreground))',
                    secondary: 'hsl(var(--muted-foreground))',
                    muted: 'hsl(var(--muted-foreground))',
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                success: "hsl(var(--success))",
                warning: "hsl(var(--warning))",
                info: "hsl(var(--info))",
                link: { DEFAULT: "hsl(var(--link))", hover: "hsl(var(--link-hover))" },
                chart: { 1: "hsl(var(--chart-1))", 2: "hsl(var(--chart-2))", 3: "hsl(var(--chart-3))", 4: "hsl(var(--chart-4))", 5: "hsl(var(--chart-5))", 6: "hsl(var(--chart-6))", 7: "hsl(var(--chart-7))", 8: "hsl(var(--chart-8))" },
                sidebar: { DEFAULT: "hsl(var(--sidebar))", foreground: "hsl(var(--sidebar-foreground))", muted: "var(--sidebar-muted)", label: "hsl(var(--sidebar-label))", active: "var(--sidebar-active)", border: "var(--sidebar-border)" },
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
            fontSize: {
                '2xs': ['10px', { lineHeight: '1.4', letterSpacing: '0.04em' }],
                'xs':  ['11px', { lineHeight: '1.5' }],
                'sm':  ['12.5px', { lineHeight: '1.5' }],
                'base': ['14px', { lineHeight: '1.6' }],
                'lg':  ['16px', { lineHeight: '1.5' }],
                'xl':  ['18px', { lineHeight: '1.4' }],
                '2xl': ['22px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
            },
            fontWeight: {
                normal: '400',
                medium: '500',
                // Do not use semibold (600) or bold (700) in dashboard components
            },
            boxShadow: {
                'clerk': '0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.05), 0 12px 24px rgba(0,0,0,0.05)',
                'glow': '0 0 20px rgba(194, 163, 107, 0.2)',
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

