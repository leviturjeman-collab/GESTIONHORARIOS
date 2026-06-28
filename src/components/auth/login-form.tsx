"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, LogIn, KeyRound, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [modo, setModo] = useState<"responsable" | "empleado">("responsable");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  function exito() {
    router.push(params.get("callbackUrl") || "/");
    router.refresh();
  }

  async function onSubmitResponsable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    setCargando(false);
    if (res?.error) return setError("Correo o contraseña incorrectos.");
    exito();
  }

  async function onSubmitEmpleado(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError("El correo electrónico es obligatorio.");
    if (!/^\d{4}$/.test(pin)) return setError("El PIN debe tener 4 dígitos.");
    setCargando(true);
    const res = await signIn("pin", { email: email.trim().toLowerCase(), pin, redirect: false });
    setCargando(false);
    if (res?.error) return setError("Correo o PIN incorrectos.");
    exito();
  }

  return (
    <div className="space-y-4">
      {/* Selector de modo */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => {
            setModo("responsable");
            setError(null);
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            modo === "responsable" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          <UserCog className="size-4" /> Responsable
        </button>
        <button
          type="button"
          onClick={() => {
            setModo("empleado");
            setError(null);
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            modo === "empleado" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          <KeyRound className="size-4" /> Empleado
        </button>
      </div>

      {modo === "responsable" ? (
        <form onSubmit={onSubmitResponsable} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tucorreo@empresa.es"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <a className="text-xs text-muted-foreground hover:text-foreground" href="#">
                ¿Has olvidado la contraseña?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={cargando}>
            {cargando ? <Loader2 className="animate-spin" /> : <LogIn />}
            Iniciar sesión
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmitEmpleado} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-pin">Correo electrónico</Label>
            <Input
              id="email-pin"
              type="email"
              placeholder="empleado@empresa.es"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">Tu PIN de acceso</Label>
            <Input
              id="pin"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="text-center font-mono text-2xl tracking-[0.5em]"
              required
            />
            <p className="text-xs text-muted-foreground">
              Introduce tu correo y el PIN de 4 dígitos proporcionado por tu responsable.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={cargando}>
            {cargando ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Entrar con PIN
          </Button>
        </form>
      )}

      {modo === "responsable" && (
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Cuentas de demostración</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setEmail("admin@demo.es");
                setPassword("demo1234");
                setError(null);
              }}
              className="rounded border border-border bg-card px-2 py-1.5 text-left hover:border-primary"
            >
              <span className="block font-medium text-foreground">Admin</span>
              admin@demo.es
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("carmen@demo.es");
                setPassword("demo1234");
                setError(null);
              }}
              className="rounded border border-border bg-card px-2 py-1.5 text-left hover:border-primary"
            >
              <span className="block font-medium text-foreground">Manager</span>
              carmen@demo.es
            </button>
          </div>
          <p className="mt-2">
            Contraseña: <span className="font-mono">demo1234</span>. Los empleados entran en la
            pestaña <strong>Empleado</strong> con su PIN.
          </p>
        </div>
      )}
    </div>
  );
}
