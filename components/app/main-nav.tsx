"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/plaza", label: "Discover" },
  { href: "/sessions", label: "Chats" },
  { href: "/models", label: "Models" },
  { href: "/me", label: "Me" },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 flex-wrap">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-3 py-2 rounded-md text-sm border",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted"
            )}
          >
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        className="px-3 py-2 rounded-md text-sm border bg-background hover:bg-muted"
      >
        Unknown
      </button>
    </nav>
  );
}
