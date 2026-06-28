"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationsBell({ count }: { count: number }) {
  return (
    <Link
      href="/notificaciones"
      className="relative inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
      aria-label={`Notificaciones${count ? `, ${count} sin leer` : ""}`}
    >
      <Bell className="size-5 text-muted-foreground" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-danger-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
