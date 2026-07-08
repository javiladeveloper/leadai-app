import type { Temperatura } from "@/lib/tipos";

const MAPA: Record<Temperatura, { texto: string; clase: string; punto: string }> = {
  caliente: { texto: "Caliente", clase: "bg-brasa-suave text-brasa-hondo", punto: "bg-brasa" },
  tibio: { texto: "Tibio", clase: "bg-tibio-suave text-tibio", punto: "bg-tibio" },
  frio: { texto: "Frío", clase: "bg-arena-2 text-frio", punto: "bg-frio" },
};

// Chip del semáforo de leads. Encodea la temperatura en color + forma + texto
// (no solo color) para que se lea de un vistazo y sea accesible.
export function ChipTemp({ t, className = "" }: { t: Temperatura; className?: string }) {
  const m = MAPA[t];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[0.72rem] font-bold ${m.clase} ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${m.punto}`} />
      {m.texto}
    </span>
  );
}
