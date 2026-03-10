# 05 - Auth (GoTrue), Webhooks & APIs Configuration
## Supabase Self-Hosted Migration Guide

**Fecha**: 2026-03-09
**Scope**: GoTrue Auth, PostgREST, Realtime, Storage, Edge Functions, Webhooks, Client-Side Changes
**Estado actual**: Supabase Cloud con email/password, CSRF cookies, Turnstile CAPTCHA, Stripe webhooks

---

## Table of Contents

1. [GoTrue (Auth) Configuration](#1-gotrue-auth-configuration)
2. [PostgREST API Configuration](#2-postgrest-api-configuration)
3. [Realtime Configuration](#3-realtime-configuration)
4. [Storage API Configuration](#4-storage-api-configuration)
5. [Edge Functions (Deno Runtime)](#5-edge-functions-deno-runtime)
6. [Kong API Gateway](#6-kong-api-gateway)
7. [Database Webhooks (pg_net)](#7-database-webhooks-pg_net)
8. [Imgproxy (Image Transformation)](#8-imgproxy-image-transformation)
9. [Supavisor (Connection Pooling)](#9-supavisor-connection-pooling)
10. [Client-Side Changes](#10-client-side-changes)
11. [Email Delivery Setup (Resend via SMTP)](#11-email-delivery-setup-resend-via-smtp)
12. [Webhook Migration Guide](#12-webhook-migration-guide)
13. [Auth Migration Checklist](#13-auth-migration-checklist)

---

## 1. GoTrue (Auth) Configuration

GoTrue es el servicio de autenticacion de Supabase. En self-hosted se configura 100% via variables de entorno con prefijo `GOTRUE_`.

### 1.1 Variables Generales

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_SITE_URL` | string | **Required** | URL base de la app. Para email links y redirects. Ej: `https://skapara.com` |
| `GOTRUE_URI_ALLOW_LIST` | string | `[]` | Comma-separated redirect URIs permitidos (soporta glob: `https://*.skapara.com`) |
| `GOTRUE_DISABLE_SIGNUP` | bool | `false` | Desactivar registro de nuevos usuarios |
| `GOTRUE_OPERATOR_TOKEN` | string | - | Shared secret para multi-instance (legacy) |
| `API_EXTERNAL_URL` | string | **Required** | URL externa donde GoTrue es accesible. Ej: `https://api.skapara.com` |

### 1.2 API Server

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_API_HOST` | string | `0.0.0.0` | Hostname para binding del servidor |
| `PORT` / `GOTRUE_API_PORT` | string | `8081` | Puerto interno del servicio auth |
| `GOTRUE_REQUEST_ID_HEADER` | string | - | Header para heredar request ID |
| `GOTRUE_API_MAX_REQUEST_DURATION` | duration | `10s` | Timeout maximo por request |

### 1.3 Database

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_DB_DRIVER` | string | **Required** | Siempre `postgres` |
| `DATABASE_URL` | string | **Required** | Connection string PostgreSQL |
| `GOTRUE_DB_NAMESPACE` | string | `auth` | Prefijo para tablas |
| `GOTRUE_DB_MAX_POOL_SIZE` | int | `0` (unlimited) | Max conexiones abiertas |
| `GOTRUE_DB_MAX_IDLE_POOL_SIZE` | int | - | Max conexiones idle |
| `GOTRUE_DB_CONN_MAX_LIFETIME` | duration | - | Tiempo maximo de vida de conexion |
| `GOTRUE_DB_CONN_MAX_IDLE_TIME` | duration | - | Tiempo maximo idle |
| `GOTRUE_DB_HEALTH_CHECK_PERIOD` | duration | - | Intervalo de health check |
| `GOTRUE_DB_CLEANUP_ENABLED` | bool | `false` | Limpiar datos stale |
| `GOTRUE_DB_MIGRATIONS_PATH` | string | `./migrations` | Path a migraciones |

### 1.4 JWT Configuration

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_JWT_SECRET` | string | **Required** | Secreto para firmar JWT (min 32 chars). Debe coincidir con `JWT_SECRET` global |
| `GOTRUE_JWT_EXP` | int | `3600` | Expiracion del token en segundos (max 604800 = 1 semana) |
| `GOTRUE_JWT_AUD` | string | - | Audience claim del JWT |
| `GOTRUE_JWT_ISSUER` | string | - | Issuer claim |
| `GOTRUE_JWT_KEY_ID` | string | - | Key ID para token signing |
| `GOTRUE_JWT_ADMIN_ROLES` | string | - | Roles con privilegios admin (comma-separated) |
| `GOTRUE_JWT_KEYS` | json | - | JSON Web Key Set para signing asimetrico |

> **IMPORTANTE**: `GOTRUE_JWT_SECRET` DEBE ser identico al `JWT_SECRET` global usado por PostgREST y demas servicios. Si difieren, los tokens no se verifican correctamente.

### 1.5 Email/Password Authentication

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_EXTERNAL_EMAIL_ENABLED` | bool | `true` | Habilitar auth por email |
| `GOTRUE_EXTERNAL_EMAIL_MAGIC_LINK_ENABLED` | bool | `true` | Habilitar magic links |
| `GOTRUE_EXTERNAL_EMAIL_AUTHORIZED_ADDRESSES` | string | `[]` | Restringir a emails especificos |

### 1.6 SMTP / Email Configuration

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_SMTP_HOST` | string | **Required** | SMTP server. Para Resend: `smtp.resend.com` |
| `GOTRUE_SMTP_PORT` | int | `587` | Puerto SMTP. Para Resend: `465` (SSL) o `587` (TLS) |
| `GOTRUE_SMTP_USER` | string | - | Usuario SMTP. Para Resend: `resend` |
| `GOTRUE_SMTP_PASS` | string | - | Password SMTP. Para Resend: tu API key (`re_xxx`) |
| `GOTRUE_SMTP_ADMIN_EMAIL` | string | **Required** | Email "From". Ej: `noreply@skapara.com` |
| `GOTRUE_SMTP_SENDER_NAME` | string | - | Nombre del sender. Ej: `SKAPARA` |
| `GOTRUE_SMTP_MAX_FREQUENCY` | duration | - | Tiempo minimo entre emails al mismo usuario |
| `GOTRUE_SMTP_HEADERS` | json | - | Headers SMTP custom (JSON) |
| `GOTRUE_SMTP_LOGGING_ENABLED` | bool | `false` | Log transacciones SMTP |

### 1.7 Mailer Configuration

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_MAILER_AUTOCONFIRM` | bool | `false` | Skip confirmacion por email (para dev) |
| `GOTRUE_MAILER_ALLOW_UNVERIFIED_EMAIL_SIGN_INS` | bool | `false` | Permitir login sin verificar |
| `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED` | bool | `true` | Confirmar en ambos emails al cambiar |
| `GOTRUE_MAILER_OTP_EXP` | uint | - | Expiracion OTP en segundos |
| `GOTRUE_MAILER_OTP_LENGTH` | int | - | Longitud del OTP |

### 1.8 Email Templates

Los templates se configuran via URL (el servicio los descarga). Se pueden hostear como archivos estaticos.

| Variable | Tipo | Descripcion |
|---|---|---|
| `GOTRUE_MAILER_TEMPLATES_CONFIRMATION` | string | Template de confirmacion de signup |
| `GOTRUE_MAILER_TEMPLATES_RECOVERY` | string | Template de reset password |
| `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK` | string | Template de magic link |
| `GOTRUE_MAILER_TEMPLATES_INVITE` | string | Template de invitacion |
| `GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE` | string | Template de cambio de email |
| `GOTRUE_MAILER_TEMPLATES_REAUTHENTICATION` | string | Template de reautenticacion |
| `GOTRUE_MAILER_TEMPLATES_PASSWORD_CHANGED_NOTIFICATION` | string | Notificacion de cambio de password |
| `GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGED_NOTIFICATION` | string | Notificacion de cambio de email |

**Variables disponibles en templates HTML:**:
- `{{ .ConfirmationURL }}` - URL de confirmacion completa
- `{{ .Token }}` - Token/OTP
- `{{ .TokenHash }}` - Hash del token
- `{{ .SiteURL }}` - URL base del sitio
- `{{ .Email }}` - Email del usuario
- `{{ .Data }}` - Datos custom del usuario

**Template caching**:

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_MAILER_TEMPLATE_MAX_SIZE` | int | `1000000` | Tamano maximo en bytes |
| `GOTRUE_MAILER_TEMPLATE_MAX_AGE` | duration | `10m` | Validez del cache |
| `GOTRUE_MAILER_TEMPLATE_RETRY_INTERVAL` | duration | `10s` | Reintento si falla fetch |
| `GOTRUE_MAILER_TEMPLATE_RELOADING_ENABLED` | bool | `false` | Recargar en background |

### 1.9 Email Subjects

| Variable | Default |
|---|---|
| `GOTRUE_MAILER_SUBJECTS_CONFIRMATION` | "Confirm Your Signup" |
| `GOTRUE_MAILER_SUBJECTS_RECOVERY` | "Reset Your Password" |
| `GOTRUE_MAILER_SUBJECTS_MAGIC_LINK` | "Your Magic Link" |
| `GOTRUE_MAILER_SUBJECTS_EMAIL_CHANGE` | "Confirm Email Change" |
| `GOTRUE_MAILER_SUBJECTS_INVITE` | "You have been invited" |
| `GOTRUE_MAILER_SUBJECTS_REAUTHENTICATION` | "Confirm reauthentication" |
| `GOTRUE_MAILER_SUBJECTS_PASSWORD_CHANGED_NOTIFICATION` | "Your password has been changed" |
| `GOTRUE_MAILER_SUBJECTS_EMAIL_CHANGED_NOTIFICATION` | "Your email address has been changed" |

### 1.10 Email URL Paths

| Variable | Default | Descripcion |
|---|---|---|
| `GOTRUE_MAILER_URLPATHS_CONFIRMATION` | `/verify` | Path para confirmacion |
| `GOTRUE_MAILER_URLPATHS_RECOVERY` | `/verify` | Path para recovery |
| `GOTRUE_MAILER_URLPATHS_INVITE` | `/verify` | Path para invitacion |
| `GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE` | `/verify` | Path para cambio de email |

> **NOTA**: En el docker-compose de Supabase, estos paths por defecto son `/auth/v1/verify` para que pasen por Kong. Ajustar segun la ruta de callback de tu app.

### 1.11 Email Notifications (Opcionales)

| Variable | Default | Descripcion |
|---|---|---|
| `GOTRUE_MAILER_NOTIFICATIONS_PASSWORD_CHANGED_ENABLED` | `false` | Notificar cambio de password |
| `GOTRUE_MAILER_NOTIFICATIONS_EMAIL_CHANGED_ENABLED` | `false` | Notificar cambio de email |
| `GOTRUE_MAILER_NOTIFICATIONS_PHONE_CHANGED_ENABLED` | `false` | Notificar cambio de telefono |
| `GOTRUE_MAILER_NOTIFICATIONS_IDENTITY_LINKED_ENABLED` | `false` | Notificar identidad vinculada |
| `GOTRUE_MAILER_NOTIFICATIONS_MFA_FACTOR_ENROLLED_ENABLED` | `false` | Notificar MFA enrollment |

### 1.12 Password Security

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_PASSWORD_MIN_LENGTH` | int | `6` | Longitud minima. **Recomendado: 8+** |
| `GOTRUE_PASSWORD_REQUIRED_CHARACTERS` | string | - | Sets requeridos (ej: `abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789`) |
| `GOTRUE_PASSWORD_HIBP_ENABLED` | bool | `false` | Verificar contra breach database (Have I Been Pwned) |
| `GOTRUE_PASSWORD_HIBP_FAIL_CLOSED` | bool | `false` | Rechazar si HIBP no disponible |

### 1.13 Multi-Factor Authentication (MFA)

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_MFA_CHALLENGE_EXPIRY_DURATION` | float64 | `300` | Expiracion del challenge en segundos |
| `GOTRUE_MFA_FACTOR_EXPIRY_DURATION` | duration | `300s` | Validez del factor |
| `GOTRUE_MFA_RATE_LIMIT_CHALLENGE_AND_VERIFY` | float64 | `15` | Requests por periodo |
| `GOTRUE_MFA_MAX_ENROLLED_FACTORS` | float64 | `10` | Max factores por usuario |
| `GOTRUE_MFA_MAX_VERIFIED_FACTORS` | int | `10` | Max factores verificados |

**TOTP (Authenticator App)**:

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_MFA_TOTP_ENROLL_ENABLED` | bool | `true` | Permitir enrollment TOTP |
| `GOTRUE_MFA_TOTP_VERIFY_ENABLED` | bool | `true` | Permitir verificacion TOTP |

**Phone MFA**:

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_MFA_PHONE_ENROLL_ENABLED` | bool | `false` | Permitir enrollment por telefono |
| `GOTRUE_MFA_PHONE_VERIFY_ENABLED` | bool | `false` | Permitir verificacion por telefono |

**WebAuthn (Passkeys/FIDO2)**:

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_MFA_WEB_AUTHN_ENROLL_ENABLED` | bool | `false` | Permitir enrollment WebAuthn |
| `GOTRUE_MFA_WEB_AUTHN_VERIFY_ENABLED` | bool | `false` | Permitir verificacion WebAuthn |

### 1.14 CAPTCHA Configuration

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_SECURITY_CAPTCHA_ENABLED` | bool | `false` | Habilitar CAPTCHA |
| `GOTRUE_SECURITY_CAPTCHA_PROVIDER` | string | `hcaptcha` | Provider: `hcaptcha` o `turnstile` |
| `GOTRUE_SECURITY_CAPTCHA_SECRET` | string | - | Secret key del provider CAPTCHA |
| `GOTRUE_SECURITY_CAPTCHA_TIMEOUT` | duration | - | Timeout de verificacion |

> **Para SKAPARA**: Ya usamos Turnstile. Configurar `GOTRUE_SECURITY_CAPTCHA_PROVIDER=turnstile` y `GOTRUE_SECURITY_CAPTCHA_SECRET` con la secret key de Cloudflare.

### 1.15 Session Configuration

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_SESSIONS_TIMEBOX` | duration | - | Tiempo maximo de sesion (absolute) |
| `GOTRUE_SESSIONS_INACTIVITY_TIMEOUT` | duration | - | Timeout por inactividad |
| `GOTRUE_SESSIONS_SINGLE_PER_USER` | bool | `false` | Solo una sesion por usuario |
| `GOTRUE_SESSIONS_TAGS` | string | `[]` | Tags custom de sesion |

### 1.16 Rate Limiting (Built-in)

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_RATE_LIMIT_HEADER` | string | - | Header para tracking (ej: `X-Forwarded-For`) |
| `GOTRUE_RATE_LIMIT_EMAIL_SENT` | rate | `30` | Emails por hora |
| `GOTRUE_RATE_LIMIT_SMS_SENT` | rate | `30` | SMS por hora |
| `GOTRUE_RATE_LIMIT_VERIFY` | float64 | `30` | Requests de verificacion |
| `GOTRUE_RATE_LIMIT_TOKEN_REFRESH` | float64 | `150` | Token refresh requests |
| `GOTRUE_RATE_LIMIT_SSO` | float64 | `30` | Requests SSO |
| `GOTRUE_RATE_LIMIT_ANONYMOUS_USERS` | float64 | `30` | Creacion de anon users |
| `GOTRUE_RATE_LIMIT_OTP` | float64 | `30` | Generacion de OTP |

> **NOTA**: Estos son rate limits INTERNOS de GoTrue. Nuestros rate limits custom (5/15min login, 3/60min register) se aplican ADEMAS a nivel de app en el middleware/API.

### 1.17 Refresh Token Security

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED` | bool | `true` | Habilitar rotacion de tokens |
| `GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL` | int | `0` | Grace period (segundos) para uso concurrente |

### 1.18 OAuth Providers

Para cada provider, las variables siguen el patron `GOTRUE_EXTERNAL_{PROVIDER}_*`:

**Providers soportados**: APPLE, AZURE, BITBUCKET, DISCORD, FACEBOOK, FIGMA, GITHUB, GITLAB, GOOGLE, KAKAO, KEYCLOAK, LINKEDIN_OIDC, NOTION, SLACK_OIDC, SPOTIFY, TWITCH, TWITTER, WORKOS, ZOOM

| Sufijo | Tipo | Descripcion |
|---|---|---|
| `_ENABLED` | bool | Habilitar/deshabilitar |
| `_CLIENT_ID` | string | OAuth client ID |
| `_SECRET` | string | OAuth client secret |
| `_REDIRECT_URI` | string | Callback URI: `https://<domain>/auth/v1/callback` |
| `_URL` | string | URL base del provider (GitLab, Keycloak) |
| `_SKIP_NONCE_CHECK` | bool | Bypass OIDC nonce (no recomendado) |

**Ejemplo Google OAuth**:
```env
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOTRUE_EXTERNAL_GOOGLE_SECRET=xxx
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://api.skapara.com/auth/v1/callback
```

**Ejemplo GitHub OAuth**:
```env
GOTRUE_EXTERNAL_GITHUB_ENABLED=true
GOTRUE_EXTERNAL_GITHUB_CLIENT_ID=xxx
GOTRUE_EXTERNAL_GITHUB_SECRET=xxx
GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI=https://api.skapara.com/auth/v1/callback
```

### 1.19 Anonymous Users

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED` | bool | `false` | Permitir cuentas anonimas |

### 1.20 Auth Hooks

Hooks permiten custom logic en puntos clave del flujo de auth. Pueden apuntar a URLs HTTP(S) o funciones PostgreSQL (`pg-functions://`).

**Hook types**: `CUSTOM_ACCESS_TOKEN`, `SEND_EMAIL`, `SEND_SMS`, `PASSWORD_VERIFICATION_ATTEMPT`, `MFA_VERIFICATION_ATTEMPT`

Para cada hook `{TYPE}`:

| Variable | Tipo | Descripcion |
|---|---|---|
| `GOTRUE_HOOK_{TYPE}_ENABLED` | bool | Habilitar hook |
| `GOTRUE_HOOK_{TYPE}_URI` | string | Endpoint: HTTP(S) URL o `pg-functions://postgres/public/function_name` |
| `GOTRUE_HOOK_{TYPE}_SECRET` | string | Secret para signing |

**Ejemplo: Custom email sending via hook (usar Resend directamente)**:
```env
GOTRUE_HOOK_SEND_EMAIL_ENABLED=true
GOTRUE_HOOK_SEND_EMAIL_URI=pg-functions://postgres/public/send_email_hook
GOTRUE_HOOK_SEND_EMAIL_SECRET=v1,whsec_xxx
```

### 1.21 SAML / SSO

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_SAML_ENABLED` | bool | `false` | Habilitar SAML |
| `GOTRUE_SAML_PRIVATE_KEY` | string | - | RSA private key (base64) |
| `GOTRUE_SAML_SIGNING_CERT` | string | - | Certificado X.509 |
| `GOTRUE_SAML_API_BASE` | string | - | Base URL para SAML endpoints |

### 1.22 Database Encryption

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPT` | bool | `false` | Encriptar datos nuevos |
| `GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPTION_KEY_ID` | string | - | ID de la key activa |
| `GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPTION_KEY` | string | - | Key base64 256-bit |

### 1.23 Logging & Observability

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `LOG_LEVEL` | string | `info` | Nivel: panic/fatal/error/warn/info/debug |
| `GOTRUE_TRACING_ENABLED` | bool | `false` | Distributed tracing (OpenTelemetry) |
| `GOTRUE_METRICS_ENABLED` | bool | `false` | Metricas (Prometheus/OTEL) |
| `GOTRUE_METRICS_EXPORTER` | string | - | `opentelemetry` o `prometheus` |

### 1.24 CORS

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `GOTRUE_CORS_ALLOWED_HEADERS` | string | `[]` | Headers CORS adicionales |

---

## 2. PostgREST API Configuration

PostgREST expone tablas y funciones PostgreSQL como API REST. En Supabase self-hosted, es el servicio `rest`.

### 2.1 Database Connection

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `PGRST_DB_URI` | string | - | Connection string PostgreSQL |
| `PGRST_DB_SCHEMAS` | string | `public` | Schemas expuestos (comma-separated). Default en Supabase: `public,storage,graphql_public` |
| `PGRST_DB_EXTRA_SEARCH_PATH` | string | `public` | Schemas en search_path |
| `PGRST_DB_ANON_ROLE` | string | - | Role para requests sin auth. En Supabase: `anon` |
| `PGRST_DB_POOL` | int | `10` | Max conexiones en pool |
| `PGRST_DB_POOL_ACQUISITION_TIMEOUT` | int | `10` | Timeout para adquirir conexion (s) |
| `PGRST_DB_POOL_MAX_IDLETIME` | int | `30` | Tiempo idle antes de cerrar (s) |
| `PGRST_DB_POOL_MAX_LIFETIME` | int | `1800` | Tiempo maximo de vida (s) |
| `PGRST_DB_POOL_AUTOMATIC_RECOVERY` | bool | `true` | Reintentar conexiones |
| `PGRST_DB_MAX_ROWS` | int | unlimited | Hard limit de filas por request |
| `PGRST_DB_PRE_REQUEST` | string | - | Funcion pre-request (schema-qualified) |
| `PGRST_DB_TX_END` | string | `commit` | Fin de transaccion: `commit`, `rollback`, `commit-allow-override` |
| `PGRST_DB_AGGREGATES_ENABLED` | bool | `false` | Habilitar funciones agregadas |
| `PGRST_DB_PLAN_ENABLED` | bool | `false` | Permitir EXPLAIN via header |
| `PGRST_DB_PREPARED_STATEMENTS` | bool | `true` | Usar prepared statements |

### 2.2 JWT / Security

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `PGRST_JWT_SECRET` | string | - | Secret para verificar JWT (min 32 chars). Debe = `JWT_SECRET` global |
| `PGRST_JWT_SECRET_IS_BASE64` | bool | `false` | Tratar secret como base64 |
| `PGRST_JWT_AUD` | string | - | Validar JWT audience claim |
| `PGRST_JWT_ROLE_CLAIM_KEY` | string | `.role` | Key path para extraer role del JWT |
| `PGRST_JWT_CACHE_MAX_ENTRIES` | int | `1000` | Max JWT cacheados (0 = disabled) |

### 2.3 Server Settings

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `PGRST_SERVER_HOST` | string | `!4` | Bind address |
| `PGRST_SERVER_PORT` | int | `3000` | Puerto interno |
| `PGRST_SERVER_CORS_ALLOWED_ORIGINS` | string | - | Origenes CORS permitidos |
| `PGRST_SERVER_TIMING_ENABLED` | bool | `false` | Header Server-Timing |

### 2.4 Admin / OpenAPI

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `PGRST_ADMIN_SERVER_PORT` | int | - | Puerto de admin server |
| `PGRST_OPENAPI_MODE` | string | `follow-privileges` | Modo OpenAPI |
| `PGRST_OPENAPI_SERVER_PROXY_URI` | string | - | URL base para OpenAPI |

### 2.5 Logging

| Variable | Tipo | Default | Descripcion |
|---|---|---|---|
| `PGRST_LOG_LEVEL` | string | `error` | Nivel: crit/error/warn/info/debug |

### 2.6 App Settings (Custom)

Variables con prefijo `PGRST_APP_SETTINGS_*` se pasan como settings a PostgreSQL, accesibles via `current_setting('app.settings.xxx')` en funciones SQL.

```env
# Ejemplo: pasar API keys a funciones SQL
PGRST_APP_SETTINGS_STRIPE_KEY=sk_xxx
# Accesible como: current_setting('app.settings.stripe_key')
```

### 2.7 Configuracion Recomendada para SKAPARA

```env
PGRST_DB_URI=postgresql://authenticator:${POSTGRES_PASSWORD}@db:5432/postgres
PGRST_DB_SCHEMAS=public,storage,graphql_public
PGRST_DB_ANON_ROLE=anon
PGRST_DB_MAX_ROWS=1000
PGRST_DB_POOL=20
PGRST_JWT_SECRET=${JWT_SECRET}
PGRST_LOG_LEVEL=warn
```

---

## 3. Realtime Configuration

Realtime proporciona WebSockets para Broadcast, Presence, y Postgres Changes.

### 3.1 Variables de Entorno

| Variable | Required | Descripcion |
|---|---|---|
| `PORT` | Si | Puerto para conexiones WebSocket |
| `DB_HOST` | Si | Host de la base de datos |
| `DB_PORT` | Si | Puerto de la base de datos |
| `DB_USER` | Si | Usuario de la base de datos |
| `DB_PASSWORD` | Si | Password de la base de datos |
| `DB_NAME` | Si | Nombre de la base de datos |
| `DB_SSL` | Si | SSL para conexion a DB |
| `DB_IP_VERSION` | Si | IPv4 o IPv6 para DB |
| `SLOT_NAME` | Si | Nombre unico para WAL tracking |
| `TEMPORARY_SLOT` | Si | Slot temporal o permanente |
| `REALTIME_IP_VERSION` | Si | IPv4 o IPv6 para binding |
| `PUBLICATIONS` | Si | JSON array de publication names |
| `SECURE_CHANNELS` | Si | Habilitar verificacion JWT en canales |
| `JWT_SECRET` | Si | Secret para verificar JWT |
| `JWT_CLAIM_VALIDATORS` | Si | Key/value para validar JWT claims |
| `EXPOSE_METRICS` | Si | Exponer metricas Prometheus en `/metrics` |
| `REPLICATION_MODE` | Si | Modo de replicacion |
| `REPLICATION_POLL_INTERVAL` | Si | Intervalo de polling (ms) |
| `SUBSCRIPTION_SYNC_INTERVAL` | Si | Intervalo de sync de suscriptores |
| `MAX_CHANGES` | Si | Soft limit de cambios por poll |
| `MAX_RECORD_BYTES` | Si | Tamano maximo de WAL record |
| `DB_RECONNECT_BACKOFF_MIN` | Si | Backoff minimo de reconexion |
| `DB_RECONNECT_BACKOFF_MAX` | Si | Backoff maximo de reconexion |

### 3.2 Modos de Operacion

**Broadcast**: Mensajes efimeros entre clientes conectados. No toca la DB.

**Presence**: Estado online/offline de usuarios. Mantenido en memoria.

**Postgres Changes**: Cambios de DB en tiempo real via WAL (Write-Ahead Log).

### 3.3 Configuracion Recomendada

```env
# Realtime
PORT=4000
DB_HOST=db
DB_PORT=5432
DB_USER=supabase_admin
DB_PASSWORD=${POSTGRES_PASSWORD}
DB_NAME=postgres
DB_SSL=false
SLOT_NAME=supabase_realtime_rls
TEMPORARY_SLOT=true
REALTIME_IP_VERSION=IPv4
PUBLICATIONS=["supabase_realtime"]
SECURE_CHANNELS=true
JWT_SECRET=${JWT_SECRET}
MAX_CHANGES=100
MAX_RECORD_BYTES=1048576
```

### 3.4 Consideraciones para Self-Hosted

- **Max connections**: Se configura via `max_concurrent_users` en el tenant record de Realtime
- **Memory**: Default 50MB heap limit per WebSocket process
- **Connection pool**: Default 5 DB connections, max wait 5000ms
- **SECRET_KEY_BASE**: Minimo 64 caracteres, usado para encriptar comunicacion Realtime

---

## 4. Storage API Configuration

### 4.1 Variables Core

| Variable | Tipo | Descripcion |
|---|---|---|
| `ANON_KEY` | string | JWT con role `anon` |
| `SERVICE_KEY` | string | JWT con role `service_role` (bypass RLS) |
| `TENANT_ID` | string | ID del tenant de Storage |
| `DATABASE_URL` | string | Connection string PostgreSQL |
| `POSTGREST_URL` | string | URL del PostgREST server |
| `PGRST_JWT_SECRET` | string | JWT secret (debe coincidir) |
| `FILE_SIZE_LIMIT` | int | Limite de tamano de archivo (bytes) |
| `STORAGE_BACKEND` | string | Backend: `file` o `s3` |
| `FILE_STORAGE_BACKEND_PATH` | string | Path cuando backend = `file` |

### 4.2 S3-Compatible Backend

| Variable | Tipo | Descripcion |
|---|---|---|
| `STORAGE_BACKEND` | string | `s3` |
| `GLOBAL_S3_BUCKET` | string | Nombre del bucket S3 |
| `GLOBAL_S3_ENDPOINT` | string | Endpoint S3 (para MinIO, R2, etc.) |
| `REGION` | string | Region del bucket |
| `AWS_ACCESS_KEY_ID` | string | Access key |
| `AWS_SECRET_ACCESS_KEY` | string | Secret key |

### 4.3 S3 Protocol Endpoint

Para acceso S3-compatible directo (rclone, aws cli, etc.):

| Variable | Tipo | Descripcion |
|---|---|---|
| `S3_PROTOCOL_ACCESS_KEY_ID` | string | Access key para endpoint S3 |
| `S3_PROTOCOL_ACCESS_KEY_SECRET` | string | Secret key para endpoint S3 |

### 4.4 Multi-Tenant

| Variable | Tipo | Descripcion |
|---|---|---|
| `IS_MULTITENANT` | bool | Modo multi-tenant |
| `MULTITENANT_DATABASE_URL` | string | DB URL multi-tenant |
| `ADMIN_API_KEYS` | string | API key para admin endpoints |
| `ENCRYPTION_KEY` | string | Key para encriptar secretos |

### 4.5 Opciones de Backend

| Backend | Pros | Contras |
|---|---|---|
| **Local filesystem** (`file`) | Simple, sin costo extra | No escala, backups manuales |
| **MinIO** (incluido en Docker) | S3-compatible, self-hosted | Requiere mantenimiento |
| **AWS S3** | Escalable, durable | Costo por uso |
| **Cloudflare R2** | Sin egress fees, S3-compatible | Requiere cuenta Cloudflare |

### 4.6 Bucket Policies

Las policies de buckets se configuran via RLS en la tabla `storage.objects`. Ejemplos:

```sql
-- Public read, authenticated upload
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'public');

CREATE POLICY "Authenticated Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'uploads'
    AND auth.role() = 'authenticated'
  );
```

### 4.7 Configuracion Recomendada para SKAPARA

```env
STORAGE_BACKEND=s3  # o file para desarrollo
GLOBAL_S3_BUCKET=skapara-storage
GLOBAL_S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com  # Cloudflare R2 recomendado
REGION=auto
FILE_SIZE_LIMIT=52428800  # 50MB
```

---

## 5. Edge Functions (Deno Runtime)

### 5.1 Estado: Beta

> **IMPORTANTE**: Self-hosted Edge Functions estan en BETA. Habra breaking changes.

### 5.2 Docker Configuration

```yaml
# docker-compose.yml snippet
functions:
  image: supabase/edge-runtime:v1.58.6
  volumes:
    - ./volumes/functions:/home/deno/functions:Z
  environment:
    JWT_SECRET: ${JWT_SECRET}
    SUPABASE_URL: http://kong:8000
    SUPABASE_ANON_KEY: ${ANON_KEY}
    SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
    SUPABASE_DB_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
    VERIFY_JWT: ${FUNCTIONS_VERIFY_JWT:-false}
  command:
    - start
    - --main-service
    - /home/deno/functions/main
  restart: unless-stopped
```

### 5.3 Deployment de Funciones

Las funciones se colocan en `volumes/functions/`:

```
volumes/functions/
  main/           # Main service (router)
    index.ts
  hello/          # Function: /functions/v1/hello
    index.ts
  stripe-webhook/ # Function: /functions/v1/stripe-webhook
    index.ts
```

### 5.4 Variables de Entorno

| Variable | Tipo | Descripcion |
|---|---|---|
| `JWT_SECRET` | string | Para verificar JWT en requests |
| `SUPABASE_URL` | string | URL interna de Supabase (via Kong) |
| `SUPABASE_ANON_KEY` | string | Anon key para client |
| `SUPABASE_SERVICE_ROLE_KEY` | string | Service role key |
| `SUPABASE_DB_URL` | string | Connection string directa a DB |
| `VERIFY_JWT` / `FUNCTIONS_VERIFY_JWT` | bool | Verificar JWT en requests (default: false) |

### 5.5 Alternativas si No Se Usan Edge Functions

Dado que SKAPARA ya tiene toda la logica en API routes de Next.js y PodClaw (FastAPI), las Edge Functions NO son necesarias. Las alternativas son:

1. **Next.js API Routes** (ya implementado): `/api/webhooks/*`, `/api/cron/*`
2. **PodClaw FastAPI Bridge** (ya implementado): `/health`, agent operations
3. **PostgreSQL Functions** (`pg-functions://`): Para hooks de auth

---

## 6. Kong API Gateway

Kong es el gateway que unifica todos los servicios Supabase en un solo endpoint.

### 6.1 Routing

| Path | Servicio Backend | Descripcion |
|---|---|---|
| `/rest/v1/*` | PostgREST | API REST (tablas, funciones) |
| `/auth/v1/*` | GoTrue | Autenticacion |
| `/realtime/v1/*` | Realtime | WebSocket |
| `/storage/v1/*` | Storage | Archivos y objetos |
| `/functions/v1/*` | Edge Runtime | Edge Functions |
| `/pg/*` | pg_meta | Schema inspection |
| `/` | Studio | Dashboard (protegido por basic auth) |

### 6.2 Variables

| Variable | Default | Descripcion |
|---|---|---|
| `KONG_HTTP_PORT` | `8000` | Puerto HTTP del gateway |
| `KONG_HTTPS_PORT` | `8443` | Puerto HTTPS del gateway |

### 6.3 Configuracion (kong.yml)

Kong usa configuracion declarativa (DB-less mode). El archivo se genera desde un template con sustitucion de env vars:

```yaml
# Ejemplo de route en kong.yml
services:
  - name: auth-v1
    url: http://auth:8081/
    routes:
      - name: auth-v1-route
        strip_path: true
        paths:
          - /auth/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false
```

### 6.4 Integracion con Caddy

En el stack de SKAPARA, Caddy ya actua como reverse proxy. Las opciones son:

**Opcion A: Caddy -> Kong -> Servicios Supabase** (recomendado)
```
Internet -> Caddy (443) -> Kong (8000) -> Auth/REST/Realtime/Storage
                        -> Frontend (3000)
                        -> Admin (3001)
                        -> PodClaw (8000)
```

**Opcion B: Caddy -> Servicios Supabase directamente** (sin Kong)
```
Internet -> Caddy (443) -> /api/auth/* -> Auth (8081)
                        -> /api/rest/* -> PostgREST (3000)
                        -> /api/realtime/* -> Realtime (4000)
                        -> Frontend (3000)
```

> **Recomendacion**: Usar Opcion A (Caddy -> Kong). Kong maneja CORS, key-auth, y routing interno. Caddy maneja TLS y routing de alto nivel.

---

## 7. Database Webhooks (pg_net)

### 7.1 Como Funcionan

Database Webhooks son un wrapper sobre triggers de PostgreSQL que usa la extension `pg_net` para hacer HTTP requests asincronos. No bloquean las transacciones de la DB.

### 7.2 Habilitacion

La extension `pg_net` debe estar en `shared_preload_libraries` del `postgresql.conf`:

```
shared_preload_libraries = 'pg_net'
```

Luego habilitar la extension:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 7.3 Crear un Webhook via SQL

```sql
-- Webhook que dispara en INSERT en la tabla orders
CREATE TRIGGER "order_created_webhook"
  AFTER INSERT ON "public"."orders"
  FOR EACH ROW
  EXECUTE FUNCTION "supabase_functions"."http_request"(
    'https://skapara.com/api/webhooks/order-created',  -- URL destino
    'POST',                                              -- Metodo HTTP
    '{"Content-Type":"application/json","X-Webhook-Secret":"your-secret"}',  -- Headers
    '{}',                                                -- Params (vacio)
    '5000'                                               -- Timeout ms
  );
```

### 7.4 Payload Automatico

El payload se genera automaticamente basado en el tipo de evento:

**INSERT**:
```json
{
  "type": "INSERT",
  "table": "orders",
  "schema": "public",
  "record": { "id": "uuid", "status": "pending", ... },
  "old_record": null
}
```

**UPDATE**:
```json
{
  "type": "UPDATE",
  "table": "orders",
  "schema": "public",
  "record": { "id": "uuid", "status": "shipped", ... },
  "old_record": { "id": "uuid", "status": "pending", ... }
}
```

**DELETE**:
```json
{
  "type": "DELETE",
  "table": "orders",
  "schema": "public",
  "record": null,
  "old_record": { "id": "uuid", "status": "cancelled", ... }
}
```

### 7.5 Llamadas HTTP Directas con pg_net

```sql
-- POST request asincrono
SELECT net.http_post(
  url := 'https://api.example.com/webhook',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer xxx"}'::jsonb,
  body := '{"event": "order.created", "data": {}}'::jsonb
);

-- GET request
SELECT net.http_get(
  url := 'https://api.example.com/status',
  headers := '{}'::jsonb
);
```

### 7.6 Monitoring

Los logs de llamadas HTTP se almacenan en `net._http_response` durante 6 horas:

```sql
SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;
```

### 7.7 Limitaciones

- Capacidad: ~200 requests/segundo
- Responses se guardan solo 6 horas
- **NO** poner triggers en `net._http_response` o `net.http_request_queue` (causa loop infinito)
- En self-hosted, usar `host.docker.internal` en vez de `localhost` para servicios del host

### 7.8 Signing / Verificacion

pg_net NO incluye signing nativo. Para verificar webhooks, opciones:

1. **Shared secret en header**: Incluir un secret en los headers del webhook y verificar en el receptor
2. **HMAC signing en funcion SQL**: Crear una funcion que compute HMAC y lo incluya en headers
3. **JWT en header**: Usar el `SERVICE_ROLE_KEY` como Bearer token

Ejemplo con shared secret:
```sql
CREATE TRIGGER "order_webhook"
  AFTER INSERT ON "public"."orders"
  FOR EACH ROW
  EXECUTE FUNCTION "supabase_functions"."http_request"(
    'https://skapara.com/api/webhooks/db/orders',
    'POST',
    '{"Content-Type":"application/json","X-Webhook-Secret":"${WEBHOOK_SECRET}"}',
    '{}',
    '5000'
  );
```

---

## 8. Imgproxy (Image Transformation)

### 8.1 Variables de Entorno

| Variable | Default | Descripcion |
|---|---|---|
| `IMGPROXY_BIND` | `:5001` | Bind address |
| `IMGPROXY_LOCAL_FILESYSTEM_ROOT` | `/` | Root para filesystem local |
| `IMGPROXY_USE_ETAG` | `true` | Habilitar ETags |
| `IMGPROXY_ENABLE_WEBP_DETECTION` | `true` | Detectar WebP support |
| `IMGPROXY_MAX_SRC_RESOLUTION` | `16.8` (MP) | Max resolucion de imagen source. Subir a `50` para imagenes grandes |

### 8.2 Integracion con Storage

Storage y Imgproxy comparten el mismo volumen de archivos. Storage proxea requests de transformacion a imgproxy:

```env
# En el servicio Storage
IMGPROXY_URL=http://imgproxy:5001
```

### 8.3 Docker Compose

```yaml
imgproxy:
  image: darthsim/imgproxy:v3.24
  environment:
    IMGPROXY_BIND: ":5001"
    IMGPROXY_LOCAL_FILESYSTEM_ROOT: "/"
    IMGPROXY_USE_ETAG: "true"
    IMGPROXY_ENABLE_WEBP_DETECTION: "true"
  volumes:
    - ./volumes/storage:/var/lib/storage:z
  restart: unless-stopped
```

### 8.4 Relevancia para SKAPARA

Actualmente las imagenes de productos se sirven desde Printful/Printify CDN. Imgproxy seria util si:
- Se almacenan imagenes de diseno en Storage
- Se quiere servir thumbnails/previews optimizados
- Se migran imagenes a storage propio (S3/R2)

---

## 9. Supavisor (Connection Pooling)

### 9.1 Variables

| Variable | Default | Descripcion |
|---|---|---|
| `POOLER_PROXY_PORT_TRANSACTION` | `6543` | Puerto para transaction mode pooling |
| `POOLER_DEFAULT_POOL_SIZE` | `20` | Max conexiones PostgreSQL por pool |
| `POOLER_MAX_CLIENT_CONN` | `100` | Max conexiones cliente por pool |
| `POOLER_TENANT_ID` | - | Tenant ID unico |
| `POOLER_DB_POOL_SIZE` | `5` | Pool interno para metadata |
| `SECRET_KEY_BASE` | - | Key de encripcion (min 64 chars) |
| `VAULT_ENC_KEY` | - | Key de encripcion (exactamente 32 chars) |

### 9.2 Modos de Conexion

- **Session mode** (puerto 5432): Conexion directa, cada cliente tiene su propia conexion DB
- **Transaction mode** (puerto 6543): Pool compartido, conexiones se reciclan entre transacciones

### 9.3 Recomendacion

Para SKAPARA, usar transaction mode (6543) para la mayoria de operaciones. Session mode solo si se necesitan features como `LISTEN/NOTIFY`, prepared statements con nombre, o operaciones de sesion completa.

---

## 10. Client-Side Changes

### 10.1 Que Cambia en el Frontend

Al migrar de Supabase Cloud a self-hosted, los cambios en el codigo del cliente son **minimos**. El SDK `@supabase/supabase-js` funciona identicamente.

**Lo que cambia**: Solo las URLs y las API keys.

### 10.2 Variables de Entorno a Actualizar

| Variable Actual | Cloud | Self-Hosted |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | `https://api.skapara.com` (o `https://skapara.com:8000`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | JWT de Supabase Cloud | JWT generado con tu `JWT_SECRET` |
| `SUPABASE_URL` | `https://xxx.supabase.co` | `https://api.skapara.com` |
| `SUPABASE_SERVICE_KEY` | Service role key de Cloud | JWT generado con tu `JWT_SECRET` y role `service_role` |

### 10.3 Generacion de Keys

Las ANON_KEY y SERVICE_ROLE_KEY son JWTs firmados con tu `JWT_SECRET`:

```bash
# Generar JWT_SECRET
JWT_SECRET=$(openssl rand -base64 48)

# Generar ANON_KEY (role: anon)
# Payload: {"role":"anon","iss":"supabase","iat":1700000000,"exp":1858000000}
# Firmar con JWT_SECRET usando HS256

# Generar SERVICE_ROLE_KEY (role: service_role)
# Payload: {"role":"service_role","iss":"supabase","iat":1700000000,"exp":1858000000}
# Firmar con JWT_SECRET usando HS256
```

Supabase provee un script: `sh ./utils/generate-keys.sh`

### 10.4 Codigo que NO Cambia

Los tres archivos de client de SKAPARA funcionan sin modificaciones:

**`frontend/src/lib/supabase.ts`** (anon client):
```typescript
// NO CHANGE NEEDED - solo actualizar env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL      // cambia el valor, no el codigo
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  // cambia el valor
createClient(supabaseUrl, supabaseAnonKey, { ... })
```

**`frontend/src/lib/supabase-admin.ts`** (service role client):
```typescript
// NO CHANGE NEEDED - solo actualizar env vars
const supabaseUrl = process.env.SUPABASE_URL         // cambia el valor
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY  // cambia el valor
createClient(supabaseUrl, supabaseServiceKey, { ... })
```

**`frontend/src/lib/supabase-server.ts`** (server client with user auth):
```typescript
// NO CHANGE NEEDED - solo actualizar env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
createClient(supabaseUrl, supabaseAnonKey, { ... })
```

### 10.5 Supabase JS Client Compatibility

- `@supabase/supabase-js` v2.x: Totalmente compatible con self-hosted
- No hay diferencia en la API del SDK entre cloud y self-hosted
- `createClient(url, key)` acepta cualquier URL (cloud o self-hosted)
- Los keys son JWTs estandar, no hay formato propietario

### 10.6 Realtime Client

El cliente Realtime tambien funciona sin cambios:

```typescript
// El SDK detecta la URL de realtime automaticamente desde la URL base
// Cloud: wss://xxx.supabase.co/realtime/v1
// Self-hosted: wss://api.skapara.com/realtime/v1
supabase.channel('orders').on('postgres_changes', ...).subscribe()
```

### 10.7 Storage Client

```typescript
// Funciona identicamente
const { data } = supabase.storage.from('designs').getPublicUrl('file.png')
// Cloud: https://xxx.supabase.co/storage/v1/object/public/designs/file.png
// Self-hosted: https://api.skapara.com/storage/v1/object/public/designs/file.png
```

### 10.8 Consideraciones Importantes

1. **URL consistency**: `NEXT_PUBLIC_SUPABASE_URL` DEBE apuntar al gateway Kong (o Caddy reverse-proxying a Kong), NO directamente a servicios individuales
2. **HTTPS obligatorio en produccion**: Los tokens se envian por HTTP header; sin HTTPS son interceptables
3. **CORS**: Kong maneja CORS automaticamente. Si Caddy esta delante, NO duplicar headers CORS
4. **Publishable/Secret keys**: En self-hosted solo hay `anon` y `service_role` JWTs. No hay "publishable key" separado como en cloud

---

## 11. Email Delivery Setup (Resend via SMTP)

### 11.1 SKAPARA ya usa Resend

Actualmente Resend se usa para transactional emails via API (no SMTP). En self-hosted GoTrue, necesitamos configurar SMTP para que GoTrue envie emails de auth (confirmacion, reset, magic link).

### 11.2 Configuracion SMTP para Resend

```env
# GoTrue SMTP -> Resend
GOTRUE_SMTP_HOST=smtp.resend.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=resend
GOTRUE_SMTP_PASS=${RESEND_API_KEY}  # re_xxx
GOTRUE_SMTP_ADMIN_EMAIL=noreply@skapara.com
GOTRUE_SMTP_SENDER_NAME=SKAPARA
GOTRUE_SMTP_MAX_FREQUENCY=60s
```

### 11.3 Resend SMTP Requirements

- **Puerto 465**: SSL/TLS (recomendado)
- **Puerto 587**: STARTTLS
- **Puerto 2465**: SSL/TLS (alternativo)
- **Username**: Siempre `resend` (literal)
- **Password**: Tu API key completa (`re_xxx`)
- **Dominio**: Debe estar verificado en Resend dashboard

### 11.4 Email Templates Custom

Opciones para personalizar templates:

**Opcion A: URLs a templates hosteados**
```env
# Hostear templates en el propio frontend
GOTRUE_MAILER_TEMPLATES_CONFIRMATION=https://skapara.com/email-templates/confirmation.html
GOTRUE_MAILER_TEMPLATES_RECOVERY=https://skapara.com/email-templates/recovery.html
GOTRUE_MAILER_TEMPLATES_MAGIC_LINK=https://skapara.com/email-templates/magic-link.html
```

**Opcion B: SEND_EMAIL Hook** (recomendado para SKAPARA)
```env
# Bypass SMTP de GoTrue, usar Resend API directamente via hook
GOTRUE_HOOK_SEND_EMAIL_ENABLED=true
GOTRUE_HOOK_SEND_EMAIL_URI=pg-functions://postgres/public/handle_send_email
GOTRUE_HOOK_SEND_EMAIL_SECRET=v1,whsec_xxx
```

Esto permite usar la API de Resend directamente con templates React/HTML custom, manteniendo el branding de SKAPARA.

### 11.5 Rate Limiting de Emails

```env
# GoTrue built-in
GOTRUE_RATE_LIMIT_EMAIL_SENT=30         # Max 30 emails/hora por usuario
GOTRUE_SMTP_MAX_FREQUENCY=60s           # Min 60s entre emails al mismo user

# Resend limits (plan)
# Free: 100 emails/dia, 1 email/segundo
# Pro: 50,000 emails/mes, 10 emails/segundo
```

### 11.6 Subjects Localizados

GoTrue no soporta localizacion nativa de subjects. Para multi-idioma (en/es/de), las opciones son:

1. **SEND_EMAIL Hook**: Detectar idioma del usuario (metadata) y enviar template localizado via Resend API
2. **Subjects neutrales**: Usar subjects simples que funcionen en todos los idiomas
3. **Emoji prefix**: Usar emojis universales en subjects

---

## 12. Webhook Migration Guide

### 12.1 Estado Actual de Webhooks en SKAPARA

| Webhook | Endpoint | Proveedor | Signing |
|---|---|---|---|
| Stripe | `/api/webhooks/stripe` | Stripe | `stripe-signature` header (HMAC) |
| Telegram | `/api/webhooks/telegram` | Telegram Bot API | Token validation |
| WhatsApp | `/api/webhooks/whatsapp` | Meta/WhatsApp | Token validation |
| POD Provider | `/api/webhooks/pod/[provider]` | Printful/Printify | Shared secret |
| Cache Invalidate | `/api/webhooks/cache-invalidate` | Internal | Shared secret |

### 12.2 Que Cambia con Self-Hosted

**Stripe Webhooks**: **NO CAMBIA**
- Stripe envia webhooks a tu dominio publico
- El endpoint sigue siendo `/api/webhooks/stripe`
- Solo cambiar el webhook URL en Stripe Dashboard si cambia el dominio
- `STRIPE_WEBHOOK_SECRET` se mantiene igual

**Telegram/WhatsApp Webhooks**: **NO CAMBIA**
- Estos webhooks van al frontend Next.js directamente
- Solo actualizar la URL en los respectivos dashboards

**POD Provider Webhooks**: **NO CAMBIA**
- Printful/Printify envian a tu dominio publico
- Actualizar URLs en dashboards de providers si cambia el dominio

**Database Webhooks (NUEVO)**:
- Con pg_net en self-hosted, se pueden crear triggers que hagan HTTP requests
- Util para notificar a PodClaw de cambios en DB sin polling

### 12.3 Nuevos Webhooks Posibles con Self-Hosted

Con acceso directo a PostgreSQL, se pueden crear webhooks de DB:

```sql
-- Notificar a PodClaw cuando se crea una orden
CREATE TRIGGER "notify_podclaw_new_order"
  AFTER INSERT ON "public"."orders"
  FOR EACH ROW
  EXECUTE FUNCTION "supabase_functions"."http_request"(
    'http://podclaw:8000/webhooks/order-created',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer ${PODCLAW_BRIDGE_AUTH_TOKEN}"}',
    '{}',
    '5000'
  );

-- Notificar cuando cambia el status de un producto
CREATE TRIGGER "notify_product_status_change"
  AFTER UPDATE OF status ON "public"."products"
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION "supabase_functions"."http_request"(
    'http://frontend:3000/api/webhooks/cache-invalidate',
    'POST',
    '{"Content-Type":"application/json","X-Webhook-Secret":"${CRON_SECRET}"}',
    '{}',
    '3000'
  );
```

### 12.4 Auth Webhooks (GoTrue Hooks)

GoTrue hooks permiten interceptar eventos de auth:

```env
# Hook para custom access token (agregar claims)
GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED=true
GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/public/custom_access_token
GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_SECRET=v1,whsec_xxx
```

```sql
-- Agregar role y store_id al JWT
CREATE OR REPLACE FUNCTION public.custom_access_token(event jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  claims := event->'claims';

  -- Lookup user role
  SELECT role INTO user_role FROM public.profiles WHERE id = (claims->>'sub')::uuid;

  -- Add custom claims
  claims := jsonb_set(claims, '{user_role}', to_jsonb(COALESCE(user_role, 'customer')));

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;
```

---

## 13. Auth Migration Checklist

### 13.1 Pre-Migration

- [ ] **Backup completo de Supabase Cloud** (users, profiles, tokens, sessions)
- [ ] **Export tabla `auth.users`** con todos los campos
- [ ] **Export tabla `auth.identities`** (si hay OAuth)
- [ ] **Export tabla `auth.mfa_factors`** (si hay MFA)
- [ ] **Export tabla `auth.sessions`** (opcional - los usuarios tendran que re-logear)
- [ ] **Export tabla `auth.refresh_tokens`** (opcional)
- [ ] **Documentar configuracion actual** de Supabase Cloud auth settings
- [ ] **Generar nuevos secrets** (`JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`)
- [ ] **Preparar SMTP** (verificar dominio en Resend)
- [ ] **Preparar templates de email** (si custom)

### 13.2 Infrastructure Setup

- [ ] **Agregar servicios a docker-compose.yml**: `db`, `auth`, `rest`, `realtime`, `storage`, `kong`
- [ ] **Configurar `.env`** con todas las variables de GoTrue
- [ ] **Configurar Kong routes** (auth/v1, rest/v1, etc.)
- [ ] **Configurar Caddy** para proxear a Kong
- [ ] **Configurar SSL/TLS** via Caddy
- [ ] **Verificar DNS** apuntando al VPS

### 13.3 Database Migration

- [ ] **Instalar PostgreSQL** con extensiones requeridas:
  - `pg_net` (webhooks)
  - `pgvector` (embeddings - ya usado)
  - `uuid-ossp` (UUIDs)
  - `pgjwt` (JWT generation)
- [ ] **Crear roles**: `anon`, `authenticated`, `service_role`, `authenticator`, `supabase_admin`
- [ ] **Aplicar migraciones** de schema auth
- [ ] **Importar datos** de auth.users (con password hashes)
- [ ] **Verificar RLS policies** estan activas
- [ ] **Crear publications** para Realtime (`supabase_realtime`)

### 13.4 Auth Configuration

- [ ] **SMTP funcional**: Enviar email de prueba
- [ ] **Turnstile CAPTCHA**: Configurar `GOTRUE_SECURITY_CAPTCHA_*`
- [ ] **Token expiry**: Configurar `GOTRUE_JWT_EXP=3600` (1h, igual que actual)
- [ ] **Password policy**: `GOTRUE_PASSWORD_MIN_LENGTH=8`
- [ ] **Refresh token rotation**: Verificar habilitado
- [ ] **Rate limits**: Configurar todos los `GOTRUE_RATE_LIMIT_*`
- [ ] **Email confirmacion**: `GOTRUE_MAILER_AUTOCONFIRM=false` en produccion
- [ ] **Redirect URLs**: Configurar `GOTRUE_SITE_URL` y `GOTRUE_URI_ALLOW_LIST`

### 13.5 Client-Side Updates

- [ ] **Actualizar `.env.local`** con nuevas URLs y keys
- [ ] **Rebuild frontend** (`docker compose build frontend`)
- [ ] **Verificar login/signup** funciona
- [ ] **Verificar token refresh** funciona
- [ ] **Verificar password reset** (email llega y link funciona)
- [ ] **Verificar Realtime** funciona (si se usa)

### 13.6 Webhook Updates

- [ ] **Stripe**: Actualizar webhook URL en Stripe Dashboard
- [ ] **Telegram**: Actualizar webhook URL via Bot API
- [ ] **WhatsApp**: Actualizar webhook URL en Meta Developer
- [ ] **Printful/Printify**: Actualizar webhook URLs

### 13.7 Post-Migration Verification

- [ ] **Login existente**: Usuarios pueden logear con password actual
- [ ] **Register nuevo**: Nuevos usuarios reciben email de confirmacion
- [ ] **Password reset**: Flow completo funciona
- [ ] **Session persistence**: Token refresh funciona
- [ ] **RLS policies**: Datos protegidos correctamente
- [ ] **API access**: PostgREST devuelve datos correctos
- [ ] **Webhooks**: Stripe test event llega correctamente
- [ ] **CSRF protection**: Double-submit cookies siguen funcionando
- [ ] **Rate limiting**: Verificar limits funcionales
- [ ] **Account deletion**: 30d grace period funciona
- [ ] **Data export**: GDPR export funciona

### 13.8 Security Hardening Post-Migration

- [ ] **Rotacion de secrets**: No reusar secrets de cloud
- [ ] **Firewall**: Solo Kong/Caddy expuesto a internet
- [ ] **DB port**: PostgreSQL NO expuesto publicamente
- [ ] **Service role key**: Solo en server-side, nunca en client
- [ ] **HTTPS enforced**: Redirect HTTP -> HTTPS
- [ ] **Monitoring**: Alertas de auth failures
- [ ] **Backup automatizado**: DB dumps programados

---

## Anexo A: Configuracion Completa Recomendada para SKAPARA

```env
***REMOVED***
# SUPABASE SELF-HOSTED — Variables de Auth & APIs
***REMOVED***

# --- Global Secrets ---
JWT_SECRET=<generado-con-openssl-rand-base64-48>
ANON_KEY=<JWT-con-role-anon-firmado-con-JWT_SECRET>
SERVICE_ROLE_KEY=<JWT-con-role-service_role-firmado-con-JWT_SECRET>
POSTGRES_PASSWORD=<generado-con-openssl-rand-hex-32>
SECRET_KEY_BASE=<generado-con-openssl-rand-base64-48>  # min 64 chars
VAULT_ENC_KEY=<exactamente-32-caracteres>
PG_META_CRYPTO_KEY=<generado-con-openssl-rand-hex-16>  # 32+ chars

# --- URLs ---
SUPABASE_PUBLIC_URL=https://api.skapara.com
API_EXTERNAL_URL=https://api.skapara.com
SITE_URL=https://skapara.com
ADDITIONAL_REDIRECT_URLS=https://www.skapara.com,https://admin.skapara.com

# --- GoTrue Auth ---
GOTRUE_SITE_URL=https://skapara.com
GOTRUE_URI_ALLOW_LIST=https://skapara.com/*,https://www.skapara.com/*
GOTRUE_JWT_SECRET=${JWT_SECRET}
GOTRUE_JWT_EXP=3600
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true

# --- SMTP (Resend) ---
GOTRUE_SMTP_HOST=smtp.resend.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=resend
GOTRUE_SMTP_PASS=${RESEND_API_KEY}
GOTRUE_SMTP_ADMIN_EMAIL=noreply@skapara.com
GOTRUE_SMTP_SENDER_NAME=SKAPARA

# --- Password Policy ---
GOTRUE_PASSWORD_MIN_LENGTH=8
GOTRUE_PASSWORD_REQUIRED_CHARACTERS=abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789

# --- CAPTCHA (Turnstile) ---
GOTRUE_SECURITY_CAPTCHA_ENABLED=true
GOTRUE_SECURITY_CAPTCHA_PROVIDER=turnstile
GOTRUE_SECURITY_CAPTCHA_SECRET=${TURNSTILE_SECRET_KEY}

# --- MFA ---
GOTRUE_MFA_TOTP_ENROLL_ENABLED=true
GOTRUE_MFA_TOTP_VERIFY_ENABLED=true

# --- Rate Limits ---
GOTRUE_RATE_LIMIT_EMAIL_SENT=30
GOTRUE_RATE_LIMIT_TOKEN_REFRESH=150
GOTRUE_RATE_LIMIT_VERIFY=30

# --- Security ---
GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true
GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=10

# --- Notifications ---
GOTRUE_MAILER_NOTIFICATIONS_PASSWORD_CHANGED_ENABLED=true
GOTRUE_MAILER_NOTIFICATIONS_EMAIL_CHANGED_ENABLED=true

# --- PostgREST ---
PGRST_DB_URI=postgresql://authenticator:${POSTGRES_PASSWORD}@db:5432/postgres
PGRST_DB_SCHEMAS=public,storage,graphql_public
PGRST_DB_ANON_ROLE=anon
PGRST_DB_MAX_ROWS=1000
PGRST_DB_POOL=20
PGRST_JWT_SECRET=${JWT_SECRET}
PGRST_LOG_LEVEL=warn

# --- Storage ---
STORAGE_BACKEND=s3
GLOBAL_S3_BUCKET=skapara-storage
REGION=auto
FILE_SIZE_LIMIT=52428800

# --- Kong Gateway ---
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

# --- Dashboard ---
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<generado-con-openssl>
```

---

## Anexo B: Docker Compose Fragment para Servicios Supabase

```yaml
# Agregar estos servicios al docker-compose.yml existente de SKAPARA

  # --- PostgreSQL Database ---
  db:
    image: supabase/postgres:15.8.1.060
    environment:
      POSTGRES_HOST: /var/run/postgresql
      PGPORT: "5432"
      POSTGRES_PORT: "5432"
      PGPASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATABASE: postgres
      POSTGRES_DB: postgres
    volumes:
      - supabase-db-data:/var/lib/postgresql/data:Z
    restart: unless-stopped
    cap_drop: [ALL]
    cap_add: [SETGID, SETUID, DAC_OVERRIDE]
    networks: [supabase-internal]
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres", "-d", "postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # --- GoTrue Auth ---
  auth:
    image: supabase/gotrue:v2.167.0
    environment:
      GOTRUE_API_HOST: "0.0.0.0"
      GOTRUE_API_PORT: "8081"
      API_EXTERNAL_URL: ${API_EXTERNAL_URL}
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgresql://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/postgres
      GOTRUE_SITE_URL: ${SITE_URL}
      GOTRUE_URI_ALLOW_LIST: ${ADDITIONAL_REDIRECT_URLS:-}
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_JWT_EXP: ${JWT_EXPIRY:-3600}
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "false"
      GOTRUE_SMTP_HOST: ${SMTP_HOST:-smtp.resend.com}
      GOTRUE_SMTP_PORT: ${SMTP_PORT:-465}
      GOTRUE_SMTP_USER: ${SMTP_USER:-resend}
      GOTRUE_SMTP_PASS: ${SMTP_PASS}
      GOTRUE_SMTP_ADMIN_EMAIL: ${SMTP_ADMIN_EMAIL}
      GOTRUE_SMTP_SENDER_NAME: ${SMTP_SENDER_NAME:-SKAPARA}
      GOTRUE_MAILER_URLPATHS_INVITE: "/auth/v1/verify"
      GOTRUE_MAILER_URLPATHS_CONFIRMATION: "/auth/v1/verify"
      GOTRUE_MAILER_URLPATHS_RECOVERY: "/auth/v1/verify"
      GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: "/auth/v1/verify"
      GOTRUE_SECURITY_CAPTCHA_ENABLED: "true"
      GOTRUE_SECURITY_CAPTCHA_PROVIDER: "turnstile"
      GOTRUE_SECURITY_CAPTCHA_SECRET: ${TURNSTILE_SECRET_KEY}
      GOTRUE_PASSWORD_MIN_LENGTH: "8"
      GOTRUE_MFA_TOTP_ENROLL_ENABLED: "true"
      GOTRUE_MFA_TOTP_VERIFY_ENABLED: "true"
      GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED: "true"
    depends_on:
      db: { condition: service_healthy }
    restart: unless-stopped
    cap_drop: [ALL]
    networks: [supabase-internal]
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8081/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  # --- PostgREST ---
  rest:
    image: postgrest/postgrest:v12.2.3
    environment:
      PGRST_DB_URI: postgresql://authenticator:${POSTGRES_PASSWORD}@db:5432/postgres
      PGRST_DB_SCHEMAS: ${PGRST_DB_SCHEMAS:-public,storage,graphql_public}
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET}
      PGRST_DB_MAX_ROWS: "1000"
      PGRST_DB_POOL: "20"
      PGRST_LOG_LEVEL: warn
    depends_on:
      db: { condition: service_healthy }
    restart: unless-stopped
    cap_drop: [ALL]
    networks: [supabase-internal]

  # --- Realtime ---
  realtime:
    image: supabase/realtime:v2.33.37
    environment:
      PORT: "4000"
      DB_HOST: db
      DB_PORT: "5432"
      DB_USER: supabase_admin
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      DB_NAME: postgres
      DB_AFTER_CONNECT_QUERY: "SET search_path TO _realtime"
      DB_ENC_KEY: ${VAULT_ENC_KEY}
      API_JWT_SECRET: ${JWT_SECRET}
      SECRET_KEY_BASE: ${SECRET_KEY_BASE}
      ERL_AFLAGS: "-proto_dist inet_tcp"
      DNS_NODES: "''"
      RLIMIT_NOFILE: "10000"
      SEED_SELF_HOST: "true"
    depends_on:
      db: { condition: service_healthy }
    restart: unless-stopped
    cap_drop: [ALL]
    networks: [supabase-internal]

  # --- Storage ---
  storage:
    image: supabase/storage-api:v1.14.3
    environment:
      ANON_KEY: ${ANON_KEY}
      SERVICE_KEY: ${SERVICE_ROLE_KEY}
      POSTGREST_URL: http://rest:3000
      PGRST_JWT_SECRET: ${JWT_SECRET}
      DATABASE_URL: postgresql://supabase_storage_admin:${POSTGRES_PASSWORD}@db:5432/postgres
      FILE_SIZE_LIMIT: "52428800"
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: stub
      REGION: local
      GLOBAL_S3_BUCKET: stub
      IMGPROXY_URL: http://imgproxy:5001
    volumes:
      - supabase-storage-data:/var/lib/storage:z
    depends_on:
      db: { condition: service_healthy }
      rest: { condition: service_started }
    restart: unless-stopped
    cap_drop: [ALL]
    networks: [supabase-internal]

  # --- Kong API Gateway ---
  kong:
    image: kong:2.8.1
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl,basic-auth
      KONG_NGINX_PROXY_PROXY_BUFFER_SIZE: 160k
      KONG_NGINX_PROXY_PROXY_BUFFERS: 64 160k
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SERVICE_ROLE_KEY}
      DASHBOARD_USERNAME: ${DASHBOARD_USERNAME:-admin}
      DASHBOARD_PASSWORD: ${DASHBOARD_PASSWORD}
    volumes:
      - ./volumes/api/kong.yml:/var/lib/kong/kong.yml:ro
    ports:
      - "${KONG_HTTP_PORT:-8000}:8000/tcp"
      - "${KONG_HTTPS_PORT:-8443}:8443/tcp"
    depends_on:
      auth: { condition: service_healthy }
    restart: unless-stopped
    cap_drop: [ALL]
    cap_add: [NET_BIND_SERVICE]
    networks: [supabase-internal, proxy]

  # --- imgproxy ---
  imgproxy:
    image: darthsim/imgproxy:v3.24
    environment:
      IMGPROXY_BIND: ":5001"
      IMGPROXY_LOCAL_FILESYSTEM_ROOT: "/"
      IMGPROXY_USE_ETAG: "true"
      IMGPROXY_ENABLE_WEBP_DETECTION: "true"
      IMGPROXY_MAX_SRC_RESOLUTION: "50"
    volumes:
      - supabase-storage-data:/var/lib/storage:z
    restart: unless-stopped
    cap_drop: [ALL]
    networks: [supabase-internal]

volumes:
  supabase-db-data:
  supabase-storage-data:

networks:
  supabase-internal:
    driver: bridge
```

---

## Anexo C: Fuentes y Referencias

- [Supabase Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [GoTrue Auth Configuration](https://supabase.com/docs/reference/self-hosting-auth/introduction)
- [GoTrue Environment Variables Reference (DeepWiki)](https://deepwiki.com/supabase/auth/2.1-environment-variables-reference)
- [PostgREST Configuration Reference](https://postgrest.org/en/stable/references/configuration.html)
- [Supabase Realtime Self-hosting Config](https://supabase.com/docs/guides/self-hosting/realtime/config)
- [Supabase Storage Self-hosting Config](https://supabase.com/docs/guides/self-hosting/storage/config)
- [Supabase Edge Functions (Self-hosted)](https://supabase.com/docs/reference/self-hosting-functions/introduction)
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [pg_net Extension](https://supabase.com/docs/guides/database/extensions/pg_net)
- [Self-Hosted OAuth Configuration](https://supabase.com/docs/guides/self-hosting/self-hosted-oauth)
- [Supabase Docker Compose (GitHub)](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml)
- [Supabase .env.example (GitHub)](https://github.com/supabase/supabase/blob/master/docker/.env.example)
- [Supabase Edge Runtime (GitHub)](https://github.com/supabase/edge-runtime)
- [Supabase Self-Hosted Environment Variables Guide (SupaScale)](https://www.supascale.app/blog/supabase-selfhosted-environment-variables-a-complete-guide)
