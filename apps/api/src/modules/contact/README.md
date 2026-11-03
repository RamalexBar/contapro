# Contacto (formulario de contapro.com.co)

Tercer canal de contacto de la pagina de inicio (los otros dos ya estaban: WhatsApp 300 845 3690 y el correo
contaprocontabilidad@gmail.com, en el boton flotante `ContactWidget`).

- **Formulario** «¿Tienes preguntas?» al final de la landing (`apps/web/src/features/marketing/components/ContactForm.tsx`,
  ancla `#contacto`): nombre, negocio, correo, celular y mensaje. Pide al menos correo o celular. A su lado, el WhatsApp y
  el correo visibles. Evento de Analytics `contact_form`.
- `POST /api/contact-messages` (publico): guarda en `contact_messages` y avisa por correo a `INTERNAL_NOTIFICATIONS_EMAIL`
  (Resend, `reply_to` = el correo de la persona: responder ese correo le contesta). Si el correo falla, el mensaje igual
  queda guardado. Anti-abuso: campo trampa oculto `website` (un robot recibe 201 pero no se guarda) y 5 mensajes por hora
  por conexion (429 con un mensaje que sugiere WhatsApp).
- Panel de plataforma → **Mensajes** (`/admin/messages`; `GET /api/admin/contact-messages`,
  `PATCH /api/admin/contact-messages/:id/handled { handled }`, con `requirePlatformAdmin`): pendientes primero, enlaces a
  responder por correo o WhatsApp, «Marcar atendido».
- El router se monta antes de los routers con sesion de empresa (app.ts), igual que saas-admin.

Verificado en vivo (local): envio desde la landing, mensaje en el panel, marcar atendido, trampa del robot, rechazo sin
correo ni celular y el limite por conexion.
