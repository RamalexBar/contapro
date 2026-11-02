// Manda un correo de prueba de los avisos de fallas, para confirmar que las variables están bien.
// En Render → contapro-api → Shell:   node apps/api/scripts/probar-aviso.cjs
// Usa RESEND_API_KEY, RESEND_FROM_EMAIL e INTERNAL_NOTIFICATIONS_EMAIL (las mismas del aviso de pagos).
const key = (process.env.RESEND_API_KEY || "").trim();
const from = (process.env.RESEND_FROM_EMAIL || "").trim();
const to = (process.env.INTERNAL_NOTIFICATIONS_EMAIL || "").trim();

const missing = [!key && "RESEND_API_KEY", !from && "RESEND_FROM_EMAIL", !to && "INTERNAL_NOTIFICATIONS_EMAIL"].filter(Boolean);
if (missing.length) {
  console.log("Faltan estas variables en contapro-api (Environment):", missing.join(", "));
  process.exit(1);
}

fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    from,
    to,
    subject: "[Contapro] Prueba de avisos de fallas",
    text: "Si le llegó este correo, los avisos de fallas de Contapro están bien configurados.",
  }),
})
  .then(async (res) => {
    console.log(res.ok ? `Enviado a ${to}. Revise el correo (y la carpeta de spam).` : `Resend respondió ${res.status}: ${await res.text()}`);
  })
  .catch((err) => console.log("No se pudo enviar:", err.message));
