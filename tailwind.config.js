/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/app/**/*.{js,ts,jsx,tsx}",
        "./src/components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: {
                    base: '#0B0F1A',
                    glass: 'rgba(255,255,255,0.08)',
                    glassStrong: 'rgba(255,255,255,0.14)',
                },
                accent: {
                    blue: '#4F8BFF',
                    violet: '#8B5CF6',
                    mint: '#2DD4BF',
                },
                text: {
                    primary: '#E6EAF2',
                    secondary: '#9CA3AF',
                    muted: '#6B7280',
                },
                border: {
                    subtle: 'rgba(255,255,255,0.12)',
                }
            },
            boxShadow: {
                soft: '0 10px 30px rgba(0,0,0,0.25)',
                glow: '0 0 0 1px rgba(255,255,255,0.08), 0 10px 40px rgba(79,139,255,0.25)',
            },
            transitionTimingFunction: {
                smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
            }
        },
    },
    plugins: [],
};
