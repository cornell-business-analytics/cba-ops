"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useAppSession } from "@/hooks/session-context";
import {
  LayoutDashboard,
  Users,
  UserSearch,
  CalendarDays,
  BarChart3,
  LogOut,
  ShieldCheck,
  Coffee,
  ClipboardList,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const baseNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },

  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/design-requests", label: "Design Requests", icon: Wand2 },
];

const recruitmentNav = [
  { href: "/recruitment", label: "Recruitment", icon: UserSearch },
  { href: "/recruitment/coffee-chats", label: "Coffee Chats", icon: Coffee },
];

export function Sidebar() {
  const pathname = usePathname();
  const session = useAppSession();
  const role = session?.role;
  const isEboard = role === "eboard";
  const hasRecruitmentAccess = role === "recruitment" || role === "eboard";

  const nav = hasRecruitmentAccess
    ? [baseNav[0], ...recruitmentNav, ...baseNav.slice(1)]
    : baseNav;

  return (
    <aside className="flex h-screen w-56 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <Image src="/logo.png" alt="CBA logo" width={28} height={28} className="shrink-0" />
        <span className="text-sm font-semibold tracking-wide">CBA Ops</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith(href)
                ? "border-l-2 border-[#1a7a3c] bg-sidebar-accent pl-[10px] font-medium text-sidebar-accent-foreground"
                : "border-l-2 border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
        {(role === "director" || role === "recruitment" || role === "eboard") && (
          <Link
            href="/members/edit-requests"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith("/members/edit-requests")
                ? "border-l-2 border-[#1a7a3c] bg-sidebar-accent pl-[10px] font-medium text-sidebar-accent-foreground"
                : "border-l-2 border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
            Edit Requests
          </Link>
        )}
        {isEboard && (
          <Link
            href="/members/access"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith("/members/access")
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Access
          </Link>
        )}
      </nav>

      {/* Sign out */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/50 transition-colors hover:bg-red-950/40 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
