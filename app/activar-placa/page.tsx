"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { haySesion, leerSesion, guardarEmpresaActiva, type EmpresaResumen } from "@/lib/auth";
import {
  negociosParaPlaca, activarPlaca, estadoPlaca, iniciarDemoPlaca, terminarDemoPlaca,
  type NegocioGooglePlaca, type EstadoPlaca,
} from "@/lib/api";
import { LogoLeadAI } from "@/components/LogoLeadAI";

/**
 * ACTIVACIÓN DE UNA PLACA NFC DE RESEÑAS (2026-08-26).
 *
 * El dueño toca su placa nueva → `/r/{uid}` ve que está libre → lo manda acá
 * con el uid en la URL. Es UNA sola vez por placa y debe resolverse en menos
 * de 30 segundos (spec §5): explicar → sesión → elegir el negocio de Google
 * (GPS o búsqueda) → PIN del empaque → listo.
 *
 * DEMOSTRACIÓN Y VENTA (2026-11-04, Jonathan: "buscar el código en un ARCHIVO
 * no es escalable"). Un vendedor toca una placa libre, elige el negocio del
 * cliente y la placa ya abre SUS reseñas: el dueño la prueba con su celular.
 * Si compra, el vendedor le pasa un enlace (`?c=`) y el dueño la activa con su
 * cuenta, con el negocio ya elegido y SIN PIN. Si no compra, el vendedor
 * termina la demostración y la placa queda libre para la próxima visita.
 *
 * REGLA DE ORO: NUNCA vincular automáticamente aunque haya un solo resultado
 * — si el GPS falla, las reseñas se irían a otro negocio por meses sin que
 * nadie lo note. Confirmación explícita SIEMPRE, también al reclamar.
 */

type Paso =
  | "cargando" | "sin-sesion" | "modo" | "negocio" | "pin" | "confirmar-demo"
  | "demo" | "demo-ajena" | "no-disponible" | "listo";

/** Para qué se está eligiendo el negocio de Google. */
type Proposito = "activar" | "demo";

/**
 * El WhatsApp de la empresa, para quien quiere que le expliquen.
 *
 * Literal y no por env: es una página del panel, y `NEXT_PUBLIC_*` obliga a
 * rebuild igual. Si cambia, se cambia acá y en `WHATSAPP_SOPORTE` del backend.
 */
const WHATSAPP = "51986110558";

/** Cómo se llama el producto según el diseño impreso de la placa. */
const NOMBRE_MARCA: Record<string, string> = {
  sania: "Sania",
  fitcore: "FitCore",
  wappido: "Wappido",
};

export default function ActivarPlaca() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [codigo, setCodigo] = useState(""); // el `?c=` del enlace del vendedor
  const [paso, setPaso] = useState<Paso>("cargando");
  const [proposito, setProposito] = useState<Proposito>("activar");
  const [estado, setEstado] = useState<EstadoPlaca | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaResumen[]>([]);
  const [empresa, setEmpresa] = useState<string>("");

  // Negocio de Google
  const [buscando, setBuscando] = useState(false);
  const [gpsFallo, setGpsFallo] = useState(false);
  const [negocios, setNegocios] = useState<NegocioGooglePlaca[]>([]);
  const [consulta, setConsulta] = useState("");
  const [elegido, setElegido] = useState<NegocioGooglePlaca | null>(null);

  // PIN + resultado
  const [pin, setPin] = useState("");
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  // La MARCA de la placa (leadai/sania/fitcore/wappido) decide qué producto invita la
  // pantalla de éxito — publicidad en el momento de máxima atención.
  const [marca, setMarca] = useState<string | null>(null);

  // Demostración en curso (vista del vendedor)
  const [linkDueno, setLinkDueno] = useState("");
  const [qrDueno, setQrDueno] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [confirmandoFin, setConfirmandoFin] = useState(false);

  // Con el código del enlace válido, el dueño activa sin PIN.
  const porEnlace = Boolean(estado?.reclamo && codigo);

  useEffect(() => {
    // El uid viene en la URL (?uid=04A2...). Se lee acá y no con
    // useSearchParams para no pelear con el prerender de Next.
    const params = new URLSearchParams(window.location.search);
    const u = (params.get("uid") ?? "").toUpperCase();
    const c = (params.get("c") ?? "").toUpperCase();
    setUid(u);
    setCodigo(c);
    if (!haySesion()) { setPaso("sin-sesion"); return; }
    const emp = leerSesion()?.empresas ?? [];
    setEmpresas(emp);
    setEmpresa(emp[0]?.tenantId ?? "");
    void cargar(u, c);
    // Una sola vez al abrir: la placa y el enlace vienen en la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargar(u: string, c: string) {
    const e = await estadoPlaca(u, c || undefined);
    setEstado(e);
    setMarca(e?.marca ?? null);
    // Sin respuesta del servidor: el camino de siempre (activar con PIN).
    if (!e) { setPaso("negocio"); return; }
    if (e.estado === "demo") {
      if (e.reclamo) {
        setElegido({ placeId: e.reclamo.placeId, nombre: e.reclamo.negocio ?? "Tu negocio", direccion: "" });
        setProposito("activar");
        setPaso("pin");
      } else if (e.demo) {
        mostrarDemo(e.demo.link);
      } else {
        setPaso("demo-ajena");
      }
      return;
    }
    if (e.estado === "libre") {
      setPaso(e.puedeVender ? "modo" : "negocio");
      return;
    }
    setPaso("no-disponible");
  }

  function mostrarDemo(link: string) {
    setLinkDueno(link);
    setPaso("demo");
    QRCode.toDataURL(link, { margin: 1, width: 240 }).then(setQrDueno).catch(() => setQrDueno(""));
  }

  // El permiso de ubicación se pide RECIÉN cuando el dueño toca el botón
  // (feedback de Jonathan 26-ago probando: un prompt de golpe al cargar, sin
  // contexto, se bloquea por reflejo — y un permiso bloqueado no se recupera
  // fácil). El botón explica para qué y ahí sí se dispara el prompt.
  const [pidioGps, setPidioGps] = useState(false);
  function usarMiUbicacion() {
    if (!("geolocation" in navigator)) { setGpsFallo(true); return; }
    setPidioGps(true);
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lista = await negociosParaPlaca(
          { lat: pos.coords.latitude, lng: pos.coords.longitude }, empresa || undefined,
        );
        setNegocios(lista);
        if (lista.length === 0) setGpsFallo(true); // sin resultados: a la búsqueda manual
        setBuscando(false);
      },
      () => { setGpsFallo(true); setBuscando(false); },
      { timeout: 8000, maximumAge: 60000 },
    );
  }

  function irALogin() {
    // El login ya sabe volver a una pantalla puntual (patrón `volver_a`).
    // Con el código del enlace incluido: el dueño vuelve a SU reclamo.
    sessionStorage.setItem("volver_a", `/activar-placa?uid=${uid}${codigo ? `&c=${codigo}` : ""}`);
    router.push("/");
  }

  async function buscarManual() {
    if (!consulta.trim() || buscando) return;
    setBuscando(true);
    setNegocios(await negociosParaPlaca({ q: consulta.trim() }, empresa || undefined));
    setBuscando(false);
  }

  function elegirNegocio(n: NegocioGooglePlaca) {
    setElegido(n);
    setError("");
    setPaso(proposito === "demo" ? "confirmar-demo" : "pin");
  }

  function cambiarNegocio() {
    setElegido(null);
    setError("");
    setPaso("negocio");
  }

  async function activar() {
    if (!elegido || activando) return;
    if (!porEnlace && !pin.trim()) return;
    setActivando(true);
    setError("");
    if (empresa) guardarEmpresaActiva(empresa);
    const r = await activarPlaca(
      porEnlace
        ? { uid, codigo, placeId: elegido.placeId }
        : { uid, pin: pin.trim().toUpperCase(), placeId: elegido.placeId },
      empresa || undefined,
    );
    setActivando(false);
    if (r.ok && r.reviewUrl) {
      setReviewUrl(r.reviewUrl);
      setMarca(r.marca ?? null);
      setPaso("listo");
    } else {
      setError(r.error ?? "No se pudo activar. Intenta de nuevo.");
    }
  }

  async function empezarDemo() {
    if (!elegido || activando) return;
    setActivando(true);
    setError("");
    const r = await iniciarDemoPlaca(uid, { placeId: elegido.placeId, negocio: elegido.nombre });
    setActivando(false);
    if (r.ok && r.link) {
      setEstado((e) => e && {
        ...e, estado: "demo",
        demo: { negocio: elegido.nombre, placeId: elegido.placeId, desde: new Date().toISOString(), link: r.link! },
      });
      mostrarDemo(r.link);
    } else {
      setError(r.error ?? "No se pudo iniciar la demostración.");
    }
  }

  async function terminarDemo() {
    if (activando) return;
    setActivando(true);
    setError("");
    const r = await terminarDemoPlaca(uid);
    setActivando(false);
    setConfirmandoFin(false);
    if (r.ok) {
      setEstado((e) => e && { ...e, estado: "libre", demo: undefined });
      setElegido(null);
      setNegocios([]);
      setPaso("modo");
    } else {
      setError(r.error ?? "No se pudo terminar la demostración.");
    }
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkDueno);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* sin permiso de portapapeles: queda el QR y WhatsApp */ }
  }

  const negocioDemo = estado?.demo?.negocio ?? elegido?.nombre ?? "su negocio";
  const textoWhatsappDueno =
    `Hola, este es el enlace para activar tu placa de reseñas de ${negocioDemo}. ` +
    `Ábrelo, entra con tu cuenta y confirma: ${linkDueno}`;

  // La invitación de la pantalla de éxito, según el diseño impreso de la placa.
  const invitacion =
    marca === "sania"
      ? { titulo: "¿Tu clínica todavía agenda a mano?", texto: "Sania agenda las citas, les confirma a tus pacientes y organiza tu día.", url: "https://www.saniape.com/?utm_source=placa&utm_medium=activacion", cta: "Conoce Sania" }
      : marca === "fitcore"
        ? { titulo: "¿Manejas un gimnasio?", texto: "FitCore controla socios, pagos y accesos en una sola pantalla.", url: "https://www.fitcorecenter.com/?utm_source=placa&utm_medium=activacion", cta: "Conoce FitCore" }
        // Las placas de restaurantes se imprimen con la marca Wappido (2026-10-12):
        // sin esta rama, la muestra de fábrica caía en la invitación genérica de LeadAI.
        : marca === "wappido"
          ? { titulo: "¿Tu restaurante recibe pedidos por WhatsApp?", texto: "Wappido toma los pedidos por ti, los manda a cocina y te avisa cuando hay que despachar.", url: "https://wappido.com/?utm_source=placa&utm_medium=activacion", cta: "Conoce Wappido" }
          : { titulo: "¿Sabías que tu cuenta puede más?", texto: "LeadAI puede responder el WhatsApp de tu negocio con IA — ya tienes cuenta, solo actívalo.", url: "https://leadai-pe.com/?utm_source=placa&utm_medium=activacion", cta: "Descubre LeadAI" };

  const botonPrincipal =
    "w-full rounded-chip bg-brasa px-6 py-3 text-[0.95rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50";
  const botonSecundario =
    "w-full rounded-chip bg-carta px-6 py-3 text-[0.95rem] font-semibold text-tinta ring-1 ring-linea transition hover:ring-brasa/50 disabled:opacity-50";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 py-8">
      <div className="flex items-center gap-2">
        <LogoLeadAI className="h-8" />
      </div>

      {paso === "cargando" && <p className="text-frio">Cargando…</p>}

      {paso === "sin-sesion" && (
        <div className="space-y-4">
          <h1 className="text-[1.4rem] font-bold text-tinta">Activa tu placa de reseñas</h1>
          <p className="text-[0.95rem] text-tinta-2">
            Estás a un minuto de que cada cliente que toque esta placa deje su reseña
            en el Google de tu negocio. Solo necesitas una cuenta LeadAI —
            <strong> gratis, sin tarjeta</strong>.
          </p>
          <button onClick={irALogin} className={botonPrincipal}>
            Entrar o crear mi cuenta
          </button>
          <p className="text-[0.8rem] text-frio">
            Después de entrar vuelves automáticamente a esta pantalla.
          </p>
        </div>
      )}

      {paso === "modo" && (
        <div className="space-y-4">
          <h1 className="text-[1.4rem] font-bold text-tinta">¿Qué quieres hacer con esta placa?</h1>
          <button
            onClick={() => { setProposito("demo"); setPaso("negocio"); }}
            className="w-full rounded-tarjeta bg-carta px-4 py-4 text-left ring-1 ring-brasa/40 transition hover:ring-brasa"
          >
            <p className="text-[0.98rem] font-bold text-tinta">🤝 Mostrarla a un cliente</p>
            <p className="mt-0.5 text-[0.84rem] text-tinta-2">
              Eliges su negocio y la placa abre sus reseñas en cualquier celular. Si la compra, le pasas
              un enlace para que la active. Sin PIN.
            </p>
          </button>
          <button
            onClick={() => { setProposito("activar"); setPaso("negocio"); }}
            className="w-full rounded-tarjeta bg-carta px-4 py-4 text-left ring-1 ring-linea transition hover:ring-brasa/50"
          >
            <p className="text-[0.98rem] font-bold text-tinta">🏷️ Activarla para mi negocio</p>
            <p className="mt-0.5 text-[0.84rem] text-tinta-2">Con el PIN del empaque.</p>
          </button>
        </div>
      )}

      {paso === "negocio" && (
        <div className="space-y-4">
          <h1 className="text-[1.4rem] font-bold text-tinta">
            {proposito === "demo" ? "¿Qué negocio le vas a mostrar?" : "¿Cuál es tu negocio en Google?"}
          </h1>
          <p className="text-[0.9rem] text-tinta-2">
            {proposito === "demo"
              ? "La placa abrirá las reseñas de este negocio mientras dure la demostración."
              : "Las reseñas de tus clientes irán a la ficha de Google que elijas aquí."}
          </p>

          {proposito === "activar" && empresas.length > 1 && (
            <div>
              <label className="text-[0.82rem] font-bold text-tinta">La placa es de:</label>
              <select
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="mt-1 w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta ring-1 ring-linea"
              >
                {empresas.map((e) => (
                  <option key={e.tenantId} value={e.tenantId}>{e.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {!pidioGps && !gpsFallo && negocios.length === 0 && (
            <div className="space-y-2">
              <button onClick={usarMiUbicacion} className={botonPrincipal}>
                📍 Buscar los negocios a mi alrededor
              </button>
              <p className="text-center text-[0.78rem] text-frio">
                Te pediremos permiso de ubicación solo para esto. Si estás parado en el
                negocio, aparecerá en la lista.
              </p>
            </div>
          )}

          {buscando && <p className="text-[0.88rem] text-frio">Buscando negocios cerca de ti…</p>}

          {negocios.length > 0 && (
            <div className="space-y-2">
              <p className="text-[0.78rem] font-bold uppercase tracking-wide text-frio">
                A menos de 150 m de ti
              </p>
              {negocios.map((n) => (
                <button
                  key={n.placeId}
                  onClick={() => elegirNegocio(n)}
                  className="w-full rounded-tarjeta bg-carta px-4 py-3 text-left ring-1 ring-linea transition hover:ring-brasa/50"
                >
                  <p className="text-[0.92rem] font-bold text-tinta">{n.nombre}</p>
                  {n.direccion && <p className="text-[0.8rem] text-frio">{n.direccion}</p>}
                </button>
              ))}
            </div>
          )}

          {!buscando && (
            <div className="space-y-2">
              <p className="text-[0.84rem] text-frio">
                {gpsFallo && negocios.length === 0
                  ? "No pudimos usar tu ubicación. Busca el negocio por nombre:"
                  : negocios.length > 0
                    ? "¿No aparece? Búscalo por nombre:"
                    : "O búscalo por nombre:"}
              </p>
              <div className="flex gap-2">
                <input
                  value={consulta}
                  onChange={(e) => setConsulta(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") buscarManual(); }}
                  placeholder="Ej. Pollería Barlovento Tacna"
                  className="flex-1 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta ring-1 ring-linea focus:ring-brasa/40"
                />
                <button
                  onClick={buscarManual}
                  disabled={buscando || !consulta.trim()}
                  className="rounded-chip bg-brasa px-4 py-2 text-[0.88rem] font-semibold text-sobre-brasa disabled:opacity-50"
                >
                  Buscar
                </button>
              </div>
            </div>
          )}

          {estado?.puedeVender && estado.estado === "libre" && (
            <button onClick={() => { setNegocios([]); setPaso("modo"); }} className="text-[0.84rem] font-semibold text-brasa-texto">
              ← Volver
            </button>
          )}
        </div>
      )}

      {paso === "pin" && elegido && (
        <div className="space-y-4">
          <h1 className="text-[1.4rem] font-bold text-tinta">
            {porEnlace ? "Confirma y la placa es tuya" : "Confirma con tu PIN"}
          </h1>
          <div className="rounded-tarjeta bg-carta px-4 py-3 ring-1 ring-linea">
            <p className="text-[0.78rem] font-bold uppercase tracking-wide text-frio">Las reseñas irán a</p>
            <p className="mt-0.5 text-[0.95rem] font-bold text-tinta">{elegido.nombre}</p>
            {elegido.direccion && <p className="text-[0.8rem] text-frio">{elegido.direccion}</p>}
            <button onClick={cambiarNegocio} className="mt-1.5 text-[0.8rem] font-semibold text-brasa-texto">
              Cambiar negocio
            </button>
          </div>

          {porEnlace && empresas.length > 1 && (
            <div>
              <label className="text-[0.82rem] font-bold text-tinta">La placa es de:</label>
              <select
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="mt-1 w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta ring-1 ring-linea"
              >
                {empresas.map((e) => (
                  <option key={e.tenantId} value={e.tenantId}>{e.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {!porEnlace && (
            <div>
              <label className="text-[0.82rem] font-bold text-tinta">PIN impreso en el empaque de tu placa</label>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                maxLength={8}
                placeholder="Ej. K7M2Q9"
                className="mt-1 w-full rounded-tarjeta bg-arena/60 px-3 py-3 text-center text-[1.2rem] font-bold tracking-[0.3em] text-tinta ring-1 ring-linea focus:ring-brasa/40"
              />
            </div>
          )}
          {error && (
            <p className="rounded-tarjeta bg-alerta-suave px-3 py-2 text-[0.84rem] text-alerta-hondo">{error}</p>
          )}
          <button
            onClick={activar}
            disabled={activando || (!porEnlace && pin.trim().length < 4)}
            className={botonPrincipal}
          >
            {activando ? "Activando…" : "Activar mi placa"}
          </button>
        </div>
      )}

      {paso === "confirmar-demo" && elegido && (
        <div className="space-y-4">
          <h1 className="text-[1.4rem] font-bold text-tinta">Confirma el negocio de la demostración</h1>
          <div className="rounded-tarjeta bg-carta px-4 py-3 ring-1 ring-linea">
            <p className="text-[0.78rem] font-bold uppercase tracking-wide text-frio">La placa abrirá las reseñas de</p>
            <p className="mt-0.5 text-[0.95rem] font-bold text-tinta">{elegido.nombre}</p>
            {elegido.direccion && <p className="text-[0.8rem] text-frio">{elegido.direccion}</p>}
            <button onClick={cambiarNegocio} className="mt-1.5 text-[0.8rem] font-semibold text-brasa-texto">
              Cambiar negocio
            </button>
          </div>
          <p className="text-[0.84rem] text-tinta-2">
            Pídele al dueño que la toque con su celular: le abrirá el formulario de reseñas de su negocio.
            Esos toques no cuentan en las estadísticas.
          </p>
          {error && (
            <p className="rounded-tarjeta bg-alerta-suave px-3 py-2 text-[0.84rem] text-alerta-hondo">{error}</p>
          )}
          <button onClick={empezarDemo} disabled={activando} className={botonPrincipal}>
            {activando ? "Preparando…" : "Empezar la demostración"}
          </button>
        </div>
      )}

      {paso === "demo" && (
        <div className="space-y-4">
          <div>
            <p className="text-[0.78rem] font-bold uppercase tracking-wide text-frio">Demostración en curso</p>
            <h1 className="text-[1.4rem] font-bold text-tinta">{negocioDemo}</h1>
            <p className="mt-1 text-[0.88rem] text-tinta-2">
              La placa ya abre las reseñas de este negocio. Que el dueño la toque con su celular.
            </p>
          </div>

          <div className="space-y-3 rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
            <p className="text-[0.95rem] font-bold text-tinta">¿La compró? Pásale este enlace</p>
            <p className="text-[0.84rem] text-tinta-2">
              Lo abre en su celular, entra con su cuenta y confirma. La placa queda a su nombre y la venta, al tuyo.
            </p>
            {qrDueno && (
              <div className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado acá */}
                <img src={qrDueno} alt="Código QR del enlace para activar la placa" className="h-48 w-48 rounded-tarjeta bg-white p-2" />
                <p className="text-[0.78rem] text-frio">Que lo escanee con la cámara de su celular</p>
              </div>
            )}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(textoWhatsappDueno)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-chip bg-[#25d366] px-4 py-3 text-[0.92rem] font-semibold text-white"
            >
              💬 Enviárselo por WhatsApp
            </a>
            <button onClick={copiarLink} className={botonSecundario}>
              {copiado ? "Enlace copiado" : "Copiar el enlace"}
            </button>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => { setProposito("demo"); setNegocios([]); setPaso("negocio"); }}
              className={botonSecundario}
            >
              Mostrar otro negocio
            </button>
            {!confirmandoFin ? (
              <button onClick={() => setConfirmandoFin(true)} className={botonSecundario}>
                No la compró: terminar la demostración
              </button>
            ) : (
              <div className="space-y-2 rounded-tarjeta bg-alerta-suave p-3">
                <p className="text-[0.86rem] text-alerta-hondo">
                  La placa deja de abrir las reseñas de {negocioDemo} y el enlace deja de servir.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={terminarDemo}
                    disabled={activando}
                    className="flex-1 rounded-chip bg-alerta-hondo px-4 py-2.5 text-[0.88rem] font-semibold text-white disabled:opacity-50"
                  >
                    {activando ? "Terminando…" : "Terminar"}
                  </button>
                  <button onClick={() => setConfirmandoFin(false)} className="flex-1 rounded-chip bg-carta px-4 py-2.5 text-[0.88rem] font-semibold text-tinta ring-1 ring-linea">
                    Seguir mostrando
                  </button>
                </div>
              </div>
            )}
          </div>
          {error && (
            <p className="rounded-tarjeta bg-alerta-suave px-3 py-2 text-[0.84rem] text-alerta-hondo">{error}</p>
          )}
        </div>
      )}

      {paso === "demo-ajena" && (
        <div className="space-y-4">
          <h1 className="text-[1.4rem] font-bold text-tinta">Esta placa está en demostración</h1>
          <p className="text-[0.92rem] text-tinta-2">
            Para activarla a tu nombre, pídele el enlace a la persona que te la mostró. Con él la activas en
            un minuto, sin PIN.
          </p>
          <a
            href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, tengo una placa en demostración y quiero activarla. El código es ${uid}`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-chip bg-[#25d366] px-4 py-3 text-[0.92rem] font-semibold text-white"
          >
            💬 Escríbenos y te ayudamos
          </a>
        </div>
      )}

      {paso === "no-disponible" && (
        <div className="space-y-4">
          <h1 className="text-[1.4rem] font-bold text-tinta">
            {estado?.estado === "activa" ? "Esta placa ya tiene dueño" : "No podemos activar esta placa"}
          </h1>
          <p className="text-[0.92rem] text-tinta-2">
            {estado?.estado === "activa"
              ? "Si es tuya, la administras desde tu panel, en la sección Placas."
              : "Escríbenos con el código de la placa y lo resolvemos."}
          </p>
          <a
            href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, tengo un problema con mi placa. El código es ${uid}`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-chip bg-[#25d366] px-4 py-3 text-[0.92rem] font-semibold text-white"
          >
            💬 Escríbenos por WhatsApp
          </a>
        </div>
      )}

      {paso === "listo" && (
        <div className="space-y-4 text-center">
          <p className="text-5xl">🎉</p>
          <h1 className="text-[1.4rem] font-bold text-tinta">¡Placa activada!</h1>
          <p className="text-[0.92rem] text-tinta-2">
            Desde ahora, cada cliente que la toque irá directo a dejar su reseña en Google.
          </p>
          <a
            href={reviewUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-chip bg-brasa px-6 py-3 text-[0.95rem] font-semibold text-sobre-brasa"
          >
            Probar el enlace de reseñas
          </a>
          <p className="text-[0.82rem] text-frio">
            También puedes probar tocando la placa con tu celular. Las estadísticas
            de escaneos las ves en tu panel, sección <strong>Placas</strong>.
          </p>
          <button onClick={() => router.push("/placas")} className="text-[0.88rem] font-semibold text-brasa-texto">
            Ir a mi panel →
          </button>

          {/* La invitación según la MARCA impresa en la placa: el momento de
              máxima atención es publicidad gratis del producto correcto. */}
          <div className="mt-2 rounded-tarjeta bg-arena/50 p-4 text-left ring-1 ring-linea">
            <p className="text-[0.92rem] font-bold text-tinta">{invitacion.titulo}</p>
            <p className="mt-1 text-[0.84rem] text-tinta-2">{invitacion.texto}</p>
            <a
              href={invitacion.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[0.86rem] font-semibold text-brasa-texto"
            >
              {invitacion.cta} →
            </a>

            {/* HABLAR CON ALGUIEN, NO SOLO LEER UNA WEB (2026-08-31, pedido de
                Jonathan: "deberíamos dirigir a un número para poder explicarles
                si tienen alguna duda").

                Quien acaba de activar su placa es el mejor prospecto que
                tenemos: tiene el producto físico en la mano y ya probó que
                funciona. Mandarlo solo a una landing lo deja leyendo solo, y la
                duda que no se resuelve ahí no se resuelve nunca.

                Va SEGUNDO y en tono menor: la web explica sin costo de
                atención, y el WhatsApp es para quien realmente quiere hablar. Al
                revés nos llenaríamos de consultas que la página ya responde. */}
            <a
              href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
                `Hola, acabo de activar mi placa y quiero saber más sobre ${NOMBRE_MARCA[marca ?? ""] ?? "LeadAI"}`,
              )}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-tarjeta bg-[#25d366] px-4 py-2.5 text-[0.86rem] font-semibold text-white"
            >
              💬 Escríbenos y te explicamos
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
