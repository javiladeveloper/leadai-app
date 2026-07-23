"use client";

import { useEffect, useState } from "react";
import { obtenerPerfil, guardarPerfil, type PerfilNegocio } from "@/lib/api";
import { RUBROS } from "@/lib/rubros";

// Tonos CURADOS del bot — lista canónica compartida con el backend
// (TONOS_BOT en core/types.ts) y la app. Texto libre ya no se acepta.
const TONOS_BOT = [
  "cálido y cercano, como atiende el dueño",
  "cercano y profesional",
  "formal y profesional",
  "informal y directo",
  "alegre y juvenil",
  "serio y al grano",
];

const PERFIL_VACIO: PerfilNegocio = {
  rubro: "",
  nombreNegocio: "",
  idioma: "es",
  tono: "",
  propuestaValor: "",
  catalogo: [],
  preguntasClave: [],
  senalesCaliente: [],
  senalesFrio: [],
  objeciones: [],
  politicas: "",
  llamadaAccion: "",
  mensajeBienvenida: "",
  respuestasFijas: [],
};

type Estado = "cargando" | "idle" | "guardando" | "ok" | "error" | "error-carga";

// Editor real del Playbook: carga y guarda contra el backend (`/perfil`). Es
// el "cerebro" que usa la IA para responder — nombre, tono, catálogo,
// preguntas clave y objeciones que el negocio quiere que maneje.
export function PlaybookEditor() {
  const [perfil, setPerfil] = useState<PerfilNegocio>(PERFIL_VACIO);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;
    obtenerPerfil()
      .then((p) => {
        if (cancelado) return;
        if (p) setPerfil({ ...PERFIL_VACIO, ...p });
        setEstado("idle");
      })
      .catch(() => {
        if (cancelado) return;
        // No mostramos el formulario vacío ni el botón Guardar: si el backend
        // está caído y el usuario guardara, el PUT (full-replace) pisaría el
        // perfil real con vacío.
        setEstado("error-carga");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function guardar() {
    setEstado("guardando");
    setError("");
    const r = await guardarPerfil(perfil.rubro || "general", perfil);
    if (r.ok) setEstado("ok");
    else {
      setEstado("error");
      setError(r.error ?? "No se pudo guardar");
    }
  }

  if (estado === "cargando") return <p className="text-frio">Cargando…</p>;

  if (estado === "error-carga") {
    return (
      <p className="rounded-xl border border-brasa/40 bg-arena/40 p-4 text-sm text-brasa">
        No pudimos cargar tu configuración. Recargá la página.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <Campo
          label="Nombre del negocio"
          value={perfil.nombreNegocio}
          onChange={(v) => setPerfil({ ...perfil, nombreNegocio: v })}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-tinta">A qué te dedicás</span>
          <select
            value={perfil.rubro}
            onChange={(e) => setPerfil({ ...perfil, rubro: e.target.value })}
            className="w-full rounded-tarjeta border border-linea bg-carta px-3.5 py-2.5 text-[0.95rem] text-tinta outline-none focus:border-brasa"
          >
            <option value="">Elegí tu rubro…</option>
            {RUBROS.map((r) => (
              <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Tono CURADO (2026-07-22, mismo criterio que la app): opciones
          predeterminadas en vez de texto libre — un tono arbitrario puede
          alterar el comportamiento del bot. Un tono legacy (texto libre de
          antes) se muestra como "Actual" y se respeta hasta que elijan uno
          curado (el backend valida con la misma lista). */}
      <div>
        <span className="mb-2 block text-sm font-medium text-tinta">Cómo querés que hable el bot</span>
        <div className="flex flex-wrap gap-2">
          {perfil.tono.trim() !== "" &&
            !TONOS_BOT.some((t) => t.toLowerCase() === perfil.tono.trim().toLowerCase()) && (
              <span className="rounded-chip bg-tibio-suave px-3 py-1.5 text-[0.82rem] font-semibold text-tibio ring-1 ring-tibio/30">
                Actual: “{perfil.tono}”
              </span>
            )}
          {TONOS_BOT.map((t) => {
            const activo = t.toLowerCase() === perfil.tono.trim().toLowerCase();
            return (
              <button
                key={t}
                type="button"
                onClick={() => setPerfil({ ...perfil, tono: t })}
                className={`rounded-chip px-3 py-1.5 text-[0.82rem] font-semibold transition ${
                  activo ? "bg-brasa text-carta" : "bg-arena text-tinta-2 ring-1 ring-linea hover:bg-linea"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            );
          })}
        </div>
      </div>
      <CampoArea
        label="Por qué elegirte"
        value={perfil.propuestaValor}
        onChange={(v) => setPerfil({ ...perfil, propuestaValor: v })}
        placeholder="Ej: 20 años de experiencia, atención el mismo día"
      />

      <ListaCatalogo
        catalogo={perfil.catalogo}
        onChange={(catalogo) => setPerfil({ ...perfil, catalogo })}
      />
      <ListaSimple
        titulo="Preguntas clave"
        descripcion="Lo que el bot pregunta antes de avisarte que un cliente está listo para comprar"
        placeholder="¿Para cuándo lo necesitás?"
        valores={perfil.preguntasClave}
        onChange={(preguntasClave) => setPerfil({ ...perfil, preguntasClave })}
      />
      <ListaSimple
        titulo="Señales de que un cliente está listo para comprar"
        descripcion="Lo que dice o pregunta un cliente que está por comprar"
        placeholder="Ej: pregunta por precios y disponibilidad"
        valores={perfil.senalesCaliente}
        onChange={(senalesCaliente) => setPerfil({ ...perfil, senalesCaliente })}
      />
      <ListaSimple
        titulo="Señales de que un cliente todavía no está listo"
        descripcion="Lo que indica que todavía no está listo para comprar"
        placeholder="Ej: solo pregunta info general, sin urgencia"
        valores={perfil.senalesFrio}
        onChange={(senalesFrio) => setPerfil({ ...perfil, senalesFrio })}
      />
      <ListaObjeciones
        objeciones={perfil.objeciones}
        onChange={(objeciones) => setPerfil({ ...perfil, objeciones })}
      />

      <div>
        <p className="mb-1 text-xs text-frio">
          Es lo primero que el cliente lee cuando te escribe por primera vez.
        </p>
        <CampoArea
          label="El primer saludo del bot"
          value={perfil.mensajeBienvenida ?? ""}
          onChange={(v) => setPerfil({ ...perfil, mensajeBienvenida: v })}
          placeholder="Ej: ¡Hola! Soy el asistente de [tu negocio] 😊 ¿En qué te puedo ayudar?"
        />
      </div>

      <ListaRespuestasFijas
        respuestasFijas={perfil.respuestasFijas ?? []}
        onChange={(respuestasFijas) => setPerfil({ ...perfil, respuestasFijas })}
      />

      <CampoArea
        label="Cómo trabajás (envíos, horarios, pagos)"
        value={perfil.politicas}
        onChange={(v) => setPerfil({ ...perfil, politicas: v })}
        placeholder="Ej: Atención remota a todo el Perú. Pago por Yape o transferencia."
      />
      <CampoArea
        label="Qué querés que hagan"
        value={perfil.llamadaAccion}
        onChange={(v) => setPerfil({ ...perfil, llamadaAccion: v })}
        placeholder="Ej: Que agenden una llamada / que hagan el pedido"
      />

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={guardar}
          disabled={estado === "guardando"}
          className="rounded-full bg-brasa px-6 py-2.5 text-sm font-semibold text-carta hover:bg-brasa-hondo disabled:opacity-60"
        >
          {estado === "guardando" ? "Guardando…" : "Guardar cambios"}
        </button>
        {estado === "ok" && <p className="text-sm font-medium text-ok">Guardado ✓</p>}
        {estado === "error" && <p className="text-sm text-brasa">{error}</p>}
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-tinta">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-linea bg-carta px-4 py-2.5 text-sm text-tinta outline-none focus:border-brasa"
      />
    </label>
  );
}

function CampoArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-tinta">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-xl border border-linea bg-carta px-4 py-2.5 text-sm text-tinta outline-none focus:border-brasa"
      />
    </label>
  );
}

// Lista editable de strings simples (preguntas clave), con agregar/quitar fila.
function ListaSimple({
  titulo,
  descripcion,
  placeholder,
  valores,
  onChange,
}: {
  titulo: string;
  descripcion?: string;
  placeholder?: string;
  valores: string[];
  onChange: (v: string[]) => void;
}) {
  function actualizar(i: number, v: string) {
    const copia = [...valores];
    copia[i] = v;
    onChange(copia);
  }
  function quitar(i: number) {
    onChange(valores.filter((_, idx) => idx !== i));
  }
  function agregar() {
    onChange([...valores, ""]);
  }

  return (
    <div className="rounded-xl border border-linea bg-arena/40 p-4">
      <p className="text-sm font-medium text-tinta">{titulo}</p>
      {descripcion && <p className="mb-2 text-xs text-frio">{descripcion}</p>}
      <div className="space-y-2">
        {valores.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={v}
              onChange={(e) => actualizar(i, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar"
              className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-frio hover:text-brasa"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={agregar}
        className="mt-2 rounded-lg border border-dashed border-linea px-3 py-1.5 text-xs font-semibold text-frio hover:border-brasa hover:text-brasa"
      >
        + Agregar
      </button>
    </div>
  );
}

// Catálogo: nombre, descripción y precio por fila.
function ListaCatalogo({
  catalogo,
  onChange,
}: {
  catalogo: PerfilNegocio["catalogo"];
  onChange: (v: PerfilNegocio["catalogo"]) => void;
}) {
  function actualizar(i: number, campo: "nombre" | "descripcion" | "precio", v: string) {
    const copia = catalogo.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it));
    onChange(copia);
  }
  function quitar(i: number) {
    onChange(catalogo.filter((_, idx) => idx !== i));
  }
  const MAX = 50; // debe coincidir con LIMITES_PERFIL.catalogoMax del backend
  const lleno = catalogo.length >= MAX;
  function agregar() {
    if (lleno) return;
    onChange([...catalogo, { nombre: "", descripcion: "", precio: "" }]);
  }

  return (
    <div className="rounded-xl border border-linea bg-arena/40 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-tinta">Qué vendés</p>
          <p className="text-xs text-frio">Productos o servicios que ofrece el negocio</p>
        </div>
        <span className={`shrink-0 text-xs font-semibold ${lleno ? "text-brasa-hondo" : "text-frio"}`}>
          {catalogo.length}/{MAX}
        </span>
      </div>
      <div className="space-y-3">
        {catalogo.map((item, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-carta p-3 ring-1 ring-linea sm:grid-cols-[1fr_1fr_auto_auto]">
            <input
              value={item.nombre}
              onChange={(e) => actualizar(i, "nombre", e.target.value)}
              placeholder="Ej: Declaración de renta"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <input
              value={item.descripcion ?? ""}
              onChange={(e) => actualizar(i, "descripcion", e.target.value)}
              placeholder="Descripción"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <input
              value={item.precio ?? ""}
              onChange={(e) => actualizar(i, "precio", e.target.value)}
              placeholder="Precio"
              className="w-full rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa sm:w-28"
            />
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar"
              className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-frio hover:text-brasa"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={agregar}
        disabled={lleno}
        className="mt-2 rounded-lg border border-dashed border-linea px-3 py-1.5 text-xs font-semibold text-frio hover:border-brasa hover:text-brasa disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-linea disabled:hover:text-frio"
      >
        + Agregar producto
      </button>
      {lleno && (
        <p className="mt-1.5 text-xs text-brasa-hondo">
          Llegaste al máximo de {MAX} productos. Es para que la IA no se sobrecargue y responda mejor.
        </p>
      )}
    </div>
  );
}

// Respuestas listas: palabra clave + respuesta fija por fila. Si el cliente
// escribe algo que contiene esa palabra, el bot responde esto directo, sin
// pensarlo (útil para preguntas repetidas como precio, horario, ubicación).
function ListaRespuestasFijas({
  respuestasFijas,
  onChange,
}: {
  respuestasFijas: { palabra: string; respuesta: string }[];
  onChange: (v: { palabra: string; respuesta: string }[]) => void;
}) {
  function actualizar(i: number, campo: "palabra" | "respuesta", v: string) {
    const copia = respuestasFijas.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it));
    onChange(copia);
  }
  function quitar(i: number) {
    onChange(respuestasFijas.filter((_, idx) => idx !== i));
  }
  function agregar() {
    onChange([...respuestasFijas, { palabra: "", respuesta: "" }]);
  }

  return (
    <div className="rounded-xl border border-linea bg-arena/40 p-4">
      <p className="text-sm font-medium text-tinta">Respuestas listas</p>
      <p className="mb-2 text-xs text-frio">
        Para preguntas que se repiten mucho: si el cliente escribe esa palabra, el bot contesta esto
        directo, sin pensarlo.
      </p>
      <div className="space-y-3">
        {respuestasFijas.map((item, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-carta p-3 ring-1 ring-linea sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={item.palabra}
              onChange={(e) => actualizar(i, "palabra", e.target.value)}
              placeholder="Si preguntan por... Ej: precio"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <input
              value={item.respuesta}
              onChange={(e) => actualizar(i, "respuesta", e.target.value)}
              placeholder="El bot responde... Ej: Depende de tu caso, ¿cuánto facturás al mes?"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar"
              className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-frio hover:text-brasa"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={agregar}
        className="mt-2 rounded-lg border border-dashed border-linea px-3 py-1.5 text-xs font-semibold text-frio hover:border-brasa hover:text-brasa"
      >
        + Agregar respuesta lista
      </button>
    </div>
  );
}

// Dudas comunes: duda del cliente + respuesta sugerida por fila.
function ListaObjeciones({
  objeciones,
  onChange,
}: {
  objeciones: PerfilNegocio["objeciones"];
  onChange: (v: PerfilNegocio["objeciones"]) => void;
}) {
  function actualizar(i: number, campo: "objecion" | "respuesta", v: string) {
    const copia = objeciones.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it));
    onChange(copia);
  }
  function quitar(i: number) {
    onChange(objeciones.filter((_, idx) => idx !== i));
  }
  function agregar() {
    onChange([...objeciones, { objecion: "", respuesta: "" }]);
  }

  return (
    <div className="rounded-xl border border-linea bg-arena/40 p-4">
      <p className="text-sm font-medium text-tinta">Dudas comunes de tus clientes</p>
      <p className="mb-2 text-xs text-frio">Qué suele frenar la venta y cómo responderlo</p>
      <div className="space-y-3">
        {objeciones.map((item, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-carta p-3 ring-1 ring-linea sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={item.objecion}
              onChange={(e) => actualizar(i, "objecion", e.target.value)}
              placeholder="Ej: Está caro"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <input
              value={item.respuesta}
              onChange={(e) => actualizar(i, "respuesta", e.target.value)}
              placeholder="Ej: Tenemos planes a tu medida, ¿cuánto facturás al mes?"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar"
              className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-frio hover:text-brasa"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={agregar}
        className="mt-2 rounded-lg border border-dashed border-linea px-3 py-1.5 text-xs font-semibold text-frio hover:border-brasa hover:text-brasa"
      >
        + Agregar duda
      </button>
    </div>
  );
}
