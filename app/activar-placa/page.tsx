"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, leerSesion, guardarEmpresaActiva, type EmpresaResumen } from "@/lib/auth";
import { negociosParaPlaca, activarPlaca, type NegocioGooglePlaca } from "@/lib/api";
import { LogoLeadAI } from "@/components/LogoLeadAI";

/**
 * ACTIVACIÓN DE UNA PLACA NFC DE RESEÑAS (2026-08-26).
 *
 * El dueño toca su placa nueva → `/r/{uid}` ve que está libre → lo manda acá
 * con el uid en la URL. Es UNA sola vez por placa y debe resolverse en menos
 * de 30 segundos (spec §5): explicar → sesión → elegir el negocio de Google
 * (GPS o búsqueda) → PIN del empaque → listo.
 *
 * REGLA DE ORO: NUNCA vincular automáticamente aunque haya un solo resultado
 * — si el GPS falla, las reseñas se irían a otro negocio por meses sin que
 * nadie lo note. Confirmación explícita SIEMPRE.
 */

type Paso = "cargando" | "sin-sesion" | "negocio" | "pin" | "listo";

export default function ActivarPlaca() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [paso, setPaso] = useState<Paso>("cargando");
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
  // La MARCA de la placa (leadai/sania/fitcore) decide qué producto invita la
  // pantalla de éxito — publicidad en el momento de máxima atención.
  const [marca, setMarca] = useState<string | null>(null);

  useEffect(() => {
    // El uid viene en la URL (?uid=04A2...). Se lee acá y no con
    // useSearchParams para no pelear con el prerender de Next.
    const u = new URLSearchParams(window.location.search).get("uid") ?? "";
    setUid(u.toUpperCase());
    if (!haySesion()) { setPaso("sin-sesion"); return; }
    const emp = leerSesion()?.empresas ?? [];
    setEmpresas(emp);
    setEmpresa(emp[0]?.tenantId ?? "");
    setPaso("negocio");
  }, []);

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
    sessionStorage.setItem("volver_a", `/activar-placa?uid=${uid}`);
    router.push("/");
  }

  async function buscarManual() {
    if (!consulta.trim() || buscando) return;
    setBuscando(true);
    setNegocios(await negociosParaPlaca({ q: consulta.trim() }, empresa || undefined));
    setBuscando(false);
  }

  async function activar() {
    if (!elegido || !pin.trim() || activando) return;
    setActivando(true);
    setError("");
    if (empresa) guardarEmpresaActiva(empresa);
    const r = await activarPlaca(
      { uid, pin: pin.trim().toUpperCase(), placeId: elegido.placeId }, empresa || undefined,
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

  // La invitación de la pantalla de éxito, según el diseño impreso de la placa.
  const invitacion =
    marca === "sania"
      ? { titulo: "¿Tu clínica todavía agenda a mano?", texto: "Sania agenda las citas, les confirma a tus pacientes y organiza tu día.", url: "https://www.saniape.com/?utm_source=placa&utm_medium=activacion", cta: "Conoce Sania" }
      : marca === "fitcore"
        ? { titulo: "¿Manejas un gimnasio?", texto: "FitCore controla socios, pagos y accesos en una sola pantalla.", url: "https://www.fitcorecenter.com/?utm_source=placa&utm_medium=activacion", cta: "Conoce FitCore" }
        : { titulo: "¿Sabías que tu cuenta puede más?", texto: "LeadAI puede responder el WhatsApp de tu negocio con IA — ya tienes cuenta, solo actívalo.", url: "https://leadai-pe.com/?utm_source=placa&utm_medium=activacion", cta: "Descubre LeadAI" };

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
          <button
            onClick={irALogin}
            className="w-full rounded-chip bg-brasa px-6 py-3 text-[0.95rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo"
          >
            Entrar o crear mi cuenta
          </button>
          <p className="text-[0.8rem] text-frio">
            Después de entrar vuelves automáticamente a esta pantalla.
          </p>
        </div>
      )}

      {paso === "negocio" && (
        <div className="space-y-4">
          <h1 className="text-[1.4rem] font-bold text-tinta">¿Cuál es tu negocio en Google?</h1>
          <p className="text-[0.9rem] text-tinta-2">
            Las reseñas de tus clientes irán a la ficha de Google que elijas aquí.
          </p>

          {empresas.length > 1 && (
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
              <button
                onClick={usarMiUbicacion}
                className="w-full rounded-chip bg-brasa px-6 py-3 text-[0.95rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo"
              >
                📍 Buscar los negocios a mi alrededor
              </button>
              <p className="text-center text-[0.78rem] text-frio">
                Te pediremos permiso de ubicación solo para esto. Si estás parado en tu
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
                  onClick={() => { setElegido(n); setPaso("pin"); }}
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
                  ? "No pudimos usar tu ubicación. Busca tu negocio por nombre:"
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
        </div>
      )}

      {paso === "pin" && elegido && (
        <div className="space-y-4">
          <h1 className="text-[1.4rem] font-bold text-tinta">Confirma con tu PIN</h1>
          <div className="rounded-tarjeta bg-carta px-4 py-3 ring-1 ring-linea">
            <p className="text-[0.78rem] font-bold uppercase tracking-wide text-frio">Las reseñas irán a</p>
            <p className="mt-0.5 text-[0.95rem] font-bold text-tinta">{elegido.nombre}</p>
            {elegido.direccion && <p className="text-[0.8rem] text-frio">{elegido.direccion}</p>}
            <button onClick={() => { setElegido(null); setPaso("negocio"); }} className="mt-1.5 text-[0.8rem] font-semibold text-brasa-texto">
              Cambiar negocio
            </button>
          </div>
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
          {error && (
            <p className="rounded-tarjeta bg-alerta-suave px-3 py-2 text-[0.84rem] text-alerta-hondo">{error}</p>
          )}
          <button
            onClick={activar}
            disabled={activando || pin.trim().length < 4}
            className="w-full rounded-chip bg-brasa px-6 py-3 text-[0.95rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
          >
            {activando ? "Activando…" : "Activar mi placa"}
          </button>
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
          </div>
        </div>
      )}
    </main>
  );
}
