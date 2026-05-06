"use client";

import { RefreshCw } from "lucide-react";

export function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 w-full">
      <div className="animate-spin text-indigo-500">
        <RefreshCw className="w-10 h-10" />
      </div>
      {message && (
        <p className="text-neutral-400 text-sm font-medium animate-pulse uppercase tracking-widest text-center">
          {message}
        </p>
      )}
    </div>
  );
}
