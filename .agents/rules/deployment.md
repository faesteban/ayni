# Regla de despliegue y sincronización con Git

Cada vez que se suba o despliegue una versión a Cloudflare (ya sea el frontend o el backend mediante `wrangler deploy` o `npm run deploy`), es **obligatorio** sincronizarlo inmediatamente con Git:

1. Ejecutar `git status` para comprobar los cambios.
2. Añadir los archivos con `git add .`.
3. Crear el commit descriptivo (`git commit -m "..."`).
4. Subir los cambios a la rama remota con `git push`.
