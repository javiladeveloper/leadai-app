"use client";

import { useEffect, useState } from "react";
import {
  obtenerNegocio,
  guardarNegocio,
  subirImagenNegocio,
  quitarImagenNegocio,
  leerFoto,
  type NegocioCarta,
} from "@/lib/carta";
import { Seccion } from "@/components/panel/Seccion";

/**
 * LA MARCA DE LA CARTA (2026-08-18).
 *
 * El logo, el banner, la dirección y el WhatsApp se cargaban SOLO en el
 * onboarding (/bienvenida). Si el dueño se equivocaba, cambiaba de local o
 * quería subir un logo mejor, no tenía dónde: los endpoints existían y nadie
 * los llamaba.
 *
 * La vista previa arma la cabecera REAL de la carta y no dos recuadros
 * sueltos: lo que importa no es "subiste un archivo", es cómo lo va a ver tu
 * cliente.
 */

/**
 * Los países donde puede estar el negocio, con su código telefónico.
 *
 * El backend guarda el número JUNTO al código y sin el "+" ("51987654321"),
 * así que acá se separan para mostrarlos y se vuelven a unir al guardar.
 *
 * Perú primero: es donde estamos. El resto son los vecinos, por si el negocio
 * o el dueño están afuera.
 */
const PAISES = [
  { code: "51", pais: "PE", bandera: "🇵🇪", largo: 9 },
  { code: "54", pais: "AR", bandera: "🇦🇷", largo: 10 },
  { code: "56", pais: "CL", bandera: "🇨🇱", largo: 9 },
  { code: "57", pais: "CO", bandera: "🇨🇴", largo: 10 },
  { code: "593", pais: "EC", bandera: "🇪🇨", largo: 9 },
  { code: "591", pais: "BO", bandera: "🇧🇴", largo: 8 },
  { code: "52", pais: "MX", bandera: "🇲🇽", largo: 10 },
  { code: "1", pais: "US", bandera: "🇺🇸", largo: 10 },
];

/** Parte "51987654321" en su código de país y el número local. */
function partirNumero(completo: string): { code: string; local: string } {
  const limpio = (completo ?? "").replace(/\D/g, "");
  // Del más largo al más corto: si no, "51" se comería el "591" de Bolivia.
  const orden = [...PAISES].sort((a, b) => b.code.length - a.code.length);
  const p = orden.find((x) => limpio.startsWith(x.code));
  return p
    ? { code: p.code, local: limpio.slice(p.code.length) }
    : { code: "51", local: limpio };
}

/** Solo dígitos, como lo quiere el backend ("51987654321"). */
function soloDigitos(v: string): string {
  return v.replace(/\D/g, "").slice(0, 15);
}

export function MarcaCarta() {
  const [negocio, setNegocio] = useState<NegocioCarta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState<"logo" | "banner" | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  // Los campos de texto se editan localmente y se guardan con el botón: ir
  // guardando en cada tecla haría una petición por letra.
  const [direccion, setDireccion] = useState("");
  const [codigoPais, setCodigoPais] = useState("51");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [web, setWeb] = useState("");
  const [entrega, setEntrega] = useState("");
  const [tema, setTema] = useState<"claro" | "oscuro">("claro");
  const [color, setColor] = useState("");

  useEffect(() => {
    void obtenerNegocio().then((n) => {
      setNegocio(n);
      setDireccion(n?.direccion ?? "");
      const { code, local } = partirNumero(n?.whatsappCarta ?? "");
      setCodigoPais(code);
      setWhatsapp(local);
      setInstagram(n?.instagramUrl ?? "");
      setFacebook(n?.facebookUrl ?? "");
      setTiktok(n?.tiktokUrl ?? "");
      setWeb(n?.webUrl ?? "");
      setEntrega(n?.entregaMinutos ? String(n.entregaMinutos) : "");
      setTema(n?.temaCarta === "oscuro" ? "oscuro" : "claro");
      setColor(n?.colorCarta ?? "");
      setCargando(false);
    });
  }, []);

  async function subir(cual: "logo" | "banner", archivo: File) {
    setSubiendo(cual);
    setError("");
    const leida = await leerFoto(archivo);
    if (!leida.ok) {
      setSubiendo(null);
      setError(leida.error);
      return;
    }
    const r = await subirImagenNegocio(cual, leida.datos);
    setSubiendo(null);
    if (r.ok) {
      setNegocio((n) => (n ? { ...n, [cual === "logo" ? "logoUrl" : "bannerUrl"]: r.dato } : n));
    } else {
      setError(r.error ?? "No se pudo subir la imagen.");
    }
  }

  async function quitar(cual: "logo" | "banner") {
    setSubiendo(cual);
    const r = await quitarImagenNegocio(cual);
    setSubiendo(null);
    if (r.ok) {
      setNegocio((n) => (n ? { ...n, [cual === "logo" ? "logoUrl" : "bannerUrl"]: null } : n));
    }
  }

  async function guardar() {
    setGuardando(true);
    setError("");
    setOk(false);
    const r = await guardarNegocio({
      // `null` y no cadena vacía: es como el backend borra un campo.
      direccion: direccion.trim() || null,
      // Se guardan juntos, como los espera el backend.
      whatsappCarta: whatsapp ? `${codigoPais}${soloDigitos(whatsapp)}` : null,
      instagramUrl: instagram.trim() || null,
      facebookUrl: facebook.trim() || null,
      tiktokUrl: tiktok.trim() || null,
      webUrl: web.trim() || null,
      entregaMinutos: entrega ? Number(entrega) : null,
      temaCarta: tema,
      // Vacío = sin color propio, vuelve al menta de LeadAI.
      colorCarta: color || null,
    });
    setGuardando(false);
    if (r.ok) {
      setOk(true);
      setNegocio((n) => (n ? { ...n, direccion: direccion.trim() || null } : n));
    } else {
      setError(r.error ?? "No se pudo guardar.");
    }
  }

  if (cargando) {
    return <div className="h-72 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  }

  return (
    <Seccion
      titulo="Cómo se ve tu carta"
      bajada="Tu logo, tu portada y los datos que ve el cliente al abrir el link."
      tono="hondo"
    >
      <div className="space-y-4">
        {/* La vista previa ES la cabecera de la carta pública: el dueño ve
            cómo queda, no dos recuadros sueltos. */}
        <div className="overflow-hidden rounded-tarjeta bg-carta">
          <label className="relative block h-32 cursor-pointer bg-superficie-honda-2">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void subir("banner", f);
              }}
            />
            {negocio?.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={negocio.bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center text-[0.85rem] font-semibold text-arena/70">
                {subiendo === "banner" ? "Subiendo…" : "+ Foto de portada"}
              </span>
            )}
            {subiendo === "banner" && negocio?.bannerUrl && (
              <span className="absolute inset-0 grid place-items-center bg-tinta/50 text-[0.85rem] font-semibold text-arena">
                Subiendo…
              </span>
            )}
          </label>

          <div className="px-4 pb-4">
            {/* `relative z-10`: el logo monta sobre el banner con -mt, y sin
                esto la imagen de portada lo tapa a la mitad. */}
            <label className="relative z-10 -mt-9 mb-2 block w-fit cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void subir("logo", f);
                }}
              />
              {negocio?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={negocio.logoUrl}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-cover ring-2 ring-carta"
                />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-arena text-[0.7rem] font-bold text-frio ring-2 ring-carta">
                  {subiendo === "logo" ? "…" : "+ Logo"}
                </span>
              )}
            </label>
            <p className="font-bold text-tinta">{negocio?.nombre || "Tu negocio"}</p>
            {direccion && <p className="text-[0.85rem] text-tinta-2">📍 {direccion}</p>}
            {entrega && <p className="text-[0.8rem] text-frio">🛵 Entrega en {entrega} min</p>}
          </div>
        </div>

        {/* UNA FILA POR IMAGEN (2026-08-19): la miniatura de lo que ya tiene,
            el botón que dice si va a cambiarla o insertarla, y una ✕ para
            quitarla. Antes los dos botones y los dos "quitar" iban en la misma
            línea y no se sabía cuál era de cuál. */}
        <div className="space-y-2">
          <FilaImagen
            etiqueta="Logo"
            url={negocio?.logoUrl ?? null}
            subiendo={subiendo === "logo"}
            onElegir={(f) => void subir("logo", f)}
            onQuitar={() => void quitar("logo")}
          />
          <FilaImagen
            etiqueta="Portada"
            url={negocio?.bannerUrl ?? null}
            subiendo={subiendo === "banner"}
            onElegir={(f) => void subir("banner", f)}
            onQuitar={() => void quitar("banner")}
            ancha
          />
        </div>

        {/* EL TEMA (2026-08-19). Dos opciones probadas y no un editor de
            colores libre: dejar elegir cada color termina en cartas
            ilegibles, y quien las arma no mide contraste. */}
        <div>
          <p className="text-[0.82rem] font-semibold text-arena">Color de tu carta</p>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            {([
              { id: "claro", nombre: "Claro", fondo: "#f6faf8", texto: "#0e1614" },
              { id: "oscuro", nombre: "Oscuro", fondo: "#14100e", texto: "#f7f3f0" },
            ] as const).map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setTema(op.id)}
                aria-pressed={tema === op.id}
                className={`rounded-tarjeta p-3 text-left transition ${
                  tema === op.id ? "ring-2 ring-brasa" : "ring-1 ring-arena/20 hover:ring-arena/40"
                }`}
                style={{ backgroundColor: op.fondo }}
              >
                <span className="text-[0.88rem] font-bold" style={{ color: op.texto }}>
                  {op.nombre}
                </span>
                {/* Una fila de muestra: se ve cómo queda un plato, no un
                    cuadrado de color suelto. */}
                <span
                  className="mt-1.5 block text-[0.72rem]"
                  style={{ color: op.id === "claro" ? "#586661" : "#9a8f87" }}
                >
                  Acevichado · <b style={{ color: color || "#0fb68b" }}>S/27.00</b>
                </span>
              </button>
            ))}
          </div>

          <label className="mt-3 flex items-center gap-3">
            <input
              type="color"
              value={color || "#0fb68b"}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-lg border border-arena/20 bg-transparent"
              aria-label="Color de precios y botones"
            />
            <span className="text-[0.8rem] text-arena/70">
              Color de precios y botones
              {color && (
                <button
                  type="button"
                  onClick={() => setColor("")}
                  className="ml-2 font-semibold text-arena underline underline-offset-2"
                >
                  usar el de LeadAI
                </button>
              )}
            </span>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* El PAÍS al costado (2026-08-19): antes había que saber que el
              número va con el código pegado adelante y sin "+". Escribirlo mal
              es un pedido que no llega.

              Es el MISMO número que atiende el bot: si hay WhatsApp conectado,
              la carta usa ese y este queda de respaldo. */}
          <Campo etiqueta="WhatsApp de pedidos" ayuda="A donde te llegan">
            <div className="flex gap-2">
              <select
                value={codigoPais}
                onChange={(e) => setCodigoPais(e.target.value)}
                aria-label="País"
                // `w-auto` para anular el `w-full` de ENTRADA: sin esto el
                // select se estiraba y dejaba el campo del número en 30px —
                // justo el dato sin el cual el pedido no le llega a nadie.
                className={`${ENTRADA} !w-auto shrink-0 pr-2`}
              >
                {PAISES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.bandera} +{p.code}
                  </option>
                ))}
              </select>
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(soloDigitos(e.target.value))}
                inputMode="numeric"
                placeholder="987654321"
                className={`${ENTRADA} min-w-0 flex-1`}
              />
            </div>
          </Campo>

          {/* El ancho SIGUE AL DATO (2026-08-20): son dos dígitos, y un campo
              de 600px para escribir "25" se lee como un input roto —parecía
              tener un recuadro gris suelto adentro—. Los minutos van al lado,
              donde el ojo los espera. */}
          <Campo etiqueta="Tiempo de entrega" ayuda="Cuánto tardas en entregar">
            <div className="flex items-center gap-2">
              <input
                value={entrega}
                onChange={(e) => setEntrega(e.target.value.replace(/\D/g, "").slice(0, 3))}
                inputMode="numeric"
                placeholder="30"
                className={`${ENTRADA} !w-20 text-center tabular-nums`}
              />
              <span className="text-[0.9rem] text-arena/60">minutos</span>
            </div>
          </Campo>

          {/* La dirección es OPCIONAL a propósito (2026-08-19): muchos negocios
              de delivery cocinan desde su casa y no quieren publicarla. */}
          <div className="sm:col-span-2">
            <Campo etiqueta="Dirección" ayuda="Opcional — si solo haces delivery, déjala vacía">
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Av. Bolognesi 456, Tacna"
                className={ENTRADA}
              />
            </Campo>
          </div>
        </div>

        {/* LAS REDES (2026-08-19). Son los links por los que su cliente lo
            encontró, y la carta es donde termina esa cadena. Todas opcionales:
            un negocio chico tiene una o dos, no las cuatro. */}
        <div>
          <p className="text-[0.82rem] font-semibold text-arena">Tus redes</p>
          <p className="text-[0.75rem] text-arena/50">
            Aparecen al pie de tu carta. Pon las que uses.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {([
              ["Instagram", instagram, setInstagram, "instagram.com/tunegocio"],
              ["Facebook", facebook, setFacebook, "facebook.com/tunegocio"],
              ["TikTok", tiktok, setTiktok, "tiktok.com/@tunegocio"],
              ["Sitio web", web, setWeb, "tunegocio.com"],
            ] as const).map(([nombre, valor, set, ejemplo]) => (
              <label key={nombre} className="block">
                <span className="text-[0.78rem] text-arena/70">{nombre}</span>
                <input
                  value={valor}
                  onChange={(e) => set(e.target.value)}
                  placeholder={ejemplo}
                  className={`${ENTRADA} mt-1`}
                />
              </label>
            ))}
          </div>
        </div>

        {/* El WhatsApp es el único campo que rompe algo si está mal: sin él, el
            pedido de la carta no le llega a nadie. */}
        {!soloDigitos(whatsapp) && (
          <p className="rounded-tarjeta bg-orbita/15 px-4 py-3 text-[0.82rem] text-arena/85 ring-1 ring-orbita/30">
            Sin el WhatsApp de pedidos, el botón de la carta no lleva a ningún lado.
          </p>
        )}

        {/* El botón, SEPARADO por una línea y alineado a la derecha: suelto
            abajo a la izquierda no se leía como el cierre del formulario —el
            ojo lo buscaba donde termina el contenido—. */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-arena/15 pt-4">
          {ok && <span className="confirma mr-auto text-[0.85rem] font-semibold text-brasa">Guardado ✓</span>}
          {error && <span className="fila-entra mr-auto text-[0.85rem] font-semibold text-orbita">{error}</span>}
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="rounded-chip bg-orbita px-6 py-2.5 text-[0.88rem] font-bold text-sobre-orbita transition hover:bg-orbita-hondo disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </Seccion>
  );
}

const ENTRADA =
  "w-full rounded-lg border border-arena/20 bg-arena/10 px-3.5 py-2.5 text-[0.95rem] text-arena outline-none transition placeholder:text-arena/40 focus:border-brasa";

function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[0.82rem] font-semibold text-arena">{etiqueta}</span>
      {ayuda && <span className="ml-2 text-[0.75rem] text-arena/50">{ayuda}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export default MarcaCarta;

/**
 * Una imagen de la marca: miniatura, botón y ✕ para quitarla.
 *
 * El botón dice CAMBIAR si ya hay una e INSERTAR si no: "subir foto" cuando ya
 * subiste una no dice si la agrega o la reemplaza.
 */
function FilaImagen({
  etiqueta, url, subiendo, onElegir, onQuitar, ancha = false,
}: {
  etiqueta: string;
  url: string | null;
  subiendo: boolean;
  onElegir: (f: File) => void;
  onQuitar: () => void;
  /** La portada es apaisada: se muestra con esa proporción, no cuadrada. */
  ancha?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-tarjeta bg-arena/5 p-2 ring-1 ring-arena/10">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className={`h-12 shrink-0 rounded-lg object-cover ${ancha ? "w-20" : "w-12"}`}
        />
      ) : (
        <span
          className={`grid h-12 shrink-0 place-items-center rounded-lg bg-arena/10 text-[0.7rem] text-arena/40 ${
            ancha ? "w-20" : "w-12"
          }`}
        >
          sin
        </span>
      )}

      <span className="min-w-0 flex-1 text-[0.85rem] font-semibold text-arena">{etiqueta}</span>

      <label className="cursor-pointer rounded-chip bg-arena/10 px-3.5 py-2 text-[0.8rem] font-semibold text-arena ring-1 ring-arena/15 transition hover:bg-arena/20">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onElegir(f);
          }}
        />
        {subiendo ? "Subiendo…" : url ? `Cambiar ${etiqueta.toLowerCase()}` : `Insertar ${etiqueta.toLowerCase()}`}
      </label>

      {/* La ✕ solo si hay algo que quitar. Va al lado de SU imagen, no en una
          lista aparte donde no se sabía cuál era cuál. */}
      {url && (
        <button
          type="button"
          onClick={onQuitar}
          title={`Quitar ${etiqueta.toLowerCase()}`}
          aria-label={`Quitar ${etiqueta.toLowerCase()}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-arena/50 transition hover:bg-arena/10 hover:text-arena"
        >
          ✕
        </button>
      )}
    </div>
  );
}
