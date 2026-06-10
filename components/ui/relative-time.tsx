"use client";

import { useEffect, useState } from "react";

/**
 * Renders a timestamp in the viewer's own timezone with a smart label:
 * time for today, "Yesterday", weekday within the last week, else a short date.
 * Runs on the client so it never shows the server's UTC time.
 */
export function RelativeTime({ date, className }: { date: string; className?: string }) {
  // Render nothing meaningful until mounted to avoid a server/client mismatch.
  const [label, setLabel] = useState("");

  useEffect(() => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return;

    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);

    if (dayDiff <= 0) setLabel(time);
    else if (dayDiff === 1) setLabel(`Yesterday ${time}`);
    else if (dayDiff < 7) setLabel(`${d.toLocaleDateString([], { weekday: "short" })} ${time}`);
    else setLabel(d.toLocaleDateString([], { day: "numeric", month: "short" }));
  }, [date]);

  return (
    <time dateTime={date} className={className} suppressHydrationWarning>
      {label}
    </time>
  );
}
