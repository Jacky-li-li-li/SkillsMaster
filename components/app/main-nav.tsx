"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  key: string;
  label: string;
  href?: string;
};

type PoseParams = {
  maxDepth: number;
  depthStep: number;
  scaleStep: number;
  opacityStep: number;
  rotateStep: number;
  durationMs: number;
};

type ItemPose = {
  transform: string;
  opacity: number;
  zIndex: number;
  blur: number;
  saturate: number;
};

type MainNavProps = {
  items?: NavItem[];
  activeIndex?: number;
  onChange?: (index: number, item: NavItem) => void;
  mobileMaxDepth?: number;
  desktopMaxDepth?: number;
};

const DEFAULT_ITEMS: NavItem[] = [
  { key: "discover", href: "/plaza", label: "Discover" },
  { key: "chats", href: "/sessions", label: "Chats" },
  { key: "models", href: "/models", label: "Models" },
  { key: "me", href: "/me", label: "Me" },
  { key: "unknown", label: "Unknown" },
];

const DESKTOP_PARAMS: PoseParams = {
  maxDepth: 3,
  depthStep: 26,
  scaleStep: 0.11,
  opacityStep: 0.2,
  rotateStep: 12,
  durationMs: 420,
};

const MOBILE_PARAMS: PoseParams = {
  maxDepth: 2,
  depthStep: 18,
  scaleStep: 0.09,
  opacityStep: 0.16,
  rotateStep: 9,
  durationMs: 360,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCircularDelta(index: number, activeIndex: number, total: number) {
  const raw = index - activeIndex;
  const half = total / 2;

  if (raw > half) return raw - total;
  if (raw < -half) return raw + total;
  return raw;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

function getPose(
  index: number,
  activeIndex: number,
  total: number,
  params: PoseParams,
  prefersReducedMotion: boolean
): ItemPose {
  const delta = getCircularDelta(index, activeIndex, total);
  const depth = Math.min(Math.abs(delta), params.maxDepth);
  const direction = Math.sign(delta);
  const depthFactor = prefersReducedMotion ? 0.35 : 1;
  const rotateFactor = prefersReducedMotion ? 0.22 : 1;
  const blur = prefersReducedMotion ? 0 : depth * 0.35;
  const saturate = Math.max(0.7, 1 - depth * 0.1);
  const translateZ = -params.depthStep * depth * depthFactor;
  const rotateY = -direction * params.rotateStep * depth * rotateFactor;
  const scale = 1 - params.scaleStep * depth;

  return {
    transform: `translate(-50%, -50%) translate3d(calc(${delta} * var(--nav-step)), 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
    opacity: Math.max(0.3, 1 - params.opacityStep * depth),
    zIndex: total + (params.maxDepth - depth),
    blur,
    saturate,
  };
}

export function MainNav({
  items = DEFAULT_ITEMS,
  activeIndex: controlledActiveIndex,
  onChange,
  mobileMaxDepth = MOBILE_PARAMS.maxDepth,
  desktopMaxDepth = DESKTOP_PARAMS.maxDepth,
}: MainNavProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const navigationTimeoutRef = useRef<number | null>(null);
  const [transientActive, setTransientActive] = useState<{
    index: number;
    pathname: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current !== null) {
        window.clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  if (items.length === 0) return null;

  const routeActiveIndex = items.findIndex((item) => item.href === pathname);
  const transientIndex =
    transientActive && transientActive.pathname === pathname ? transientActive.index : null;
  const activeIndex = clamp(
    controlledActiveIndex ??
      transientIndex ??
      (routeActiveIndex >= 0 ? routeActiveIndex : 0),
    0,
    Math.max(0, items.length - 1)
  );
  const baseParams = isMobile ? MOBILE_PARAMS : DESKTOP_PARAMS;
  const params: PoseParams = {
    ...baseParams,
    maxDepth: isMobile ? mobileMaxDepth : desktopMaxDepth,
  };
  const durationMs = prefersReducedMotion
    ? Math.min(220, Math.round(params.durationMs * 0.52))
    : params.durationMs;
  const navVars: CSSProperties = {
    ["--nav-step" as string]: "clamp(56px, 10vw, 92px)",
    ["--nav-duration" as string]: `${durationMs}ms`,
  };

  function activateItem(index: number) {
    const target = items[index];
    if (!target) return;

    if (controlledActiveIndex === undefined) {
      setTransientActive({ index, pathname });
    }
    onChange?.(index, target);

    if (!target.href || target.href === pathname) return;
    const nextHref = target.href;

    if (navigationTimeoutRef.current !== null) {
      window.clearTimeout(navigationTimeoutRef.current);
    }

    const delay = prefersReducedMotion ? 0 : isMobile ? 140 : 180;
    navigationTimeoutRef.current = window.setTimeout(() => {
      router.push(nextHref);
    }, delay);
  }

  return (
    <nav
      className="w-full max-w-[36rem]"
      aria-label="Main navigation"
    >
      <div
        className="relative h-20 w-full [perspective:1000px]"
        style={navVars}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-1 top-1/2 h-14 -translate-y-1/2 rounded-full border border-border/80 bg-gradient-to-b from-background via-background to-muted/60 shadow-[0_10px_30px_rgba(15,23,42,0.14)]"
        />
        {items.map((item, index) => {
          const active = index === activeIndex;
          const pose = getPose(
            index,
            activeIndex,
            items.length,
            params,
            prefersReducedMotion
          );
          const itemStyle: CSSProperties = {
            transform: pose.transform,
            opacity: pose.opacity,
            zIndex: pose.zIndex,
            filter: `saturate(${pose.saturate}) blur(${pose.blur}px)`,
            transitionDuration: `${durationMs}ms`,
          };

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => activateItem(index)}
              className={cn(
                "absolute left-1/2 top-1/2 inline-flex h-10 min-w-[4.4rem] items-center justify-center whitespace-nowrap rounded-full border px-3 text-[0.77rem] font-medium tracking-[0.01em] [transform-style:preserve-3d] transition-[transform,opacity,filter,box-shadow,background-color,color,border-color] [transition-timing-function:cubic-bezier(0.22,0.78,0.2,1)] duration-[var(--nav-duration)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none sm:h-11 sm:min-w-[5.4rem] sm:px-4 sm:text-sm",
                active
                  ? "border-primary/80 bg-primary text-primary-foreground font-semibold shadow-[0_12px_28px_rgba(15,23,42,0.28)]"
                  : "border-border/80 bg-background/92 text-foreground/85 shadow-[0_8px_18px_rgba(15,23,42,0.14)] hover:bg-muted/80"
              )}
              style={itemStyle}
              aria-current={active && item.href ? "page" : undefined}
              aria-pressed={active}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
