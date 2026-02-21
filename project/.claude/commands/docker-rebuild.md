Reconstruye un servicio específico del stack Docker sin bajar los demás.

Uso: /docker-rebuild $ARGUMENTS

Servicios que se pueden reconstruir: frontend, admin, podclaw, rembg

1. `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml up --build -d $ARGUMENTS`
2. Espera a que el servicio esté healthy
3. Muestra `docker compose ps` para confirmar
4. Si el servicio tiene dependientes (ej: Caddy depende de frontend), reinícialos también

El directorio de trabajo es: project/
