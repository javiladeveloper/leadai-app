"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { LienzoFlujo } from "@/components/panel/flujos/LienzoFlujo";

export default function EditorFlujoPanel() {
  const router = useRouter();
  const params = useParams();
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);
  if (!listo) return null;
  const id = String(params.id);
  return <LienzoFlujo flujoId={id} />;
}
