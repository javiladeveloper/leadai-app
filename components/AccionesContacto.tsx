// Botones para contactar directo a la persona: llamar, abrir su WhatsApp,
// escribirle un correo o entrar a la videollamada.
//
// AMPLIADO (2026-10-09, tanda "todo conectado"): antes solo había Llamar y
// WhatsApp, y solo cuando el canal era WhatsApp. El mismo par de botones se
// copiaba a mano en la Agenda (sin Llamar), en Equipo (sin nada: el correo era
// texto), en Oportunidades (el contacto del negocio era texto) y en el reporte
// del marketero. Ahora cada pantalla le pasa lo que sabe y el componente decide
// qué botón tiene sentido:
//  - `contacto` + `canal`: el contactoExterno del lead. En WhatsApp o en un lead
//    a mano es el número; en Instagram/Messenger/TikTok es un id interno que no
//    sirve para llamar, y ahí no se muestra nada.
//  - `telefono`, `email`, `meet`: cuando la pantalla ya los tiene separados.

import { correoDe, telefonoDe } from "@/lib/enlaces";

const ICONO_TEL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L7.6 9.8a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z" />
  </svg>
);
const ICONO_WA = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2Zm5.4 14.1c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3-.8-2.5-1-4.1-3.6-4.2-3.8-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.7.8c.2.1.4.2.4.3.1.2.1.7-.1 1.3Z" />
  </svg>
);
const ICONO_CORREO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
const ICONO_VIDEO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
    <rect x="2.5" y="6" width="13" height="12" rx="2" />
    <path d="m15.5 10 6-3.5v11l-6-3.5" />
  </svg>
);

export function AccionesContacto({
  canal,
  contacto,
  telefono,
  email,
  meet,
  compacto = false,
}: {
  canal?: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  meet?: string | null;
  compacto?: boolean;
}) {
  const tel = telefonoDe(telefono ? "whatsapp" : canal, telefono ?? contacto ?? null);
  const correo = email ?? correoDe(contacto);
  if (!tel && !correo && !meet) return null;

  const base = compacto ? "h-9 w-9" : "h-10 px-3 gap-1.5";
  const neutro = `inline-flex items-center justify-center rounded-full text-sm font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena ${base}`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Unirse: lo más urgente si hay reunión, por eso va primero. */}
      {meet && (
        <a
          href={meet}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Unirse a la videollamada"
          className={`inline-flex items-center justify-center rounded-full bg-brasa text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo ${base}`}
        >
          {ICONO_VIDEO}
          {!compacto && <span>Unirse</span>}
        </a>
      )}
      {tel && (
        // Llamar: abre el marcador del teléfono con el número puesto.
        <a
          href={`tel:+${tel}`}
          aria-label="Llamar"
          className={`inline-flex items-center justify-center rounded-full text-sm font-semibold text-ok ring-1 ring-ok/30 transition hover:bg-ok/10 ${base}`}
        >
          {ICONO_TEL}
          {!compacto && <span>Llamar</span>}
        </a>
      )}
      {tel && (
        // Abrir en WhatsApp: el chat real con esa persona en tu WhatsApp.
        <a href={`https://wa.me/${tel}`} target="_blank" rel="noopener noreferrer" aria-label="Abrir en WhatsApp" className={neutro}>
          {ICONO_WA}
          {!compacto && <span>WhatsApp</span>}
        </a>
      )}
      {correo && (
        <a href={`mailto:${correo}`} aria-label={`Escribir a ${correo}`} title={correo} className={neutro}>
          {ICONO_CORREO}
          {!compacto && <span>Correo</span>}
        </a>
      )}
    </div>
  );
}
