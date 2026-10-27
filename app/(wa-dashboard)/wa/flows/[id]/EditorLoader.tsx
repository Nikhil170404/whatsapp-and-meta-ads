"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// The canvas needs the browser, so it loads on the client only.
const FlowEditor = dynamic(() => import("@/components/flows/FlowEditor"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-50 lg:left-72" role="status"><Loader2 className="h-8 w-8 animate-spin text-[#25D366]" aria-label="Loading editor" /></div>,
});

export function EditorLoader(props: React.ComponentProps<typeof FlowEditor>) {
  return <FlowEditor {...props} />;
}
