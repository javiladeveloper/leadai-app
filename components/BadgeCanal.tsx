import { IconoWhatsApp, IconoInstagram, IconoMessenger, IconoTikTok } from "./Iconos";

// Metadatos por canal: ícono, nombre legible y color de marca. Cubre los canales
// que el backend puede reportar en Lead.canalOrigen (TipoCanal).
const CANALES: Record<
  string,
  { nombre: string; Icono: (p: { className?: string }) => React.ReactElement; color: string }
> = {
  whatsapp: { nombre: "WhatsApp", Icono: IconoWhatsApp, color: "#25D366" },
  instagram: { nombre: "Instagram", Icono: IconoInstagram, color: "#C13584" },
  messenger: { nombre: "Messenger", Icono: IconoMessenger, color: "#0084FF" },
  tiktok: { nombre: "TikTok", Icono: IconoTikTok, color: "#010101" },
};

// Nombre humano de canales sin ícono propio (fallback).
const NOMBRE_FALLBACK: Record<string, string> = {
  gym: "Gimnasio",
  externo: "Otro",
};

// Badge que muestra de qué red viene una conversación: ícono de la marca + nombre.
// `tamano="chico"` para listas densas (tarjetas), normal para cabeceras.
export function BadgeCanal({ canal, tamano = "normal" }: { canal?: string; tamano?: "chico" | "normal" }) {
  if (!canal) return null;
  const meta = CANALES[canal];
  const chico = tamano === "chico";

  // Canal sin ícono propio: chip neutro con el nombre.
  if (!meta) {
    return (
      <span className={`inline-flex items-center rounded-chip bg-arena px-2 py-0.5 font-semibold text-frio ${chico ? "text-[0.68rem]" : "text-[0.78rem]"}`}>
        {NOMBRE_FALLBACK[canal] ?? canal}
      </span>
    );
  }

  const { nombre, Icono, color } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-chip px-2 py-0.5 font-semibold ${chico ? "text-[0.68rem]" : "text-[0.78rem]"}`}
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <Icono className={chico ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {nombre}
    </span>
  );
}
