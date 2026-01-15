"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  UserCheck,
  Clock,
  CalendarDays,
  Settings,
  LogOut,
  LayoutDashboard,
  School,
  FileText,
  FolderOpen,
} from "lucide-react";
import { pb } from "@/lib/pocketbase";
import { cn } from "@/lib/utils";

const sidebarItems = [
  {
    title: "Botschafter",
    href: "/members/active",
    icon: Users,
    children: [
      {
        title: "Aktive Botschafter",
        href: "/members/active",
        icon: UserCheck,
      },
      {
        title: "Wartende Botschafter",
        href: "/members/pending",
        icon: Clock,
      },
    ],
  },
  {
    title: "Formulare",
    href: "/forms",
    icon: FileText,
  },
  {
    title: "Events",
    href: "/events",
    icon: CalendarDays,
  },
  {
    title: "Ressourcen",
    href: "/resources",
    icon: FolderOpen,
  },
  {
    title: "Schulen",
    href: "/schools",
    icon: School,
  },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const isSettingsActive = pathname.startsWith("/settings");
  const user = pb.authStore.model as { name?: string; email?: string } | null;
  const displayName =
    user?.name?.trim() || user?.email?.trim() || "Profil";
  const emailLabel = user?.email?.trim() || "keine E-Mail";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={cn("flex h-full w-64 flex-col border-r bg-card text-card-foreground", className)}>
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/members/active" className="flex items-center gap-2 font-bold text-lg">
          <LayoutDashboard className="h-6 w-6" />
          <span>Admin Panel</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-2 px-2">
          {sidebarItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = item.children
              ? item.children.some((child) => pathname.startsWith(child.href))
              : pathname.startsWith(item.href);
            return (
              <div key={index} className="grid gap-1">
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </Link>
                {item.children ? (
                  <div className="grid gap-1 pl-6">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = pathname.startsWith(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                            isChildActive
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          <ChildIcon className="h-3.5 w-3.5" />
                          {child.title}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
      <div className="border-t p-4">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-4 text-sm font-medium">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-muted text-xs font-bold">
            {initials || "?"}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold">{displayName}</div>
            <div className="text-xs text-muted-foreground truncate">
              {emailLabel}
            </div>
          </div>
        </div>
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
            isSettingsActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
          )}
        >
          <div className="flex h-9 w-9 items-center justify-center">
            <Settings className="h-4 w-4" />
          </div>
          Einstellungen
        </Link>
        <button
          onClick={() => {
            pb.authStore.clear();
            window.location.href = "/login";
          }}
          className="mt-0 flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <div className="flex h-9 w-9 items-center justify-center">
            <LogOut className="h-4 w-4" />
          </div>
          Abmelden
        </button>
      </div>
    </div>
  );
}
