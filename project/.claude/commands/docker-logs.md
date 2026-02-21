Muestra los logs recientes de un servicio Docker. El usuario puede especificar qué servicio.

Uso: /docker-logs $ARGUMENTS

Servicios disponibles: frontend, admin, podclaw, rembg, redis, caddy

Si no se especifica servicio, muestra los últimos 20 logs de TODOS los servicios.

Comando: `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml logs --tail=50 $ARGUMENTS`

El directorio de trabajo es: project/
