"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Rises into place once as it scrolls into view. The content is visible in the server HTML and
 * only hidden after the page loads, so nothing stays invisible if scripts fail or motion is reduced.
 */
export function Reveal({ children, delay = 0, as: Tag = "div", className = "" }: { children: ReactNode; delay?: number; as?: ElementType; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"shown" | "hidden" | "in">("shown");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setState("hidden");
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setState("in"); io.disconnect(); }
    }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: state === "in" ? `${delay}ms` : "0ms" }}
      className={`${state === "hidden" ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100"} transition-[opacity,transform] duration-700 ease-out ${className}`}
    >
      {children}
    </Tag>
  );
}
