"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Send, Sparkles, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { preguntarAsistente } from "@/features/asistente/actions";

type Msg = { rol: "user" | "ia"; texto: string };

export function Chat({ sugerencias }: { sugerencias: string[] }) {
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, cargando]);

  async function enviar(pregunta?: string) {
    const q = (pregunta ?? texto).trim();
    if (!q || cargando) return;
    setMensajes((m) => [...m, { rol: "user", texto: q }]);
    setTexto("");
    setCargando(true);
    try {
      const res = await preguntarAsistente(q);
      setMensajes((m) => [...m, { rol: "ia", texto: res.texto }]);
    } catch {
      toast.error("No se ha podido contactar con el asistente");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col rounded-lg border border-border bg-card">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {mensajes.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent/10">
              <Sparkles className="size-6 text-accent" />
            </div>
            <p className="font-medium">¿En qué te ayudo?</p>
            <p className="mb-4 text-sm text-muted-foreground">Prueba con una de estas:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {sugerencias.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm hover:border-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {mensajes.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.rol === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                m.rol === "ia" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
              )}
            >
              {m.rol === "ia" ? <Sparkles className="size-4" /> : <User className="size-4" />}
            </div>
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                m.rol === "ia" ? "bg-muted" : "bg-primary text-primary-foreground"
              )}
            >
              {m.texto}
            </div>
          </div>
        ))}
        {cargando && (
          <div className="flex gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Sparkles className="size-4" />
            </div>
            <div className="flex items-center rounded-lg bg-muted px-3 py-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={finRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe tu mensaje…"
          disabled={cargando}
        />
        <Button type="submit" disabled={cargando || !texto.trim()}>
          <Send />
        </Button>
      </form>
    </div>
  );
}
