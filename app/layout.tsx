import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Plus Jakarta Sans: geometría amigable pero profesional (design system
// "Brand Harmony" de Stitch). Se auto-hostea (next/font), sin CDN.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LeadAI",
  description:
    "Ve tus leads, respondé al instante y cerrá más ventas. La IA atiende; vos cerrás.",
  applicationName: "LeadAI",
  appleWebApp: { capable: true, title: "LeadAI", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f7f9fb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={jakarta.variable}>
      {/* El root queda sin restricción de ancho: el panel de escritorio ocupa
          todo el ancho (su propio layout maneja sidebar+contenido), y las
          pantallas tipo login se centran ellas mismas en un ancho de teléfono. */}
      <body className="min-h-dvh bg-arena">{children}</body>
    </html>
  );
}
