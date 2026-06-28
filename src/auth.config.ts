import type { NextAuthConfig } from "next-auth";
import { Rol } from "@/lib/enums";

/**
 * Configuración compartida y *edge-safe* (sin Prisma ni bcrypt): la usa el
 * middleware para proteger rutas. La lógica de credenciales vive en `auth.ts`,
 * que se ejecuta en runtime Node.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // se añaden en auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.rol = (user as any).rol;
        token.organizacionId = (user as any).organizacionId;
        token.empleadoId = (user as any).empleadoId ?? null;
        token.nombre = (user as any).name ?? token.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.rol = token.rol as string;
        session.user.organizacionId = token.organizacionId as string;
        session.user.empleadoId = (token.empleadoId as string | null) ?? null;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;

      // Rutas públicas
      const publicas = ["/login", "/invitacion"];
      const esPublica = publicas.some((p) => pathname.startsWith(p));

      if (esPublica) return true;
      if (!isLoggedIn) return false; // redirige a /login automáticamente

      // Áreas exclusivas de responsables (admin/manager)
      const rol = auth!.user.rol as string;
      const soloResponsable = [
        "/inicio",
        "/ubicaciones",
        "/cuadrantes",
        "/onboarding",
        "/costes",
        "/empleados",
        "/nominas",
        "/ajustes",
      ];
      if (
        rol === Rol.EMPLEADO &&
        soloResponsable.some((p) => pathname.startsWith(p))
      ) {
        return Response.redirect(new URL("/fichar", request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
