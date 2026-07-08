import { redirect } from "next/navigation";

// Ruta vieja reemplazada por el panel de escritorio: /leads.
export default function BandejaRedirect() {
  redirect("/leads");
}
