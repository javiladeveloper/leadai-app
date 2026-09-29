# Marketing — paquete local sin despliegue

## Restricción vigente

Jonathan está grabando el video de aprobación para Meta. No integrar en master, publicar previews ni desplegar este paquete hasta que autorice. No hay cambios en producción ni en anuncios reales.

Rama: `codex/marketing-auditoria-sin-deploy`, base `f2eac24`. Backend coordinado: mismo nombre de rama, base `c8e5ee1`, en el repo LeadAI. El documento técnico completo está en `docs/marketing-auditoria-2026-09-29.md` de ese backend.

## Entrega

- Tenant explícito en Marketing, creador, automatizaciones, públicos y controles; resultados tardíos no pisan otro negocio.
- Selector compartido 7/30/90 días, monedas visibles y resultados comerciales sólo cuando están medidos. No presentar clientes interesados como citas, ni ROAS como beneficio neto.
- Listado buscable y filtrable, detalle expandible, paginación visual y acceso a borradores.
- Borrador del creador versionado por negocio; no persistir base64 ni secretos. Descartar un borrador local es explícito, no borra el remoto ni publica nada.
- Estado de publicación pendiente de verificar: no reintentar o clonar automáticamente algo que quizá ya se publicó.
- Confirmación antes de reactivar toda una campaña; bloqueo de doble envío.
- Errores visibles y reintentables, rollback de ajustes y conservación del contenido ante fallos. Publicación parcial: no reenviar a redes ya exitosas.
- Todos los horarios devueltos por el backend; entradas de archivos y controles mejor etiquetados para teclado.
- Se eliminó únicamente un `export` inválido en `app/(panel)/conversaciones/page.tsx` para que Next compile. No cambia el adaptador `autorDe`.

## Verificación

Corrida final local: **216/216 pruebas aprobadas**, TypeScript correcto y build webpack exitoso (37 páginas estáticas). No se publicó el build.

Pruebas con APIs y contactos ficticios, sin gasto. Se añadieron suites conductuales con hooks simulados y contratos API; no equivalen a una publicación real en Meta. Navegador local: 28 anuncios, búsqueda/detalle, período de siete días, 24 horas, cambio de negocio y rollback. El servidor temporal rechazaba escrituras y fue retirado; tampoco se deja una ruta de auditoría accesible en el producto.

Build local: `node node_modules/next/dist/bin/next build --webpack`. El worktree usa un enlace de dependencias que Turbopack rechaza fuera de su raíz; se verificó con webpack sin cambiar la configuración de despliegue.

No se verificaron dispositivos móviles físicos, lector de pantalla, publicación/cobro reales ni nuevos permisos Meta. La edición in situ de borradores remotos sigue sin endpoint: se puede retomar lo guardado o descartar el borrador local para crear otro explícitamente, sólo si el remoto sigue siendo un borrador comprobado. Los estados ambiguos requieren revisión.

## Orden cuando se levante la restricción

1. Revisar cambios nuevos de las ramas principales.
2. Repetir tests y build.
3. Desplegar primero backend: el panel exige metadatos nuevos de períodos/monedas.
4. Publicar el panel y verificar lecturas reales autorizadas.
5. No activar campañas o subir contactos como parte de una simple comprobación de salud.
