"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { leerSesion, esSuperAdmin, rolEnEmpresaActiva } from "@/lib/auth";
import { useCapacidades } from "@/lib/modo-negocio";
import { seccionesDe, agruparSecciones, type Seccion } from "@/lib/secciones";
import { ContadorHits } from "@/components/panel/ContadorHits";
import { LogoLeadAI } from "@/components/LogoLeadAI";
import {
  IconoInicio, IconoConversaciones, IconoSeguimiento, IconoFlujos,
  IconoBandeja, IconoReportes, IconoConfig, IconoRayo, IconoOportunidades,
} from "@/components/Iconos";

// Panel de NEGOCIO (dueño de un negocio). El panel de plataforma (Aprendizaje,
// Métricas, Negocios) vive aparte en /admin, solo para super admins.
//
// CADA SECCIÓN DECLARA QUÉ NECESITA (2026-08-19). `requiere` es la capacidad
// sin la cual esa sección no tiene sentido; sin `requiere`, la ve todo el
// mundo. Antes esto eran dos listas de rutas que solo sabían de dos rubros, y
// por eso una clínica —que no es restaurante— se llevaba Anuncios, Campañas y
// el embudo entero, ninguno de los cuales usa.
//
// Ahora, agregar un rubro es una fila en la tabla del backend
// (`core/capacidades-rubro.ts`) y este archivo no se toca.
// EL MENÚ AGRUPADO (2026-08-24, pedido de Jonathan: "el panel tiene
// demasiadas secciones"). Captación veía DOCE items sueltos y el dueño
// escaneaba la lista entera para cada tarea. Ahora las secciones se leen en
// bloques por lo que el dueño quiere HACER: vender (el ciclo del lead),
// atraer (marketing) y administrar (reportes y equipo). Los doce items pasan
// a siete bloques visuales sin quitar ninguna pantalla.
//
// El orden IMPORTA: `agruparSecciones` junta solo items contiguos del mismo
// grupo, así que las secciones de un grupo van seguidas en esta lista.
export const SECCIONES: Seccion[] = [
  { href: "/inicio", label: "Inicio", Icono: IconoInicio, rapido: 0 },
  { href: "/conversaciones", label: "Conversaciones", corto: "Chats", Icono: IconoConversaciones, rapido: 1 },
  // LA COCINA (2026-08-19): despachar pedidos desde la computadora. Existía
  // solo en la app, así que el dueño con la compu en el mostrador tenía que
  // agarrar el celular con las manos ocupadas.
  { href: "/cocina", label: "Cocina", Icono: IconoInicio, requiere: "tieneCocina", rapido: 2 },
  // La carta del restaurante: lo que ve el cliente en /c/<tenantId> y lo que
  // el bot lee para tomar pedidos. Se editaba en la app móvil hasta que se
  // movió acá (2026-08-17): 40 platos con el pulgar no los carga nadie.
  //
  // Comparte prioridad con Seguimiento a propósito: ningún negocio tiene las
  // dos, así que el tercer acceso rápido es el embudo o la carta según quién
  // sea.
  { href: "/carta", label: "Carta", Icono: IconoOportunidades, requiere: "tieneCarta", rapido: 2 },

  // ── VENTAS: el ciclo del lead, de la primera charla al cierre ──
  { href: "/seguimiento", label: "Seguimiento", corto: "Pipeline", Icono: IconoSeguimiento, requiere: "tieneEmbudo", rapido: 2, grupo: "Ventas" },
  { href: "/leads", label: "Leads", Icono: IconoBandeja, requiere: "calificaLeads", rapido: 3, grupo: "Ventas" },
  { href: "/oportunidades", label: "Oportunidades", Icono: IconoOportunidades, requiere: "tieneEmbudo", grupo: "Ventas" },

  // ── MARKETING: atraer gente nueva y hablarle a la que ya vino ──
  // Anuncios y Campañas ya viven en /marketing con pestañas (2026-08-24);
  // Publicar y Comentarios son la otra mitad del mismo trabajo (las redes
  // del negocio), así que el bloque junta a los tres.
  { href: "/marketing", label: "Marketing", Icono: IconoRayo, requiereAlguna: ["tieneAnuncios", "tieneCampanias"], grupo: "Marketing" },
  // PUBLICAR SALIÓ DEL MENÚ (2026-08-27, Jonathan: "sacar del menú publicar,
  // porque ya no va"). Vive dentro de Marketing como pestaña, junto a
  // Anuncios, Campañas y Presencia — tenerlo en los dos lados hacía que el
  // mismo destino se viera como dos cosas distintas.
  //
  // La RUTA /publicar sigue existiendo: un link guardado o el historial del
  // navegador no puede terminar en 404.
  { href: "/comentarios", label: "Comentarios", Icono: IconoConversaciones, requiere: "calificaLeads", grupo: "Marketing" },

  { href: "/flujos", label: "Flujos", Icono: IconoFlujos, requiere: "redactaRespuestas" },
  // "Probar bot" NO va en el menú (2026-08-17). Era andamiaje para ver cómo
  // respondía la IA mientras se resolvía el tema del tech provider de Meta;
  // con WhatsApp ya conectado, el dueño prueba escribiéndose a sí mismo y esa
  // es la prueba de verdad.
  //
  // La pantalla y el endpoint SIGUEN VIVOS: /probar-bot responde si se entra a
  // mano, y `evals/golden.test.ts` usa /simular-mensaje en el CI. Solo se saca
  // del menú.
  // { href: "/probar-bot", label: "Probar bot", Icono: IconoRayo },

  // ── TU NEGOCIO: los números y el equipo ──
  // Reportes y Equipo son de CAPTACIÓN (2026-08-19): un restaurante ve lo que
  // vendió hoy en su Inicio y casi siempre lo maneja una sola persona.
  { href: "/reportes", label: "Reportes", Icono: IconoReportes, requiere: "calificaLeads", grupo: "Tu negocio" },
  // REPORTES DE RESTAURANTE (2026-09-01, reporte de Jonathan: "restaurantes no
  // tiene una sección de reportes"). Es OTRA pantalla, no la misma con ifs: la
  // de arriba muestra leads, embudo de ventas y comisiones —datos que un
  // restaurante no tiene— y por eso pide `calificaLeads`.
  //
  // El backend servía `GET /reportes/pedidos` desde julio con ventas por día,
  // ticket promedio, top platos y embudo de abandono. Estaba todo calculado y
  // nadie podía verlo.
  //
  // Va por `tieneCarta` y no por el plan: la SECCIÓN existe para todo
  // restaurante, y el candado del plan lo pone la pantalla —igual que
  // Marketing— para que el dueño vea qué se está perdiendo.
  { href: "/reportes-pedidos", label: "Reportes", Icono: IconoReportes, requiere: "tieneCarta", grupo: "Tu negocio" },
  // EQUIPO ES DE TODOS LOS RUBROS (2026-08-31, Jonathan: "¿esa sección está
  // en el panel?"). Estaba atada a `calificaLeads` — capacidad de CAPTACIÓN —
  // así que justo el restaurante, que es quien invita mozos, caja y cocina,
  // no la veía en su menú. El rol sí filtra (un mozo no la ve), y el plan lo
  // exige el backend al invitar.
  { href: "/equipo", label: "Equipo", Icono: IconoConversaciones, grupo: "Tu negocio" },
  // Placas NFC de reseñas (2026-08-26): SIN `requiere` a propósito — un
  // restaurante quiere reseñas de Google igual que una contadora.
  // PLACAS SOLO SI TIENE UNA (2026-08-27, Jonathan: "cuando activen una placa
  // recién debe aparecer la opción; si no activan ninguna, que no aparezca").
  { href: "/placas", label: "Placas", Icono: IconoRayo, grupo: "Tu negocio", soloConPlacas: true },

  // "Mi perfil" vive dentro de Configuración (pestaña — es de la persona,
  // no de un negocio; decisión 2026-07-22). Ajustes entra a la barra de móvil
  // solo si sobra lugar: en captación los cuatro puestos ya se llenan.
  // MI PLAN VA EN EL MENÚ Y NO DENTRO DE AJUSTES (2026-09-01, pedido de
  // Jonathan). Nadie busca cuánto paga en "Configuración": va a mirar su plan,
  // que es una pregunta de plata y no de configuración. Y es la pantalla donde
  // el dueño SUBE de plan — esconderla es esconder el único lugar donde nos
  // paga más.
  { href: "/mi-plan", label: "Mi plan", Icono: IconoReportes, grupo: "Tu negocio" },
  { href: "/configuracion", label: "Configuración", corto: "Ajustes", Icono: IconoConfig, rapido: 4 },
];


const CLAVE_SIDEBAR = "leadai.sidebar"; // '1' expandido | '0' colapsado

// Sidebar del panel de escritorio, COLAPSABLE CON BOTÓN (feedback 2026-08-04:
// el hover mareaba). El botón «/» expande o retrae; la preferencia se recuerda.
// Colapsado, cada ícono explica qué es con su tooltip (title) al pasar el mouse.
export function Sidebar() {
  const path = usePathname();
  const sesion = leerSesion();
  const superAdmin = esSuperAdmin();
  // `null` = todavía no se sabe. NO se adivina (2026-08-19): antes se mostraba
  // el menú completo mientras llegaba la respuesta, así que al recargar el
  // restaurante veía las trece secciones de captación —Anuncios, Campañas,
  // Flujos, Leads…— y un segundo después el menú se acortaba de golpe.
  //
  // Ahora se dibujan placeholders. En la práctica casi no se ven: el modo
  // queda guardado en localStorage y el F5 pinta el menú correcto de una.
  const negocio = useCapacidades();
  // El ROL filtra encima de las capacidades (2026-08-21): un mozo ve Cocina y
  // Carta, nada más. El backend igual lo bloquea con 403 — esto existe para no
  // mostrarle puertas que al abrirlas dan error.
  const rol = rolEnEmpresaActiva();
  const secciones = negocio === null
    ? []
    : seccionesDe(SECCIONES, negocio.capacidades, rol, { tienePlacas: negocio.tienePlacas });
  const nombre = sesion?.usuario?.nombre ?? sesion?.usuario?.email ?? "Mi cuenta";
  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";

  const [expandido, setExpandido] = useState(true);
  useEffect(() => {
    setExpandido(localStorage.getItem(CLAVE_SIDEBAR) !== "0");
  }, []);
  function alternar() {
    const nuevo = !expandido;
    setExpandido(nuevo);
    localStorage.setItem(CLAVE_SIDEBAR, nuevo ? "1" : "0");
  }

  return (
    <aside
      className={`hidden bg-superficie-honda text-arena transition-[width] duration-200 ease-out lg:flex lg:shrink-0 lg:flex-col ${
        expandido ? "lg:w-60" : "lg:w-[68px]"
      }`}
    >
      <div className={`flex items-center gap-2 py-5 ${expandido ? "px-5" : "justify-center px-2"}`}>
        <LogoLeadAI className="h-9 w-9 shrink-0" />
        {expandido && (
          <>
            <span className="whitespace-nowrap text-lg font-bold">
              Lead<span className="text-brasa">AI</span>
            </span>
            <button
              onClick={alternar}
              title="Retraer el menú"
              aria-label="Retraer el menú"
              className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-arena/60 transition hover:bg-white/10 hover:text-arena"
            >
              «
            </button>
          </>
        )}
      </div>
      {/* Colapsado: el botón de expandir va solo, bien visible bajo el logo. */}
      {!expandido && (
        <div className="flex justify-center pb-2">
          <button
            onClick={alternar}
            title="Expandir el menú"
            aria-label="Expandir el menú"
            className="grid h-7 w-7 place-items-center rounded-lg text-arena/60 transition hover:bg-white/10 hover:text-arena"
          >
            »
          </button>
        </div>
      )}
      {/* Alta manual de contacto. NO en restaurantes (2026-08-17): sus clientes
          entran por WhatsApp y nadie carga uno a mano — el botón ocupaba el
          lugar más visible del menú sin servir para nada. */}
      {negocio?.capacidades.altaManualDeLead && (
        <div className="px-3 pb-3">
          <Link
            href="/leads?nuevo=1"
            title="Nuevo lead"
            // Contorno en vez de bloque sólido: pegado a la píldora activa
            // eran dos manchas de color peleando.
            className="flex h-10 items-center justify-center gap-1.5 rounded-chip text-sm font-bold text-brasa ring-1 ring-brasa/40 transition hover:bg-brasa hover:text-sobre-brasa hover:ring-brasa"
          >
            <span className="shrink-0">＋</span>
            {expandido && <span className="whitespace-nowrap">Nuevo lead</span>}
          </Link>
        </div>
      )}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 [scrollbar-width:none]">
        {/* Mientras no se sabe qué menú va, filas en gris: dibujar el menú de
            captación y después acortarlo era peor — el dueño de un restaurante
            veía secciones que no le corresponden. Cuatro filas porque es el
            menú más corto: crecer no molesta, encoger sí. */}
        {negocio === null &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <span className="h-5 w-5 shrink-0 animate-pulse rounded bg-arena/10" />
              {expandido && <span className="h-3 w-24 animate-pulse rounded bg-arena/10" />}
            </div>
          ))}

        {agruparSecciones(secciones).map((grupo, i) => (
        <div key={grupo.titulo ?? `sueltas-${i}`} className={grupo.titulo ? "space-y-1 pt-3" : "space-y-1"}>
          {/* EL TÍTULO DEL GRUPO. Colapsado no hay lugar para texto, y una
              línea separa igual de bien sin empujar el ancho. */}
          {grupo.titulo && (expandido ? (
            <p className="px-2.5 pb-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-arena/40">
              {grupo.titulo}
            </p>
          ) : (
            <div className="mx-auto h-px w-6 bg-arena/15" aria-hidden />
          ))}
        {grupo.items.map(({ href, label, Icono }) => {
          const activo = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-semibold transition-colors ${
                activo
                  // EL MISMO VERDE que la pestaña "Platos" (2026-08-17): menta
                  // de marca con la tinta oscura encima, no el menta con texto
                  // blanco que se usaba antes. Ese par se leía más saturado de
                  // lo necesario sobre el sidebar oscuro.
                  ? "bg-brasa text-sobre-brasa"
                  : "text-arena/80 hover:bg-white/5 hover:text-arena"
              } ${expandido ? "" : "justify-center"}`}
              aria-current={activo ? "page" : undefined}
            >
              <Icono className="h-5 w-5 shrink-0" />
              {expandido && <span className="whitespace-nowrap">{label}</span>}
            </Link>
          );
        })}
        </div>
        ))}
        {/* Acceso al panel de plataforma, solo para super admins. */}
        {superAdmin && (
          <Link
            href="/admin"
            title="Panel de plataforma"
            className={`mt-2 flex items-center gap-3 rounded-xl border border-brasa/30 px-2.5 py-2.5 text-sm font-semibold text-brasa transition-colors hover:bg-brasa/10 ${
              expandido ? "" : "justify-center"
            }`}
          >
            <IconoRayo className="h-5 w-5 shrink-0" />
            {expandido && <span className="whitespace-nowrap">Panel de plataforma</span>}
          </Link>
        )}
      </nav>
      {/* Cuota del mes: solo expandido (números y barra necesitan ancho). */}
      {/* EL CONSUMO DEL PLAN NO ES ASUNTO DEL MOZO (2026-08-21). Cuántos
          pedidos van del tope contratado es información de facturación: la
          mira quien paga la cuenta, no quien lleva los platos. */}
      {expandido && rol !== "mozo" && <ContadorHits />}
      <div className={`border-t border-white/10 py-4 text-sm ${expandido ? "px-4" : "px-2"}`}>
        <div className={`flex items-center gap-2.5 ${expandido ? "" : "justify-center"}`}>
          <span
            title={expandido ? undefined : nombre}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[0.85rem] font-bold text-arena"
          >
            {inicial}
          </span>
          {expandido && (
            <div className="min-w-0">
              <p className="truncate font-semibold text-arena">{nombre}</p>
              <p className="truncate text-xs text-arena/60">{sesion?.usuario?.email}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
