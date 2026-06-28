import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { empleado: { select: { id: true } } },
        });
        if (!usuario || !usuario.activo) return null;

        const ok = await bcrypt.compare(parsed.data.password, usuario.passwordHash);
        if (!ok) return null;

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nombre,
          rol: usuario.rol,
          organizacionId: usuario.organizacionId,
          empleadoId: usuario.empleado?.id ?? null,
        } as any;
      },
    }),
    // Login solo con PIN (empleados): no necesitan correo ni contraseña.
    Credentials({
      id: "pin",
      name: "pin",
      credentials: {
        email: { label: "Correo", type: "text" },
        pin: { label: "PIN", type: "text" },
      },
      authorize: async (credentials) => {
        const pin = String((credentials as any)?.pin ?? "").trim();
        const email = String((credentials as any)?.email ?? "").trim().toLowerCase();
        if (!/^\d{4}$/.test(pin)) return null;

        const whereClause: any = { pinFichaje: pin, estado: "ACTIVO", usuarioId: { not: null } };
        if (email) {
          whereClause.email = email;
        }

        const empleados = await prisma.empleado.findMany({
          where: whereClause,
          include: { usuario: true },
        });
        if (empleados.length !== 1) return null; // ninguno o PIN ambiguo
        const e = empleados[0];
        if (!e.usuario || !e.usuario.activo) return null;

        return {
          id: e.usuario.id,
          email: e.usuario.email,
          name: e.usuario.nombre,
          rol: e.usuario.rol,
          organizacionId: e.usuario.organizacionId,
          empleadoId: e.id,
        } as any;
      },
    }),
  ],
});
