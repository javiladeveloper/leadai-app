"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { paginaLeadsFiltrada, paginaBandejaGlobalFiltrada, type Lead } from "@/lib/api";
import { leerEmpresaActiva, tieneVariosNegocios } from "@/lib/auth";
import { pedir } from "@/lib/cache-datos";
import { coincideBusqueda, terminoParaServidor, urlBusqueda } from "@/lib/enlaces";
import { useAbrirLead } from "@/components/LinkLead";

type LeadBuscable = Lead & { tenantId?: string; negocioNombre?: string };

/**
 * Cuántos contactos recientes se traen para sugerir: una sola página. 100 es
 * el máximo de `/bandeja-global`: con 200 respondía 400 y, como el error se
 * tragaba, con varios negocios el buscador NUNCA sugería nada (2026-10-13).
 */
const RECIENTES = 100;
const MAX_SUGERENCIAS = 6;
/** Espera tras la última tecla antes de preguntarle al servidor. */
const ESPERA_SERVIDOR_MS = 300;

const clave = (l: LeadBuscable) => `${l.tenantId ?? ""}-${l.id}`;

/**
 * EL BUSCADOR DEL HEADER (2026-10-09, tanda "consistencia").
 *
 *  · Se ve TAMBIÉN EN EL CELULAR. Estaba `hidden` debajo de 640 px, justo
 *    donde más cuesta llegar a la lista de leads a mano.
 *  · RESPETA EL RUBRO: mandaba siempre a /leads, que un restaurante no
 *    tiene. Ahora va a Leads si existe y si no a Conversaciones
 *    (`urlBusqueda`, lib/enlaces.ts).
 *  · SUGIERE MIENTRAS ESCRIBES, por nombre o teléfono. Es barato a propósito:
 *    el backend no busca por texto, así que al enfocar se trae UNA página con
 *    los contactos más recientes (caché de un minuto, compartida) y se filtra
 *    acá. No hay una petición por tecla. Quien no está entre los recientes
 *    aparece igual al apretar Enter, en la lista completa.
 *  · CON VARIOS NEGOCIOS TAMBIÉN BUSCA EN EL SERVIDOR (2026-10-13):
 *    `/bandeja-global?q=` busca por nombre o contacto en todos los negocios,
 *    así aparece quien no está entre los últimos 100. Una sola petición
 *    cuando se deja de escribir (no una por tecla); un teléfono viaja solo
 *    con sus dígitos (`terminoParaServidor`). `/leads` todavía no busca por
 *    texto: con un negocio, solo lo reciente.
 *  · SI FALLA, LO DICE: antes el error se tragaba y la lista quedaba en
 *    "Nadie con ese nombre", que se lee como que la persona no existe.
 */
export function BuscadorPanel({ placeholder, tieneLeads }: { placeholder: string; tieneLeads: boolean }) {
  const router = useRouter();
  const abrirLead = useAbrirLead();
  const idLista = useId();
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [recientes, setRecientes] = useState<LeadBuscable[] | null>(null);
  const [errorRecientes, setErrorRecientes] = useState(false);
  // Lo que respondió el servidor para un término (solo con varios negocios).
  const [remotos, setRemotos] = useState<{ termino: string; items: LeadBuscable[] } | null>(null);
  // El término cuya búsqueda en el servidor falló (el error es de ESE término).
  const [errorRemotoDe, setErrorRemotoDe] = useState<string | null>(null);
  const [activo, setActivo] = useState(-1);
  const cajaRef = useRef<HTMLFormElement>(null);
  const cargandoRef = useRef(false);

  function cargarRecientes() {
    if (recientes || cargandoRef.current) return;
    cargandoRef.current = true;
    setErrorRecientes(false);
    const varios = tieneVariosNegocios();
    const claveCache = `buscador@${varios ? "global" : leerEmpresaActiva() || "-"}`;
    pedir<LeadBuscable[]>(
      claveCache,
      () => (varios
        ? paginaBandejaGlobalFiltrada({}, null, RECIENTES).then((r) => r.items as LeadBuscable[])
        : paginaLeadsFiltrada({}, null, RECIENTES).then((r) => r.items)),
      { maxEdadMs: 60_000 },
    )
      .then(setRecientes)
      // Sin sugerencias, pero avisado y con reintento; Enter sigue funcionando.
      .catch(() => setErrorRecientes(true))
      .finally(() => { cargandoRef.current = false; });
  }

  // Búsqueda en el servidor: con varios negocios, cuando se deja de escribir.
  const termino = q.trim().length >= 2 ? terminoParaServidor(q) : "";
  const [intentoRemoto, setIntentoRemoto] = useState(0);
  useEffect(() => {
    if (!termino || !tieneVariosNegocios()) return;
    let vigente = true;
    const t = window.setTimeout(() => {
      pedir<LeadBuscable[]>(
        `buscador@global?q=${termino}`,
        () => paginaBandejaGlobalFiltrada({ q: termino }, null, 20).then((r) => r.items as LeadBuscable[]),
        { maxEdadMs: 60_000 },
      )
        .then((items) => { if (vigente) { setRemotos({ termino, items }); setErrorRemotoDe(null); } })
        .catch(() => { if (vigente) setErrorRemotoDe(termino); });
    }, ESPERA_SERVIDOR_MS);
    return () => { vigente = false; window.clearTimeout(t); };
  }, [termino, intentoRemoto]);

  const remotosVigentes = remotos && remotos.termino === termino ? remotos.items : null;
  const errorRemoto = !!termino && errorRemotoDe === termino;
  const sugerencias = useMemo(() => {
    if (q.trim().length < 2) return [];
    const locales = (recientes ?? []).filter((l) => coincideBusqueda(l, q));
    // Primero lo reciente (más probable), después lo que encontró el servidor.
    const vistos = new Set(locales.map(clave));
    const delServidor = (remotosVigentes ?? []).filter((l) => !vistos.has(clave(l)));
    return [...locales, ...delServidor].slice(0, MAX_SUGERENCIAS);
  }, [q, recientes, remotosVigentes]);
  const mostrar = abierto && q.trim().length >= 2;
  const buscaEnServidor = !!termino && tieneVariosNegocios();
  // "Buscando…" mientras falta lo reciente o, con varios negocios, la respuesta del servidor.
  const buscando = (recientes === null && !errorRecientes)
    || (buscaEnServidor && remotosVigentes === null && !errorRemoto && sugerencias.length === 0);
  const hayError = errorRecientes || (buscaEnServidor && errorRemoto);
  function reintentar() {
    if (errorRecientes) cargarRecientes();
    if (errorRemoto) setIntentoRemoto((n) => n + 1);
  }

  // Tocar afuera cierra la lista.
  useEffect(() => {
    if (!abierto) return;
    const alTocar = (e: PointerEvent) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target as Node)) setAbierto(false);
    };
    window.addEventListener("pointerdown", alTocar);
    return () => window.removeEventListener("pointerdown", alTocar);
  }, [abierto]);

  function irALista(texto: string) {
    const t = texto.trim();
    if (!t) return;
    setAbierto(false);
    router.push(urlBusqueda(t, { tieneLeads }));
  }

  function elegir(l: LeadBuscable) {
    setAbierto(false);
    setQ("");
    // A la ficha; quien no puede abrir chats (marketing) va a la lista.
    if (!abrirLead(l.id, l.tenantId)) irALista(l.nombre ?? l.contactoExterno);
  }

  return (
    <form
      ref={cajaRef}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (activo >= 0 && sugerencias[activo]) elegir(sugerencias[activo]);
        else irALista(q);
      }}
      className="relative min-w-0 flex-1 sm:max-w-md"
    >
      <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-arena/50">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </span>
      <input
        name="q"
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setAbierto(true); setActivo(-1); }}
        onFocus={() => { cargarRecientes(); setAbierto(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActivo((i) => Math.min(i + 1, sugerencias.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((i) => Math.max(i - 1, -1)); }
          else if (e.key === "Escape") setAbierto(false);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={idLista}
        aria-autocomplete="list"
        autoComplete="off"
        className="w-full rounded-chip bg-white/8 py-2 pl-10 pr-4 text-sm text-arena outline-none ring-1 ring-white/15 placeholder:text-arena/45 focus:ring-brasa/50"
      />

      {mostrar && (
        <div
          id={idLista}
          role="listbox"
          className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-tarjeta bg-carta shadow-[var(--sombra-flotante)] ring-1 ring-linea sm:right-auto sm:w-[26rem]"
        >
          {buscando && sugerencias.length === 0 && (
            <p className="px-4 py-3 text-[0.82rem] text-frio" aria-busy="true">Buscando…</p>
          )}
          {sugerencias.map((l, i) => (
            <button
              key={clave(l)}
              type="button"
              role="option"
              aria-selected={i === activo}
              onMouseEnter={() => setActivo(i)}
              onClick={() => elegir(l)}
              className={`flex min-h-0 w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition ${i === activo ? "bg-arena" : "hover:bg-arena/60"}`}
            >
              <span className="w-full truncate text-[0.9rem] font-semibold text-tinta">{l.nombre ?? l.contactoExterno}</span>
              <span className="w-full truncate text-[0.75rem] text-frio">
                {l.nombre ? l.contactoExterno : ""}
                {l.negocioNombre ? `${l.nombre ? " · " : ""}${l.negocioNombre}` : ""}
              </span>
            </button>
          ))}
          {hayError && sugerencias.length === 0 && (
            <p role="alert" className="flex items-center gap-2 px-4 pt-3 text-[0.8rem] text-frio">
              <span>No pudimos traer sugerencias.</span>
              <button
                type="button"
                onClick={reintentar}
                className="min-h-0 font-semibold text-brasa-texto underline-offset-2 hover:underline"
              >
                Reintentar
              </button>
            </p>
          )}
          {!buscando && !hayError && sugerencias.length === 0 && (
            <p className="px-4 pt-3 text-[0.8rem] text-frio">
              {buscaEnServidor
                ? "Nadie con ese nombre o número."
                : "Nadie con ese nombre entre los últimos que te escribieron."}
            </p>
          )}
          <button
            type="submit"
            className="flex min-h-0 w-full items-center gap-1.5 border-t border-linea px-4 py-2.5 text-left text-[0.82rem] font-semibold text-brasa-texto transition hover:bg-arena/60"
          >
            Buscar «{q.trim()}» en {tieneLeads ? "Leads" : "Conversaciones"} →
          </button>
        </div>
      )}
    </form>
  );
}
