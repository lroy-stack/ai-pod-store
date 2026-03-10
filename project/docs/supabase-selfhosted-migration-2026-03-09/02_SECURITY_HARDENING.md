# Supabase Self-Hosted: Security Hardening Guide

> Fecha: 2026-03-09
> Proyecto: POD AI Store (SKAPARA)
> Contexto: Migracion de Supabase Cloud a self-hosted Docker Compose en VPS

---

## Tabla de Contenidos

1. [Checklist de Seguridad](#1-checklist-de-seguridad)
2. [JWT Secrets y API Keys](#2-jwt-secrets-y-api-keys)
3. [GoTrue/Auth Security](#3-gotrueauth-security)
4. [Row Level Security (RLS)](#4-row-level-security-rls)
5. [Network Security](#5-network-security)
6. [Kong API Gateway Hardening](#6-kong-api-gateway-hardening)
7. [PostgreSQL Security Hardening](#7-postgresql-security-hardening)
8. [Dashboard/Studio Protection](#8-dashboardstudio-protection)
9. [SSL/TLS Configuration](#9-ssltls-configuration)
10. [Secrets Management](#10-secrets-management)
11. [CORS Configuration](#11-cors-configuration)
12. [Rate Limiting](#12-rate-limiting)
13. [Backups y Recovery](#13-backups-y-recovery)
14. [Monitoring y Alertas](#14-monitoring-y-alertas)
15. [Errores Comunes a Evitar](#15-errores-comunes-a-evitar)

---

## 1. Checklist de Seguridad

### MUST (Obligatorio - Bloquea produccion si no se cumple)

- [ ] Generar `JWT_SECRET` criptograficamente seguro (min 64 caracteres)
- [ ] Generar `ANON_KEY` y `SERVICE_ROLE_KEY` desde el JWT_SECRET
- [ ] Cambiar `POSTGRES_PASSWORD` (solo alfanumerico, evitar caracteres especiales para URL encoding)
- [ ] Cambiar `DASHBOARD_USERNAME` y `DASHBOARD_PASSWORD` (password debe incluir al menos una letra)
- [ ] Generar `SECRET_KEY_BASE` unico (min 64 caracteres)
- [ ] Generar `VAULT_ENC_KEY` unico (exactamente 32 caracteres)
- [ ] Generar `PG_META_CRYPTO_KEY` unico (min 32 caracteres)
- [ ] NO exponer PostgreSQL (puertos 5432/6543) a internet
- [ ] NO exponer Logflare/Analytics UI (puerto 4000) a internet
- [ ] NO exponer servicios internos directamente - solo Kong como punto de entrada
- [ ] Configurar HTTPS obligatorio (via Caddy reverse proxy delante de Kong)
- [ ] Habilitar RLS en TODAS las tablas con datos de usuario
- [ ] Configurar `GOTRUE_MAILER_AUTOCONFIRM=false` (requerir confirmacion email)
- [ ] Configurar SMTP real para produccion (NO usar InBucket)
- [ ] Configurar `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` con URLs reales
- [ ] Configurar `GOTRUE_URI_ALLOW_LIST` con dominios permitidos unicamente
- [ ] `.env` NUNCA committed a version control
- [ ] Deshabilitar signup si no se necesita: `GOTRUE_DISABLE_SIGNUP=true`
- [ ] Configurar firewall VPS (ufw/iptables): solo puertos 80, 443, 22

### SHOULD (Altamente recomendado)

- [ ] Configurar `GOTRUE_PASSWORD_MIN_LENGTH=8` (minimo recomendado)
- [ ] Configurar `GOTRUE_PASSWORD_REQUIRED_CHARACTERS` con conjuntos de caracteres
- [ ] Habilitar `GOTRUE_PASSWORD_HIBP_ENABLED=true` (verificar passwords filtradas)
- [ ] Habilitar `GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true`
- [ ] Configurar `GOTRUE_SECURITY_CAPTCHA_ENABLED=true` con Turnstile
- [ ] Configurar `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION=true`
- [ ] Habilitar `GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPT=true` para datos sensibles
- [ ] Configurar session timeouts: `GOTRUE_SESSIONS_TIMEBOX` y `GOTRUE_SESSIONS_INACTIVITY_TIMEOUT`
- [ ] Configurar CORS restrictivo en Kong (solo dominios propios)
- [ ] Instalar CrowdSec para deteccion de amenazas
- [ ] Backup automatizado de PostgreSQL con retencion
- [ ] Monitoreo con Prometheus + Grafana
- [ ] Usar secrets manager (Doppler, Vault, etc.) en vez de .env plano
- [ ] Configurar rate limits de Kong adicionales
- [ ] Dashboard solo accesible via VPN o IP whitelist
- [ ] Deshabilitar `pg_graphql` si no se usa (reduce superficie de ataque)
- [ ] Configurar `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true`

### NICE-TO-HAVE (Mejora incremental)

- [ ] Migrar de HS256 a ES256 (NIST P-256) para JWT signing
- [ ] Habilitar WebAuthn/passkeys para MFA
- [ ] Habilitar `GOTRUE_SESSIONS_SINGLE_PER_USER=true` si aplica
- [ ] pgAudit para auditoria de queries
- [ ] Separar base de datos de observabilidad de la de produccion
- [ ] Log drains a sistema externo (Datadog, etc.)
- [ ] S3-backed storage para escalabilidad
- [ ] Bloom filter cache para HIBP: `GOTRUE_PASSWORD_HIBP_BLOOM_ENABLED=true`

---

## 2. JWT Secrets y API Keys

### 2.1 Generacion del JWT_SECRET

El `JWT_SECRET` es el secreto mas critico de toda la instalacion. Se usa para firmar y verificar TODOS los JWT tokens (auth, anon, service_role).

```bash
# Generar JWT_SECRET seguro (64 caracteres alfanumericos)
openssl rand -base64 48 | tr -d '/+=' | head -c 64

# Alternativa con urandom
cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64
```

**Reglas:**
- Minimo 32 caracteres (recomendado 64+)
- Solo caracteres alfanumericos para evitar problemas de encoding
- NUNCA usar el valor por defecto del repositorio
- NUNCA compartir publicamente ni commitear a git
- El mismo JWT_SECRET debe configurarse en TODOS los servicios que lo usan: Kong, GoTrue, PostgREST, Realtime, Storage

### 2.2 Generacion de ANON_KEY y SERVICE_ROLE_KEY

Las API keys son JWTs firmados con el JWT_SECRET. Contienen claims de rol que PostgREST usa para cambiar de rol PostgreSQL.

**ANON_KEY** - Token con rol `anon`:
```json
{
  "role": "anon",
  "iss": "supabase",
  "iat": 1735689600,
  "exp": 1893456000
}
```

**SERVICE_ROLE_KEY** - Token con rol `service_role`:
```json
{
  "role": "service_role",
  "iss": "supabase",
  "iat": 1735689600,
  "exp": 1893456000
}
```

**Generacion con Node.js:**
```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'tu-jwt-secret-de-64-caracteres-aqui';

// ANON_KEY
const anonKey = jwt.sign(
  {
    role: 'anon',
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 anos
  },
  JWT_SECRET,
  { algorithm: 'HS256' }
);

// SERVICE_ROLE_KEY
const serviceRoleKey = jwt.sign(
  {
    role: 'service_role',
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60)
  },
  JWT_SECRET,
  { algorithm: 'HS256' }
);

console.log('ANON_KEY:', anonKey);
console.log('SERVICE_ROLE_KEY:', serviceRoleKey);
```

**Generacion con CLI de Supabase:**
```bash
supabase gen signing-key --algorithm ES256  # Para migracion futura a asimetrico
supabase gen bearer-jwt --secret <JWT_SECRET> --role anon
supabase gen bearer-jwt --secret <JWT_SECRET> --role service_role
```

### 2.3 Donde usar cada key

| Key | Donde se usa | Exposicion |
|-----|-------------|------------|
| `ANON_KEY` | Frontend (browser), `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PUBLICA - protegida por RLS |
| `SERVICE_ROLE_KEY` | Backend/Server ONLY, `SUPABASE_SERVICE_KEY` | PRIVADA - bypassa RLS |
| `JWT_SECRET` | Configuracion de servicios internos | PRIVADA - NUNCA exponer |

**CRITICO:** El `SERVICE_ROLE_KEY` bypassa TODAS las politicas RLS. Solo debe usarse en:
- Server-side API routes (nunca en cliente)
- Cron jobs y scripts de administracion
- Funciones Edge con logica de admin

### 2.4 Rotacion de Keys

**Proceso de rotacion seguro:**
1. Generar nuevo `JWT_SECRET`
2. Generar nuevas `ANON_KEY` y `SERVICE_ROLE_KEY` con el nuevo secret
3. Actualizar `.env` con los nuevos valores
4. Actualizar `kong.yml` con las nuevas keys en los consumers
5. Reiniciar TODOS los servicios con `docker compose down && docker compose up -d`
6. Actualizar aplicacion frontend/backend con las nuevas keys
7. Verificar que tokens existentes siguen funcionando durante periodo de gracia
8. Los tokens de sesion de usuarios existentes se invalidaran - planificar mantenimiento

**ADVERTENCIA:** Rotar el JWT_SECRET invalida TODOS los tokens existentes inmediatamente. Planificar una ventana de mantenimiento.

---

## 3. GoTrue/Auth Security

### 3.1 Password Policies

```yaml
# docker-compose.yml - servicio auth
environment:
  # Longitud minima de password (NUNCA menos de 8)
  GOTRUE_PASSWORD_MIN_LENGTH: 8

  # Caracteres requeridos - separados por ':'
  # abcdefghijklmnopqrstuvwxyz = requiere minuscula
  # ABCDEFGHIJKLMNOPQRSTUVWXYZ = requiere mayuscula
  # 0123456789 = requiere digito
  # !@#$%^&*()_+-=[]{}|;':\"<>?,./~ = requiere simbolo
  GOTRUE_PASSWORD_REQUIRED_CHARACTERS: "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789"

  # Verificacion contra Have I Been Pwned
  GOTRUE_PASSWORD_HIBP_ENABLED: true
  # Rechazar password si HIBP no esta disponible (fail-closed)
  GOTRUE_PASSWORD_HIBP_FAIL_CLOSED: false
  # Cache bloom filter para reducir llamadas a HIBP API
  GOTRUE_PASSWORD_HIBP_BLOOM_ENABLED: true
  GOTRUE_PASSWORD_HIBP_BLOOM_ITEMS: 100000
```

**Notas:**
- Passwords se hashean con bcrypt (salt aleatorio por password)
- Si se refuerza la politica, usuarios existentes mantienen acceso pero reciben `WeakPasswordError` al hacer sign-in, forzandolos a actualizar
- `GOTRUE_PASSWORD_REQUIRED_CHARACTERS` usa `:` como separador de conjuntos

### 3.2 Rate Limiting de Auth

```yaml
environment:
  # Header para identificar IP (detrás de proxy)
  GOTRUE_RATE_LIMIT_HEADER: "X-Forwarded-For"

  # Emails por hora (signup, recover, otp, invite)
  GOTRUE_RATE_LIMIT_EMAIL_SENT: 30

  # SMS por hora
  GOTRUE_RATE_LIMIT_SMS_SENT: 30

  # Endpoint /verify
  GOTRUE_RATE_LIMIT_VERIFY: 30

  # Token refresh
  GOTRUE_RATE_LIMIT_TOKEN_REFRESH: 150

  # SSO
  GOTRUE_RATE_LIMIT_SSO: 30

  # Usuarios anonimos
  GOTRUE_RATE_LIMIT_ANONYMOUS_USERS: 30

  # OTP generation
  GOTRUE_RATE_LIMIT_OTP: 30

  # Intervalo minimo entre emails al mismo usuario
  GOTRUE_SMTP_MAX_FREQUENCY: "60s"

  # Intervalo minimo entre SMS al mismo numero
  GOTRUE_SMS_MAX_FREQUENCY: "60s"
```

**CRITICO para self-hosted:** El header `GOTRUE_RATE_LIMIT_HEADER` debe coincidir con el header que tu reverse proxy (Caddy) envia. Si no se configura correctamente, el rate limiting se aplicara por IP del proxy, no del cliente real.

### 3.3 Email Confirmation

```yaml
environment:
  # NUNCA true en produccion - requiere verificacion de email
  GOTRUE_MAILER_AUTOCONFIRM: false

  # Bloquear sign-in con email no verificado
  GOTRUE_MAILER_ALLOW_UNVERIFIED_EMAIL_SIGN_INS: false

  # Doble confirmacion en cambio de email (old + new email)
  GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED: true

  # Expiracion de OTP (segundos)
  GOTRUE_MAILER_OTP_EXP: 3600

  # Longitud del codigo OTP
  GOTRUE_MAILER_OTP_LENGTH: 6

  # SMTP real para produccion
  GOTRUE_SMTP_HOST: "email-smtp.eu-west-1.amazonaws.com"
  GOTRUE_SMTP_PORT: 587
  GOTRUE_SMTP_USER: "${SMTP_USER}"
  GOTRUE_SMTP_PASS: "${SMTP_PASS}"
  GOTRUE_SMTP_ADMIN_EMAIL: "noreply@skapara.com"
  GOTRUE_SMTP_SENDER_NAME: "SKAPARA"
```

### 3.4 OAuth Providers

```yaml
environment:
  # Habilitar providers especificos
  GOTRUE_EXTERNAL_GOOGLE_ENABLED: true
  GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID}"
  GOTRUE_EXTERNAL_GOOGLE_SECRET: "${GOOGLE_CLIENT_SECRET}"
  GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: "https://api.skapara.com/auth/v1/callback"

  # SITE_URL para redirects de auth
  GOTRUE_SITE_URL: "https://skapara.com"

  # Lista blanca de redirect URIs (CRITICO - evita open redirect)
  GOTRUE_URI_ALLOW_LIST: "https://skapara.com/*,https://admin.skapara.com/*"

  # URL externa del servicio auth
  API_EXTERNAL_URL: "https://api.skapara.com"
```

**CRITICO:** `GOTRUE_URI_ALLOW_LIST` previene ataques de open redirect. Solo incluir dominios propios. HTTPS es obligatorio para OAuth.

### 3.5 MFA/2FA

TOTP esta habilitado por defecto en self-hosted. Configuracion disponible:

```yaml
environment:
  # TOTP (Google Authenticator, Authy, etc.)
  GOTRUE_MFA_TOTP_ENROLL_ENABLED: true
  GOTRUE_MFA_TOTP_VERIFY_ENABLED: true

  # Phone MFA (requiere SMS provider)
  GOTRUE_MFA_PHONE_ENROLL_ENABLED: false
  GOTRUE_MFA_PHONE_VERIFY_ENABLED: false

  # WebAuthn/Passkeys (si el navegador lo soporta)
  GOTRUE_MFA_WEB_AUTHN_ENROLL_ENABLED: false
  GOTRUE_MFA_WEB_AUTHN_VERIFY_ENABLED: false

  # Limites
  GOTRUE_MFA_MAX_ENROLLED_FACTORS: 10
  GOTRUE_MFA_MAX_VERIFIED_FACTORS: 10
  GOTRUE_MFA_CHALLENGE_EXPIRY_DURATION: 300
  GOTRUE_MFA_FACTOR_EXPIRY_DURATION: "300s"

  # Rate limit para challenge/verify (por hora)
  GOTRUE_MFA_RATE_LIMIT_CHALLENGE_AND_VERIFY: 15
```

**NOTA:** Para habilitar MFA variables en el contenedor, deben estar tanto en `.env` como mapeadas en `docker-compose.yml` con el prefijo `GOTRUE_MFA_*`.

### 3.6 Session Management

```yaml
environment:
  # Duracion del JWT token (segundos) - default 3600 (1 hora)
  GOTRUE_JWT_EXP: 3600

  # Tiempo maximo de sesion independiente de actividad
  GOTRUE_SESSIONS_TIMEBOX: "24h"

  # Timeout por inactividad
  GOTRUE_SESSIONS_INACTIVITY_TIMEOUT: "8h"

  # Periodo de gracia para AAL1 antes de requerir AAL2 (MFA)
  GOTRUE_SESSIONS_ALLOW_LOW_AAL: "5m"

  # Solo una sesion activa por usuario
  GOTRUE_SESSIONS_SINGLE_PER_USER: false

  # Rotacion de refresh tokens (OBLIGATORIO)
  GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED: true

  # Ventana de gracia para reuso de refresh token (concurrencia)
  GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL: 10
```

**Recomendacion:** Con `GOTRUE_JWT_EXP: 3600` los tokens duran 1 hora. Los refresh tokens se rotan automaticamente. Si se detecta reuso de un refresh token revocado, TODA la familia de tokens se revoca (proteccion contra token theft).

### 3.7 Security Features Adicionales

```yaml
environment:
  # Requerir reautenticacion para cambiar password
  GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION: true

  # CAPTCHA (Turnstile recomendado)
  GOTRUE_SECURITY_CAPTCHA_ENABLED: true
  GOTRUE_SECURITY_CAPTCHA_PROVIDER: "turnstile"
  GOTRUE_SECURITY_CAPTCHA_SECRET: "${TURNSTILE_SECRET_KEY}"

  # Encriptacion de datos sensibles en DB
  GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPT: true
  GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPTION_KEY_ID: "primary"
  GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPTION_KEY: "${DB_ENCRYPTION_KEY}"  # Base64 de 256 bits

  # Deshabilitar linking manual de identidades
  GOTRUE_SECURITY_MANUAL_LINKING_ENABLED: false
```

---

## 4. Row Level Security (RLS)

### 4.1 Verificacion de RLS Post-Migracion

**TODAS las tablas con datos de usuario DEBEN tener RLS habilitado.** En self-hosted, las politicas RLS se migran con el schema SQL.

```sql
-- Verificar que RLS esta habilitado en todas las tablas
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'auth', 'storage', 'extensions', 'supabase_functions')
ORDER BY schemaname, tablename;

-- Listar tablas SIN RLS habilitado (RIESGO)
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;

-- Listar todas las politicas RLS existentes
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 4.2 Testing de RLS

Script de verificacion post-migracion:

```sql
-- Test 1: Verificar que anon no puede leer datos protegidos
SET ROLE anon;
SELECT count(*) FROM public.orders;  -- Deberia devolver 0 o error
RESET ROLE;

-- Test 2: Verificar que authenticated user solo ve sus propios datos
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "test-user-uuid", "role": "authenticated"}';
SELECT count(*) FROM public.orders;  -- Solo ordenes del usuario
RESET ROLE;

-- Test 3: Verificar que service_role bypassa RLS
SET ROLE service_role;
SELECT count(*) FROM public.orders;  -- Todas las ordenes
RESET ROLE;
```

### 4.3 Politicas RLS Criticas a Verificar

```sql
-- Verificar que no existen politicas "fake" que den acceso total
-- BUSCAR: policies con "true" como condicion (permiten todo)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual::text = 'true';

-- Estas politicas son PELIGROSAS y deben revisarse caso por caso
```

### 4.4 Patrones RLS Seguros

```sql
-- Patron: Usuario solo accede a sus propios datos
CREATE POLICY "users_own_data" ON public.orders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Patron: Lectura publica, escritura solo autenticada
CREATE POLICY "public_read" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "auth_write" ON public.products
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Patron: Admin con verificacion de rol en metadata
CREATE POLICY "admin_access" ON public.admin_settings
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );
```

---

## 5. Network Security

### 5.1 Arquitectura de Red Recomendada

```
Internet
    |
    v
[Cloudflare] (WAF, DDoS protection, bot management)
    |
    v
[Caddy] (reverse proxy + auto HTTPS, puertos 80/443)
    |
    v
[Kong] (API gateway, puerto 8000 - SOLO interno)
    |
    +---> [GoTrue/Auth] (puerto 9999 - interno)
    +---> [PostgREST] (puerto 3000 - interno)
    +---> [Realtime] (puerto 4000 - interno)
    +---> [Storage] (puerto 5000 - interno)
    +---> [pg_meta] (puerto 8080 - interno)
    +---> [Studio] (puerto 3000 - interno)
    |
    v
[Supavisor] (connection pooler, puertos 5432/6543 - SOLO interno)
    |
    v
[PostgreSQL] (puerto 5432 - NUNCA expuesto)
```

### 5.2 Firewall Rules (UFW)

```bash
# Reset y politica por defecto
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH (restringir a tu IP si es posible)
sudo ufw allow 22/tcp

# HTTP/HTTPS (Caddy)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# DENEGAR explicitamente puertos internos
sudo ufw deny 5432/tcp   # PostgreSQL
sudo ufw deny 6543/tcp   # Supavisor transaction mode
sudo ufw deny 8000/tcp   # Kong
sudo ufw deny 8443/tcp   # Kong HTTPS
sudo ufw deny 4000/tcp   # Analytics/Logflare
sudo ufw deny 9999/tcp   # GoTrue
sudo ufw deny 3000/tcp   # PostgREST/Studio

# Habilitar
sudo ufw enable
```

### 5.3 Docker Network Isolation

```yaml
# docker-compose.yml - Redes aisladas
networks:
  # Red para servicios que necesitan Kong
  api:
    driver: bridge
    internal: false  # Kong necesita acceso externo via Caddy
  # Red interna para DB
  db:
    driver: bridge
    internal: true   # NUNCA accesible desde fuera
  # Red interna para auth
  auth:
    driver: bridge
    internal: true

services:
  kong:
    networks:
      - api
  db:
    networks:
      - db
    # NO mapear puertos al host
    # ports:  # COMENTADO
    #   - "5432:5432"
  auth:
    networks:
      - auth
      - db
  rest:
    networks:
      - api
      - db
```

### 5.4 Servicios que NUNCA deben exponerse

| Servicio | Puerto | Razon |
|----------|--------|-------|
| PostgreSQL | 5432 | Acceso directo a la BD sin RLS |
| Supavisor | 5432/6543 | Connection pooler, misma razon |
| GoTrue | 9999 | Auth service interno, acceder via Kong |
| PostgREST | 3000 | API REST interna, acceder via Kong |
| Realtime | 4000 | WebSocket interno |
| Storage | 5000 | Storage API interno |
| pg_meta | 8080 | Metadata de BD, acceso admin |
| Logflare/Analytics | 4000 | UI de analytics con datos sensibles |
| Vector | - | Pipeline de logs interno |

**Solo Kong (via Caddy) debe ser accesible desde internet.**

---

## 6. Kong API Gateway Hardening

### 6.1 Estructura de kong.yml

El archivo `volumes/api/kong.yml` define toda la configuracion de routing y seguridad:

```yaml
_format_version: "1.1"

consumers:
  - username: DASHBOARD
    basicauth_credentials:
      - username: "${DASHBOARD_USERNAME}"
        password: "${DASHBOARD_PASSWORD}"
  - username: anon
    keyauth_credentials:
      - key: "${ANON_KEY}"
    acls:
      - group: anon
  - username: service_role
    keyauth_credentials:
      - key: "${SERVICE_ROLE_KEY}"
    acls:
      - group: admin

services:
  # Auth - rutas abiertas (verify, callback, authorize)
  - name: auth-v1-open
    url: http://auth:9999/verify
    routes:
      - name: auth-v1-open
        strip_path: true
        paths:
          - /auth/v1/verify
          - /auth/v1/callback
          - /auth/v1/authorize
    plugins:
      - name: cors

  # Auth - rutas protegidas
  - name: auth-v1
    url: http://auth:9999
    routes:
      - name: auth-v1
        strip_path: true
        paths:
          - /auth/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false  # Auth necesita ver el token
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin
            - anon

  # REST API - CORS + key-auth + ACL
  - name: rest-v1
    url: http://rest:3000/
    routes:
      - name: rest-v1
        strip_path: true
        paths:
          - /rest/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: true  # Ocultar credenciales del backend
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin
            - anon

  # pg_meta - SOLO admin
  - name: meta
    url: http://meta:8080/
    routes:
      - name: meta
        strip_path: true
        paths:
          - /pg/
    plugins:
      - name: key-auth
        config:
          hide_credentials: false
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin  # SOLO service_role, NO anon

  # MCP - BLOQUEADO por defecto
  - name: mcp-termination
    url: http://studio:3000
    routes:
      - name: mcp-termination
        paths:
          - /mcp
          - /api/mcp
    plugins:
      - name: request-termination
        config:
          status_code: 403
          message: "MCP access is disabled"
      # Para habilitar solo desde IPs locales:
      # - name: ip-restriction
      #   config:
      #     allow:
      #       - 127.0.0.1
      #       - ::1

  # Dashboard - Basic Auth (catch-all)
  - name: dashboard
    url: http://studio:3000/
    routes:
      - name: dashboard
        strip_path: true
        paths:
          - /
    plugins:
      - name: cors
      - name: basic-auth
```

### 6.2 Hardening Adicional de Kong

**Agregar rate limiting por ruta:**
```yaml
# Agregar al servicio auth-v1
plugins:
  - name: rate-limiting
    config:
      second: 5
      minute: 30
      hour: 500
      policy: local
      fault_tolerant: true
      hide_client_headers: false

# Agregar al servicio rest-v1 (mas permisivo)
plugins:
  - name: rate-limiting
    config:
      second: 50
      minute: 1000
      hour: 10000
      policy: local
```

**Agregar CORS restrictivo:**
```yaml
plugins:
  - name: cors
    config:
      origins:
        - "https://skapara.com"
        - "https://admin.skapara.com"
      methods:
        - GET
        - POST
        - PUT
        - PATCH
        - DELETE
        - OPTIONS
      headers:
        - Authorization
        - Content-Type
        - apikey
        - x-client-info
      exposed_headers:
        - Content-Range
        - X-Total-Count
      credentials: true
      max_age: 3600
```

### 6.3 Routing y Access Control

| Endpoint | Auth | Roles Permitidos | Notas |
|----------|------|------------------|-------|
| `/auth/v1/verify`, `/callback`, `/authorize` | No | Todos | OAuth callbacks |
| `/auth/v1/*` | key-auth | admin, anon | Signup, login, etc. |
| `/rest/v1/*` | key-auth | admin, anon | Credentials ocultas |
| `/graphql/v1` | key-auth | admin, anon | Considerar deshabilitar |
| `/realtime/v1/*` | key-auth | admin, anon | WebSockets |
| `/storage/v1/*` | No (propio) | Self-managed | Storage gestiona auth |
| `/functions/v1/*` | No | Todos | Edge functions |
| `/pg/*` | key-auth | admin SOLO | Metadata BD |
| `/mcp`, `/api/mcp` | Bloqueado | Ninguno | Request termination |
| `/*` (catch-all) | basic-auth | Dashboard user | Studio UI |

---

## 7. PostgreSQL Security Hardening

### 7.1 Roles de Supabase

Supabase self-hosted crea una jerarquia de roles PostgreSQL:

| Rol | Proposito | Privilegios |
|-----|-----------|-------------|
| `postgres` | Superuser | TODO - proteger con password fuerte |
| `supabase_admin` | Admin interno de servicios | Near-superuser para operaciones internas |
| `supabase_auth_admin` | GoTrue DB user | CRUD en schema `auth` |
| `supabase_storage_admin` | Storage DB user | CRUD en schema `storage` |
| `authenticator` | PostgREST user | Cambia rol segun JWT claim |
| `anon` | Rol anonimo | Acceso limitado via RLS |
| `authenticated` | Usuario autenticado | Acceso via RLS con `auth.uid()` |
| `service_role` | Admin de aplicacion | Bypassa RLS |
| `supabase_realtime_admin` | Realtime DB user | Acceso a replication |
| `dashboard_user` | Studio | Acceso a pg_meta queries |

### 7.2 Password de PostgreSQL

```bash
# Generar password seguro (solo alfanumerico para evitar URL encoding issues)
openssl rand -base64 32 | tr -d '/+=' | head -c 32
```

En `.env`:
```env
POSTGRES_PASSWORD=<password-generado-alfanumerico>
```

**IMPORTANTE:** Usar SOLO letras y numeros en `POSTGRES_PASSWORD` para evitar problemas de URL encoding en connection strings. Caracteres como `@`, `#`, `%` rompen las URIs de PostgreSQL.

### 7.3 pg_hba.conf Hardening

En self-hosted Supabase, `pg_hba.conf` se configura via init scripts. Para hardening adicional:

```
# Tipo   DB        Usuario              Direccion          Metodo
# Requerir SSL para todas las conexiones remotas
hostssl  all       all                  0.0.0.0/0          scram-sha-256
hostssl  all       all                  ::/0               scram-sha-256

# Conexiones locales (dentro de Docker network)
host     all       supabase_admin       172.16.0.0/12      scram-sha-256
host     all       supabase_auth_admin  172.16.0.0/12      scram-sha-256
host     all       supabase_storage_admin 172.16.0.0/12    scram-sha-256
host     all       authenticator        172.16.0.0/12      scram-sha-256

# NUNCA permitir trust en produccion
# host   all       all                  0.0.0.0/0          trust   # PROHIBIDO
```

**Reglas:**
- NUNCA usar `trust` como metodo de autenticacion en produccion
- Usar `scram-sha-256` en lugar de `md5` (mas seguro)
- Restringir conexiones a la subnet de Docker
- Requerir SSL (`hostssl`) para cualquier conexion fuera del Docker network

### 7.4 postgresql.conf Security Settings

```ini
# Autenticacion
password_encryption = scram-sha-256

# SSL
ssl = on
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'
ssl_min_protocol_version = TLSv1.2

# Logging para auditoria
log_connections = on
log_disconnections = on
log_statement = 'ddl'              # Loguear DDL statements
log_line_prefix = '%t [%p] %u@%d '

# Statement timeouts (proteccion contra queries infinitos)
statement_timeout = '30s'          # Timeout global
idle_in_transaction_session_timeout = '60s'

# Limites de conexion
max_connections = 200              # Ajustar segun VPS
superuser_reserved_connections = 3

# Deshabilitar funciones peligrosas para roles no-superuser
# (Ya manejado por Supabase via grants)
```

### 7.5 Extensions Audit

```sql
-- Listar extensiones instaladas
SELECT extname, extversion FROM pg_extension ORDER BY extname;

-- Extensiones de seguridad recomendadas:
-- pgcrypto (ya incluida) - funciones criptograficas
-- pgjwt (ya incluida) - verificacion JWT en SQL

-- Extensiones a evaluar deshabilitar si no se usan:
-- pg_graphql - reduce superficie de ataque si no usas GraphQL
-- pg_net - llamadas HTTP desde SQL (riesgo si mal configurado)
```

### 7.6 Comandos Peligrosos a Bloquear

Similar a lo que ya hacemos con Redis, bloquear comandos destructivos:

```sql
-- En un script de init, revocar permisos peligrosos de roles de aplicacion
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;

-- Verificar que anon/authenticated no pueden crear tablas
-- (Supabase ya lo maneja, pero verificar post-migracion)
```

---

## 8. Dashboard/Studio Protection

### 8.1 Basic Auth (Minimo)

El dashboard de Supabase Studio esta protegido SOLO por HTTP Basic Auth via Kong:

```env
# .env
DASHBOARD_USERNAME=admin_skapara
DASHBOARD_PASSWORD=CambiarEstaPassword2026!
```

**Reglas del password:**
- DEBE incluir al menos una letra (no solo numeros)
- NO usar caracteres especiales (limitacion del basic auth de Kong)
- Cambiar SIEMPRE el valor por defecto

### 8.2 Acceso Solo via VPN/IP Whitelist (RECOMENDADO)

**Opcion A: IP Whitelist en Caddy**

```caddyfile
# Caddyfile
admin.skapara.com {
    # Solo permitir IPs especificas
    @blocked not remote_ip 1.2.3.4 5.6.7.8
    respond @blocked 403

    reverse_proxy kong:8000
}
```

**Opcion B: IP Restriction en Kong**

```yaml
# kong.yml - servicio dashboard
plugins:
  - name: ip-restriction
    config:
      allow:
        - 1.2.3.4     # Tu IP fija
        - 10.0.0.0/8  # VPN subnet
  - name: basic-auth
```

**Opcion C: Deshabilitar Studio en Produccion**

Si no necesitas el dashboard en produccion (recomendado):

```yaml
# docker-compose.yml
services:
  studio:
    profiles:
      - debug  # Solo se levanta con: docker compose --profile debug up studio
```

### 8.3 Analytics UI Protection

El servicio Analytics/Logflare expone una UI en puerto 4000 que **NUNCA debe mapearse externamente**:

```yaml
services:
  analytics:
    # NO mapear el puerto 4000
    # ports:
    #   - "4000:4000"  # NUNCA en produccion
    expose:
      - "4000"  # Solo accesible dentro de Docker network
```

---

## 9. SSL/TLS Configuration

### 9.1 Caddy como Reverse Proxy (Recomendado)

Caddy gestiona certificados HTTPS automaticamente con Let's Encrypt:

```caddyfile
# Caddyfile
{
    email admin@skapara.com
}

# API endpoint (Kong)
api.skapara.com {
    reverse_proxy kong:8000 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Security headers
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
}

# Dashboard (opcional - solo con IP whitelist)
admin-db.skapara.com {
    @blocked not remote_ip 1.2.3.4
    respond @blocked 403

    reverse_proxy kong:8000
}
```

### 9.2 Headers de Seguridad

Agregar en Caddy para todas las respuestas:

| Header | Valor | Proposito |
|--------|-------|-----------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forzar HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevenir MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevenir clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Proteccion XSS legacy |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control de referrer |
| `Content-Security-Policy` | Segun aplicacion | Prevenir injection |

### 9.3 SSL para PostgreSQL (Interno)

Si necesitas SSL entre servicios Docker (paranoia mode):

```yaml
services:
  db:
    command: >
      postgres
      -c ssl=on
      -c ssl_cert_file=/etc/ssl/certs/server.crt
      -c ssl_key_file=/etc/ssl/private/server.key
    volumes:
      - ./certs/server.crt:/etc/ssl/certs/server.crt:ro
      - ./certs/server.key:/etc/ssl/private/server.key:ro
```

**Nota:** Dentro de Docker network, SSL entre servicios es generalmente innecesario si las redes estan aisladas correctamente. Es una capa adicional para entornos de alta seguridad.

---

## 10. Secrets Management

### 10.1 Jerarquia de Opciones (de menos a mas seguro)

| Nivel | Metodo | Cuando usar |
|-------|--------|-------------|
| 1 | `.env` file (gitignored) | Desarrollo local |
| 2 | Docker secrets | Produccion basica (single node) |
| 3 | HashiCorp Vault | Produccion seria |
| 4 | Cloud KMS (AWS/GCP/Azure) | Enterprise |
| 5 | Doppler / Infisical | SaaS secrets management |

### 10.2 Docker Secrets (Recomendado para VPS Single Node)

```yaml
# docker-compose.yml
secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  postgres_password:
    file: ./secrets/postgres_password.txt
  service_role_key:
    file: ./secrets/service_role_key.txt

services:
  db:
    secrets:
      - postgres_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password

  auth:
    secrets:
      - jwt_secret
    environment:
      GOTRUE_JWT_SECRET_FILE: /run/secrets/jwt_secret
```

**Nota:** No todos los servicios de Supabase soportan `_FILE` suffix para Docker secrets. Verificar compatibilidad antes de implementar. Como alternativa, usar un script de entrypoint que lea los secrets y los exporte como env vars.

### 10.3 Listado Completo de Secrets a Proteger

```env
# === CRITICOS (compromiso = acceso total) ===
JWT_SECRET=                    # Firma de TODOS los tokens
SERVICE_ROLE_KEY=              # Bypassa RLS
POSTGRES_PASSWORD=             # Acceso superuser a BD
SECRET_KEY_BASE=               # Realtime + Supavisor sessions
VAULT_ENC_KEY=                 # Encriptacion de Supavisor config

# === ALTOS (compromiso = acceso a servicios) ===
ANON_KEY=                      # API key publica (menos critica, pero proteger)
PG_META_CRYPTO_KEY=            # Connection strings en Studio
DASHBOARD_PASSWORD=            # Acceso al dashboard
SMTP_PASS=                     # Envio de emails (phishing risk)
LOGFLARE_PRIVATE_ACCESS_TOKEN= # Admin de analytics

# === MEDIOS (compromiso = funcionalidad parcial) ===
LOGFLARE_PUBLIC_ACCESS_TOKEN=  # Ingestion de logs
S3_PROTOCOL_ACCESS_KEY_SECRET= # Storage S3 backend
MINIO_ROOT_PASSWORD=           # MinIO admin

# === OAUTH (compromiso = suplantacion) ===
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_SECRET=
# etc.

# === CAPTCHA ===
TURNSTILE_SECRET_KEY=

# === DB ENCRYPTION ===
DB_ENCRYPTION_KEY=             # Encriptacion de datos sensibles en auth
```

### 10.4 Reglas de .env

```bash
# Permisos restrictivos
chmod 600 .env
chown root:root .env

# Verificar que esta en .gitignore
echo ".env" >> .gitignore
echo "secrets/" >> .gitignore

# NUNCA commitear
git status  # Verificar que .env no aparece
```

---

## 11. CORS Configuration

### 11.1 CORS en Kong

Configuracion del plugin CORS en `kong.yml` para produccion:

```yaml
# Configuracion GLOBAL para todos los servicios
plugins:
  - name: cors
    config:
      origins:
        - "https://skapara.com"
        - "https://www.skapara.com"
        - "https://admin.skapara.com"
      methods:
        - GET
        - HEAD
        - POST
        - PUT
        - PATCH
        - DELETE
        - OPTIONS
      headers:
        - Accept
        - Accept-Version
        - Authorization
        - Content-Length
        - Content-Type
        - Date
        - X-Auth-Token
        - apikey
        - x-client-info
        - range
      exposed_headers:
        - Content-Range
        - X-Total-Count
      credentials: true
      max_age: 3600
      preflight_continue: false
```

### 11.2 Errores Comunes de CORS

| Error | Causa | Solucion |
|-------|-------|----------|
| `No 'Access-Control-Allow-Origin'` | Dominio no en lista | Agregar dominio a `origins` |
| `Credentials flag is true` | `withCredentials` sin `credentials: true` | Habilitar `credentials` en Kong |
| `Method not allowed` | Metodo no listado | Agregar metodo a `methods` |
| Preflight fails | OPTIONS no manejado | Verificar que CORS plugin esta activo |
| CORS ok en API pero falla en storage | Storage maneja CORS propio | Configurar Storage CORS tambien |

### 11.3 CORS en GoTrue

GoTrue tambien tiene su propia configuracion CORS interna. Generalmente, Kong maneja CORS antes de que llegue a GoTrue, pero si hay conflictos:

```yaml
environment:
  # GoTrue respeta los headers que Kong agrega
  API_EXTERNAL_URL: "https://api.skapara.com"
```

---

## 12. Rate Limiting

### 12.1 Capas de Rate Limiting

En una instalacion correcta, hay multiples capas:

```
[Cloudflare] → Rate limiting L7 (WAF rules)
    ↓
[Caddy] → Rate limiting basico (si se configura)
    ↓
[Kong] → Rate limiting por ruta via plugin
    ↓
[GoTrue] → Rate limiting interno por endpoint
    ↓
[PostgREST] → Statement timeouts
    ↓
[PostgreSQL] → max_connections + statement_timeout
```

### 12.2 Kong Rate Limiting Plugin

```yaml
# Agregar a servicios individuales en kong.yml
services:
  - name: auth-v1
    plugins:
      - name: rate-limiting
        config:
          second: 5       # 5 req/s
          minute: 60      # 60 req/min
          hour: 1000      # 1000 req/h
          policy: local   # In-memory (suficiente para single-node)
          fault_tolerant: true
          hide_client_headers: false  # Enviar X-RateLimit-* headers
          # Para usar Redis como backend:
          # policy: redis
          # redis_host: redis
          # redis_port: 6379

  - name: rest-v1
    plugins:
      - name: rate-limiting
        config:
          second: 100
          minute: 2000
          hour: 50000
          policy: local
```

### 12.3 GoTrue Rate Limits (Interno)

```yaml
# Ya documentado en seccion 3.2
GOTRUE_RATE_LIMIT_HEADER: "X-Forwarded-For"
GOTRUE_RATE_LIMIT_EMAIL_SENT: 30
GOTRUE_RATE_LIMIT_SMS_SENT: 30
GOTRUE_RATE_LIMIT_VERIFY: 30
GOTRUE_RATE_LIMIT_TOKEN_REFRESH: 150
GOTRUE_RATE_LIMIT_ANONYMOUS_USERS: 30
GOTRUE_RATE_LIMIT_OTP: 30
```

### 12.4 PostgREST Limits

```yaml
environment:
  # Limite de filas por request (default: sin limite - PELIGROSO)
  PGRST_MAX_ROWS: 1000

  # Statement timeout
  PGRST_DB_PLAN_ENABLED: false  # NUNCA true en produccion (revela internals)

  # Pool de conexiones
  PGRST_DB_POOL: 10
  PGRST_DB_POOL_ACQUISITION_TIMEOUT: 10
```

### 12.5 Cloudflare Rate Limiting (Capa Externa)

En Cloudflare Free tier, configurar WAF rules basicas:

- Rate limit: 100 requests/10s por IP en `/auth/v1/*`
- Rate limit: 50 requests/10s por IP en `/rest/v1/*`
- Challenge: requests sin `User-Agent` header
- Block: requests con patrones de SQL injection en query string

---

## 13. Backups y Recovery

### 13.1 Backup Automatizado con pg_dump

```bash
#!/bin/bash
# scripts/backup-db.sh
set -euo pipefail

BACKUP_DIR="/backups/supabase"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
DB_CONTAINER="supabase-db"

# Crear directorio
mkdir -p "${BACKUP_DIR}"

# Dump completo (todos los schemas incluido auth, storage, etc.)
docker exec "${DB_CONTAINER}" pg_dump \
  -U postgres \
  --format=custom \
  --compress=9 \
  --file="/tmp/backup_${TIMESTAMP}.dump" \
  postgres

# Copiar fuera del contenedor
docker cp "${DB_CONTAINER}:/tmp/backup_${TIMESTAMP}.dump" \
  "${BACKUP_DIR}/backup_${TIMESTAMP}.dump"

# Limpiar dentro del contenedor
docker exec "${DB_CONTAINER}" rm "/tmp/backup_${TIMESTAMP}.dump"

# Retention: borrar backups mas viejos que N dias
find "${BACKUP_DIR}" -name "backup_*.dump" -mtime +${RETENTION_DAYS} -delete

# Log
echo "[$(date)] Backup completado: backup_${TIMESTAMP}.dump ($(du -h ${BACKUP_DIR}/backup_${TIMESTAMP}.dump | cut -f1))"
```

### 13.2 Cron para Backups Automaticos

```bash
# Editar crontab
crontab -e

# Backup diario a las 3:00 AM
0 3 * * * /opt/supabase/scripts/backup-db.sh >> /var/log/supabase-backup.log 2>&1

# Backup adicional antes de schema changes (manual)
# /opt/supabase/scripts/backup-db.sh
```

### 13.3 Backup como Servicio Docker

Usar `pg-backup-scheduler` como sidecar:

```yaml
# docker-compose.yml
services:
  backup:
    image: ghcr.io/mxschmitt/pg-backup-scheduler:latest
    environment:
      PG_CONNECTION_STRING: "postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/postgres"
      BACKUP_SCHEDULE: "0 3 * * *"  # 3:00 AM diario
      BACKUP_RETENTION_DAYS: 30
      BACKUP_DIR: /backups
    volumes:
      - ./backups:/backups
    depends_on:
      db:
        condition: service_healthy
    networks:
      - db
    restart: unless-stopped
```

### 13.4 Backup de Storage

```bash
#!/bin/bash
# scripts/backup-storage.sh
BACKUP_DIR="/backups/supabase-storage"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Si usas filesystem local
tar czf "${BACKUP_DIR}/storage_${TIMESTAMP}.tar.gz" \
  ./volumes/storage/

# Si usas S3 - los datos ya estan en S3, solo necesitas backup de metadata en BD
```

### 13.5 Restore

```bash
# Restore de backup
docker exec -i supabase-db pg_restore \
  -U postgres \
  --clean \
  --if-exists \
  -d postgres \
  < /backups/supabase/backup_20260309_030000.dump
```

---

## 14. Monitoring y Alertas

### 14.1 Stack de Observabilidad Recomendado

```
[Vector] → Recolecta logs de todos los contenedores
    ↓
[Logflare/Analytics] → Almacena y permite buscar logs
    ↓
[Prometheus] → Scrape metricas cada 15s
    ↓
[Grafana] → Dashboards + alertas
```

### 14.2 Vector Configuration (Ya incluido)

Vector esta incluido en el docker-compose oficial y recolecta logs de todos los contenedores:

```yaml
services:
  vector:
    image: timberio/vector:0.28.1-alpine
    volumes:
      - ./volumes/logs/vector.yml:/etc/vector/vector.yml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      LOGFLARE_API_KEY: "${LOGFLARE_PUBLIC_ACCESS_TOKEN}"
    depends_on:
      analytics:
        condition: service_healthy
```

### 14.3 Prometheus + Grafana

```yaml
# docker-compose.monitoring.yml (compose override)
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    networks:
      - monitoring
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: "${GRAFANA_ADMIN_PASSWORD}"
      GF_USERS_ALLOW_SIGN_UP: "false"
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - monitoring
    restart: unless-stopped
```

**prometheus.yml:**
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'supabase-db'
    static_configs:
      - targets: ['db:5432']

  - job_name: 'kong'
    static_configs:
      - targets: ['kong:8001']  # Kong Admin API (NO exponer externamente)

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

### 14.4 Que Monitorear (Alertas Criticas)

| Metrica | Umbral | Accion |
|---------|--------|--------|
| PostgreSQL connections | > 80% max_connections | Investigar connection leaks |
| PostgreSQL replication lag | > 30s | Verificar storage I/O |
| Disk usage | > 85% | Limpiar o expandir disco |
| Auth failed logins | > 50/min | Posible brute force |
| Kong 5xx responses | > 5% | Investigar servicios backend |
| Kong latency p99 | > 2s | Investigar BD o servicios lentos |
| Container restarts | > 3 en 5min | Investigar logs del contenedor |
| Certificate expiry | < 14 dias | Verificar auto-renewal de Caddy |
| Backup age | > 25h | Verificar cron de backup |
| Memory usage | > 90% | Investigar memory leaks |

### 14.5 Logs Importantes a Revisar

```bash
# Logs de auth (intentos de login, signups, errores)
docker logs supabase-auth --tail 100

# Logs de Kong (requests, rate limits, errores)
docker logs supabase-kong --tail 100

# Logs de PostgreSQL (conexiones, queries lentos, errores)
docker logs supabase-db --tail 100

# Buscar errores criticos en todos los servicios
docker compose logs --tail 200 | grep -i "error\|fatal\|panic\|critical"
```

### 14.6 CrowdSec Integration (Deteccion de Amenazas)

```bash
# Instalar CrowdSec
curl -s https://install.crowdsec.net/ | sudo bash
sudo apt install crowdsec crowdsec-firewall-bouncer

# Configurar adquisicion de logs de Supabase
cat > /etc/crowdsec/acquis.d/supabase.yaml << 'EOF'
source: docker
container_name:
  - supabase-db
labels:
  type: postgres
---
source: docker
container_name:
  - supabase-kong
labels:
  type: nginx
EOF

# Instalar coleccion de deteccion para Supabase
sudo cscli collections install crowdsecurity/supabase-compose
sudo systemctl reload crowdsec

# Verificar que esta detectando
sudo cscli metrics
sudo cscli decisions list
```

---

## 15. Errores Comunes a Evitar

### 15.1 Secrets y Keys

| Error | Consecuencia | Solucion |
|-------|-------------|----------|
| Usar JWT_SECRET por defecto | Cualquiera puede generar tokens validos | Generar secret criptografico unico |
| Commitear .env a git | Exposicion de TODOS los secrets | .gitignore + git-secrets + pre-commit hook |
| SERVICE_ROLE_KEY en frontend | Bypassa RLS desde el browser | Solo usar en server-side |
| ANON_KEY sin RLS | Acceso total a la BD | Habilitar RLS en TODAS las tablas |
| Caracteres especiales en POSTGRES_PASSWORD | Connection strings rotas | Solo alfanumerico |
| Password del dashboard solo numeros | Rechazado por Kong basic-auth | Incluir al menos una letra |

### 15.2 Network y Exposicion

| Error | Consecuencia | Solucion |
|-------|-------------|----------|
| Exponer puerto 5432 | Acceso directo a PostgreSQL | Solo acceso via Docker network |
| Exponer puerto 4000 | Analytics UI publica | No mapear puerto externamente |
| Kong sin reverse proxy | Sin HTTPS, sin headers de seguridad | Caddy delante de Kong |
| Dashboard publico sin restriccion IP | Acceso admin para atacantes | VPN o IP whitelist |
| No configurar firewall VPS | Todos los puertos accesibles | UFW: solo 22, 80, 443 |

### 15.3 Auth y Sessions

| Error | Consecuencia | Solucion |
|-------|-------------|----------|
| GOTRUE_MAILER_AUTOCONFIRM=true | Usuarios sin verificar email | false en produccion |
| InBucket como SMTP en produccion | Emails no llegan | Configurar SMTP real |
| No configurar URI_ALLOW_LIST | Open redirect vulnerability | Lista blanca de dominios |
| JWT_EXP muy largo (>1 semana) | Tokens robados validos mucho tiempo | 3600s (1h) recomendado |
| No rotar refresh tokens | Token theft sin deteccion | ROTATION_ENABLED=true |
| No habilitar CAPTCHA | Bot abuse en signup/login | Turnstile habilitado |

### 15.4 Database

| Error | Consecuencia | Solucion |
|-------|-------------|----------|
| Tablas sin RLS | Datos accesibles via ANON_KEY | RLS en TODAS las tablas |
| Politicas con `USING (true)` | RLS habilitado pero no protege | Verificar condiciones reales |
| trust en pg_hba.conf | Acceso sin password | scram-sha-256 siempre |
| Sin statement_timeout | Queries infinitos bloquean BD | 30s timeout |
| PGRST_MAX_ROWS sin limite | Dump de toda la tabla posible | Limitar a 1000 |
| pg_graphql habilitado sin uso | Superficie de ataque innecesaria | Deshabilitar si no se usa |

### 15.5 Operaciones

| Error | Consecuencia | Solucion |
|-------|-------------|----------|
| Sin backups automaticos | Perdida de datos irrecuperable | pg_dump diario + retencion |
| Sin monitoring | Problemas no detectados | Prometheus + Grafana |
| Sin log rotation | Disco lleno | Docker log driver con max-size |
| Actualizar sin backup previo | Migracion fallida sin rollback | Siempre backup antes de update |
| Mismo servidor para analytics y produccion | Analytics afecta rendimiento | Separar si es posible |

---

## Resumen de .env Completo para Produccion

```env
***REMOVED***
# SUPABASE SELF-HOSTED - PRODUCCION
***REMOVED***
# NUNCA commitear este archivo a git
# chmod 600 .env

# === JWT & API KEYS ===
JWT_SECRET=<64-chars-alphanumeric-generado-con-openssl>
ANON_KEY=<jwt-generado-con-rol-anon>
SERVICE_ROLE_KEY=<jwt-generado-con-rol-service_role>

# === DATABASE ===
POSTGRES_PASSWORD=<32-chars-alphanumeric-only>
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres

# === ENCRYPTION ===
SECRET_KEY_BASE=<64-chars-min>
VAULT_ENC_KEY=<exactly-32-chars>
PG_META_CRYPTO_KEY=<32-chars-min>

# === DASHBOARD ===
DASHBOARD_USERNAME=admin_skapara
DASHBOARD_PASSWORD=<password-con-letras-y-numeros>

# === URLs ===
SITE_URL=https://skapara.com
API_EXTERNAL_URL=https://api.skapara.com
SUPABASE_PUBLIC_URL=https://api.skapara.com

# === AUTH (GoTrue) ===
GOTRUE_SITE_URL=https://skapara.com
GOTRUE_URI_ALLOW_LIST=https://skapara.com/*,https://admin.skapara.com/*
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_SECRET=${JWT_SECRET}
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_EXTERNAL_EMAIL_ENABLED=true

# Auth - Password
GOTRUE_PASSWORD_MIN_LENGTH=8
GOTRUE_PASSWORD_REQUIRED_CHARACTERS=abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789
GOTRUE_PASSWORD_HIBP_ENABLED=true

# Auth - Sessions
GOTRUE_SESSIONS_TIMEBOX=24h
GOTRUE_SESSIONS_INACTIVITY_TIMEOUT=8h
GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true
GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=10

# Auth - Security
GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION=true
GOTRUE_SECURITY_CAPTCHA_ENABLED=true
GOTRUE_SECURITY_CAPTCHA_PROVIDER=turnstile
GOTRUE_SECURITY_CAPTCHA_SECRET=${TURNSTILE_SECRET_KEY}
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true

# Auth - Rate Limits
GOTRUE_RATE_LIMIT_HEADER=X-Forwarded-For
GOTRUE_RATE_LIMIT_EMAIL_SENT=30
GOTRUE_RATE_LIMIT_SMS_SENT=30
GOTRUE_RATE_LIMIT_VERIFY=30
GOTRUE_RATE_LIMIT_TOKEN_REFRESH=150
GOTRUE_RATE_LIMIT_ANONYMOUS_USERS=30

# Auth - MFA
GOTRUE_MFA_TOTP_ENROLL_ENABLED=true
GOTRUE_MFA_TOTP_VERIFY_ENABLED=true
GOTRUE_MFA_MAX_ENROLLED_FACTORS=10
GOTRUE_MFA_CHALLENGE_EXPIRY_DURATION=300

# === SMTP ===
GOTRUE_SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
GOTRUE_SMTP_PORT=587
GOTRUE_SMTP_USER=${SMTP_USER}
GOTRUE_SMTP_PASS=${SMTP_PASS}
GOTRUE_SMTP_ADMIN_EMAIL=noreply@skapara.com
GOTRUE_SMTP_SENDER_NAME=SKAPARA
GOTRUE_SMTP_MAX_FREQUENCY=60s

# === ANALYTICS ===
LOGFLARE_PUBLIC_ACCESS_TOKEN=<32-chars-min>
LOGFLARE_PRIVATE_ACCESS_TOKEN=<32-chars-min>

# === STORAGE ===
# STORAGE_BACKEND=file  # o s3 para produccion escalable
# S3_PROTOCOL_ACCESS_KEY_ID=
# S3_PROTOCOL_ACCESS_KEY_SECRET=

# === CAPTCHA ===
TURNSTILE_SECRET_KEY=<turnstile-secret>

# === POSTGREST ===
PGRST_MAX_ROWS=1000

# === OAUTH PROVIDERS ===
# GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
# GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=
# GOTRUE_EXTERNAL_GOOGLE_SECRET=
# GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://api.skapara.com/auth/v1/callback
```

---

## Fuentes y Referencias

- [Supabase Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase Auth Rate Limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase Password Security](https://supabase.com/docs/guides/auth/password-security)
- [Supabase JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase Auth Config (Self-Hosted)](https://supabase.com/docs/guides/self-hosting/auth/config)
- [Supabase Auth Environment Variables](https://deepwiki.com/supabase/auth/2.1-environment-variables-reference)
- [Supabase Self-Hosted Deployment Architecture](https://deepwiki.com/supabase/supabase/3-self-hosted-deployment)
- [GoTrue Auth Repository](https://github.com/supabase/auth)
- [Supabase Docker .env.example](https://github.com/supabase/supabase/blob/master/docker/.env.example)
- [Kong Configuration (kong.yml)](https://github.com/supabase/supabase/blob/master/docker/volumes/api/kong.yml)
- [Hardening Self-Hosted Supabase with CrowdSec](https://www.crowdsec.net/blog/hardening-self-hosted-supabase)
- [PostgREST Hardening](https://docs.postgrest.org/en/stable/admin.html)
- [Supabase Security Retro 2025](https://supabase.com/blog/supabase-security-2025-retro)
- [Supabase Security Suite](https://supabase.com/blog/hardening-supabase)
- [PostgreSQL Security Hardening](https://goteleport.com/blog/securing-postgres-postgresql/)
- [PostgreSQL Security Best Practices](https://www.bytebase.com/reference/postgres/how-to/postgres-security-best-practices/)
- [pg-backup-scheduler](https://github.com/mxschmitt/pg-backup-scheduler)
- [Supabase Grafana Observability](https://github.com/supabase/supabase-grafana)
- [Supabase Metrics API](https://supabase.com/docs/guides/telemetry/metrics/grafana-self-hosted)
- [Self-Hosting Community Discussion](https://github.com/orgs/supabase/discussions/39820)
- [Supabase Phone MFA Self-Hosted](https://supabase.com/docs/guides/self-hosting/self-hosted-phone-mfa)
