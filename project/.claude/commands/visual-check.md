Realiza una verificación visual del stack Docker usando Chrome DevTools:

1. Verifica que los servicios estén running (ejecuta docker compose ps)
2. Navega a http://localhost:8080/ y toma screenshot (landing page)
3. Navega a http://localhost:8080/en/shop y toma screenshot (tienda)
4. Navega a http://localhost:8080/panel y toma screenshot (admin login)
5. Verifica que no haya errores de consola JavaScript
6. Reporta cualquier problema visual o error

Nota: Este comando requiere que Claude Code se haya iniciado con `claude --chrome` para tener acceso al Chrome DevTools Protocol.

El directorio de trabajo es: project/
