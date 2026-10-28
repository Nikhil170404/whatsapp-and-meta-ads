"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Phone } from "./Phone";

/**
 * The split stage: a phone that stays on screen while the page scrolls beside it, showing the
 * conversation that matches the section being read. On a phone-sized screen the stage is one
 * phone under the opening, and each stage shows its own conversation inline instead.
 */
export function Stage({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = Array.from(root.current?.querySelectorAll<HTMLElement>("[data-stage]") ?? []);
    const io = new IntersectionObserver((entries) => {
      const best = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (best) setStage(Number((best.target as HTMLElement).dataset.stage));
    }, { rootMargin: "-35% 0px -35% 0px", threshold: [0, 0.2, 0.5, 1] });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={root} className="mx-auto grid max-w-[1400px] lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
      <div className="hidden lg:block">
        <div className="sticky top-16 flex h-[calc(100svh-4rem)] items-center justify-center bg-lp-field px-8">
          <div className="relative w-full max-w-[340px]">
            <Phone stage={stage} />
            <p className="mt-4 text-center text-sm text-lp-soft">{stage === 0 ? "This chat is live. Type a word and it answers." : "The same messages your customers will see."}</p>
          </div>
        </div>
      </div>
      <div className="min-w-0 px-5 sm:px-8 lg:px-14 xl:px-20">{children}</div>
    </div>
  );
}

/** One conversation shown inline, for screens too narrow for the side-by-side stage. */
export function InlinePhone({ stage }: { stage: number }) {
  return <div className="mt-8 lg:hidden"><Phone stage={stage} /></div>;
}
