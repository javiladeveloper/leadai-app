"use client";

import type { Lead } from "@/lib/api";

/**
 * DE DÓNDE VINO ESTE LEAD Y CUÁNTO COSTÓ (2026-09-17, pedido de Jonathan:
 * "acaba de contestarme un lead, no sé de qué publicidad vino y tampoco las
 * estadísticas me dicen nada, no sé de dónde vino ese y cuánto me costó").
 *
 * El dato SIEMPRE estuvo: Meta manda el id del anuncio y lo guardábamos. Lo que
 * se mostraba era `ad:120255972775720311`, dieciocho dígitos que nadie puede
 * reconocer. Ahora el backend lo cruza contra el histórico y esto pinta el
 * nombre del anuncio y lo que costó traer a esta persona.
 *
 * DOS TAMAÑOS porque son dos preguntas distintas: en la lista alcanza con
 * saber que vino de un anuncio (`compacto`), y en la ficha —donde uno decide
 * si le contesta rápido— importa cuánto costó.
 */

const ICONO: Record<string, string> = {
  anuncio: "📣",
  link: "🔗",
  manual: "✍️",
  otro: "💬",
};

/**
 * LA PLATAFORMA DONDE SE PAGÓ (2026-10-06, pedido de Jonathan: "¿cada lead me
 * muestra de qué campaña viene, si TikTok, Meta o Google Ads?"). Un chip con el
 * nombre que el dueño usa — no un logo: "Meta Ads" se lee, un ícono se adivina.
 */
const PLATAFORMA: Record<string, { nombre: string; clase: string }> = {
  meta: { nombre: "Meta Ads", clase: "bg-[#1877F2]/12 text-[#1464d6]" },
  google: { nombre: "Google Ads", clase: "bg-[#34A853]/14 text-[#1f7a3a]" },
  tiktok: { nombre: "TikTok Ads", clase: "bg-tinta text-carta" },
};

export function ChipPlataforma({ plataforma }: { plataforma?: string }) {
  const p = plataforma ? PLATAFORMA[plataforma] : undefined;
  if (!p) return null;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-chip px-1.5 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide ${p.clase}`}>
      {p.nombre}
    </span>
  );
}

function soles(centavos: number): string {
  return `S/${(centavos / 100).toLocaleString("es-PE", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

export function OrigenLead({
  lead, compacto = false,
}: { lead: Pick<Lead, "origen" | "origenEtiqueta">; compacto?: boolean }) {
  const o = lead.origen;
  // Sin el origen resuelto no se pinta nada: mostrar la etiqueta cruda de
  // vuelta sería reponer justamente el problema que esto resuelve.
  if (!o) return null;

  if (compacto) {
    return (
      <span className="inline-flex max-w-[15rem] items-center gap-1">
        <ChipPlataforma plataforma={o.plataforma} />
        <span
          title={o.campania ? `Campaña: ${o.campania}` : undefined}
          className="inline-flex min-w-0 items-center gap-1 truncate rounded-chip bg-arena px-1.5 py-0.5 text-[0.7rem] font-semibold text-tinta-2"
        >
          {!o.plataforma && <span aria-hidden>{ICONO[o.tipo] ?? "💬"}</span>}
          <span className="truncate">{o.etiqueta}</span>
        </span>
      </span>
    );
  }

  return (
    <div className="rounded-lg bg-arena/50 px-3 py-2">
      <p className="flex items-center justify-between gap-2 text-[0.72rem] font-bold uppercase tracking-wide text-frio">
        De dónde vino
        <ChipPlataforma plataforma={o.plataforma} />
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[0.88rem] font-semibold text-tinta">
        <span aria-hidden>{ICONO[o.tipo] ?? "💬"}</span>
        <span className="truncate">{o.etiqueta}</span>
      </p>
      {o.campania && (
        <p className="mt-0.5 truncate text-[0.76rem] text-frio">Campaña: {o.campania}</p>
      )}

      {/* EL COSTO ES EL REPARTIDO, no el gasto del anuncio. Se aclara con
          cuántos leads se dividió: sin eso, "S/3.53" parece una medición
          exacta de esta persona y en realidad es un promedio. */}
      {o.costoCentavos !== undefined && (
        <p className="mt-1.5 text-[0.8rem] text-tinta-2">
          Te costó aprox. <strong className="text-tinta">{soles(o.costoCentavos)}</strong>
          {o.leadsDelAnuncio !== undefined && o.gastoCentavos !== undefined && (
            <span className="block text-[0.74rem] text-frio">
              {soles(o.gastoCentavos)} del anuncio ÷ {o.leadsDelAnuncio}{" "}
              {o.leadsDelAnuncio === 1 ? "lead que trajo" : "leads que trajo"}
            </span>
          )}
        </p>
      )}

      {/* El cron del histórico corre una vez al día: un lead de la mañana llega
          antes que el gasto de su anuncio. Decirlo evita que el hueco se lea
          como un error. */}
      {o.tipo === "anuncio" && o.plataforma === "meta" && o.costoCentavos === undefined && (
        <p className="mt-1.5 text-[0.76rem] text-frio">
          Lo que costó aparece cuando Meta cierre el día.
        </p>
      )}
    </div>
  );
}
