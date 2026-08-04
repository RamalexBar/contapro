import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // allowedHosts:true es aceptable solo para exponer este dev server puntualmente detras de un
    // tunel (Cloudflare Tunnel/ngrok, dominio distinto cada vez) -- NUNCA usar en un despliegue
    // real expuesto permanentemente (riesgo de DNS rebinding), ahi hay que listar el/los host(s)
    // reales explicitos.
    allowedHosts: true,
  },
});
