export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Arial Black'", "Impact", "system-ui", "sans-serif"],
        mono: ["'Courier New'", "ui-monospace", "monospace"]
      },
      boxShadow: {
        glow: "0 0 0 1px #fff, 0 0 22px rgba(255,255,255,.28)",
        hard: "6px 6px 0 #fff"
      },
      animation: {
        scan: "scan 7s linear infinite",
        glitch: "glitch 2.7s steps(2,end) infinite",
        pulsebar: "pulsebar 1.8s ease-in-out infinite"
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" }
        },
        glitch: {
          "0%, 92%, 100%": { transform: "translate(0)" },
          "93%": { transform: "translate(2px, -1px)" },
          "94%": { transform: "translate(-2px, 1px)" },
          "95%": { transform: "translate(1px, 2px)" }
        },
        pulsebar: {
          "0%, 100%": { opacity: ".55" },
          "50%": { opacity: "1" }
        }
      }
    }
  },
  plugins: []
};
