# WhatsApp & Telegram — Estado Actual

*Generado por agente de exploración 2026-03-09*

## Resumen

3 arquitecturas de mensajería paralelas, ninguna suficiente para CEO via WhatsApp.

## PodClaw Conectores MCP

### WhatsApp (110 LOC)
- API: Meta WhatsApp Cloud API v18.0
- 2 tools: `whatsapp_send` (texto), `whatsapp_send_template` (templates)
- SIN inbound webhook, SIN imágenes, SIN botones interactivos
- Solo outbound text

### Telegram (126 LOC)
- API: Telegram Bot API
- 3 tools: `telegram_send` (markdown), `telegram_send_photo` (URL), `telegram_broadcast`
- Soporta Markdown/HTML y fotos por URL
- SIN botones/inline keyboards, SIN webhook inbound

## OpenClaw Plugins (Referencia)

### WhatsApp (Baileys, 497 LOC)
- Full 2-way: text, media, polls, reactions
- QR login required (Web emulation, frágil)
- Multi-account, DM policy enforcement

### Telegram (grammY, 489 LOC)
- Threads, reactions, native commands
- Webhook + polling modes
- Message actions adapter

## Admin Chat (Bridge SSE)
- Web-only, streaming SSE
- Budget €0.50/conversación, Sonnet 4.5
- Tool access directo (Supabase, Stripe, Printify)
- Memory search integrado

## DB Schema (Existe)
- `user_messaging_links` (platform, platform_user_id, is_admin_mode)
- `telegram_messages` (update_id, message_id, text, chat_id)
- `whatsapp_messages` (message_id, from_number, text, media_url, media_type)
- `messaging_conversations` (direction, message_type, content, metadata)
- RLS activo en todas las tablas

## Gaps para CEO via WhatsApp

| Capability | Estado | Criticidad |
|-----------|--------|-----------|
| Recibir imágenes del CEO | NO existe | CRITICAL |
| Enviar previews de diseños | NO existe | CRITICAL |
| Botones approve/reject | NO existe | CRITICAL |
| Webhook inbound WhatsApp | NO existe | CRITICAL |
| Webhook inbound Telegram | Solo test | HIGH |
| Push notifications | NO | HIGH |
| Threading/contexto | NO | MEDIUM |
