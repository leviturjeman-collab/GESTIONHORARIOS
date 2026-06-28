import { redirect } from "next/navigation";
import { getSesion } from "@/lib/session";
import { rutaInicial } from "@/lib/rbac";

export default async function Home() {
  const u = await getSesion();
  if (!u) redirect("/login");
  redirect(rutaInicial(u.rol));
}
