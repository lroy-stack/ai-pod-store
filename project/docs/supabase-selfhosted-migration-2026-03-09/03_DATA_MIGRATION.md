# Supabase Cloud -> Self-Hosted: Plan de Migracion Completo de Datos

**Fecha**: 2026-03-09
**Proyecto**: POD AI Store (SKAPARA)
**Autor**: Investigacion automatizada
**Estado**: DRAFT — Solo documentacion, sin modificar codigo

---

## Tabla de Contenidos

1. [Inventario del Sistema Actual](#1-inventario-del-sistema-actual)
2. [Pre-Requisitos](#2-pre-requisitos)
3. [Paso 1 — Setup Supabase Self-Hosted](#3-paso-1--setup-supabase-self-hosted)
4. [Paso 2 — Backup de la Base de Datos (Cloud)](#4-paso-2--backup-de-la-base-de-datos-cloud)
5. [Paso 3 — Preparacion del Destino](#5-paso-3--preparacion-del-destino)
6. [Paso 4 — Restauracion de la Base de Datos](#6-paso-4--restauracion-de-la-base-de-datos)
7. [Paso 5 — Migracion de Auth Users](#7-paso-5--migracion-de-auth-users)
8. [Paso 6 — Migracion de Storage](#8-paso-6--migracion-de-storage)
9. [Paso 7 — RLS Policies](#9-paso-7--rls-policies)
10. [Paso 8 — Functions, Triggers y Scheduled Jobs](#10-paso-8--functions-triggers-y-scheduled-jobs)
11. [Paso 9 — Realtime](#11-paso-9--realtime)
12. [Paso 10 — Edge Functions](#12-paso-10--edge-functions)
13. [Paso 11 — Webhooks](#13-paso-11--webhooks)
14. [Paso 12 — Actualizacion de Variables de Entorno](#14-paso-12--actualizacion-de-variables-de-entorno)
15. [Verificacion Post-Migracion](#15-verificacion-post-migracion)
16. [Riesgos y Mitigaciones](#16-riesgos-y-mitigaciones)
17. [Plan de Rollback](#17-plan-de-rollback)
18. [Downtime Estimado](#18-downtime-estimado)
19. [Checklist Final](#19-checklist-final)

---

## 1. Inventario del Sistema Actual

### Base de Datos
| Elemento | Cantidad | Notas |
|----------|----------|-------|
| Tablas (public schema) | 74 base + 25 particiones = 99 | Particiones: agent_events, messages, audit_log (by month) |
| Indexes | 393 | Incluyendo HNSW para pgvector |
| Extensions | 2 criticas | `uuid-ossp`, `vector` (pgvector 768-dim) |
| RLS Policies | ~90 ENABLE + ~150 CREATE POLICY | En 67+ archivos de migracion |
| Functions (PL/pgSQL) | ~30+ | search_documents, consume_credit_atomic, handle_new_user, etc. |
| Triggers | ~20+ | update_updated_at, after_review_change, on_auth_user_created, etc. |
| Migraciones SQL | 318 archivos | En `supabase/migrations/` |
| pg_cron jobs | 0 a nivel DB | Cron es via Next.js API routes (11 endpoints) |

### Storage Buckets
| Bucket | Publico | Uso |
|--------|---------|-----|
| `designs` | Si | Imagenes de disenos subidas por usuarios y AI |
| `avatars` | Si | Fotos de perfil de usuario |
| `mockups` | Si | Previews de productos generados |
| `review-photos` | Si | Fotos subidas en reviews |
| `marketing` | Si | Imagenes de hero campaigns y OG |

### Auth
- **Provider**: Supabase Auth (GoTrue)
- **Metodo**: Email/password (bcrypt hashes)
- **Trigger**: `on_auth_user_created` -> sync a `public.users`
- **No hay OAuth providers** configurados actualmente
- **No hay Edge Functions** (directorio `supabase/functions/` no existe)
- **No hay Database Webhooks** (no se usa `pg_net`)
- **No hay Realtime subscriptions** activas en el codigo

### Cron Jobs (App-Level, NO database-level)
Los cron jobs son Next.js API routes, NO pg_cron:
- `/api/cron/sync-printify` — Sync productos
- `/api/cron/retry-printify-orders` — Reintentar ordenes fallidas
- `/api/cron/cleanup-personal` — Limpiar datos personales
- `/api/cron/cleanup-temp-products` — Limpiar productos temporales
- `/api/cron/cleanup` — Limpieza general
- `/api/cron/abandoned-cart-recovery` — Carritos abandonados
- `/api/cron/product-metrics` — Metricas de productos
- `/api/cron/hard-delete-accounts` — Eliminacion de cuentas
- `/api/cron/check-delivery-status` — Estado de entregas
- `/api/cron/drip` — Email drip campaigns
- `/api/cron/zombie-reaper` — Limpieza de sesiones muertas

**Implicacion**: Estos cron jobs NO necesitan migracion de pg_cron. Solo necesitan que las URLs de Supabase en las env vars apunten al nuevo self-hosted.

---

## 2. Pre-Requisitos

### Software Necesario
```bash
# Supabase CLI (v2+)
npm install -g supabase

# PostgreSQL client
brew install postgresql    # macOS
# o apt install postgresql-client  # Ubuntu

# rclone (para Storage migration)
brew install rclone        # macOS
# o apt install rclone     # Ubuntu

# Docker + Docker Compose
docker --version           # >= 24.0
docker compose version     # >= 2.20
```

### Hardware Minimo VPS
| Recurso | Minimo | Recomendado |
|---------|--------|-------------|
| RAM | 4 GB | 8+ GB |
| CPU | 2 cores | 4+ cores |
| Disco | 50 GB SSD | 80+ GB SSD |
| Red | 100 Mbps | 1 Gbps |

> **NOTA**: El stack actual del proyecto (frontend, admin, podclaw, redis, rembg, crawl4ai, caddy, prometheus, grafana, loki) ya consume ~3.5 GB RAM. Supabase self-hosted anade ~2-3 GB mas (PostgreSQL, GoTrue, PostgREST, Kong, Storage, Realtime, Supavisor, imgproxy). **Total estimado: 6-8 GB RAM**.

### Antes de Empezar
1. **Snapshot/backup del VPS** antes de cualquier cambio
2. **No pausar ni eliminar** el proyecto Cloud hasta validar al 100%
3. **Preparar ventana de mantenimiento** (ver seccion Downtime)
4. **Comunicar a usuarios** que habra un periodo breve de indisponibilidad

---

## 3. Paso 1 — Setup Supabase Self-Hosted

### 3.1 Clonar y Configurar

```bash
# En el VPS, directorio del proyecto
cd /opt/pod-ai  # o donde este el proyecto

# Clonar repo oficial de Supabase (solo Docker files)
git clone --depth 1 https://github.com/supabase/supabase /opt/supabase-docker
cd /opt/supabase-docker/docker

# Copiar env de ejemplo
cp .env.example .env
```

### 3.2 Generar Secrets (CRITICO — NO usar defaults)

```bash
# JWT Secret (base para ANON_KEY y SERVICE_ROLE_KEY)
JWT_SECRET=$(openssl rand -base64 48)

# Postgres password (solo letras y numeros para evitar URL encoding)
POSTGRES_PASSWORD=$(openssl rand -hex 24)

# Encryption keys
SECRET_KEY_BASE=$(openssl rand -hex 32)   # min 64 chars
VAULT_ENC_KEY=$(openssl rand -hex 16)     # exactamente 32 chars
PG_META_CRYPTO_KEY=$(openssl rand -hex 16) # min 32 chars

# Storage S3
S3_PROTOCOL_ACCESS_KEY_ID=$(openssl rand -hex 16)
S3_PROTOCOL_ACCESS_KEY_SECRET=$(openssl rand -hex 24)

# Logflare (monitoring interno)
LOGFLARE_PUBLIC_ACCESS_TOKEN=$(openssl rand -hex 16)
LOGFLARE_PRIVATE_ACCESS_TOKEN=$(openssl rand -hex 16)

# Dashboard
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=$(openssl rand -hex 12)  # min 1 letra, sin chars especiales

echo "JWT_SECRET=$JWT_SECRET"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
# ... imprimir todos para copiar al .env
```

### 3.3 Generar API Keys (ANON_KEY y SERVICE_ROLE_KEY)

Las API keys son JWTs firmados con el JWT_SECRET. Usar la herramienta de Supabase:
- Ir a https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
- O generar manualmente:

```bash
# Instalar jwt-cli o usar Node.js:
node -e "
const jwt = require('jsonwebtoken');
const JWT_SECRET = '$JWT_SECRET';

// ANON KEY (role: anon, exp: 5 years)
const anonKey = jwt.sign(
  { role: 'anon', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 5*365*24*3600 },
  JWT_SECRET
);

// SERVICE ROLE KEY (role: service_role, exp: 5 years)
const serviceKey = jwt.sign(
  { role: 'service_role', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 5*365*24*3600 },
  JWT_SECRET
);

console.log('ANON_KEY=' + anonKey);
console.log('SERVICE_ROLE_KEY=' + serviceKey);
"
```

### 3.4 Configurar .env

Editar `/opt/supabase-docker/docker/.env` con los valores generados:

```env
# IMPORTANTE — Configurar ANTES de iniciar
POSTGRES_PASSWORD=<generado>
JWT_SECRET=<generado>
ANON_KEY=<generado>
SERVICE_ROLE_KEY=<generado>
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<generado>

# URLs (ajustar al dominio real)
SUPABASE_PUBLIC_URL=https://db.tu-dominio.com:8000
API_EXTERNAL_URL=https://db.tu-dominio.com:8000
SITE_URL=https://tu-dominio.com

# SMTP (produccion)
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<tu-resend-api-key>
SMTP_ADMIN_EMAIL=admin@tu-dominio.com
SMTP_SENDER_NAME=SKAPARA

# Storage S3 Protocol
REGION=eu-central-1
S3_PROTOCOL_ACCESS_KEY_ID=<generado>
S3_PROTOCOL_ACCESS_KEY_SECRET=<generado>

# Encryption
SECRET_KEY_BASE=<generado>
VAULT_ENC_KEY=<generado>
PG_META_CRYPTO_KEY=<generado>
```

### 3.5 Iniciar Supabase Self-Hosted (VACIO — sin datos)

```bash
cd /opt/supabase-docker/docker

# Descargar imagenes
docker compose pull

# Iniciar en modo detached
docker compose up -d

# Verificar que todos los servicios estan healthy
docker compose ps
# Todos deben mostrar "Up (healthy)"

# Verificar acceso al dashboard
curl -s http://localhost:8000/auth/v1/health
# Debe retornar {"description":"GoTrue is a user registration..."}
```

### 3.6 Servicios de Supabase Self-Hosted

| Servicio | Puerto | Funcion |
|----------|--------|---------|
| Kong | 8000 | API Gateway |
| GoTrue (Auth) | 9999 (interno) | Autenticacion |
| PostgREST | 3000 (interno) | REST API sobre Postgres |
| Realtime | 4000 (interno) | WebSocket para cambios en DB |
| Storage | 5000 (interno) | Gestion de archivos (S3-compatible) |
| postgres-meta | 8080 (interno) | Metadata de Postgres |
| PostgreSQL | 5432 | Base de datos |
| Supavisor | 6543 | Connection pooler |
| imgproxy | 8081 (interno) | Procesamiento de imagenes |
| Edge Runtime | 5001 (interno) | Deno functions |
| Studio | 3000 (via Kong) | Dashboard visual |

---

## 4. Paso 2 — Backup de la Base de Datos (Cloud)

### 4.1 Obtener Connection String del Cloud

Ir al dashboard de Supabase Cloud -> Settings -> Database -> Connection string.

O usar la conexion directa conocida:
```
postgresql://postgres:[PASSWORD]@db.your-project.supabase.co:5432/postgres
```

### 4.2 Exportar con Supabase CLI (3 archivos)

**IMPORTANTE**: Usar `supabase db dump` en vez de `pg_dump` directo. El CLI aplica filtros especificos de Supabase: excluye schemas internos, strip roles reservados, y anade clausulas `IF NOT EXISTS` idempotentes.

```bash
# Directorio de trabajo para backups
mkdir -p /opt/migration-backup && cd /opt/migration-backup

# Conexion string del Cloud
CLOUD_DB_URL="postgresql://postgres:[PASSWORD]@db.your-project.supabase.co:5432/postgres"

# 1. Exportar ROLES (roles de base de datos)
supabase db dump --db-url "$CLOUD_DB_URL" -f roles.sql --role-only
echo "roles.sql: $(wc -l < roles.sql) lineas"

# 2. Exportar SCHEMA (tablas, indexes, constraints, RLS, functions, triggers)
supabase db dump --db-url "$CLOUD_DB_URL" -f schema.sql
echo "schema.sql: $(wc -l < schema.sql) lineas"

# 3. Exportar DATA (datos con COPY, mas eficiente que INSERT)
supabase db dump --db-url "$CLOUD_DB_URL" -f data.sql --use-copy --data-only
echo "data.sql: $(wc -l < data.sql) lineas"

# Verificar tamanos
ls -lah roles.sql schema.sql data.sql
```

### 4.3 Que Se Incluye en Cada Archivo

| Archivo | Contenido |
|---------|-----------|
| `roles.sql` | Definiciones de roles PostgreSQL (anon, authenticated, service_role, custom roles) |
| `schema.sql` | DDL completo: CREATE TABLE, CREATE INDEX, ALTER TABLE (RLS), CREATE POLICY, CREATE FUNCTION, CREATE TRIGGER, particiones, constraints |
| `data.sql` | Datos de TODAS las tablas incluyendo `auth.users`, `auth.identities`, `storage.buckets`, `storage.objects` (metadata), tablas public |

### 4.4 Verificacion del Backup

```bash
# Contar tablas en schema.sql
grep -c "CREATE TABLE" schema.sql

# Verificar que auth.users esta en data.sql
grep -c "COPY auth.users" data.sql
# Debe ser >= 1

# Verificar que storage.buckets esta en data.sql
grep -c "COPY storage.buckets" data.sql

# Verificar tamaño razonable
du -sh data.sql
# Para ~99 tablas con datos moderados, esperar 10MB-500MB
```

---

## 5. Paso 3 — Preparacion del Destino

### 5.1 Instalar Extensions Requeridas

Antes de restaurar, verificar que las extensions necesarias estan disponibles en el self-hosted:

```bash
# Conectar al Postgres self-hosted
SELFHOSTED_DB_URL="postgres://postgres:[POSTGRES_PASSWORD]@localhost:5432/postgres"

psql "$SELFHOSTED_DB_URL" -c "SELECT name FROM pg_available_extensions WHERE name IN ('uuid-ossp', 'vector', 'pgcrypto', 'pgjwt', 'pg_stat_statements') ORDER BY name;"
```

Las extensions requeridas por el proyecto:
- `uuid-ossp` — Generacion de UUIDs (viene preinstalada en Supabase)
- `vector` — pgvector para embeddings 768-dim (viene en la imagen Docker de Supabase)

**NOTA**: La imagen Docker oficial de Supabase (`supabase/postgres`) incluye pgvector preinstalado. Si usas una imagen custom de PostgreSQL, debes instalarlo manualmente:

```bash
# Solo si NO usas supabase/postgres:
apt-get install postgresql-16-pgvector
# O compilar desde fuente: https://github.com/pgvector/pgvector
```

### 5.2 Compatibilidad de Versiones PostgreSQL

**ALERTA**: Supabase Cloud puede correr PostgreSQL 17, pero el Docker self-hosted actualmente usa PostgreSQL 15. Aunque los dumps SQL son compatibles entre versiones, pueden haber problemas:

**Problemas conocidos en `data.sql`**:
- `SET transaction_timeout = 0` — Solo existe en PG17, no en PG15
- Tablas nuevas de Auth que no existen en self-hosted: `auth.oauth_clients`, `storage.buckets_vectors`
- Columnas anadidas en versiones mas nuevas de GoTrue/Auth

**Solucion**: Editar `data.sql` antes de restaurar:

```bash
# Comentar settings de PG17
sed -i 's/^SET transaction_timeout/-- SET transaction_timeout/' data.sql

# Verificar si hay tablas problematicas
grep "COPY auth.oauth_clients" data.sql
grep "COPY storage.buckets_vectors" data.sql
# Si existen, comentar esos bloques COPY completos (desde COPY hasta \.)
```

### 5.3 Parar Servicios que Escriben a la DB

Antes de restaurar, parar GoTrue y otros servicios que podrian interferir:

```bash
cd /opt/supabase-docker/docker
docker compose stop auth realtime storage rest meta
# Solo dejar postgres corriendo
```

---

## 6. Paso 4 — Restauracion de la Base de Datos

### 6.1 Restauracion Completa (Single Transaction)

```bash
SELFHOSTED_DB_URL="postgres://postgres.your-tenant-id:[POSTGRES_PASSWORD]@localhost:5432/postgres"

# Restaurar TODO en una sola transaccion atomica
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$SELFHOSTED_DB_URL"
```

**Flags criticos**:
- `--single-transaction`: Si cualquier paso falla, se hace rollback de TODO
- `--variable ON_ERROR_STOP=1`: Para en el primer error
- `SET session_replication_role = replica`: **Desactiva triggers** durante la importacion de datos, previniendo problemas como doble-encriptacion de columnas o triggers que disparen sobre datos ya existentes

### 6.2 Restauracion en Dos Fases (Recomendado para Debugging)

Si la restauracion falla, ejecutar primero SIN `--single-transaction` para identificar TODOS los errores:

```bash
# FASE 1: Identificar errores (sin parar en el primero)
psql \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$SELFHOSTED_DB_URL" 2>&1 | tee restore-errors.log

# Revisar errores
grep -i "error" restore-errors.log
grep -i "already exists" restore-errors.log

# FASE 2: Corregir errores en los archivos SQL y re-ejecutar con --single-transaction
# (despues de limpiar la DB del intento fallido)
```

### 6.3 Reset de la DB Self-Hosted (si necesitas reintentar)

```bash
cd /opt/supabase-docker/docker

# CUIDADO: Esto DESTRUYE todos los datos del self-hosted
docker compose down -v   # Elimina volumenes
docker compose up -d db  # Reiniciar solo Postgres
sleep 10                 # Esperar que inicie

# Re-ejecutar restauracion
```

### 6.4 Resetear Sequences

Despues de importar datos, los sequences (auto-increment) pueden estar desincronizados. Ejecutar:

```sql
-- Conectar al self-hosted
-- Resetear todos los sequences al max valor actual
DO $$
DECLARE
  r RECORD;
  max_val BIGINT;
BEGIN
  FOR r IN (
    SELECT
      schemaname,
      sequencename,
      -- Extraer tabla y columna del sequence name
      regexp_replace(sequencename, '_id_seq$|_seq$', '') AS base_name
    FROM pg_sequences
    WHERE schemaname IN ('public', 'auth')
  ) LOOP
    BEGIN
      -- Intentar obtener el max id de la tabla asociada
      EXECUTE format(
        'SELECT COALESCE(MAX(id), 0) FROM %I.%I',
        r.schemaname,
        r.base_name
      ) INTO max_val;

      IF max_val > 0 THEN
        EXECUTE format(
          'SELECT setval(%L, %s)',
          r.schemaname || '.' || r.sequencename,
          max_val
        );
        RAISE NOTICE 'Reset % to %', r.sequencename, max_val;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Tabla no encontrada o columna diferente, ignorar
      RAISE NOTICE 'Skipped %: %', r.sequencename, SQLERRM;
    END;
  END LOOP;
END $$;
```

---

## 7. Paso 5 — Migracion de Auth Users

### 7.1 Como Funciona

La tabla `auth.users` se exporta/importa como parte del `data.sql` en el Paso 4. **Los password hashes (bcrypt) son totalmente compatibles** entre Supabase Cloud y Self-Hosted porque ambos usan la misma implementacion de GoTrue con bcrypt `GenerateFromPassword`.

### 7.2 Que Se Migra Automaticamente (via data.sql)

| Tabla Auth | Contenido | Migracion |
|------------|-----------|-----------|
| `auth.users` | Email, encrypted_password (bcrypt), metadata, email_confirmed_at | Automatico via data.sql |
| `auth.identities` | Proveedores de identidad vinculados | Automatico via data.sql |
| `auth.sessions` | Sesiones activas | Se exportan pero seran INVALIDAS |
| `auth.refresh_tokens` | Tokens de refresco | Se exportan pero seran INVALIDOS |
| `auth.mfa_factors` | Factores MFA (si existen) | Automatico via data.sql |
| `auth.mfa_challenges` | Challenges MFA pendientes | Automatico via data.sql |

### 7.3 Caveats Criticos

1. **JWT Secret diferente**: El self-hosted tiene un JWT_SECRET distinto al Cloud. Esto significa:
   - **TODOS los tokens existentes se invalidan**
   - **Los usuarios deben re-autenticarse** (login de nuevo)
   - Las sesiones activas se rompen
   - Los refresh tokens dejan de funcionar

2. **Opcion para preservar sesiones**: Si quieres que los usuarios NO tengan que re-loguearse:
   ```bash
   # Obtener el JWT_SECRET del proyecto Cloud:
   # Dashboard -> Settings -> API -> JWT Settings -> JWT Secret
   # Usar ESE MISMO secret en el .env del self-hosted
   ```
   **RIESGO**: Si alguien comprometio el secret del Cloud, lo propagas al self-hosted.
   **RECOMENDACION**: Generar un nuevo JWT_SECRET y forzar re-login. Es mas seguro.

3. **Password hashes**: Son 100% compatibles. Los usuarios pueden hacer login con su password actual sin ningun cambio.

4. **Email confirmation status**: Se preserva via `email_confirmed_at`. Usuarios que ya confirmaron email NO necesitan re-confirmar.

5. **Trigger `on_auth_user_created`**: Ya esta incluido en el schema dump. Los usuarios existentes ya tienen su row en `public.users`. Para NUEVOS usuarios post-migracion, el trigger funcionara normalmente.

### 7.4 Validacion de Auth Post-Migracion

```sql
-- Contar usuarios migrados
SELECT count(*) FROM auth.users;

-- Verificar que passwords estan intactos
SELECT id, email,
  LEFT(encrypted_password, 7) AS hash_prefix,  -- Debe ser '$2a$10$' (bcrypt)
  email_confirmed_at IS NOT NULL AS email_confirmed
FROM auth.users
LIMIT 5;

-- Verificar sync con public.users
SELECT
  (SELECT count(*) FROM auth.users) AS auth_count,
  (SELECT count(*) FROM public.users) AS public_count;
-- Deben ser iguales (o public >= auth si hay datos legacy)

-- Verificar que NO hay identities huerfanas
SELECT count(*) FROM auth.identities i
LEFT JOIN auth.users u ON i.user_id = u.id
WHERE u.id IS NULL;
-- Debe ser 0
```

---

## 8. Paso 6 — Migracion de Storage

### 8.1 Por Que NO Se Puede Copiar Archivos Directamente

> **CRITICO**: Copiar archivos directamente al volumen Docker (`volumes/storage/`) NO FUNCIONA. El sistema de Storage de Supabase usa metadata interna en tablas PostgreSQL (`storage.objects`, `storage.buckets`). Los archivos deben transferirse via el protocolo S3 para que se creen los registros de metadata correctamente.

Sin embargo, dado que estamos restaurando `data.sql` que incluye `storage.objects` y `storage.buckets`, los registros de metadata YA ESTAN en la DB. Solo necesitamos transferir los archivos binarios.

### 8.2 Configurar S3 Credentials

**En Supabase Cloud** — Obtener credenciales S3:
1. Dashboard -> Storage -> S3 Configuration -> Access Keys
2. Generar nuevas credenciales
3. Anotar:
   - Endpoint: `https://your-project.supabase.co/storage/v1/s3`
   - Region: (la del proyecto, ej: `eu-central-1`)
   - Access Key ID
   - Secret Access Key

**En Self-Hosted** — Ya configurado en `.env`:
- `S3_PROTOCOL_ACCESS_KEY_ID`
- `S3_PROTOCOL_ACCESS_KEY_SECRET`
- `REGION`
- Endpoint: `http://localhost:8000/storage/v1/s3`

### 8.3 Configurar rclone

```bash
# Crear/editar configuracion de rclone
cat > ~/.config/rclone/rclone.conf << 'EOF'
[supabase-cloud]
type = s3
provider = Other
access_key_id = <cloud-access-key-id>
secret_access_key = <cloud-secret-access-key>
endpoint = https://your-project.supabase.co/storage/v1/s3
region = eu-central-1

[supabase-selfhosted]
type = s3
provider = Other
access_key_id = <selfhosted-S3_PROTOCOL_ACCESS_KEY_ID>
secret_access_key = <selfhosted-S3_PROTOCOL_ACCESS_KEY_SECRET>
endpoint = http://localhost:8000/storage/v1/s3
region = eu-central-1
EOF

# Verificar conectividad
rclone lsd supabase-cloud:      # Debe listar buckets
rclone lsd supabase-selfhosted: # Debe listar buckets (restaurados de data.sql)
```

### 8.4 Crear Buckets en Self-Hosted (si no existen)

Si los buckets NO se restauraron con `data.sql`, crearlos manualmente:

```sql
-- Conectar al Postgres self-hosted
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('designs', 'designs', true, NULL, NULL),
  ('avatars', 'avatars', true, NULL, NULL),
  ('mockups', 'mockups', true, NULL, NULL),
  ('review-photos', 'review-photos', true, NULL, NULL),
  ('marketing', 'marketing', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
```

### 8.5 Transferir Archivos

```bash
# Transferir TODOS los buckets
for bucket in designs avatars mockups review-photos marketing; do
  echo "=== Copiando bucket: $bucket ==="
  rclone copy \
    "supabase-cloud:$bucket" \
    "supabase-selfhosted:$bucket" \
    --progress \
    --transfers 4 \
    --checkers 8 \
    --timeout 30m
  echo "=== Completado: $bucket ==="
done
```

### 8.6 Verificar Storage Migration

```bash
# Comparar tamanos por bucket
for bucket in designs avatars mockups review-photos marketing; do
  echo "=== $bucket ==="
  echo "Cloud:"
  rclone size "supabase-cloud:$bucket"
  echo "Self-hosted:"
  rclone size "supabase-selfhosted:$bucket"
  echo ""
done
```

### 8.7 URLs Publicas — Cambio Necesario

Las URLs de storage cambian:

| Tipo | Cloud | Self-Hosted |
|------|-------|-------------|
| URL publica | `https://your-project.supabase.co/storage/v1/object/public/...` | `https://db.tu-dominio.com:8000/storage/v1/object/public/...` |
| URL firmada | `https://your-project.supabase.co/storage/v1/object/sign/...` | `https://db.tu-dominio.com:8000/storage/v1/object/sign/...` |

**Impacto en el proyecto**:
- Las URLs de imagenes almacenadas en la DB (ej: `avatar_url`, `image_url` en productos, `og_image_url`) apuntan al dominio Cloud
- **Necesitan actualizarse** en la base de datos:

```sql
-- Actualizar TODAS las URLs de storage en la DB
-- EJECUTAR DESPUES de confirmar que el storage funciona en self-hosted

-- Productos
UPDATE products SET image_url = REPLACE(image_url,
  'https://your-project.supabase.co/storage/v1',
  'https://db.tu-dominio.com:8000/storage/v1')
WHERE image_url LIKE '%your-project.supabase.co%';

-- Usuarios (avatars)
UPDATE users SET avatar_url = REPLACE(avatar_url,
  'https://your-project.supabase.co/storage/v1',
  'https://db.tu-dominio.com:8000/storage/v1')
WHERE avatar_url LIKE '%your-project.supabase.co%';

-- Disenos
UPDATE designs SET image_url = REPLACE(image_url,
  'https://your-project.supabase.co/storage/v1',
  'https://db.tu-dominio.com:8000/storage/v1')
WHERE image_url LIKE '%your-project.supabase.co%';

-- Hero campaigns
UPDATE hero_campaigns SET image_url = REPLACE(image_url,
  'https://your-project.supabase.co/storage/v1',
  'https://db.tu-dominio.com:8000/storage/v1')
WHERE image_url LIKE '%your-project.supabase.co%';

UPDATE hero_campaigns SET og_image_url = REPLACE(og_image_url,
  'https://your-project.supabase.co/storage/v1',
  'https://db.tu-dominio.com:8000/storage/v1')
WHERE og_image_url LIKE '%your-project.supabase.co%';

-- NOTA: Las imagenes de productos de Printful/Printify NO estan en Supabase Storage.
-- Solo las subidas por usuarios/AI estan en Storage.
```

**ALTERNATIVA**: Si el reverse proxy (Caddy) puede manejar ambos dominios, se podria configurar un redirect/proxy de las URLs antiguas a las nuevas como medida temporal.

---

## 9. Paso 7 — RLS Policies

### 9.1 Se Exportan Automaticamente

Las RLS policies **SI se exportan con `supabase db dump`** en el archivo `schema.sql`. Esto incluye:
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- `CREATE POLICY ... ON ... FOR ... TO ... USING (...) WITH CHECK (...)`

El proyecto tiene ~90 sentencias `ENABLE ROW LEVEL SECURITY` y ~150+ politicas definidas en 67+ archivos de migracion. Todas se incluyen en el dump del schema.

### 9.2 Verificar RLS Post-Migracion

```sql
-- Contar tablas con RLS habilitado
SELECT count(*)
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
-- Comparar con el numero esperado (~50+)

-- Listar TODAS las policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- Contar policies por tabla
SELECT tablename, count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count DESC;
```

### 9.3 Policies Especiales de Storage

Las policies de storage (`storage.objects`, `storage.buckets`) tambien se exportan:

```sql
-- Verificar policies de storage
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;
```

Policies esperadas:
- `buckets_select_authenticated` — SELECT para authenticated
- `buckets_admin_all` — ALL para service_role
- Policies por bucket en `storage.objects` (marketing)

### 9.4 Posible Problema: Policies del Auth Schema

Si modificaste el auth schema con triggers o RLS adicionales, el dump estandar podria no incluirlos. Verificar:

```bash
# Comparar auth schema entre Cloud y Self-hosted
supabase db diff --db-url "$CLOUD_DB_URL" --schema auth --linked
```

---

## 10. Paso 8 — Functions, Triggers y Scheduled Jobs

### 10.1 Functions PL/pgSQL

Todas las funciones se exportan en `schema.sql`. Functions criticas del proyecto:

| Funcion | Proposito | Schema |
|---------|-----------|--------|
| `handle_new_user()` | Sync auth.users -> public.users | public |
| `search_documents()` | Busqueda fulltext + vector | public |
| `hybrid_search_documents()` | Busqueda hibrida | public |
| `consume_credit_atomic()` | Consumo atomico de creditos | public |
| `add_credits()` | Anadir creditos idempotente | public |
| `decrement_usage()` | Decrementar uso | public |
| `issue_refund_atomic()` | Reembolso atomico | public |
| `update_product_rating()` | Recalcular rating de producto | public |
| `has_permission()` | RBAC check | public |
| `get_user_roles()` | Obtener roles de usuario | public |
| `get_current_tenant_id()` | Multi-tenancy | public |
| `increment_coupon_usage()` | Uso de cupones | public |
| `update_updated_at_column()` | Auto-update timestamps | public |
| `create_product_belief()` | Product beliefs AI | public |

### 10.2 Triggers

Todos los triggers se exportan en `schema.sql`:

| Trigger | Tabla | Evento |
|---------|-------|--------|
| `on_auth_user_created` | auth.users | AFTER INSERT |
| `after_review_change` | reviews | AFTER INSERT/UPDATE/DELETE |
| `update_*_updated_at` | Multiples tablas | BEFORE UPDATE |
| `trg_product_create_belief` | products | AFTER INSERT |
| `cron_runs_calculate_duration` | cron_runs | BEFORE INSERT |

### 10.3 Scheduled Jobs (pg_cron)

**El proyecto NO usa pg_cron a nivel de base de datos.** Todos los cron jobs se implementan como API routes de Next.js invocadas externamente (por Vercel Cron, un crontab externo, o un servicio similar).

Para el self-hosted, configurar un crontab en el VPS o usar un servicio de scheduling:

```crontab
# /etc/cron.d/pod-ai-crons
# Ajustar URLs y CRON_SECRET

# Cada 15 minutos — Sync Printify
*/15 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/sync-printify

# Cada hora — Retry ordenes fallidas
0 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/retry-printify-orders

# Cada 6 horas — Cleanup personal data
0 */6 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/cleanup-personal

# Diario a las 3 AM — Hard delete accounts
0 3 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/hard-delete-accounts

# Diario a las 4 AM — Cleanup general
0 4 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/cleanup

# Diario a las 5 AM — Cleanup temp products
0 5 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/cleanup-temp-products

# Cada 30 minutos — Check delivery status
*/30 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/check-delivery-status

# Cada hora — Abandoned cart recovery
0 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/abandoned-cart-recovery

# Diario a las 2 AM — Product metrics
0 2 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/product-metrics

# Cada 2 horas — Drip campaigns
0 */2 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/drip

# Cada 10 minutos — Zombie reaper
*/10 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/zombie-reaper
```

### 10.4 Validar Functions Post-Migracion

```sql
-- Listar todas las funciones en public schema
SELECT
  routine_name,
  routine_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Listar todos los triggers
SELECT
  trigger_schema,
  event_object_table,
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema IN ('public')
ORDER BY event_object_table, trigger_name;

-- Test critico: verificar que handle_new_user existe
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'handle_new_user';

-- Test critico: verificar que trigger on_auth_user_created existe
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```

---

## 11. Paso 9 — Realtime

### 11.1 Estado Actual

El proyecto **NO usa Supabase Realtime** activamente. No hay:
- `supabase.channel()` calls en el codigo
- `.on('postgres_changes', ...)` subscriptions
- Realtime broadcasts o presence

Solo hay una referencia en un comentario de `SignupBanner.tsx` sobre un "realtime refetch" que es simplemente un re-fetch HTTP, no una subscription de Realtime.

### 11.2 Configuracion en Self-Hosted (para el futuro)

El servicio Realtime viene incluido en el Docker Compose de Supabase. Configuracion recomendada:

```env
# En .env de Supabase self-hosted
# Limitar WAL para prevenir que el disco se llene
# Ajustar en postgresql.conf o via ALTER SYSTEM:
```

```sql
-- Prevenir buildup de WAL por Realtime
ALTER SYSTEM SET max_slot_wal_keep_size = '1GB';
SELECT pg_reload_conf();
```

### 11.3 Si Se Necesitara Realtime

Habria que configurar en el `.env` del docker-compose de Supabase:
- `REALTIME_DB_URL` apuntando al Postgres local
- El servicio ya escucha cambios via logical replication
- Asegurar que `wal_level = logical` en postgresql.conf

---

## 12. Paso 10 — Edge Functions

### 12.1 Estado Actual

El proyecto **NO tiene Edge Functions**. El directorio `supabase/functions/` no existe. Toda la logica serverless esta implementada como Next.js API routes.

### 12.2 Para el Futuro (si se necesitan)

El Docker Compose de Supabase self-hosted incluye un Edge Runtime (Deno). Para agregar funciones:

```bash
# En el VPS
cd /opt/supabase-docker/docker/volumes/functions/

# Crear una funcion
mkdir hello
cat > hello/index.ts << 'EOF'
Deno.serve(async (req) => {
  return new Response(JSON.stringify({ message: "Hello from self-hosted!" }), {
    headers: { "Content-Type": "application/json" },
  });
});
EOF

# Reiniciar el servicio
docker compose restart functions --no-deps

# Probar
curl http://localhost:8000/functions/v1/hello
```

**NOTA**: Edge Functions self-hosted estan en beta con posibles breaking changes. Para el proyecto actual, las API routes de Next.js son la solucion correcta y no necesitan migracion.

---

## 13. Paso 11 — Webhooks

### 13.1 Database Webhooks

El proyecto **NO usa database webhooks** (pg_net extension). Todos los webhooks son HTTP endpoints:
- Stripe webhooks -> `/api/webhooks/stripe`
- Printful webhooks -> `/api/webhooks/printful`

Estos webhooks NO dependen de Supabase y no necesitan migracion.

### 13.2 Webhook URLs que Cambiar

Si el dominio cambia, actualizar las URLs de webhook en los servicios externos:

| Servicio | Dashboard | URL a actualizar |
|----------|-----------|------------------|
| Stripe | stripe.com/dashboard/webhooks | `https://nuevo-dominio.com/api/webhooks/stripe` |
| Printful | printful.com | `https://nuevo-dominio.com/api/webhooks/printful` |

---

## 14. Paso 12 — Actualizacion de Variables de Entorno

### 14.1 Variables que Cambian

El archivo `.env` del proyecto (`/opt/pod-ai/project/.env`) necesita actualizarse:

```env
# ANTES (Cloud)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Cloud service key
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...     # Cloud anon key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# DESPUES (Self-Hosted)
SUPABASE_URL=http://kong:8000           # Interno via Docker network
# O si Supabase y la app NO estan en la misma red Docker:
# SUPABASE_URL=https://db.tu-dominio.com:8000
SUPABASE_SERVICE_KEY=<nuevo-service-role-key-generado>
SUPABASE_ANON_KEY=<nuevo-anon-key-generado>
NEXT_PUBLIC_SUPABASE_URL=https://db.tu-dominio.com  # Publico para el browser
NEXT_PUBLIC_SUPABASE_ANON_KEY=<nuevo-anon-key-generado>
```

### 14.2 Integracion con Docker Compose del Proyecto

Hay dos opciones de arquitectura:

**Opcion A: Supabase en el MISMO Docker Compose**
- Agregar los servicios de Supabase al `docker-compose.yml` existente
- Ventaja: Comunicacion interna via Docker network (mas rapido, sin TLS overhead)
- Desventaja: Compose file enorme, mas dificil de mantener

**Opcion B: Supabase en Docker Compose SEPARADO** (RECOMENDADO)
- Supabase en `/opt/supabase-docker/docker/docker-compose.yml`
- Proyecto en `/opt/pod-ai/project/docker-compose.yml`
- Crear Docker network compartida:

```bash
# Crear network externa compartida
docker network create pod-ai-shared

# En docker-compose de Supabase, agregar:
# networks:
#   pod-ai-shared:
#     external: true

# En docker-compose del proyecto, agregar:
# networks:
#   supabase:
#     external: true
#     name: pod-ai-shared
```

### 14.3 Rebuild del Frontend

El frontend necesita rebuild porque las NEXT_PUBLIC_* vars se embeben en build-time:

```bash
cd /opt/pod-ai/project
docker compose build frontend admin
docker compose up -d frontend admin
```

### 14.4 Service Worker Update

El service worker en `frontend/src/app/sw.ts` tiene un regex para cachear requests de Supabase Storage:

```typescript
// Linea 71 — ACTUALIZAR el patron:
matcher: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
// Cambiar a:
matcher: /^https:\/\/db\.tu-dominio\.com.*\/storage\/.*/i,
```

---

## 15. Verificacion Post-Migracion

### 15.1 Queries de Validacion de Datos

```sql
-- ========================================
-- SCRIPT DE VALIDACION POST-MIGRACION
-- Ejecutar contra el self-hosted
-- ========================================

-- 1. Contar tablas en public schema
SELECT count(*) AS tabla_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Esperado: ~74 (puede variar con particiones)

-- 2. Contar tablas con particiones
SELECT count(*) AS partition_count
FROM pg_inherits;
-- Esperado: ~25

-- 3. Contar indexes
SELECT count(*) AS index_count
FROM pg_indexes
WHERE schemaname = 'public';
-- Esperado: ~393

-- 4. Contar usuarios
SELECT count(*) FROM auth.users;
SELECT count(*) FROM public.users;

-- 5. Contar productos
SELECT count(*) FROM products;
SELECT count(*) FROM product_variants;

-- 6. Contar ordenes
SELECT count(*) FROM orders;
SELECT count(*) FROM order_items;

-- 7. Verificar extensions
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('uuid-ossp', 'vector', 'pgcrypto')
ORDER BY extname;

-- 8. Verificar RLS activo
SELECT count(*) AS rls_tables
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;

-- 9. Verificar policies
SELECT count(*) AS policy_count FROM pg_policies
WHERE schemaname IN ('public', 'storage');

-- 10. Verificar functions
SELECT count(*) AS function_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';

-- 11. Verificar triggers
SELECT count(*) AS trigger_count
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname IN ('public') AND NOT t.tgisinternal;

-- 12. Verificar que pgvector funciona
SELECT '[1,2,3]'::vector;
-- No debe dar error

-- 13. Verificar search function
SELECT proname FROM pg_proc WHERE proname = 'search_documents';
SELECT proname FROM pg_proc WHERE proname = 'hybrid_search_documents';

-- 14. Storage buckets
SELECT id, name, public FROM storage.buckets ORDER BY name;
-- Esperado: designs, avatars, mockups, review-photos, marketing
```

### 15.2 Tests Funcionales

```bash
# 1. Health check de la API de Supabase
curl -s https://db.tu-dominio.com:8000/rest/v1/ \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"

# 2. Listar productos via PostgREST
curl -s https://db.tu-dominio.com:8000/rest/v1/products?limit=5 \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"

# 3. Auth health
curl -s https://db.tu-dominio.com:8000/auth/v1/health

# 4. Storage health — listar buckets
curl -s https://db.tu-dominio.com:8000/storage/v1/bucket \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"

# 5. Test login con usuario existente
curl -s https://db.tu-dominio.com:8000/auth/v1/token?grant_type=password \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"l.roy.lwe@gmail.com","password":"TestPass123456!"}'
# Debe retornar un access_token y refresh_token

# 6. Test de una imagen de Storage
curl -s -o /dev/null -w "%{http_code}" \
  https://db.tu-dominio.com:8000/storage/v1/object/public/designs/<algun-archivo>
# Debe retornar 200

# 7. Frontend health
curl -s https://tu-dominio.com/api/health
```

### 15.3 Comparacion Cloud vs Self-Hosted

Ejecutar los mismos queries en AMBOS y comparar:

```bash
# Script de comparacion
CLOUD_URL="postgresql://postgres:[PASS]@db.your-project.supabase.co:5432/postgres"
SELF_URL="postgres://postgres:[PASS]@localhost:5432/postgres"

echo "=== CLOUD ==="
psql "$CLOUD_URL" -c "SELECT 'users' AS tbl, count(*) FROM users UNION ALL SELECT 'products', count(*) FROM products UNION ALL SELECT 'orders', count(*) FROM orders UNION ALL SELECT 'auth.users', count(*) FROM auth.users UNION ALL SELECT 'designs', count(*) FROM designs;"

echo "=== SELF-HOSTED ==="
psql "$SELF_URL" -c "SELECT 'users' AS tbl, count(*) FROM users UNION ALL SELECT 'products', count(*) FROM products UNION ALL SELECT 'orders', count(*) FROM orders UNION ALL SELECT 'auth.users', count(*) FROM auth.users UNION ALL SELECT 'designs', count(*) FROM designs;"
```

---

## 16. Riesgos y Mitigaciones

### Riesgo 1: Incompatibilidad de Versiones PostgreSQL
- **Probabilidad**: ALTA
- **Impacto**: Fallo en restauracion
- **Detalle**: Cloud puede estar en PG17, self-hosted en PG15
- **Mitigacion**:
  1. Ejecutar restauracion primero en un entorno de prueba
  2. Editar `data.sql` para comentar settings de PG17
  3. Comentar tablas que no existen en la version self-hosted
  4. Considerar usar una imagen Docker con PG17 si hay muchos problemas

### Riesgo 2: Perdida de Sesiones de Usuario
- **Probabilidad**: SEGURO (si se cambia JWT_SECRET)
- **Impacto**: MEDIO — usuarios deben re-loguearse
- **Mitigacion**: Comunicar a usuarios antes de la migracion. Los passwords se preservan.

### Riesgo 3: URLs de Storage Rotas
- **Probabilidad**: ALTA
- **Impacto**: ALTO — imagenes no cargan
- **Mitigacion**:
  1. Actualizar URLs en DB (script proporcionado en seccion 8.7)
  2. Configurar redirect en Caddy como fallback temporal
  3. Mantener el proyecto Cloud activo temporalmente como CDN

### Riesgo 4: Extensions No Disponibles
- **Probabilidad**: BAJA (pgvector viene preinstalado)
- **Impacto**: CRITICO — la app no funciona sin pgvector
- **Mitigacion**: Verificar `pg_available_extensions` ANTES de restaurar

### Riesgo 5: Volumen de Datos Grande
- **Probabilidad**: MEDIA
- **Impacto**: Downtime extendido
- **Mitigacion**:
  1. Comprimir backups: `gzip data.sql`
  2. Usar `--use-copy` (ya incluido) en vez de INSERT
  3. Transferir storage en paralelo con `--transfers 4`

### Riesgo 6: Fallo de la Red Durante Transferencia de Storage
- **Probabilidad**: MEDIA
- **Impacto**: BAJO — rclone es idempotente
- **Mitigacion**: rclone soporta resume/retry automatico. Re-ejecutar el mismo comando.

### Riesgo 7: Rendimiento Degradado
- **Probabilidad**: MEDIA
- **Impacto**: MEDIO
- **Mitigacion**:
  1. Ejecutar `ANALYZE` despues de la restauracion
  2. Verificar que indexes HNSW estan creados correctamente
  3. Monitorizar con Grafana

```sql
-- Post-migracion: recalcular estadisticas
ANALYZE;

-- Verificar indexes HNSW (pgvector)
SELECT indexname, indexdef
FROM pg_indexes
WHERE indexdef LIKE '%hnsw%';
```

### Riesgo 8: VPS Sin Suficiente RAM
- **Probabilidad**: ALTA si VPS < 8 GB
- **Impacto**: OOM kills, servicios inestables
- **Mitigacion**:
  1. Reducir servicios innecesarios de Supabase (Logflare, imgproxy si no se usa)
  2. Configurar memory limits en Docker Compose
  3. Habilitar swap como fallback: `fallocate -l 4G /swapfile`

---

## 17. Plan de Rollback

### 17.1 Estrategia: Cloud Como Fallback

**NUNCA eliminar ni pausar el proyecto Cloud hasta que el self-hosted este 100% validado y estable (minimo 1 semana en produccion).**

### 17.2 Pasos de Rollback

```bash
# 1. Detener la aplicacion
cd /opt/pod-ai/project
docker compose down

# 2. Restaurar variables de entorno al Cloud
# Editar .env:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=<cloud-service-key>
SUPABASE_ANON_KEY=<cloud-anon-key>
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<cloud-anon-key>

# 3. Rebuild frontend (NEXT_PUBLIC vars son build-time)
docker compose build frontend admin

# 4. Reiniciar
docker compose up -d

# 5. Verificar
curl -s https://tu-dominio.com/api/health
```

### 17.3 Sincronizacion Inversa (si hubo escrituras en self-hosted)

Si el self-hosted estuvo en produccion y recibio escrituras nuevas, necesitas sincronizar de vuelta al Cloud:

```bash
# Exportar solo datos NUEVOS del self-hosted
# (requiere identificar timestamps de cutover)
CUTOVER_TIME="2026-03-10 00:00:00"

psql "$SELF_URL" -c "
  COPY (SELECT * FROM orders WHERE created_at > '$CUTOVER_TIME')
  TO STDOUT WITH CSV HEADER" > new_orders.csv

psql "$SELF_URL" -c "
  COPY (SELECT * FROM auth.users WHERE created_at > '$CUTOVER_TIME')
  TO STDOUT WITH CSV HEADER" > new_users.csv

# Importar al Cloud
psql "$CLOUD_URL" -c "\COPY orders FROM 'new_orders.csv' WITH CSV HEADER"
```

**NOTA**: Este proceso es manual y propenso a errores. La mejor estrategia es:
1. Hacer cutover limpio en una ventana de mantenimiento
2. No tener escrituras en ambos lados simultaneamente
3. Si hay que volver al Cloud, asumir que los datos del periodo self-hosted se pierden o se sincronizan manualmente

### 17.4 Preservar el Cloud

```
Costo del plan Free de Supabase: $0/mes (mantener como backup)
Costo del plan Pro: $25/mes (si estas en Pro, considerar downgrade a Free)
```

Mantener el Cloud como readonly/backup no cuesta nada en el plan Free.

---

## 18. Downtime Estimado

### 18.1 Desglose por Fase

| Fase | Duracion Estimada | Downtime? |
|------|-------------------|-----------|
| Setup Supabase self-hosted | 30-60 min | NO |
| Backup Cloud (pg_dump) | 5-15 min | NO |
| Transfer backup al VPS | 5-30 min (depende de tamaño) | NO |
| Restaurar DB en self-hosted | 5-30 min (depende de tamaño) | NO |
| Transferir Storage (rclone) | 10-60 min (depende de volumen) | NO |
| **Cutover**: Parar app, cambiar env, rebuild, reiniciar | **15-30 min** | **SI** |
| Actualizar URLs de storage en DB | 5 min | Incluido en cutover |
| Validacion post-migracion | 15-30 min | Post-cutover, app ya up |

### 18.2 Downtime Total

**Downtime real para usuarios: 15-30 minutos**

La mayor parte del trabajo (setup, backup, restore, storage transfer) se puede hacer ANTES del cutover mientras la app sigue funcionando con el Cloud.

### 18.3 Estrategia para Minimizar Downtime

1. **Dia D-7**: Setup completo de Supabase self-hosted
2. **Dia D-3**: Hacer un "ensayo" completo de backup + restore + storage transfer
3. **Dia D-1**: Backup y restore final (datos casi actuales)
4. **Dia D (ventana de mantenimiento)**:
   - 00:00 — Poner app en modo mantenimiento
   - 00:05 — Ultimo backup diferencial (solo datos nuevos desde D-1)
   - 00:15 — Restaurar diferencial
   - 00:20 — Transfer Storage (solo archivos nuevos — rclone es incremental)
   - 00:25 — Cambiar env vars y rebuild
   - 00:30 — Arrancar app con self-hosted
   - 00:35 — Validacion
   - 00:45 — Abrir al publico
5. **Dia D+7**: Si todo bien, eliminar/downgrade proyecto Cloud

---

## 19. Checklist Final

### Pre-Migracion
- [ ] VPS con >= 8 GB RAM, 80 GB SSD
- [ ] Docker + Docker Compose instalados
- [ ] Supabase CLI instalado
- [ ] rclone instalado
- [ ] psql client instalado
- [ ] Snapshot/backup del VPS creado
- [ ] Supabase self-hosted levantado y healthy
- [ ] Todos los secrets generados (JWT, POSTGRES_PASSWORD, API keys, S3)
- [ ] Ensayo de migracion completado en entorno de prueba
- [ ] Ventana de mantenimiento comunicada a usuarios

### Migracion
- [ ] Backup `roles.sql` creado
- [ ] Backup `schema.sql` creado
- [ ] Backup `data.sql` creado (y editado para PG version compat)
- [ ] Archivos transferidos al VPS
- [ ] Extensions verificadas en self-hosted
- [ ] Servicios non-essential de Supabase parados (auth, realtime, storage, rest)
- [ ] Restauracion ejecutada sin errores
- [ ] Sequences reseteados
- [ ] Storage buckets verificados
- [ ] Storage objects transferidos via rclone
- [ ] Storage URLs actualizadas en DB
- [ ] App env vars actualizadas
- [ ] Frontend y Admin rebuildeados
- [ ] Service Worker patterns actualizados
- [ ] App reiniciada con self-hosted

### Post-Migracion
- [ ] Queries de validacion ejecutados (seccion 15.1)
- [ ] Counts de tablas coinciden entre Cloud y Self-Hosted
- [ ] Login funcional (test con usuario real)
- [ ] Imagenes de productos cargan correctamente
- [ ] Avatars de usuario cargan
- [ ] Checkout flow funciona (test con Stripe test mode)
- [ ] Cron jobs configurados y ejecutando
- [ ] ANALYZE ejecutado en la DB
- [ ] Monitoring (Grafana) verificado
- [ ] Webhook URLs actualizadas (Stripe, Printful)
- [ ] Cloud mantenido como fallback (minimo 7 dias)
- [ ] Performance acceptable (latencia, tiempos de carga)

---

## Fuentes

- [Supabase: Transferring from Cloud to Self-Host](https://supabase.com/docs/guides/troubleshooting/transferring-from-cloud-to-self-host-in-supabase-2oWNvW)
- [Supabase: Restore a Platform Project to Self-Hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
- [Supabase: Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase: Copy Storage Objects from Platform](https://supabase.com/docs/guides/self-hosting/copy-from-platform-s3)
- [Supabase: Configure S3 Storage](https://supabase.com/docs/guides/self-hosting/self-hosted-s3)
- [Supabase: Auth Self-Hosting Config](https://supabase.com/docs/guides/self-hosting/auth/config)
- [Supabase: Migrating Auth Users Between Projects](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)
- [Supabase: Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase: Edge Runtime Self-Hosted](https://supabase.com/blog/edge-runtime-self-hosted-deno-functions)
- [Supabase: Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Supabase: Cron Module](https://supabase.com/docs/guides/cron)
- [Supabase: Realtime Self-Hosting Config](https://supabase.com/docs/guides/self-hosting/realtime/config)
- [GitHub Discussion #22712: Transferring from cloud to self-host](https://github.com/orgs/supabase/discussions/22712)
- [GitHub Discussion #3897: Export Users and passwords](https://github.com/orgs/supabase/discussions/3897)
- [GitHub Discussion #36664: Migrating Authenticated Users](https://github.com/orgs/supabase/discussions/36664)
