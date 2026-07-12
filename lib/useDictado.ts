"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Dictado por voz usando la Web Speech API del navegador (reconocimiento nativo).
// Sin backend ni costo: el celular convierte la voz en texto. Pensado para que
// Guisella pueda HABLAR en vez de escribir. Devuelve el texto a medida que habla.
//
// Soporte: Chrome/Edge/Safari en celular lo tienen. Firefox no siempre. Si no
// hay soporte, `soportado` es false y el botón de dictar no se muestra.

// Tipos mínimos de la Web Speech API (no están en los tipos estándar de TS).
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export function useDictado(onTexto: (fragmento: string) => void) {
  const [escuchando, setEscuchando] = useState(false);
  const [soportado, setSoportado] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextoRef = useRef(onTexto);
  onTextoRef.current = onTexto;

  useEffect(() => {
    setSoportado(getRecognition() !== null);
  }, []);

  const parar = useCallback(() => {
    recRef.current?.stop();
    setEscuchando(false);
  }, []);

  const empezar = useCallback(() => {
    const rec = getRecognition();
    if (!rec) return;
    rec.lang = "es-PE"; // español de Perú
    rec.continuous = true;
    rec.interimResults = false; // solo entregamos frases finales, no el "borrador"
    rec.onresult = (e) => {
      // Concatenamos las frases finales nuevas de este evento.
      let fragmento = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fragmento += r[0].transcript;
      }
      if (fragmento.trim()) onTextoRef.current(fragmento.trim());
    };
    rec.onerror = () => setEscuchando(false);
    rec.onend = () => setEscuchando(false);
    recRef.current = rec;
    rec.start();
    setEscuchando(true);
  }, []);

  // Limpieza al desmontar.
  useEffect(() => () => recRef.current?.stop(), []);

  return { escuchando, soportado, empezar, parar };
}
