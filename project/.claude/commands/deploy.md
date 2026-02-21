Realiza un deployment completo del stack Docker:

1. Verifica que Docker Desktop esté corriendo (`docker info`)
2. Baja el stack actual: `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml down`
3. Rebuild y levanta: `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml up --build -d`
4. Espera a que todos los servicios estén healthy (máximo 5 min)
5. Muestra el estado final con `docker compose ps`
6. Prueba los endpoints:
   - curl http://localhost:8080/ (frontend via Caddy)
   - curl http://localhost:8080/panel (admin via Caddy)
   - curl http://localhost:8080/api/bridge/health (podclaw via Caddy)
7. Reporta cualquier servicio que no esté healthy

El directorio de trabajo es: project/
