"use client";

import { useEffect, useState } from "react";
import { listarEnviosCampania, type CampaniaHSM, type EnvioCampania } from "@/lib/api";
import { LinkLead } from "@/components/LinkLead";

/**
 * "12 RESPONDIERON" ABRE LA LISTA DE ESOS 12 (2026-10-09, tanda "web").
 *
 * La tarjeta de la campaña daba el número y nada más: para saber quiénes
 * respondieron había que ir a Conversaciones y adivinar. Ahora el conteo de
 * respondieron (y el de fallidos, con el motivo) se toca y muestra esos leads,
 * cada uno con su link a la ficha.
 *
 * LA RUTA DEL BACKEND PUEDE NO EXISTIR TODAVÍA (`GET /campanias/:id/envios`
 * sale en paralelo). Antes de ofrecer el link se pregunta UNA vez por negocio
 * con la primera campaña que tenga algo que mostrar: si responde 404, los
 * conteos quedan como texto, igual que siempre — nunca un link que lleva a un
 * error.
 */
const disponiblePorNegocio = new Map<string, Promise<boolean>>();

export function useEnviosDisponibles(campanias: CampaniaHSM[], tenant?: string): boolean {
  const [disponible, setDisponible] = useState(false);
  const muestra = campanias.find((c) => c.respondieron > 0 || c.fallidos > 0);
  useEffect(() => {
    if (!muestra) return;
    const clave = tenant ?? "-";
    let sonda = disponiblePorNegocio.get(clave);
    if (!sonda) {
      sonda = listarEnviosCampania(muestra.id, muestra.respondieron > 0 ? "respondio" : "fallido", { tenant, limite: 1 })
        .then((r) => r !== null)
        .catch(() => {
          // Un error de red no dice si la ruta existe: se vuelve a preguntar
          // la próxima vez.
          disponiblePorNegocio.delete(clave);
          return false;
        });
      disponiblePorNegocio.set(clave, sonda);
    }
    let vivo = true;
    void sonda.then((ok) => { if (vivo) setDisponible(ok); });
    return () => { vivo = false; };
  }, [muestra, tenant]);
  return disponible;
}

/** Los números de la tarjeta; con la ruta disponible, los que tienen gente se tocan. */
export function ConteosCampania({
  c,
  tenant,
  disponible,
  extra,
}: {
  c: CampaniaHSM;
  tenant?: string;
  disponible: boolean;
  /** Lo que va al final de la línea (p. ej. "programada …"). */
  extra?: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState<"" | "respondio" | "fallido">("");
  const boton = (estado: "respondio" | "fallido", texto: React.ReactNode, n: number, clase: string) =>
    disponible && n > 0 ? (
      <button
        type="button"
        onClick={() => setAbierta((a) => (a === estado ? "" : estado))}
        aria-expanded={abierta === estado}
        className={`min-h-0 underline decoration-dotted underline-offset-2 transition hover:decoration-solid ${clase}`}
      >
        {texto}
      </button>
    ) : (
      <span className={clase}>{texto}</span>
    );

  return (
    <div className="min-w-0">
      <p className="text-[0.76rem] text-frio">
        {c.enviados} enviados · {boton("fallido", <>{c.fallidos} fallidos</>, c.fallidos, "")} ·{" "}
        {boton("respondio", <b>{c.respondieron} respondieron</b>, c.respondieron, "text-ok")} · {c.totalDestinatarios} en total
        {extra}
      </p>
      {abierta && (
        <ListaEnvios key={abierta} campaniaId={c.id} estado={abierta} tenant={tenant} onCerrar={() => setAbierta("")} />
      )}
    </div>
  );
}

function ListaEnvios({
  campaniaId,
  estado,
  tenant,
  onCerrar,
}: {
  campaniaId: string;
  estado: "respondio" | "fallido";
  tenant?: string;
  onCerrar: () => void;
}) {
  const [envios, setEnvios] = useState<EnvioCampania[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  useEffect(() => {
    let vivo = true;
    listarEnviosCampania(campaniaId, estado, { tenant })
      .then((r) => {
        if (!vivo) return;
        if (!r) { setError(true); return; }
        setEnvios(r.envios);
        setCursor(r.siguienteCursor);
      })
      .catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, [campaniaId, estado, tenant]);

  async function verMas() {
    if (!cursor || cargandoMas) return;
    setCargandoMas(true);
    try {
      const r = await listarEnviosCampania(campaniaId, estado, { tenant, cursor });
      if (r) {
        setEnvios((prev) => [...(prev ?? []), ...r.envios]);
        setCursor(r.siguienteCursor);
      }
    } catch {
      setError(true);
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <div className="mt-2 rounded-tarjeta bg-arena/60 p-3 ring-1 ring-linea">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
          {estado === "respondio" ? "Respondieron" : "No se les pudo enviar"}
        </p>
        <button type="button" onClick={onCerrar} className="min-h-0 text-[0.75rem] font-semibold text-frio hover:text-tinta">
          Cerrar
        </button>
      </div>
      {envios === null && !error && <p className="text-[0.8rem] text-frio" aria-busy="true">Cargando…</p>}
      {error && <p className="text-[0.8rem] text-alerta-hondo">No pudimos traer la lista. Inténtalo de nuevo en un rato.</p>}
      {envios && envios.length === 0 && <p className="text-[0.8rem] text-frio">Nadie todavía.</p>}
      {envios && envios.length > 0 && (
        <ul className="divide-y divide-linea">
          {envios.map((e) => (
            <li key={e.leadId} className="flex items-center justify-between gap-2 py-1.5 text-[0.82rem]">
              <span className="min-w-0">
                <LinkLead
                  id={e.leadId}
                  tenant={tenant}
                  className="block truncate font-semibold text-tinta underline-offset-2 hover:underline"
                >
                  {e.nombre ?? e.contacto ?? "Lead eliminado"}
                </LinkLead>
                {estado === "fallido" && e.error && <span className="block truncate text-[0.74rem] text-alerta-hondo">{e.error}</span>}
              </span>
              {e.nombre && e.contacto && <span className="shrink-0 text-[0.74rem] text-frio">{e.contacto}</span>}
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <button
          type="button"
          onClick={() => void verMas()}
          disabled={cargandoMas}
          className="mt-2 min-h-0 text-[0.8rem] font-semibold text-brasa-texto hover:underline disabled:opacity-60"
        >
          {cargandoMas ? "Cargando…" : "Ver más"}
        </button>
      )}
    </div>
  );
}
