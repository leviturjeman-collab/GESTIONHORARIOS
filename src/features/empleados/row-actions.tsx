"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Mail, UserX, UserCheck, Download, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EmployeeForm } from "@/features/empleados/employee-form";
import {
  invitarEmpleado,
  cambiarEstadoEmpleado,
  borrarDatosEmpleado,
} from "@/features/empleados/actions";

type Ubic = { id: string; nombre: string };

export function EmployeeRowActions({
  empleado,
  ubicaciones,
  puedeRgpd,
}: {
  empleado: any;
  ubicaciones: Ubic[];
  puedeRgpd?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function borrar() {
    if (
      !window.confirm(
        `RGPD · ¿Eliminar TODOS los datos de ${empleado.nombre} ${empleado.apellidos ?? ""}? Es irreversible (ficha, contrato, turnos, fichajes, documentos y cuenta).`
      )
    )
      return;
    setBusy(true);
    const res = await borrarDatosEmpleado(empleado.id);
    setBusy(false);
    res.ok ? toast.success("Datos del empleado eliminados") : toast.error(res.error);
    router.refresh();
  }

  async function invitar() {
    setBusy(true);
    const res = await invitarEmpleado(empleado.id);
    setBusy(false);
    res.ok ? toast.success("Invitación enviada") : toast.error(res.error);
    router.refresh();
  }
  async function alternarEstado() {
    setBusy(true);
    const res = await cambiarEstadoEmpleado(empleado.id, empleado.estado === "INACTIVO");
    setBusy(false);
    res.ok ? toast.success("Estado actualizado") : toast.error(res.error);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
        disabled={busy}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <EmployeeForm ubicaciones={ubicaciones} empleado={empleado}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Pencil /> Editar
          </DropdownMenuItem>
        </EmployeeForm>
        <DropdownMenuItem onClick={invitar}>
          <Mail /> Invitar por correo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={alternarEstado}>
          {empleado.estado === "INACTIVO" ? (
            <>
              <UserCheck /> Reactivar
            </>
          ) : (
            <>
              <UserX /> Desactivar
            </>
          )}
        </DropdownMenuItem>
        {puedeRgpd && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={`/api/rgpd/${empleado.id}`} target="_blank" rel="noreferrer">
                <Download /> Exportar datos (RGPD)
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={borrar} className="text-danger">
              <Trash2 /> Eliminar datos (RGPD)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
