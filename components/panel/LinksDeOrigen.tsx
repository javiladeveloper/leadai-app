"use client";

import { useState } from "react";

/**
 * SABER DE DÓNDE VINO CADA LEAD (2026-09-17, pedido de Jonathan).
 *
 * Meta nos dice de qué anuncio viene alguien, pero todo lo demás caía como
 * "directo": el link de la bio de TikTok, el flyer con QR, el que el marketero
 * pega en un grupo. O sea que TODO el trabajo hecho fuera de Meta era
 * invisible — imposible demostrar que sirvió, imposible decidir dónde insistir.
 *
 * Cada link lleva un código en el texto precargado. Cuando la persona manda
 * ese mensaje, el lead queda marcado con su origen y aparece en los reportes.
 *
 * VA EN EL TEXTO Y NO EN LA URL porque WhatsApp no nos dice desde dónde
 * tocaron: solo nos llega el mensaje. El código se borra antes de que el bot
 * lo lea, así que el cliente nunca ve nada raro.
 */

/** Los lugares donde un negocio chico pone un link, en orden de uso real. */
const LUGARES = [
  { codigo: "tiktok-bio", nombre: "Bio de TikTok" },
  { codigo: "instagram-bio", nombre: "Bio de Instagram" },
  { codigo: "facebook", nombre: "Facebook" },
  { codigo: "google", nombre: "Ficha de Google" },
  { codigo: "flyer", nombre: "Flyer o volante" },
  { codigo: "qr-local", nombre: "QR en el local" },
];

export function LinksDeOrigen({
  whatsapp,
  mensaje = "Hola, quiero más información",
}: {
  whatsapp?: string | null;
  mensaje?: string;
}) {
  const [copiado, setCopiado] = useState("");
  const [propio, setPropio] = useState("");

  const numero = (whatsapp ?? "").replace(/\D/g, "");

  // Sin número no hay link posible: se dice qué falta en vez de mostrar uno roto.
  if (!numero) {
    return (
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <h3 className="text-[1.05rem] font-bold text-tinta">Links para saber de dónde te escriben</h3>
        <p className="mt-1 text-[0.85rem] text-frio">
          Primero carga el WhatsApp de tu negocio en la sección Carta. Sin eso
          no podemos armar los links.
        </p>
      </div>
    );
  }

  function armar(codigo: string): string {
    const texto = `${mensaje} [#${codigo}]`;
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  }

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(armar(codigo));
      setCopiado(codigo);
      setTimeout(() => setCopiado(""), 1800);
    } catch {
      // Sin permiso de portapapeles (http, navegador viejo): el link igual se
      // ve en pantalla y se puede seleccionar a mano.
      setCopiado("");
    }
  }

  // Un código escrito a mano se normaliza igual que en el backend: si no,
  // "TikTok Bio" generaría un origen que nunca coincide con el que llega.
  const codigoPropio = propio.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <h3 className="text-[1.05rem] font-bold text-tinta">Links para saber de dónde te escriben</h3>
      <p className="mt-1 text-[0.85rem] text-frio">
        Usa un link distinto en cada lugar. Cuando alguien te escriba, vas a ver
        de dónde salió en tus reportes — y así sabes qué vale la pena y qué no.
      </p>

      <div className="mt-4 space-y-2">
        {LUGARES.map((l) => (
          <div key={l.codigo} className="flex items-center gap-2 rounded-lg bg-arena/40 px-3 py-2">
            <span className="w-36 shrink-0 text-[0.85rem] font-semibold text-tinta">{l.nombre}</span>
            <span className="min-w-0 flex-1 truncate text-[0.78rem] text-frio">{armar(l.codigo)}</span>
            <button
              type="button"
              onClick={() => void copiar(l.codigo)}
              className="shrink-0 rounded-chip bg-brasa px-3 py-1 text-[0.78rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo"
            >
              {copiado === l.codigo ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
        ))}
      </div>

      {/* El marketero siempre tiene un lugar que no está en la lista: un
          influencer, una feria, un grupo puntual. Sin esto tendría que pedir
          que le agreguemos cada uno. */}
      <div className="mt-4 border-t border-linea pt-4">
        <label className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
          Otro lugar
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            value={propio}
            onChange={(e) => setPropio(e.target.value)}
            placeholder="Ej: feria de octubre"
            maxLength={30}
            className="min-w-0 flex-1 rounded-lg border border-linea bg-arena/40 px-3 py-2 text-[0.85rem] text-tinta placeholder:text-frio"
          />
          <button
            type="button"
            disabled={!codigoPropio}
            onClick={() => void copiar(codigoPropio)}
            className="shrink-0 rounded-chip bg-brasa px-3 py-2 text-[0.78rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-40"
          >
            {copiado === codigoPropio && codigoPropio ? "Copiado ✓" : "Copiar link"}
          </button>
        </div>
        {codigoPropio && (
          <p className="mt-1.5 truncate text-[0.78rem] text-frio">{armar(codigoPropio)}</p>
        )}
      </div>
    </div>
  );
}
