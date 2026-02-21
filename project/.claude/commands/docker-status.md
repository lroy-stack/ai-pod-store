Muestra el estado completo del stack Docker POD AI:

1. `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml ps`
2. Para cada servicio que esté running, haz un health check:
   - Frontend: curl http://localhost:3000/api/health
   - Admin: curl http://localhost:3001/panel/api/health
   - PodClaw: curl http://localhost:8000/health
   - rembg: curl http://localhost:8090/health
   - Redis: docker exec deploy-redis-1 redis-cli ping
   - Caddy: curl http://localhost:8080/
3. Muestra el uso de recursos: `docker stats --no-stream`
4. Presenta un resumen en tabla con: servicio, estado, health, puerto, memoria

El directorio de trabajo es: project/
