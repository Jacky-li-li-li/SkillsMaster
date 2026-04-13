"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/plaza", label: "Skill广场" },
  { href: "/sessions", label: "会话" },
  { href: "/models", label: "模型" },
  { href: "/me", label: "我的" },
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
    </nav>
  );
}
