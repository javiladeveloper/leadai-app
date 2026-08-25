"use client";

/**
 * EL ALTA DE UN NEGOCIO, PASO A PASO (2026-08-18).
 *
 * Antes era un formulario con nombre y rubro, y todo lo demás —WhatsApp,
 * dirección, horario, carta, logo— quedaba escondido en Configuración. El
 * dueño terminaba el alta con un panel vacío y sin saber qué hacer.
 *
 * Ahora son cinco pasos cortos. El orden no es casual: primero lo que NO se
 * puede saltar (el negocio existe o no existe), después lo que hace que su
 * carta sirva, y al final lo lindo. Cada paso menos el primero se puede
 * saltar — quien tiene apuro llega igual al panel y completa después.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, leerSesion, guardarEmpresaActiva } from "@/lib/auth";
import { crearEmpresa } from "@/lib/api";
import { RUBROS_DISPONIBLES } from "@/lib/rubros";
import {
  guardarNegocio, subirImagenNegocio, leerFoto,
  leerExcel, leerFotoOPdf, importarCarta, descargarPlantilla,
  precioTexto, listarEspecialidades, platosDeEspecialidad,
  type ItemImportado, type Especialidad,
} from "@/lib/carta";
import { LogoLeadAI } from "@/components/LogoLeadAI";
import { guardarFormaDeTrabajo } from "@/lib/horario";
import { PasosOnboarding, Preparando } from "@/components/panel/PasosOnboarding";
import { CartaAMano } from "@/components/panel/CartaAMano";

const TOTAL_PASOS = 6;

/**
 * EL PASO "CÓMO TRABAJÁS" ES EL 6 EN EL CÓDIGO PERO EL 2 EN PANTALLA.
 *
 * Se agregó después (2026-08-25) y renumerar los cinco que ya existían habría
 * tocado ocho `setPaso` y sus tests. El orden lo decide `POSICION`, no el
 * número: agregar otro paso mañana es una fila más acá.
 */
const POSICION: Record<number, number> = { 1: 1, 6: 2, 2: 3, 3: 4, 4: 5, 5: 6 };

/** Los países donde puede estar el negocio. Perú primero: es donde estamos. */
const PAISES = [
  { code: "51", bandera: "🇵🇪" },
  { code: "54", bandera: "🇦🇷" },
  { code: "56", bandera: "🇨🇱" },
  { code: "57", bandera: "🇨🇴" },
  { code: "593", bandera: "🇪🇨" },
  { code: "591", bandera: "🇧🇴" },
  { code: "52", bandera: "🇲🇽" },
  { code: "1", bandera: "🇺🇸" },
];

export default function BienvenidaPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [agregar, setAgregar] = useState(false);
  const [paso, setPaso] = useState(1);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Paso 1 — el negocio
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState("");
  const [codigoPais, setCodigoPais] = useState("51");
  const [whatsapp, setWhatsapp] = useState("");
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Paso 2 — dónde y cuándo
  const [direccion, setDireccion] = useState("");
  const [horaAbre, setHoraAbre] = useState("11");
  const [horaCierra, setHoraCierra] = useState("23");
  const [entrega, setEntrega] = useState("30");

  // Paso 3 — la carta
  const [leyendo, setLeyendo] = useState(false);
  const [importados, setImportados] = useState<ItemImportado[]>([]);
  /**
   * CÓMO CARGA SU CARTA (2026-08-25). Hasta hoy los dos caminos exigían un
   * ARCHIVO —subir uno, o bajar una plantilla para volver con uno—, y el dueño
   * que tiene la carta en la cabeza quedaba trabado en el paso más importante.
   * Su única salida era "Saltar": un negocio sin carta, que es lo que hace
   * inútil al bot.
   */
  // Paso "cómo trabajás" (2026-08-25). Los defaults son el caso más común de
  // un restaurante peruano: local físico, toma reservas, cobra por Yape.
  const [tieneLocal, setTieneLocal] = useState(true);
  const [aceptaReservas, setAceptaReservas] = useState(true);
  const [yapeNumero, setYapeNumero] = useState("");
  const [yapeNombre, setYapeNombre] = useState("");
  const [cobra, setCobra] = useState<"antes" | "entrega" | "ambos">("antes");

  const [modoCarta, setModoCarta] = useState<"sugerida" | "archivo" | "mano">("sugerida");
  /** Las especialidades para prepoblar la carta (2026-08-25). */
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [cargandoSugerida, setCargandoSugerida] = useState("");
  const [erroresArchivo, setErroresArchivo] = useState<{ fila: number; motivo: string }[]>([]);

  // Paso 4 — la marca
  const [logo, setLogo] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Paso 5 — el resumen
  const [hechos, setHechos] = useState<Record<string, boolean>>({});

  // Un negocio que no es de comida no tiene carta ni horario de cocina: su
  // alta son dos pasos, no cinco. El id es `gastronomia`, el de la lista de
  // rubros (lib/rubros.ts) — con "comida" a secas la rama nunca se activaba.
  const esComida = rubro === "gastronomia";

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    const esAgregar = new URLSearchParams(window.location.search).get("agregar") === "1";
    setAgregar(esAgregar);
    const sesion = leerSesion();
    if (!esAgregar && sesion && sesion.empresas.length > 0) {
      router.replace("/inicio");
      return;
    }
    setListo(true);
  }, [router]);

  /**
   * Paso 5: guarda el horario y muestra qué quedó configurado.
   *
   * Los checks NO son animación de relleno: cada uno se marca cuando su dato
   * ya está guardado de verdad. Un spinner mudo deja la duda de si algo se
   * perdió en el camino.
   */
  useEffect(() => {
    if (paso !== 5) return;
    let vivo = true;
    (async () => {
      const marcar = (k: string) => vivo && setHechos((h) => ({ ...h, [k]: true }));
      marcar("negocio");
      if (whatsapp.trim()) { await new Promise((r) => setTimeout(r, 250)); marcar("whatsapp"); }
      if (direccion.trim()) { await new Promise((r) => setTimeout(r, 250)); marcar("direccion"); }
      if (esComida) {
        await guardarNegocio({});
        await new Promise((r) => setTimeout(r, 250));
        marcar("horario");
        if (importados.length > 0) { await new Promise((r) => setTimeout(r, 250)); marcar("carta"); }
        if (logo || banner) { await new Promise((r) => setTimeout(r, 250)); marcar("marca"); }
      }
    })();
    return () => { vivo = false; };
  }, [paso]);

  // Las especialidades se piden UNA vez, al llegar al paso de la carta: antes
  // sería una consulta que la mayoría no usa (quien no es restaurante nunca
  // llega acá).
  useEffect(() => {
    if (paso !== 3 || !esComida || especialidades.length > 0) return;
    void listarEspecialidades().then(setEspecialidades);
  }, [paso, esComida, especialidades.length]);

  if (!listo) return null;
  const primerNombre = leerSesion()?.usuario.nombre?.split(" ")[0] ?? "";

  /** Paso 1: crea el negocio de verdad. Sin esto no hay dónde guardar nada. */
  async function crearNegocio() {
    const limpio = nombre.trim();
    if (!limpio) { setError("Ponele un nombre a tu negocio."); return; }
    setError("");
    setGuardando(true);
    const r = await crearEmpresa(limpio, rubro || undefined);
    setGuardando(false);
    if (!r.ok) { setError(r.error ?? "No se pudo crear tu negocio."); return; }

    // La sesión se recarga con la empresa nueva; se adopta como activa para
    // que los pasos siguientes escriban en ella.
    const sesion = leerSesion();
    const creada = sesion?.empresas[sesion.empresas.length - 1];
    if (creada) {
      guardarEmpresaActiva(creada.tenantId);
      setTenantId(creada.tenantId);
    }
    if (whatsapp.trim()) {
      await guardarNegocio({ whatsappCarta: whatsapp.trim() });
    }
    // Un negocio que no es de comida no tiene carta ni horario de cocina:
    // salta directo al final.
    // El negocio de comida pasa por "cómo trabajás" (6, ver POSICION);
    // captación no tiene local ni cobra por Yape, así que salta al resumen.
    setPaso(esComida ? 6 : 5);
  }

  /**
   * Guarda CÓMO TRABAJA el negocio: local o delivery, reservas, a dónde le
   * pagan y si cobra antes o al entregar.
   *
   * Nada de esto se preguntaba en el alta y quedaba escondido en Ajustes — el
   * dueño se enteraba cuando un cliente no podía pagarle.
   */
  async function guardarComoTrabaja() {
    setGuardando(true);
    await guardarFormaDeTrabajo({
      tieneLocal,
      // Sin local no hay mesa que reservar, pase lo que pase el toggle.
      aceptaReservas: tieneLocal && aceptaReservas,
      yapeNumero: yapeNumero.trim(),
      yapeNombre: yapeNombre.trim(),
      // Sin número cargado no se puede cobrar por ahí: encenderlo dejaría al
      // bot pidiendo un Yape que no existe.
      aceptaYape: yapeNumero.trim().length > 0 && cobra !== "entrega",
      aceptaPlin: yapeNumero.trim().length > 0 && cobra !== "entrega",
      aceptaEfectivo: cobra !== "antes",
    });
    setGuardando(false);
    setPaso(2);
  }

  async function guardarPaso2() {
    setGuardando(true);
    await guardarNegocio({
      direccion: direccion.trim() || null,
      entregaMinutos: entrega ? Number(entrega) : null,
    });
    setGuardando(false);
    setPaso(3);
  }

  /** Lee el archivo que sea y deja los platos listos para revisar. */
  async function leerArchivo(archivo: File) {
    setError("");
    setLeyendo(true);
    const esExcel = /\.(xlsx|xls)$/i.test(archivo.name);
    const esPdf = /\.pdf$/i.test(archivo.name);

    const datos = await new Promise<string>((res) => {
      const l = new FileReader();
      l.onload = () => res(String(l.result));
      l.readAsDataURL(archivo);
    });

    const r = esExcel
      ? await leerExcel(datos)
      : esPdf
        ? await leerFotoOPdf({ pdfBase64: datos.slice(datos.indexOf(",") + 1) })
        : await leerFotoOPdf({ imagenBase64: datos, imagenMime: archivo.type });

    setLeyendo(false);
    if (!r.ok || !r.dato) {
      setError(r.error ?? "No pudimos leer ese archivo.");
      return;
    }
    setImportados(r.dato.items);
    setErroresArchivo(r.dato.errores);
    if (r.dato.items.length === 0) {
      setError("No encontramos platos en ese archivo.");
    }
  }

  async function guardarCarta() {
    if (importados.length === 0) { setPaso(4); return; }
    setGuardando(true);
    const r = await importarCarta(importados);
    setGuardando(false);
    if (!r.ok) { setError(r.error ?? "No se pudo guardar la carta."); return; }
    setPaso(4);
  }

  async function guardarMarca() {
    setGuardando(true);
    if (logo) await subirImagenNegocio("logo", logo);
    if (banner) await subirImagenNegocio("banner", banner);
    setGuardando(false);
    setPaso(5);
  }

  /** Trae los platos de una especialidad y los deja listos para editar. */
  async function usarEspecialidad(id: string) {
    setCargandoSugerida(id);
    const platos = await platosDeEspecialidad(id);
    setCargandoSugerida("");
    if (platos.length === 0) return;
    // Se pasan al modo "mano": ahí ya se pueden borrar los que no vende y
    // sumar los suyos. La carta sugerida es un punto de partida, no un molde.
    setImportados(platos);
    setModoCarta("mano");
  }

  const resumen = [
    { clave: "negocio", emoji: "🏪", titulo: "Tu negocio", detalle: nombre },
    ...(whatsapp.trim() ? [{ clave: "whatsapp", emoji: "💬", titulo: "WhatsApp", detalle: `+${whatsapp}` }] : []),
    ...(direccion.trim() ? [{ clave: "direccion", emoji: "📍", titulo: "Dirección", detalle: direccion }] : []),
    ...(esComida ? [{ clave: "horario", emoji: "🕐", titulo: "Horario", detalle: `${horaAbre}:00 a ${horaCierra}:00` }] : []),
    // LA CARTA SIEMPRE APARECE, cargada o no (2026-08-25). Antes solo salía si
    // la había cargado: quien la salteaba terminaba viendo "¡Todo listo!" sin
    // carta — y sin carta el bot no puede vender, que es todo el producto.
    // Marcarla como pendiente es lo único que le avisa que le falta.
    ...(esComida
      ? [{
          clave: "carta",
          emoji: "🍔",
          titulo: "Tu carta",
          detalle: importados.length > 0
            ? `${importados.length} platos cargados`
            // Corto a propósito: el detalle se trunca en una línea, y "no
            // pued…" no le dice nada a nadie.
            : "Falta — sin ella el bot no vende",
        }]
      : []),
    ...(logo || banner ? [{ clave: "marca", emoji: "🎨", titulo: "Logo y banner", detalle: "Tu carta con tu marca" }] : []),
  ];

  return (
    <div className="grid min-h-dvh place-items-center bg-arena px-5 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center gap-2">
          <LogoLeadAI className="h-9 w-9" />
          <span className="text-lg font-bold text-tinta">
            Lead<span className="text-brasa-texto">AI</span>
          </span>
        </div>

        {paso !== 5 && <PasosOnboarding actual={POSICION[paso] ?? paso} total={esComida ? TOTAL_PASOS : 2} />}

        {error && (
          <p className="mb-4 rounded-tarjeta bg-alerta/10 px-4 py-3 text-[0.9rem] font-semibold text-alerta ring-1 ring-alerta/25">
            {error}
          </p>
        )}

        {/* ── 1. El negocio ── */}
        {paso === 1 && (
          <div className="entra">
            <h1 className="text-[1.8rem] font-bold leading-tight text-tinta">
              {agregar ? "Agregá otro negocio" : `¡Bienvenido${primerNombre ? `, ${primerNombre}` : ""}! 👋`}
            </h1>
            <p className="mt-2 text-[1.02rem] text-tinta-2">
              Empecemos por lo básico: cómo se llama y a qué se dedica.
            </p>

            <div className="mt-7 space-y-4">
              <Campo etiqueta="Nombre de tu negocio">
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoFocus
                  placeholder="Ej: Burger House"
                  className={ENTRADA}
                />
              </Campo>

              <Campo etiqueta="¿A qué se dedica?">
                <select value={rubro} onChange={(e) => setRubro(e.target.value)} className={ENTRADA}>
                  <option value="">Elegí tu rubro…</option>
                  {RUBROS_DISPONIBLES.map((r) => (
                    <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>
                  ))}
                </select>
              </Campo>

              {/* OBLIGATORIO (2026-08-19): sin este número la carta no lleva a
                  ningún lado — el cliente arma su pedido y no tiene a dónde
                  mandarlo. Se pedía pero se podía saltear con Continuar. */}
              <Campo
                etiqueta="Tu WhatsApp"
                ayuda="A dónde te llegan los pedidos de tus clientes"
              >
                {/* El PAÍS se elige (2026-08-19): estaba fijo en +51 y un
                    negocio fuera de Perú no podía cargar su número. */}
                <div className="flex items-center gap-2">
                  <select
                    value={codigoPais}
                    onChange={(e) => {
                      const nuevo = e.target.value;
                      const local = whatsapp.slice(codigoPais.length);
                      setCodigoPais(nuevo);
                      setWhatsapp(`${nuevo}${local}`);
                    }}
                    aria-label="País"
                    // `!w-28` con `!`: ENTRADA trae `w-full` y sin forzarlo el
                    // selector se estiraba a 512px dejando el campo del número
                    // en 34px — no entraba ni un dígito visible. Es el campo
                    // más importante del alta: sin WhatsApp no hay producto.
                    className={`${ENTRADA} !w-28 shrink-0`}
                  >
                    {PAISES.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.bandera} +{p.code}
                      </option>
                    ))}
                  </select>
                  <input
                    value={whatsapp.slice(codigoPais.length)}
                    onChange={(e) =>
                      setWhatsapp(`${codigoPais}${e.target.value.replace(/\D/g, "")}`)
                    }
                    inputMode="tel"
                    placeholder="987 654 321"
                    className={`${ENTRADA} min-w-0 flex-1`}
                  />
                </div>
              </Campo>
            </div>

            {/* El aviso aparece solo si empezó a escribir y va corto: en
                blanco todavía no se equivocó en nada. */}
            {whatsapp.slice(codigoPais.length).length > 0 &&
              whatsapp.slice(codigoPais.length).length < 8 && (
                <p className="mt-3 text-[0.85rem] text-brasa-texto">
                  El número va con sus 9 dígitos.
                </p>
              )}

            <button
              onClick={crearNegocio}
              disabled={
                guardando || !nombre.trim() || whatsapp.slice(codigoPais.length).length < 8
              }
              className={BOTON}
            >
              {guardando ? "Creando…" : "Continuar"}
            </button>
          </div>
        )}

        {/* ── 2. Dónde y cuándo ── */}
        {/* CÓMO TRABAJA EL NEGOCIO (2026-08-25). Es el paso 2 en pantalla —
            ver POSICION— porque son las decisiones que definen qué puede
            hacer el bot: sin saber si tiene local o a dónde le pagan, no
            puede tomar una reserva ni cobrar un pedido. */}
        {paso === 6 && (
          <div className="entra">
            <h1 className="text-[1.8rem] font-bold leading-tight text-tinta">
              ¿Cómo trabajás?
            </h1>
            <p className="mt-2 text-[1.02rem] text-tinta-2">
              Con esto tu bot sabe qué ofrecerle a cada cliente.
            </p>

            <div className="mt-7 space-y-5">
              <Campo etiqueta="¿Tenés local para comer ahí?">
                <div className="flex flex-wrap gap-2">
                  {([
                    { v: true, txt: "🍽️ Sí, tengo local" },
                    { v: false, txt: "🛵 Solo delivery" },
                  ] as const).map((o) => (
                    <button
                      key={String(o.v)}
                      type="button"
                      onClick={() => setTieneLocal(o.v)}
                      className={`rounded-chip px-4 py-2.5 text-[0.9rem] font-semibold transition ${
                        tieneLocal === o.v
                          ? "bg-brasa text-sobre-brasa"
                          : "text-tinta-2 ring-1 ring-linea hover:bg-carta"
                      }`}
                    >
                      {o.txt}
                    </button>
                  ))}
                </div>
              </Campo>

              {/* Sin local no hay mesa que reservar: la pregunta desaparece en
                  vez de quedar en gris pidiendo una decisión imposible. */}
              {tieneLocal && (
                <Campo etiqueta="¿Tomás reservas de mesa?">
                  <div className="flex flex-wrap gap-2">
                    {([
                      { v: true, txt: "Sí" },
                      { v: false, txt: "No, solo llegan" },
                    ] as const).map((o) => (
                      <button
                        key={String(o.v)}
                        type="button"
                        onClick={() => setAceptaReservas(o.v)}
                        className={`rounded-chip px-4 py-2.5 text-[0.9rem] font-semibold transition ${
                          aceptaReservas === o.v
                            ? "bg-brasa text-sobre-brasa"
                            : "text-tinta-2 ring-1 ring-linea hover:bg-carta"
                        }`}
                      >
                        {o.txt}
                      </button>
                    ))}
                  </div>
                </Campo>
              )}

              <Campo etiqueta="¿Cuándo te pagan?">
                <div className="flex flex-wrap gap-2">
                  {([
                    { v: "antes", txt: "Antes de cocinar" },
                    { v: "entrega", txt: "Al recibir" },
                    { v: "ambos", txt: "Las dos" },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setCobra(o.v)}
                      className={`rounded-chip px-4 py-2.5 text-[0.9rem] font-semibold transition ${
                        cobra === o.v
                          ? "bg-brasa text-sobre-brasa"
                          : "text-tinta-2 ring-1 ring-linea hover:bg-carta"
                      }`}
                    >
                      {o.txt}
                    </button>
                  ))}
                </div>
              </Campo>

              {/* El Yape solo si cobra por adelantado: a quien cobra al
                  entregar, pedirle un número es preguntarle por algo que no
                  usa. */}
              {cobra !== "entrega" && (
                <>
                  <Campo etiqueta="Tu número de Yape o Plin" ayuda="A dónde te transfieren">
                    <input
                      value={yapeNumero}
                      onChange={(e) => setYapeNumero(e.target.value.replace(/\D/g, ""))}
                      inputMode="tel"
                      placeholder="987 654 321"
                      className={ENTRADA}
                    />
                  </Campo>
                  <Campo etiqueta="A nombre de quién" ayuda="Como aparece en la app, para revisar el pago">
                    <input
                      value={yapeNombre}
                      onChange={(e) => setYapeNombre(e.target.value)}
                      placeholder="María López"
                      className={ENTRADA}
                    />
                  </Campo>
                </>
              )}
            </div>

            <div className="mt-7 flex gap-2">
              <button onClick={() => setPaso(2)} className={BOTON_SECUNDARIO}>Saltar</button>
              <button
                onClick={guardarComoTrabaja}
                disabled={guardando}
                className={`${BOTON} mt-0 flex-1`}
              >
                {guardando ? "Guardando…" : "Continuar"}
              </button>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="entra">
            <h1 className="text-[1.8rem] font-bold leading-tight text-tinta">
              ¿Dónde y cuándo atendés?
            </h1>
            <p className="mt-2 text-[1.02rem] text-tinta-2">
              Tus clientes lo van a ver en tu carta.
            </p>

            <div className="mt-7 space-y-4">
              <Campo etiqueta="Dirección" ayuda="Opcional">
                <input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  autoFocus
                  placeholder="Av. Bolognesi 456, Tacna"
                  className={ENTRADA}
                />
              </Campo>

              <Campo etiqueta="Horario de atención">
                <div className="flex items-center gap-2">
                  <select value={horaAbre} onChange={(e) => setHoraAbre(e.target.value)} className={ENTRADA}>
                    {HORAS.map((h) => <option key={h} value={h}>{h}:00</option>)}
                  </select>
                  <span className="shrink-0 text-tinta-2">a</span>
                  <select value={horaCierra} onChange={(e) => setHoraCierra(e.target.value)} className={ENTRADA}>
                    {HORAS.map((h) => <option key={h} value={h}>{h}:00</option>)}
                  </select>
                </div>
              </Campo>

              <Campo etiqueta="Tiempo de entrega" ayuda="Cuánto tarda un delivery">
                <div className="flex items-center gap-2">
                  <input
                    value={entrega}
                    onChange={(e) => setEntrega(e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    className="w-24 rounded-lg border border-linea bg-carta px-4 py-3 text-[1rem] tabular-nums text-tinta outline-none transition focus:border-brasa"
                  />
                  <span className="text-tinta-2">minutos</span>
                </div>
              </Campo>
            </div>

            <div className="mt-7 flex gap-2">
              <button onClick={() => setPaso(3)} className={BOTON_SECUNDARIO}>Saltar</button>
              <button onClick={guardarPaso2} disabled={guardando} className={`${BOTON} mt-0 flex-1`}>
                {guardando ? "Guardando…" : "Continuar"}
              </button>
            </div>
          </div>
        )}

        {/* ── 3. La carta ── */}
        {paso === 3 && (
          <div className="entra">
            <h1 className="text-[1.8rem] font-bold leading-tight text-tinta">
              Cargá tu carta en segundos
            </h1>
            <p className="mt-2 text-[1.02rem] text-tinta-2">
              {modoCarta === "sugerida"
                ? "Elegí qué vendés y te armamos la carta. Después corregís precios y borrás lo que no tengas."
                : modoCarta === "archivo"
                  ? "Subí una foto, un PDF o un Excel. Nosotros sacamos los platos y los precios."
                  : importados.length > 0
                    // Con platos ya cargados, lo que importa es que REVISE los
                    // precios: son de referencia y publicar los nuestros sería
                    // vender al precio equivocado.
                    ? "Revisá los precios y borrá lo que no vendas. Podés sumar tus platos acá abajo."
                    : "Escribí tus platos con su precio. Con los más pedidos alcanza para empezar."}
            </p>

            {/* LAS DOS FORMAS, A LA VISTA (2026-08-25). Antes solo se podía
                subir un archivo, y quien no tenía uno solo podía saltear el
                paso — quedando sin carta, que es lo que hace inútil al bot. */}
            {(modoCarta === "mano" || importados.length === 0) && (
              <div className="mt-5 flex gap-1.5" role="tablist">
                {([
                  { id: "sugerida", txt: "Empezar con una base" },
                  { id: "archivo", txt: "Subir un archivo" },
                  { id: "mano", txt: "Escribirla acá" },
                ] as const).map((o) => (
                  <button
                    key={o.id}
                    role="tab"
                    aria-selected={modoCarta === o.id}
                    onClick={() => setModoCarta(o.id)}
                    className={`rounded-chip px-4 py-2 text-[0.88rem] font-semibold transition ${
                      modoCarta === o.id
                        ? "bg-brasa text-sobre-brasa"
                        : "text-tinta-2 ring-1 ring-linea hover:bg-arena"
                    }`}
                  >
                    {o.txt}
                  </button>
                ))}
              </div>
            )}

            {modoCarta === "sugerida" && importados.length === 0 ? (
              /* LOS PRECIOS SON DE REFERENCIA y se dicen así: un dueño que
                 cree que son los suyos publica mal. Corregirlos mirándolos es
                 mucho más rápido que escribir treinta platos de cero. */
              <div className="mt-5">
                <div className="flex flex-wrap gap-2">
                  {especialidades.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => usarEspecialidad(e.id)}
                      disabled={cargandoSugerida !== ""}
                      className="rounded-tarjeta bg-carta px-4 py-3 text-left ring-1 ring-linea transition hover:ring-brasa/50 disabled:opacity-50"
                    >
                      <span className="text-[1.3rem]">{e.emoji}</span>
                      <span className="ml-2 text-[0.92rem] font-semibold text-tinta">{e.etiqueta}</span>
                      <span className="block text-[0.78rem] text-frio">
                        {cargandoSugerida === e.id ? "Armando tu carta…" : `${e.platos} platos para empezar`}
                      </span>
                    </button>
                  ))}
                </div>
                {especialidades.length === 0 && (
                  <p className="text-[0.88rem] text-frio">Cargando opciones…</p>
                )}
              </div>
            ) : modoCarta === "mano" || (modoCarta === "sugerida" && importados.length > 0) ? (
              /* SIEMPRE, no solo con la lista vacía (bug 2026-08-25): al
                 agregar el primer plato el formulario desaparecía y no se
                 podía cargar el segundo. `CartaAMano` ya muestra lo cargado,
                 así que no necesita el bloque de revisión del archivo. */
              <CartaAMano items={importados} onCambio={setImportados} />
            ) : importados.length === 0 ? (
              <>
                <label className="mt-5 block cursor-pointer rounded-tarjeta border-2 border-dashed border-linea bg-carta px-6 py-10 text-center transition hover:border-orbita">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) leerArchivo(f);
                    }}
                  />
                  {leyendo ? (
                    <>
                      <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-2 border-linea border-t-orbita" />
                      <p className="font-semibold text-tinta">Leyendo tu carta…</p>
                      <p className="mt-1 text-[0.85rem] text-frio">Esto tarda unos segundos</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[2rem]">📄</p>
                      <p className="mt-2 font-semibold text-tinta">Subí tu carta</p>
                      <p className="mt-1 text-[0.85rem] text-frio">Foto, PDF o Excel</p>
                    </>
                  )}
                </label>

                <button
                  onClick={() => descargarPlantilla()}
                  className="mt-3 w-full text-center text-[0.85rem] font-semibold text-brasa-texto hover:underline"
                >
                  ¿No tenés tu carta en archivo? Descargá la plantilla de Excel
                </button>
              </>
            ) : (
              /* La REVISIÓN antes de guardar: la IA lee mal un dígito de vez en
                 cuando, y un precio equivocado en la carta es plata perdida. */
              <div className="mt-6">
                <p className="mb-2 font-semibold text-tinta">
                  Encontramos {importados.length} platos
                </p>
                {erroresArchivo.length > 0 && (
                  <p className="mb-3 rounded-lg bg-orbita/10 px-3 py-2 text-[0.85rem] text-calor ring-1 ring-orbita/25">
                    {erroresArchivo.length}{" "}
                    {erroresArchivo.length === 1 ? "fila no se pudo leer" : "filas no se pudieron leer"} —
                    las podés cargar a mano después.
                  </p>
                )}
                <div className="scroll-fino max-h-72 space-y-1.5 overflow-y-auto rounded-tarjeta bg-carta p-3 ring-1 ring-linea">
                  {importados.map((i, n) => (
                    <div key={n} className="flex items-center gap-2 text-[0.9rem]">
                      <span className="min-w-0 flex-1 truncate text-tinta">
                        {i.nombre}
                        {i.seccion && <span className="ml-1.5 text-[0.78rem] text-frio">{i.seccion}</span>}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-calor">
                        {precioTexto(i.precioCentavos)}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setImportados([]); setErroresArchivo([]); }}
                  className="mt-2 text-[0.82rem] font-semibold text-frio hover:text-tinta"
                >
                  Subir otro archivo
                </button>
              </div>
            )}

            <div className="mt-7 flex gap-2">
              <button onClick={() => setPaso(4)} className={BOTON_SECUNDARIO}>
                {importados.length > 0 ? "Descartar" : "Saltar"}
              </button>
              <button
                onClick={guardarCarta}
                disabled={guardando || leyendo}
                className={`${BOTON} mt-0 flex-1`}
              >
                {guardando ? "Guardando…" : importados.length > 0 ? `Cargar ${importados.length} platos` : "Continuar"}
              </button>
            </div>
          </div>
        )}

        {/* ── 4. La marca ── */}
        {paso === 4 && (
          <div className="entra">
            <h1 className="text-[1.8rem] font-bold leading-tight text-tinta">
              Ponele tu cara
            </h1>
            <p className="mt-2 text-[1.02rem] text-tinta-2">
              Tu logo y una foto de portada. Sin esto, tu carta parece un
              formulario.
            </p>

            {/* La vista previa arma la cabecera REAL de la carta: el dueño ve
                cómo va a quedar, no dos recuadros sueltos. */}
            <div className="mt-6 overflow-hidden rounded-tarjeta ring-1 ring-linea">
              <label className="relative block h-28 cursor-pointer bg-superficie-honda">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    const r = await leerFoto(f);
                    if (r.ok) setBanner(r.datos); else setError(r.error);
                  }}
                />
                {banner ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full place-items-center text-[0.85rem] font-semibold text-arena/70">
                    + Foto de portada
                  </span>
                )}
              </label>

              <div className="bg-carta px-4 pb-4">
                <label className="-mt-8 mb-2 block w-fit cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      const r = await leerFoto(f);
                      if (r.ok) setLogo(r.datos); else setError(r.error);
                    }}
                  />
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="" className="h-16 w-16 rounded-2xl object-cover ring-2 ring-carta" />
                  ) : (
                    <span className="grid h-16 w-16 place-items-center rounded-2xl bg-arena text-[0.7rem] font-bold text-frio ring-2 ring-carta">
                      + Logo
                    </span>
                  )}
                </label>
                <p className="font-bold text-tinta">{nombre || "Tu negocio"}</p>
                {direccion && <p className="text-[0.85rem] text-tinta-2">📍 {direccion}</p>}
              </div>
            </div>

            <div className="mt-7 flex gap-2">
              <button onClick={() => setPaso(5)} className={BOTON_SECUNDARIO}>Saltar</button>
              <button onClick={guardarMarca} disabled={guardando} className={`${BOTON} mt-0 flex-1`}>
                {guardando ? "Guardando…" : "Continuar"}
              </button>
            </div>
          </div>
        )}

        {/* ── 5. Listo ── */}
        {paso === 5 && (
          <Preparando
            items={resumen.map((r) => ({ ...r, hecho: !!hechos[r.clave] }))}
            alTerminar={() => router.replace("/inicio")}
          />
        )}
      </div>
    </div>
  );
}

const ENTRADA =
  "w-full rounded-lg border border-linea bg-carta px-4 py-3 text-[1rem] text-tinta outline-none transition focus:border-brasa";
const BOTON =
  "mt-7 w-full rounded-tarjeta bg-orbita px-6 py-3.5 text-[1rem] font-bold text-sobre-orbita transition hover:bg-orbita-hondo active:scale-[0.99] disabled:opacity-50";
const BOTON_SECUNDARIO =
  "rounded-tarjeta px-5 py-3.5 text-[0.95rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-carta";

const HORAS = Array.from({ length: 24 }, (_, i) => String(i));

function Campo({
  etiqueta, ayuda, children,
}: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[0.85rem] font-semibold text-tinta">{etiqueta}</span>
      {ayuda && <span className="ml-2 text-[0.78rem] text-frio">{ayuda}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
