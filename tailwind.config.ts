import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-tajawal)", "system-ui", "sans-serif"],
        display: ["var(--font-baloo)", "var(--font-cairo)", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "rgb(var(--primary-600) / <alpha-value>)",
          foreground: "#FFFFFF",
          50: "rgb(var(--primary-50) / <alpha-value>)",
          100: "rgb(var(--primary-100) / <alpha-value>)",
          200: "rgb(var(--primary-200) / <alpha-value>)",
          300: "rgb(var(--primary-300) / <alpha-value>)",
          400: "rgb(var(--primary-400) / <alpha-value>)",
          500: "rgb(var(--primary-500) / <alpha-value>)",
          600: "rgb(var(--primary-600) / <alpha-value>)",
          700: "rgb(var(--primary-700) / <alpha-value>)",
          800: "rgb(var(--primary-800) / <alpha-value>)",
          900: "rgb(var(--primary-900) / <alpha-value>)",
          950: "rgb(var(--primary-950) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--primary-400) / <alpha-value>)",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "rgb(var(--primary-300) / <alpha-value>)",
          foreground: "#09090B",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        lunex: {
          bg: "rgb(var(--lunex-bg) / <alpha-value>)",
          purple: "rgb(var(--lunex-purple) / <alpha-value>)",
          violet: "rgb(var(--lunex-violet) / <alpha-value>)",
          lilac: "rgb(var(--lunex-lilac) / <alpha-value>)",
          gray: "rgb(var(--lunex-gray) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        glow: "0 0 40px -10px rgb(var(--primary-400) / 0.45)",
        "glow-lg": "0 0 80px -20px rgb(var(--primary-400) / 0.55)",
        premium: "0 8px 30px rgba(0,0,0,0.35)",
      },
      backgroundImage: {
        "lunex-radial": "radial-gradient(circle at 50% 0%, rgb(var(--primary-600) / 0.25), transparent 60%)",
        "lunex-gradient": "linear-gradient(135deg, rgb(var(--primary-600)) 0%, rgb(var(--primary-400)) 50%, rgb(var(--primary-300)) 100%)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-12px)" } },
        glow: { "0%, 100%": { opacity: "0.6" }, "50%": { opacity: "1" } },
        shimmer: { "0%": { backgroundPosition: "-1000px 0" }, "100%": { backgroundPosition: "1000px 0" } },
        wiggle: { "0%, 100%": { transform: "rotate(-4deg)" }, "50%": { transform: "rotate(4deg)" } },
        "bob": { "0%, 100%": { transform: "translateY(0) rotate(-2deg)" }, "50%": { transform: "translateY(-8px) rotate(2deg)" } },
        "pop-in": { "0%": { transform: "scale(0.7)", opacity: "0" }, "70%": { transform: "scale(1.05)" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 6s ease-in-out infinite",
        glow: "glow 3s ease-in-out infinite",
        shimmer: "shimmer 2s infinite linear",
        wiggle: "wiggle 0.5s ease-in-out",
        bob: "bob 5s ease-in-out infinite",
        "pop-in": "pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionTimingFunction: {
        bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
