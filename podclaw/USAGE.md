# PodClaw — Guia de Uso

## Prerequisitos

```bash
# Activar siempre el venv dedicado de PodClaw antes de cualquier comando
cd project/podclaw
source .venv/bin/activate
```

Las variables de entorno se cargan automaticamente desde:
1. `config/.env.required` (credenciales maestras)
2. `project/frontend/.env.local` (override con claves reales)

Variables criticas: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`,
`PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID`, `FAL_KEY`, `GEMINI_API_KEY`,
`RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`.

---

## 1. Arranque Normal (Produccion)

Inicia el orchestrator + scheduler + heartbeat + bridge FastAPI en puerto 8000.

```bash
cd project/podclaw
source .venv/bin/activate
python -m podclaw.main --workspace ../..
```

Esto arranca:
- **Orchestrator**: coordina los 10 agentes autónomos
- **Scheduler**: APScheduler con crons (research 06:00, marketing 07:00, etc.)
- **Heartbeat**: cada 30 min verifica salud de la tienda (Haiku, ~$0.04/dia)
- **Bridge**: FastAPI en `http://localhost:8000` (admin dashboard)

Para detener: `Ctrl+C` (graceful shutdown, espera hasta 30s por sesiones activas)

### Verificar que esta corriendo

```bash
# Proceso activo
ps aux | grep "podclaw.main" | grep -v grep

# Bridge respondiendo
curl -s http://localhost:8000/health | python3 -m json.tool

# Puerto 8000 ocupado
lsof -i :8000
```

### Matar proceso si queda colgado

```bash
# Buscar PID
ps aux | grep "podclaw.main" | grep -v grep

# Matar (reemplazar PID)
kill <PID>

# Si no muere:
kill -9 <PID>

# Verificar que el puerto quedo libre
lsof -i :8000
```

---

## 2. Dry Run (Solo Verificacion)

Inicializa todo (env, connectors, hooks, scheduler) pero NO arranca nada.
Util para verificar que la configuracion es correcta.

```bash
cd project/podclaw
source .venv/bin/activate
python -m podclaw.main --workspace ../.. --dry-run
```

Salida esperada:
```
✓ PodClaw initialized successfully
  Agents: 8
  Scheduled jobs: N
  SOUL.md: found
  Heartbeat: enabled
  Soul Evolution: enabled
```

---

## 3. Sin Bridge (Solo Scheduler)

Arranca orchestrator + scheduler + heartbeat, pero sin el servidor FastAPI.
Util si no necesitas el admin dashboard o el puerto 8000 esta ocupado.

```bash
cd project/podclaw
source .venv/bin/activate
python -m podclaw.main --workspace ../.. --no-bridge
```

---

## 4. Tests

### 4a. Test E2E Pipeline (el mas completo)

Ejecuta el ciclo COMPLETO de gestion de catalogo con escrituras reales a Printify y Supabase.

```bash
cd project
source podclaw/.venv/bin/activate
python -m podclaw.test_e2e_pipeline
```

**Que hace (5 fases):**

| Fase | Agente | Accion | Tool Calls |
|------|--------|--------|------------|
| Pre-clean | — | Purga productos `[E2E]` existentes de DB y Printify | — |
| 1A-C | cataloger | Crea 20 productos EU en 3 batches (7+7+6) | ~24+ por batch |
| 2 | cataloger | Publica los 20 productos | ~7 |
| 3 | cataloger | Edita 1 producto (titulo, descripcion, +10% precio) | ~10 |
| 4 | finance | Verifica margenes y costos del catalogo completo | ~9 |
| 5 | cataloger | Elimina 1 producto de prueba | ~6 |
| Cleanup | — | Limpia productos `[E2E]` restantes | — |

**Duracion**: ~10-20 minutos
**Costo LLM**: ~$3-5 USD
**Verificaciones**: 30+ checks automaticos (precios, margenes, i18n, imagenes, etc.)

**Prerequisitos del test:**
- El directorio `img_test/` en la raiz del workspace con imagenes de prueba (flame.png, skully.png, backk.png, fusion.png, stats.png)
- Si no existe, el test salta el upload de imagenes pero sigue funcionando

**Salida**: Log detallado por fase + FINAL VERDICT con todos los checks PASS/FAIL

### 4b. Test Cataloger (1 agente)

Prueba solo el agente cataloger con una tarea simple.

```bash
cd project
source podclaw/.venv/bin/activate
python -m podclaw.test_cataloger
```

### 4c. Test Multi-Agent (2 agentes)

Secuencia researcher → cataloger.

```bash
cd project
source podclaw/.venv/bin/activate
python -m podclaw.test_multiagent
```

### 4d. Test Orchestrator Full

Prueba completa del orchestrator con todos los agentes.

```bash
cd project
source podclaw/.venv/bin/activate
python -m podclaw.test_orchestrator_full
```

---

## 5. Bridge API — Endpoints Utiles

El bridge corre en `http://localhost:8000`. Requiere auth token via header
`Authorization: Bearer <PODCLAW_BRIDGE_AUTH_TOKEN>` (excepto `/health`).

```bash
# Health (sin auth)
curl -s http://localhost:8000/health | python3 -m json.tool

# Estado del heartbeat
curl -s http://localhost:8000/heartbeat/status | python3 -m json.tool

# Disparar heartbeat manualmente
curl -s -X POST http://localhost:8000/heartbeat/trigger \
  -H "Authorization: Bearer $PODCLAW_BRIDGE_AUTH_TOKEN"

# Ver cola de eventos
curl -s http://localhost:8000/queue/peek \
  -H "Authorization: Bearer $PODCLAW_BRIDGE_AUTH_TOKEN" | python3 -m json.tool

# Ejecutar un agente manualmente
curl -s -X POST http://localhost:8000/agents/researcher/run \
  -H "Authorization: Bearer $PODCLAW_BRIDGE_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task": "Investiga tendencias POD para primavera 2026"}'

# Ver costos del dia
curl -s http://localhost:8000/costs \
  -H "Authorization: Bearer $PODCLAW_BRIDGE_AUTH_TOKEN" | python3 -m json.tool

# Ver SOUL.md actual
curl -s http://localhost:8000/soul \
  -H "Authorization: Bearer $PODCLAW_BRIDGE_AUTH_TOKEN"
```

---

## 6. Logs y Memoria

### Donde estan los logs

PodClaw usa structlog a stdout. No hay archivo de log dedicado — la salida va a la terminal.
Para capturar a archivo:

```bash
python -m podclaw.main --workspace ../.. 2>&1 | tee podclaw.log
```

Para logs en formato JSON (parseable):

```bash
PODCLAW_JSON_LOGS=true python -m podclaw.main --workspace ../..
```

### Archivos de memoria

```
podclaw/memory/
├── YYYY-MM-DD.md          # Log diario (14 dias retencion)
├── weekly/
│   └── YYYY-WNN.md        # Resumen semanal (90 dias retencion)
├── MEMORY.md              # Aprendizajes permanentes
├── HEARTBEAT.md           # Template de checklist de salud
└── context/
    ├── best_sellers.md     # Top productos
    ├── pricing_history.md  # Historial de precios
    └── ...                 # Otros contextos dinamicos
```

---

## 7. Diferencia: PodClaw vs Harness

| | Harness (`autonomous_agent_demo.py`) | PodClaw (`podclaw.main`) |
|---|---|---|
| **Proposito** | CONSTRUYE el codigo del proyecto | OPERA la tienda autonomamente |
| **Auth** | Claude Max OAuth (sin API key) | Anthropic API Key (Agent SDK) |
| **Agentes** | 2 (Initializer + Coding) | 8 especializados |
| **Herramientas** | Bash, Write, Edit, Playwright | MCP connectors (Supabase, Stripe, etc.) |
| **Ejecucion** | Sesiones manuales | 24/7 con scheduler + heartbeat |
| **Puerto** | — | 8000 (FastAPI bridge) |
| **venv** | `pod-agent-harness-v2/venv/` | `project/podclaw/.venv/` |

**Nunca corren simultaneamente.** El harness crea PodClaw; PodClaw opera la tienda.

---

## 8. Troubleshooting

### El proceso queda colgado / zombie
```bash
ps aux | grep "podclaw" | grep -v grep
kill <PID>
lsof -i :8000  # verificar que el puerto se libero
```

### "ModuleNotFoundError: No module named 'podclaw'"
Estas ejecutando desde el directorio incorrecto o con el venv equivocado:
```bash
cd project
source podclaw/.venv/bin/activate
python -m podclaw.main --workspace ..
```

### "FATAL: Missing environment variables"
Verifica que existan los archivos .env:
```bash
ls -la config/.env.required
ls -la project/frontend/.env.local
```

### Heartbeat corriendo pero `last_run: null`
El heartbeat solo ejecuta dentro de `active_hours` (05:00-23:00 UTC por defecto).
Si esta fuera de ese rango, esperara al proximo periodo activo.

### El test E2E falla en cleanup de productos
Printify puede tardar en sincronizar eliminaciones. Si hay productos `[E2E]` huerfanos:
```bash
# Verificar manualmente
curl -s "https://api.printify.com/v1/shops/$PRINTIFY_SHOP_ID/products.json" \
  -H "Authorization: Bearer $PRINTIFY_API_TOKEN" | python3 -c "
import sys, json
for p in json.load(sys.stdin).get('data', []):
    if '[E2E]' in p.get('title', ''):
        print(f\"{p['id']}: {p['title']}\")"
```
