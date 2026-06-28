import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: string;
      organizacionId: string;
      empleadoId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    rol?: string;
    organizacionId?: string;
    empleadoId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    rol?: string;
    organizacionId?: string;
    empleadoId?: string | null;
  }
}
