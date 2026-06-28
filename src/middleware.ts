import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// El middleware usa solo la configuración edge-safe (sin Prisma/bcrypt).
export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  // La lógica de autorización vive en `authConfig.callbacks.authorized`.
  return;
});

export const config = {
  // Protege todo salvo estáticos y la API de NextAuth.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
