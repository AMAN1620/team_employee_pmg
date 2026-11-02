import type { Config } from "tailwindcss";

// Tokens copied from the Stitch export (stitch_pmg_prototype_screen_prompts/supportive_growth/DESIGN.md).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "secondary-container": "#8a4cfc", "inverse-primary": "#80d5cb", "on-primary-fixed": "#00201d",
        "on-secondary-container": "#fffbff", "on-tertiary": "#ffffff", "tertiary-fixed-dim": "#ffb598",
        "tertiary-fixed": "#ffdbce", "surface-container-lowest": "#ffffff", "primary-fixed-dim": "#80d5cb",
        "error-container": "#ffdad6", "on-surface": "#0b1c30", "surface-container": "#e5eeff",
        "surface-tint": "#006a63", "on-primary": "#ffffff", "secondary-fixed": "#eaddff",
        "surface-container-low": "#eff4ff", error: "#ba1a1a", "primary-fixed": "#9cf2e8",
        "primary-container": "#0f766e", "on-primary-container": "#a3faef", "surface-bright": "#f8f9ff",
        "tertiary-container": "#9c573a", "surface-variant": "#d3e4fe", secondary: "#712ae2",
        "on-error-container": "#93000a", "outline-variant": "#bdc9c6", "on-secondary": "#ffffff",
        "inverse-surface": "#213145", "on-background": "#0b1c30", "on-secondary-fixed": "#25005a",
        "on-error": "#ffffff", "surface-container-high": "#dce9ff", primary: "#005c55", tertiary: "#7f4025",
        outline: "#6e7977", "on-tertiary-fixed": "#370e00", "on-secondary-fixed-variant": "#5a00c6",
        "secondary-fixed-dim": "#d2bbff", "surface-dim": "#cbdbf5", "on-surface-variant": "#3e4947",
        "surface-container-highest": "#d3e4fe", surface: "#f8f9ff", "inverse-on-surface": "#eaf1ff",
        "on-tertiary-fixed-variant": "#72361b", background: "#f8f9ff", "on-tertiary-container": "#ffe5db",
        "on-primary-fixed-variant": "#00504a",
        line: "#E2E8F0", canvas: "#F8FAFC", ink: "#0F172A", muted: "#64748B",
        teal: { DEFAULT: "#0F766E", hover: "#115E59", tint: "#CCFBF1" },
        violet: { DEFAULT: "#7C3AED", hover: "#6D28D9", tint: "#EDE9FE" },
      },
      borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
      spacing: {
        "space-xs": "0.25rem", "space-sm": "0.5rem", "space-md": "1rem", "space-lg": "1.5rem",
        "space-xl": "2rem", gutter: "1.5rem", margin: "2rem",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      fontSize: {
        "display-lg": ["36px", { lineHeight: "44px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["30px", { lineHeight: "38px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-sm": ["20px", { lineHeight: "28px", letterSpacing: "-0.005em", fontWeight: "600" }],
        "title-md": ["16px", { lineHeight: "24px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "26px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "22px", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "18px", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "label-sm": ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "pill-tag": ["12px", { lineHeight: "16px", letterSpacing: "0.01em", fontWeight: "600" }],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(15,23,42,0.04), 0 1px 2px -1px rgba(15,23,42,0.04)",
        "card-hover": "0 4px 6px -1px rgba(15,23,42,0.07), 0 2px 4px -2px rgba(15,23,42,0.05)",
        pop: "0 10px 15px -3px rgba(15,23,42,0.08), 0 4px 6px -4px rgba(15,23,42,0.03)",
      },
    },
  },
  plugins: [],
};
export default config;
