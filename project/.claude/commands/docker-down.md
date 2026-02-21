Para todos los contenedores del stack Docker POD AI:

1. `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml down`
2. Confirma que no quedan contenedores: `docker ps`
3. NO elimina volúmenes (datos de Redis, certs de Caddy, data de PodClaw se preservan)

Si el usuario pide también limpiar:
- `docker system prune -f` (limpia imágenes y cache huérfanos)
- `docker volume prune -f` (SOLO si el usuario explícitamente lo pide — destruye datos)

El directorio de trabajo es: project/
