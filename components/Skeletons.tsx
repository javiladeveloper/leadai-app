// Skeletons de carga: cajas con pulso que imitan la forma del contenido real
// mientras se cargan los datos. Da sensación de app rápida y pulida (en vez de
// un "Cargando…" plano). Usa los tokens Brasa.

// Bloque base con animación de pulso.
function Bloque({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-arena-2/70 ${className}`} />;
}

// Grilla de 3 tarjetas de métrica (para Inicio).
export function SkeletonMetricas() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea"
        >
          <Bloque className="mx-auto h-9 w-16" />
          <Bloque className="mx-auto mt-3 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

// Lista de tarjetas de lead (para Leads y la columna de Conversaciones).
export function SkeletonLista({ filas = 5 }: { filas?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: filas }).map((_, i) => (
        <div
          key={i}
          className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea"
        >
          <div className="flex items-center justify-between">
            <Bloque className="h-4 w-32" />
            <Bloque className="h-5 w-16 rounded-chip" />
          </div>
          <Bloque className="mt-3 h-3 w-full" />
          <Bloque className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

// Panel de conversación (burbujas de chat).
export function SkeletonChat() {
  return (
    <div className="space-y-3 p-4">
      <Bloque className="h-12 w-3/5" />
      <Bloque className="ml-auto h-12 w-2/3" />
      <Bloque className="h-16 w-3/4" />
      <Bloque className="ml-auto h-10 w-1/2" />
    </div>
  );
}

// Filas de tabla/lista para Reportes.
export function SkeletonReportes() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea"
          >
            <Bloque className="h-3 w-28" />
            <Bloque className="mt-3 h-8 w-32" />
          </div>
        ))}
      </div>
      <SkeletonLista filas={4} />
    </div>
  );
}
