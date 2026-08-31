/**
 * LOS ERRORES DE META, EN CASTELLANO Y CON LA SALIDA (2026-08-30).
 *
 * Reporte de Jonathan, en vivo con una clienta: "este problema puede pasar a
 * muchas personas que intenten entrar a nuestra herramienta... necesito que la
 * conexión de dispositivos sea lo más sencillo posible, recuerda que no son
 * personas técnicas".
 *
 * El diálogo de Meta habla en su idioma: "El número de teléfono que ingresaste
 * no está asociado con la empresa que seleccionaste (#3441062)". Un dueño de
 * restaurante lee eso y concluye que LeadAI está roto — y abandona. La verdad
 * es que su número ya está reclamado por otro portfolio suyo y se destraba en
 * dos toques desde su celular.
 *
 * Lo que se traduce NO es el texto crudo (ese aparece dentro del popup de
 * Meta, donde no llegamos): es el error que vuelve al backend cuando la
 * conexión falla. Acá se convierte en qué le pasó y qué hacer ahora.
 */

export interface ErrorTraducido {
  /** Qué pasó, en una línea, sin jerga. */
  titulo: string;
  /** Qué hacer ahora. Pasos concretos, no "contacta soporte". */
  pasos: string[];
  /** Si el problema se resuelve reintentando, se ofrece el botón. */
  reintentable: boolean;
}

/**
 * Cada entrada: los fragmentos que delatan el error (en minúsculas, tal como
 * llegan de Meta o del backend) y qué mostrar.
 *
 * El orden importa: gana la primera que matchea, así que van de lo más
 * específico a lo más general.
 */
const CONOCIDOS: { pistas: string[]; error: ErrorTraducido }[] = [
  {
    // El caso de la clienta: su número ya vive en otro portfolio de Meta,
    // normalmente uno que se creó solo al configurar WhatsApp Business.
    pistas: ['no está asociado', 'not associated', '3441062', 'already', 'ya está registrado', 'desvincular'],
    error: {
      titulo: 'Ese número ya está conectado a otra cuenta de Meta',
      pasos: [
        'Abre WhatsApp Business en tu celular',
        'Entra a Configuración → Herramientas comerciales',
        'Toca "desvincular de la plataforma"',
        'Vuelve aquí y conecta de nuevo',
      ],
      reintentable: true,
    },
  },
  {
    // Pasa seguido: el dueño cierra el popup a mitad, o se pierde en un paso.
    pistas: ['no llegó a completarse', 'wabaid', 'waba_id', 'no se pudo resolver la cuenta'],
    error: {
      titulo: 'La conexión quedó a medias',
      pasos: [
        'Vuelve a intentar sin cerrar la ventana de Meta',
        'Completa todos sus pasos hasta el final',
        'Si te pide un código, revisa los SMS de ese número',
      ],
      reintentable: true,
    },
  },
  {
    // El diálogo lleva mucho abierto: Meta vence la sesión y todo falla raro.
    pistas: ['session', 'sesión', 'expired', 'vencid', 'code was already used', 'invalid code'],
    error: {
      titulo: 'La ventana de Meta se venció',
      pasos: [
        'Cierra la ventana de Meta si sigue abierta',
        'Vuelve a tocar Conectar y hazlo de corrido',
      ],
      reintentable: true,
    },
  },
  {
    // Cuenta sin permisos sobre ese número: lo maneja otra persona.
    pistas: ['permission', 'permiso', 'not authorized', 'no autorizado', 'admin'],
    error: {
      titulo: 'Tu cuenta de Facebook no administra ese número',
      pasos: [
        'Entra con la cuenta de Facebook que creó ese WhatsApp Business',
        'O pide a quien lo administra que te dé acceso en Meta Business',
      ],
      reintentable: true,
    },
  },
  {
    pistas: ['url', 'sitio web', 'website'],
    error: {
      titulo: 'Meta pide un sitio web válido',
      pasos: [
        'Puedes usar tu página de Facebook o tu Instagram',
        'Tiene que empezar con https://',
        'Si no tienes ninguno, usa https://leadai-pe.com',
      ],
      reintentable: true,
    },
  },
];

/** El que se muestra cuando no reconocemos el error. */
const GENERICO: ErrorTraducido = {
  titulo: 'No pudimos completar la conexión',
  pasos: [
    'Vuelve a intentar en un momento',
    'Si puedes, hazlo desde una computadora: el asistente de Meta funciona mejor ahí',
    'Si sigue fallando, escríbenos y lo resolvemos contigo',
  ],
  reintentable: true,
};

/**
 * Traduce el error a algo accionable.
 *
 * NUNCA devuelve null: quedarse sin mensaje es peor que un consejo genérico,
 * porque el dueño se queda mirando una pantalla que no le dice qué hacer.
 */
export function traducirErrorMeta(crudo: string | null | undefined): ErrorTraducido {
  const t = (crudo ?? '').toLowerCase();
  if (!t.trim()) return GENERICO;
  for (const { pistas, error } of CONOCIDOS) {
    if (pistas.some((p) => t.includes(p))) return error;
  }
  return GENERICO;
}
