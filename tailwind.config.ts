import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
    // Match both .dark class AND [data-theme="dark"] attribute so the
    // existing theme toggles (which set data-theme) activate Tailwind's
    // dark: variants. Tailwind v3.4+ supports multiple dark mode selectors.
    darkMode: ["class", '[data-theme="dark"]'],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
        extend: {
                fontFamily: {
                        sans: ['Geist', 'var(--font-geist)', 'system-ui', '-apple-system', 'sans-serif'],
                        mono: ['var(--font-jetbrains)', 'Geist Mono', 'ui-monospace', 'monospace'],
                        serif: ['var(--font-instrument)', 'var(--font-newsreader)', 'Georgia', 'serif'],
                        display: ['var(--font-instrument)', 'var(--font-newsreader)', 'Georgia', 'serif'],
                },
                colors: {
                        background: 'hsl(var(--shadcn-background))',
                        foreground: 'hsl(var(--shadcn-foreground))',
                        card: {
                                DEFAULT: 'hsl(var(--shadcn-card))',
                                foreground: 'hsl(var(--shadcn-card-foreground))'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--shadcn-popover))',
                                foreground: 'hsl(var(--shadcn-popover-foreground))'
                        },
                        primary: {
                                DEFAULT: 'hsl(var(--shadcn-primary))',
                                foreground: 'hsl(var(--shadcn-primary-foreground))'
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--shadcn-secondary))',
                                foreground: 'hsl(var(--shadcn-secondary-foreground))'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--shadcn-muted))',
                                foreground: 'hsl(var(--shadcn-muted-foreground))'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--shadcn-accent))',
                                foreground: 'hsl(var(--shadcn-accent-foreground))'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--shadcn-destructive))',
                                foreground: 'hsl(var(--shadcn-destructive-foreground))'
                        },
                        border: 'hsl(var(--shadcn-border))',
                        input: 'hsl(var(--shadcn-input))',
                        ring: 'hsl(var(--shadcn-ring))',
                        chart: {
                                '1': 'hsl(var(--shadcn-chart-1))',
                                '2': 'hsl(var(--shadcn-chart-2))',
                                '3': 'hsl(var(--shadcn-chart-3))',
                                '4': 'hsl(var(--shadcn-chart-4))',
                                '5': 'hsl(var(--shadcn-chart-5))'
                        }
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                }
        }
  },
  plugins: [tailwindcssAnimate],
};
export default config;
