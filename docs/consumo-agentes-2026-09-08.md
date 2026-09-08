# Consumo interno por agente y clínica

Integración en `/admin`, bloque independiente de las métricas globales.
Filtros: Sania, LeadAI, FitCore y sin clasificar; búsqueda de clínica/negocio
sin distinguir acentos/mayúsculas; selección explícita de negocio y mes UTC.
Se consulta un negocio a la vez: no se suman importes de clínicas ni se hace
una llamada por cada negocio al abrir el panel.

## Contrato y acceso

- Lista existente: `GET /admin/negocios`, campo `producto` del backend.
- Informe: `GET /admin/consumo-llm?tenantId=...&mes=YYYY-MM`.
- Guardado: `PUT /admin/presupuesto-llm` con tenantId, mes, presupuestoUsd
  (string decimal o null) y revisionEsperada (revisionMes, no revisionVigente).
- Usa exclusivamente la sesión de superadministrador y el cliente HTTP actual.
  No necesita ADMIN_API_KEY ni ninguna nueva variable pública.
- El backend debe incluir el registro de estas rutas dentro de `rutasAdminPanel`.
  Las rutas `/ecosistema/*` por clave siguen intactas para integraciones servidor.

No se duplican cálculos económicos: porcentajes, cobertura, gasto, vigencia y
avisos los entrega el backend. Costo desconocido no se presenta como cero.
Avisos null significa lectura no disponible; [] significa sin avisos registrados.
No se generan avisos en el navegador. No cambia planes, cupos ni el bot.

## Escrituras y errores

La selección y el formulario quedan bloqueados mientras se guarda. Al terminar,
se pide recargar para actualizar el resumen y la revisión. Un 409 o fallo incierto
conserva la edición y exige recargar antes de otra escritura. El botón de recarga
indica que descarta esa edición. Los meses cerrados son solo lectura.
Cambiar clínica o mes desmonta el informe y descarta respuestas tardías.

## Verificación

`npm run test:consumo` (Node 22.6+): filtros, cero/null, precisión, formatos inválidos
y presentación de costos diminutos. Sin dependencias nuevas.
`npx tsc --noEmit --incremental false` para tipos.

Pruebas de navegador sobre componente real con API sintética local, no cuentas
reales: selección agente/clínica, búsqueda CLINICA, cambio rápido DALU→Dental,
guardado cero y recarga, conflicto 409 conservando 99, error 503 sin gasto falso,
avisos no disponibles y mes cerrado. Vista móvil sin desborde horizontal.
La ruta temporal de evaluación se retiró antes de entregar.

El build completo detectó un bloqueo previo: Anuncios/Campañas/Publicar exportaban
una página Next con la prop `embebido`. Se trasladó cada implementación intacta a
`components/panel`, dejando páginas sin props especiales y actualizando los imports
de Marketing. No cambia creación de anuncios, campañas, pagos o publicaciones.
Se valida con `next build --webpack` (compilación y generación de todas las rutas).

## Publicación

Publicar primero el backend con las rutas de sesión y después este frontend.
No requiere migraciones adicionales a las de presupuesto ya aplicadas.
La disponibilidad final debe comprobarse con una sesión real de superadministrador;
los tests de UI no reemplazan esa comprobación en producción.
