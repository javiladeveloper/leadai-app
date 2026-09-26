"use client";

import { useEffect, useState } from "react";
import { Seccion } from "@/components/panel/Seccion";
import { estadoExportacion, guardarAjustesVendedora, type AjustesVendedora as AjustesVendedoraTipo } from "@/lib/api";

/**
 * TUS DATOS EN EL NEGOCIO EXPORTADO (2026-09-25).
 *
 * El bot es el mismo en las dos copias (dueño y vendedora): lo configura el
 * dueño. Lo único que la vendedora pone de sí misma es esto — su nombre, su
 * agenda, su teléfono para llamadas y su horario —, y el bot lo usa al hablar
 * con sus clientes.
 *
 * Si el negocio activo no es una exportación (`exportado === false`), no
 * renderiza nada: no hay nada que ajustar acá.
 */
export function AjustesVendedora({ tenant }: { tenant?: string }) {
  const [exportado, setExportado] = useState<boolean | null>(null);
  const [nombreVendedora, setNombreVendedora] = useState("");
  const [linkAgenda, setLinkAgenda] = useState("");
  const [telefonoLlamadas, setTelefonoLlamadas] = useState("");
  const [horario, setHorario] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    void estadoExportacion(tenant).then((r) => {
      if (!vivo) return;
      setExportado(r.exportado);
      setNombreVendedora(r.ajustes?.nombreVendedora ?? "");
      setLinkAgenda(r.ajustes?.linkAgenda ?? "");
      setTelefonoLlamadas(r.ajustes?.telefonoLlamadas ?? "");
      setHorario(r.ajustes?.horario ?? "");
    });
    return () => { vivo = false; };
  }, [tenant]);

  async function guardar() {
    setGuardando(true);
    setError("");
    setOk(false);
    const datos: AjustesVendedoraTipo = {
      nombreVendedora: nombreVendedora.trim(),
      linkAgenda: linkAgenda.trim(),
      telefonoLlamadas: telefonoLlamadas.trim(),
      horario: horario.trim(),
    };
    const r = await guardarAjustesVendedora(datos, tenant);
    setGuardando(false);
    if (r.ok) {
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } else {
      setError(r.error ?? "No se pudo guardar");
    }
  }

  if (exportado === null) return <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  if (!exportado) return null;

  return (
    <Seccion
      titulo="Tus datos"
      bajada="El bot los usa al hablar con tus clientes: tu nombre, tu agenda y tu teléfono."
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">Tu nombre</span>
          <input
            value={nombreVendedora}
            onChange={(e) => setNombreVendedora(e.target.value)}
            placeholder="Cómo te presenta el bot"
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
          />
        </label>

        <label className="block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">Tu enlace de agenda</span>
          <input
            value={linkAgenda}
            onChange={(e) => setLinkAgenda(e.target.value)}
            placeholder="https://cal.com/tu-usuario"
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
          />
        </label>

        <label className="block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">Tu teléfono para llamadas</span>
          <input
            value={telefonoLlamadas}
            onChange={(e) => setTelefonoLlamadas(e.target.value)}
            inputMode="tel"
            placeholder="+51987654321"
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta placeholder:text-frio"
          />
        </label>

        <label className="block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">Tu horario</span>
          <input
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            placeholder="Lunes a viernes, 9am a 6pm"
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="rounded-chip bg-brasa px-5 py-2 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          {ok && <span className="text-[0.82rem] font-semibold text-ok">✓ Guardado</span>}
          {error && <span className="text-[0.82rem] font-semibold text-brasa-hondo">{error}</span>}
        </div>
      </div>
    </Seccion>
  );
}

export default AjustesVendedora;
