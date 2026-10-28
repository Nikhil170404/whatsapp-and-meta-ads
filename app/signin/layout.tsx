import type { ReactNode } from "react";

// Rendered on every request so the strict Content Security Policy can stamp a fresh nonce on the page's scripts.
// A pre-built (static) page has no per-request nonce, so its scripts would be blocked.
export const dynamic = "force-dynamic";

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
