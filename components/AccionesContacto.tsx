// Botones para contactar directo a la persona: llamar (abre el marcador del
// teléfono) y abrir el chat de WhatsApp. Solo aplican cuando tenemos un número
// real — en WhatsApp el contactoExterno ES el número; en IG/Messenger es un id
// interno que no sirve para llamar, así que ahí no mostramos los botones.

// ¿El contacto es un número de teléfono usable? (solo dígitos, largo razonable).
function esTelefono(canal?: string, contacto?: string): string | null {
  if (canal !== "whatsapp" || !contacto) return null;
  const soloDigitos = contacto.replace(/[^\d]/g, "");
  if (soloDigitos.length < 8 || soloDigitos.length > 15) return null;
  return soloDigitos;
}

export function AccionesContacto({
  canal, contacto, compacto = false,
}: { canal?: string; contacto?: string; compacto?: boolean }) {
  const tel = esTelefono(canal, contacto);
  if (!tel) return null;

  const base = compacto ? "h-9 w-9" : "h-10 px-3 gap-1.5";
  return (
    <div className="flex items-center gap-1.5">
      {/* Llamar: abre el marcador del teléfono con el número puesto. */}
      <a
        href={`tel:+${tel}`}
        aria-label="Llamar"
        className={`inline-flex items-center justify-center rounded-full text-sm font-semibold text-ok ring-1 ring-ok/30 transition hover:bg-ok/10 ${base}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L7.6 9.8a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z" />
        </svg>
        {!compacto && <span>Llamar</span>}
      </a>

      {/* Abrir en WhatsApp: el chat real con esa persona en tu WhatsApp. */}
      <a
        href={`https://wa.me/${tel}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir en WhatsApp"
        className={`inline-flex items-center justify-center rounded-full text-sm font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena ${base}`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
          <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2Zm5.4 14.1c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3-.8-2.5-1-4.1-3.6-4.2-3.8-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.7.8c.2.1.4.2.4.3.1.2.1.7-.1 1.3Z" />
        </svg>
        {!compacto && <span>WhatsApp</span>}
      </a>
    </div>
  );
}
