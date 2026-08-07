/** Preset Tailwind compartido (colores de marca, tipografía) para apps/web y cualquier otra app
 * que lo consuma. Neutros: se usa la escala `slate` nativa de Tailwind (más fría que `gray`), no
 * hace falta redefinirla acá -- solo las páginas migran de `gray-*` a `slate-*`. */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        // Colores semanticos -- mapeados a escalas nativas de Tailwind (sin redefinir tonos
        // propios) para que "success-600"/"warning-600"/"danger-600" tengan un nombre de intencion
        // claro en vez de emerald-600/amber-600/red-600 repartidos sin criterio por el codigo.
        success: {
          50: "#ecfdf5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        warning: {
          50: "#fffbeb",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        danger: {
          50: "#fef2f2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
