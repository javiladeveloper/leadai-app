"use client";

import { useEffect, useState } from "react";
import {
  obtenerMenuDia, publicarMenuDia, marcarDisponible, marcarOpcionDisponible,
  obtenerMenusProgramados, programarMenuDia, borrarMenuProgramado,
  type MenuDelDia, type OpcionMenuDia, type MenuProgramado,
} from "@/lib/carta";
import { SkeletonLista } from "@/components/Skeletons";

/**
 * EL MENÚ DE HOY (2026-08-31, feedback de un restaurante real: "tenemos menús
 * que cambian en el día, y necesito marcar que se acabó el menú o un plato").
 *
 * El ritual de cada mañana en una sola pantalla: precio, entradas y segundos
 * (uno por línea), y "Publicar". Durante el servicio: un toque apaga el
 * tallarín que se acabó o el menú entero — y TODO vuelve solo al día
 * siguiente. El menú de ayer no se vende hoy: amanece apagado hasta que se
 * publica el nuevo.
 */

function soles(centavos: number): string {
  return `S/${(centavos / 100).toFixed(2)}`;
}

/** "13.50" o "13" → céntimos; null si no es un precio. */
function aCentavos(texto: string): number | null {
  const n = Number(texto.replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

const lineas = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

// Los próximos días como los ve un dueño peruano: "Hoy", "Mañana", "Mié 2".
// El día se calcula en HORA DE LIMA (UTC-5 fijo) aunque el navegador esté en
// otro huso: programar "para mañana" tiene que significar mañana EN EL LOCAL.
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function diasProximos(n: number): { dia: string; etiqueta: string }[] {
  const ahoraLima = new Date(Date.now() - 5 * 3_600_000);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(ahoraLima.getTime() + i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    const etiqueta =
      i === 0 ? "Hoy" : i === 1 ? "Mañana" : `${DIAS_CORTOS[d.getUTCDay()]} ${d.getUTCDate()}`;
    return { dia: iso, etiqueta };
  });
}

export function MenuDelDiaPanel() {
  const [estado, setEstado] = useState<"cargando" | "ok">("cargando");
  const [menu, setMenu] = useState<MenuDelDia | null>(null);
  const [precio, setPrecio] = useState("");
  const [entradas, setEntradas] = useState("");
  const [segundos, setSegundos] = useState("");
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // "¿Para cuándo?": HOY publica al toque; otro día deja el menú PROGRAMADO
  // y el sistema lo publica solo a las 4am de ese día.
  const [dias] = useState(() => diasProximos(7));
  const [diaElegido, setDiaElegido] = useState(() => diasProximos(7)[0].dia);
  const [programados, setProgramados] = useState<MenuProgramado[]>([]);

  async function cargar() {
    const [m, progs] = await Promise.all([obtenerMenuDia(), obtenerMenusProgramados()]);
    setMenu(m);
    setProgramados(progs);
    // El menú anterior es el mejor borrador del de hoy: la mayoría repite
    // media carta y cambia dos segundos.
    if (m) {
      setPrecio((m.precioCentavos / 100).toFixed(2).replace(/\.00$/, ""));
      setEntradas(m.entradas.map((o) => o.nombre).join("\n"));
      setSegundos(m.segundos.map((o) => o.nombre).join("\n"));
    }
    // Sin menú publicado hoy, la pantalla ABRE en el editor: es lo que se
    // vino a hacer a las 9am.
    setEditando(!m || !m.esDeHoy);
    setEstado("ok");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void cargar(); }, []);

  async function publicar() {
    const centavos = aCentavos(precio);
    const segs = lineas(segundos);
    if (!centavos) { setError("Ponle el precio del menú (ej. 13.50)."); return; }
    if (segs.length === 0) { setError("Escribe al menos un segundo."); return; }
    setError("");
    setGuardando(true);
    const esHoy = diaElegido === dias[0].dia;
    const r = esHoy
      ? await publicarMenuDia({ precioCentavos: centavos, entradas: lineas(entradas), segundos: segs })
      : await programarMenuDia({
          dia: diaElegido, precioCentavos: centavos, entradas: lineas(entradas), segundos: segs,
        });
    setGuardando(false);
    if (!r.ok) { setError(r.error ?? "No se pudo guardar."); return; }
    await cargar();
  }

  async function quitarProgramado(dia: string) {
    await borrarMenuProgramado(dia);
    await cargar();
  }

  // Al cambiar de día, el formulario carga lo YA programado para ese día (o
  // deja el borrador actual, que suele ser la mejor base).
  function elegirDia(dia: string) {
    setDiaElegido(dia);
    const prog = programados.find((x) => x.dia === dia);
    if (prog) {
      setPrecio((prog.precioCentavos / 100).toFixed(2).replace(/\.00$/, ""));
      setEntradas(prog.entradas.join("\n"));
      setSegundos(prog.segundos.join("\n"));
    }
    setEditando(true);
  }

  async function agotarMenu(disponible: boolean) {
    if (!menu) return;
    await marcarDisponible(menu.productoId, disponible);
    await cargar();
  }

  async function agotarOpcion(o: OpcionMenuDia) {
    await marcarOpcionDisponible(o.id, !o.disponible);
    await cargar();
  }

  if (estado === "cargando") return <SkeletonLista filas={3} />;

  const publicadoHoy = menu !== null && menu.esDeHoy;

  return (
    <div className="space-y-4">
      {/* El estado del día, sin adivinar. */}
      <div className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow">Menú del día</p>
            <p className="mt-1 text-[0.95rem] font-semibold text-tinta">
              {!menu && "Todavía no publicas un menú."}
              {menu && publicadoHoy && menu.disponible && (
                <>Publicado hoy · {soles(menu.precioCentavos)} · se está vendiendo ✅</>
              )}
              {menu && publicadoHoy && !menu.disponible && (
                <>Se acabó por hoy 💤 — mañana amanece listo para publicar el nuevo</>
              )}
              {menu && !publicadoHoy && (
                <>El de {menu.dia ?? "otro día"} está apagado — publica el de hoy para vender</>
              )}
            </p>
            <p className="mt-0.5 text-[0.8rem] text-frio">
              Se publica cada mañana. El de ayer se apaga solo: nadie compra el tallarín del lunes un martes.
            </p>
          </div>
          <div className="flex gap-2">
            {menu && publicadoHoy && menu.disponible && (
              <button
                onClick={() => void agotarMenu(false)}
                className="rounded-chip bg-arena px-3.5 py-2 text-[0.85rem] font-bold text-tinta-2 ring-1 ring-linea hover:bg-linea"
              >
                💤 Se acabó el menú
              </button>
            )}
            {menu && publicadoHoy && !menu.disponible && (
              <button
                onClick={() => void agotarMenu(true)}
                className="rounded-chip bg-arena px-3.5 py-2 text-[0.85rem] font-bold text-tinta-2 ring-1 ring-linea hover:bg-linea"
              >
                Volver a venderlo hoy
              </button>
            )}
            {!editando && (
              <button
                onClick={() => setEditando(true)}
                className="rounded-chip bg-brasa px-3.5 py-2 text-[0.85rem] font-bold text-sobre-brasa hover:opacity-90"
              >
                {publicadoHoy ? "Corregir el menú" : "Armar el menú de hoy"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lo publicado HOY: cada opción se apaga con un toque y vuelve mañana. */}
      {menu && publicadoHoy && (
        <div className="grid gap-3 sm:grid-cols-2">
          {([["Entradas", menu.entradas], ["Segundos", menu.segundos]] as const).map(
            ([titulo, opciones]) => opciones.length > 0 && (
              <div key={titulo} className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
                <p className="text-[0.72rem] font-bold uppercase tracking-wide text-frio">{titulo}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {opciones.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => void agotarOpcion(o)}
                      title={o.disponible ? "Tócalo si se acabó (vuelve mañana)" : "Tócalo para reponerlo hoy"}
                      className={`rounded-chip px-3 py-1.5 text-[0.85rem] font-semibold ring-1 transition ${
                        o.disponible
                          ? "bg-arena text-tinta ring-linea hover:ring-brasa/50"
                          : "bg-carta text-frio/60 line-through ring-linea"
                      }`}
                    >
                      {o.nombre}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[0.75rem] text-frio">
                  Toca un plato si se acabó — se tacha al instante y vuelve solo mañana.
                </p>
              </div>
            ),
          )}
        </div>
      )}

      {/* El editor: precio + un plato por línea. */}
      {editando && (
        <div className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
          <p className="text-[0.95rem] font-bold text-tinta">
            {diaElegido === dias[0].dia
              ? (publicadoHoy ? "Corregir el menú de hoy" : "El menú de hoy")
              : "Dejar programado el menú"}
          </p>
          {/* ¿Para cuándo? Hoy publica al toque; otro día queda programado y
              se publica solo a las 4am de ese día. */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {dias.map((d) => {
              const tiene = programados.some((x) => x.dia === d.dia);
              return (
                <button
                  key={d.dia}
                  onClick={() => elegirDia(d.dia)}
                  className={`rounded-chip px-3 py-1.5 text-[0.82rem] font-semibold ring-1 transition ${
                    diaElegido === d.dia
                      ? "bg-brasa text-sobre-brasa ring-brasa"
                      : "bg-arena text-tinta-2 ring-linea hover:ring-brasa/40"
                  }`}
                >
                  {d.etiqueta}{tiene && " ✓"}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[0.8rem] font-semibold text-tinta-2">Precio del menú</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[0.95rem] font-bold text-frio">S/</span>
                <input
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  inputMode="decimal"
                  placeholder="13.50"
                  className="w-32 rounded-lg border border-linea bg-arena/40 px-3 py-2 text-[0.95rem] font-semibold text-tinta outline-none focus:border-brasa"
                />
              </div>
            </div>
            <div>
              <label className="text-[0.8rem] font-semibold text-tinta-2">
                Entradas <span className="font-normal text-frio">(una por línea, opcional)</span>
              </label>
              <textarea
                value={entradas}
                onChange={(e) => setEntradas(e.target.value)}
                rows={5}
                placeholder={"Sopa criolla\nPapa a la huancaína"}
                className="mt-1 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2 text-[0.92rem] text-tinta outline-none focus:border-brasa"
              />
            </div>
            <div>
              <label className="text-[0.8rem] font-semibold text-tinta-2">
                Segundos <span className="font-normal text-frio">(uno por línea)</span>
              </label>
              <textarea
                value={segundos}
                onChange={(e) => setSegundos(e.target.value)}
                rows={5}
                placeholder={"Tallarín saltado\nArroz con pollo\nAjí de gallina"}
                className="mt-1 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2 text-[0.92rem] text-tinta outline-none focus:border-brasa"
              />
            </div>
          </div>
          {error && <p className="mt-2 text-[0.85rem] font-semibold text-alerta">{error}</p>}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => void publicar()}
              disabled={guardando}
              className="rounded-chip bg-brasa px-4 py-2 text-[0.9rem] font-bold text-sobre-brasa hover:opacity-90 disabled:opacity-50"
            >
              {guardando
                ? "Guardando…"
                : diaElegido !== dias[0].dia
                  ? `📅 Dejar programado (${dias.find((d) => d.dia === diaElegido)?.etiqueta})`
                  : publicadoHoy ? "Guardar cambios" : "🍲 Publicar el menú de hoy"}
            </button>
            <p className="text-[0.78rem] text-frio">
              {diaElegido === dias[0].dia
                ? "El cliente elige su entrada y su segundo en la carta — web, QR de mesa y chat."
                : "Se publica solo a las 4am de ese día. Puedes dejar armada toda la semana."}
            </p>
          </div>
        </div>
      )}

      {/* La semana dejada lista: qué días ya tienen menú esperando. */}
      {programados.length > 0 && (
        <div className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
          <p className="text-[0.72rem] font-bold uppercase tracking-wide text-frio">
            Menús programados
          </p>
          <div className="mt-2 space-y-2">
            {programados.map((prog) => (
              <div key={prog.dia} className="flex items-center justify-between gap-3">
                <button
                  onClick={() => elegirDia(prog.dia)}
                  className="min-w-0 flex-1 text-left"
                  title="Tócalo para editarlo"
                >
                  <span className="text-[0.88rem] font-semibold text-tinta">
                    {dias.find((d) => d.dia === prog.dia)?.etiqueta ?? prog.dia}
                    {" · "}{soles(prog.precioCentavos)}
                  </span>
                  <span className="block truncate text-[0.78rem] text-frio">
                    {[...prog.entradas, ...prog.segundos].join(", ")}
                  </span>
                </button>
                <button
                  onClick={() => void quitarProgramado(prog.dia)}
                  className="shrink-0 rounded-chip bg-arena px-2.5 py-1 text-[0.75rem] font-bold text-frio ring-1 ring-linea hover:bg-linea"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[0.75rem] text-frio">
            Cada uno se publica solo a las 4am de su día — no tienes que entrar todas las mañanas.
          </p>
        </div>
      )}
    </div>
  );
}
