"use client";

// Perfil de VENDEDOR del marketplace. Es de la PERSONA (dueña de la cuenta),
// no de un negocio (decisión 2026-07-22) — por eso vive como pestaña "Mi
// perfil" de Configuración, sin chips de negocio. Extraído de la antigua
// página /mi-perfil (que ahora solo redirige acá).

import { useEffect, useState } from "react";
import { miPerfilVendedor, guardarPerfilVendedor, subirFotoVendedor, type PerfilVendedor, type Experiencia } from "@/lib/api";
import { RUBROS } from "@/lib/rubros";
import { Seccion } from "@/components/panel/Seccion";

const inputCls =
  "w-full rounded-tarjeta border border-linea bg-carta px-3.5 py-2.5 text-[0.95rem] text-tinta outline-none focus:border-brasa";

export function MiPerfilVendedorPanel() {
  const [cargando, setCargando] = useState(true);
  const [perfil, setPerfil] = useState<PerfilVendedor | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState("");

  useEffect(() => {
    miPerfilVendedor().then((p) => { setPerfil(p); setCargando(false); });
  }, []);

  function set<K extends keyof PerfilVendedor>(campo: K, valor: PerfilVendedor[K]) {
    setPerfil((p) => (p ? { ...p, [campo]: valor } : p));
  }

  function toggleRubro(id: string) {
    if (!perfil) return;
    const tiene = perfil.rubros.includes(id);
    set("rubros", tiene ? perfil.rubros.filter((r) => r !== id) : [...perfil.rubros, id]);
  }

  // ── Experiencia profesional (mini-CV: dónde trabajó) ──
  function agregarExperiencia() {
    if (!perfil) return;
    set("experiencia", [...perfil.experiencia, { cargo: "", lugar: "", desde: "", hasta: "" }]);
  }
  function quitarExperiencia(i: number) {
    if (!perfil) return;
    set("experiencia", perfil.experiencia.filter((_, idx) => idx !== i));
  }
  // Subir foto desde el dispositivo: leemos el archivo como data URL, lo
  // mandamos al backend (que lo sube a Storage) y actualizamos la foto en vivo.
  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    if (archivo.size > 5 * 1024 * 1024) { setErrorFoto("La imagen es muy pesada (máximo 5MB)."); return; }
    setErrorFoto("");
    setSubiendoFoto(true);
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = () => rej(new Error("No se pudo leer el archivo"));
      fr.readAsDataURL(archivo);
    }).catch(() => "");
    if (!dataUrl) { setSubiendoFoto(false); setErrorFoto("No se pudo leer la imagen."); return; }
    const r = await subirFotoVendedor(dataUrl);
    setSubiendoFoto(false);
    if (r.ok && r.fotoUrl) set("fotoUrl", r.fotoUrl);
    else setErrorFoto(r.error ?? "No se pudo subir la foto.");
  }

  function editarExperiencia(i: number, campo: keyof Experiencia, valor: string) {
    if (!perfil) return;
    set("experiencia", perfil.experiencia.map((e, idx) => (idx === i ? { ...e, [campo]: valor } : e)));
  }

  async function guardar() {
    if (!perfil) return;
    setGuardando(true);
    const r = await guardarPerfilVendedor({
      bio: perfil.bio, aniosExp: perfil.aniosExp, rubros: perfil.rubros,
      fotoUrl: perfil.fotoUrl,
      instagram: perfil.instagram, linkedin: perfil.linkedin, whatsapp: perfil.whatsapp,
      telefono: perfil.telefono, email: perfil.email, ciudad: perfil.ciudad, web: perfil.web,
      experiencia: perfil.experiencia,
      publico: perfil.publico,
    });
    setGuardando(false);
    if (r.ok) { setOk(true); setTimeout(() => setOk(false), 1800); }
  }

  // Skeleton con la forma real de la pantalla, como el resto del panel: un
  // "Cargando…" plano hace saltar todo el contenido cuando llega.
  if (cargando || !perfil) {
    return (
      <div className="space-y-5">
        <div className="h-52 animate-pulse rounded-tarjeta bg-arena-2/70" />
        <div className="h-72 animate-pulse rounded-tarjeta bg-arena-2/70" />
      </div>
    );
  }

  return (
    // Sin encabezado ni ancho propios (2026-08-18): esto se escribió como
    // página suelta y hoy es una PESTAÑA de Configuración. Traía su propio
    // eyebrow + <h1> debajo del <h1> "Configuración" —dos encabezados apilados—
    // y un max-w-2xl que lo dejaba más angosto que las otras tres pestañas.
    <div className="space-y-5">

      {/* La CABECERA del perfil, en verde hondo (2026-08-18): es lo que otro
          negocio ve de vos, así que la foto, el nombre y las métricas van
          arriba y juntos. Antes la foto estaba enterrada en el medio del
          formulario, entre "Sobre vos" y los años de experiencia. */}
      <Seccion
        titulo="Así te ven los negocios"
        bajada="Tu foto, tu experiencia y cómo contactarte. Un perfil completo te consigue más oportunidades."
        tono="hondo"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {perfil.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={perfil.fotoUrl}
                alt="Tu foto"
                className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-arena/20"
              />
            ) : (
              /* Sin foto, la inicial va sobre el MENTA de marca: el círculo
                 gris sobre el verde hondo se perdía contra el fondo, y es lo
                 primero que ve alguien que abre tu perfil. */
              <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-brasa text-2xl font-bold text-sobre-brasa">
                {(perfil.nombre ?? "V").charAt(0).toUpperCase()}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-[1.15rem] font-bold text-arena">{perfil.nombre || "Tu nombre"}</p>
              {/* Las dos métricas en línea: el número en naranja, que es el
                  dato con el que un negocio te evalúa. */}
              <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[0.84rem] text-arena/70">
                <span>
                  <b className="text-[1.05rem] font-bold text-orbita">{perfil.ventasCerradas}</b>{" "}
                  {perfil.ventasCerradas === 1 ? "venta cerrada" : "ventas cerradas"}
                </span>
                <span>
                  <b className="text-[1.05rem] font-bold text-orbita">{perfil.aniosExp}</b>{" "}
                  {perfil.aniosExp === 1 ? "año de experiencia" : "años de experiencia"}
                </span>
              </div>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-chip bg-arena/10 px-3 py-1.5 text-[0.82rem] font-semibold text-arena ring-1 ring-arena/15 transition hover:bg-arena/20">
                {subiendoFoto ? "Subiendo…" : perfil.fotoUrl ? "Cambiar foto" : "Subir foto"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  disabled={subiendoFoto} onChange={subirFoto} />
              </label>
              <p className="mt-1 text-[0.75rem] text-arena/50">JPG, PNG o WebP. Máximo 5MB.</p>
              {errorFoto && <p className="mt-1 text-[0.8rem] font-semibold text-orbita">{errorFoto}</p>}
            </div>
          </div>

          {/* El interruptor de VISIBILIDAD va acá: es la decisión que define si
              todo lo de abajo lo ve alguien o no. */}
          {/* El mismo interruptor que usa el resto del panel (el bot, la IA):
              el checkbox nativo se veía como una caja blanca cuadrada, ajena
              a todo lo demás — y encima acá va sobre fondo oscuro. */}
          <div className="flex items-center justify-between gap-4 rounded-tarjeta bg-arena/10 px-4 py-3 ring-1 ring-arena/15">
            <div className="min-w-0">
              <p className="text-[0.92rem] font-semibold text-arena">Aparecer en el marketplace</p>
              <p className="text-[0.8rem] text-arena/65">
                {perfil.publico
                  ? "Los negocios pueden encontrarte y darte oportunidades."
                  : "Tu perfil está oculto: nadie te ve todavía."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={perfil.publico}
              aria-label="Aparecer en el marketplace"
              onClick={() => set("publico", !perfil.publico)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                perfil.publico ? "bg-brasa" : "bg-arena/20"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-carta shadow transition-transform ${
                  perfil.publico ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Tus datos" bajada="Lo que un negocio lee antes de escribirte.">
        <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-tinta">Sobre vos</span>
          <textarea value={perfil.bio} onChange={(e) => set("bio", e.target.value)} rows={3}
            placeholder="Ej: Vendedora con experiencia promocionando servicios contables. Consigo clientes por WhatsApp e Instagram."
            className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-tinta">Años de experiencia</span>
          <input type="number" min={0} max={80} value={perfil.aniosExp}
            onChange={(e) => set("aniosExp", Number(e.target.value) || 0)} className={inputCls} />
        </label>

        <div>
          <span className="mb-2 block text-sm font-medium text-tinta">Rubros en los que sos bueno/a</span>
          <div className="flex flex-wrap gap-2">
            {RUBROS.filter((r) => r.id !== "otro").map((r) => {
              const activo = perfil.rubros.includes(r.id);
              return (
                <button key={r.id} type="button" onClick={() => toggleRubro(r.id)}
                  className={`rounded-chip px-3 py-1.5 text-[0.82rem] font-semibold transition ${
                    activo ? "bg-brasa text-carta" : "bg-arena text-tinta-2 ring-1 ring-linea"
                  }`}>
                  {r.emoji} {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">Instagram</span>
            <input value={perfil.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@usuario" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">LinkedIn</span>
            <input value={perfil.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="link o usuario" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">WhatsApp</span>
            <input value={perfil.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+51 9xx…" className={inputCls} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">Teléfono</span>
            <input value={perfil.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="+51 1 xxx…" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">Email de contacto</span>
            <input type="email" value={perfil.email} onChange={(e) => set("email", e.target.value)} placeholder="tucorreo@…" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">Ciudad</span>
            <input value={perfil.ciudad} onChange={(e) => set("ciudad", e.target.value)} placeholder="Ej: Lima" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">Sitio web / portfolio</span>
            <input value={perfil.web} onChange={(e) => set("web", e.target.value)} placeholder="https://…" className={inputCls} />
          </label>
        </div>
        </div>
      </Seccion>

      {/* Experiencia profesional (dónde trabajó). El "+ Agregar" va en la
          cabecera de la sección, como acción del bloque. */}
      <Seccion
        titulo="Experiencia profesional"
        bajada="Dónde trabajaste. Le da confianza a los negocios que te contactan."
        accion={
          <button type="button" onClick={agregarExperiencia}
            className="shrink-0 rounded-chip bg-arena px-3 py-1.5 text-[0.8rem] font-semibold text-tinta-2 ring-1 ring-linea hover:bg-linea">
            + Agregar
          </button>
        }
      >
        <div className="space-y-3">
        {perfil.experiencia.length === 0 && (
          <p className="rounded-tarjeta bg-arena/40 px-4 py-3 text-[0.85rem] text-frio">
            Todavía no agregaste experiencia. Tocá “+ Agregar”.
          </p>
        )}

        {perfil.experiencia.map((exp, i) => (
          <div key={i} className="rounded-tarjeta bg-arena/40 p-3 ring-1 ring-linea">
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={exp.cargo} onChange={(e) => editarExperiencia(i, "cargo", e.target.value)}
                placeholder="Cargo (ej. Vendedora)" className={inputCls} />
              <input value={exp.lugar} onChange={(e) => editarExperiencia(i, "lugar", e.target.value)}
                placeholder="Lugar / empresa (ej. Estudio Vega)" className={inputCls} />
              <input value={exp.desde} onChange={(e) => editarExperiencia(i, "desde", e.target.value)}
                placeholder="Desde (ej. 2020)" className={inputCls} />
              <input value={exp.hasta} onChange={(e) => editarExperiencia(i, "hasta", e.target.value)}
                placeholder="Hasta (ej. 2023 o Actual)" className={inputCls} />
            </div>
            <button type="button" onClick={() => quitarExperiencia(i)}
              className="mt-2 text-[0.78rem] font-semibold text-frio hover:text-brasa-hondo">
              Quitar
            </button>
          </div>
        ))}
        </div>
      </Seccion>

      <div className="flex items-center gap-3">
        <button onClick={guardar} disabled={guardando}
          className="rounded-tarjeta bg-brasa px-6 py-3 font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-60">
          {guardando ? "Guardando…" : "Guardar mi perfil"}
        </button>
        {ok && <span className="text-sm font-semibold text-ok">Guardado ✓</span>}
      </div>
    </div>
  );
}
