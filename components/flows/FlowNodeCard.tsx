"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import type { FlowNode, NodeDataMap } from "@/lib/flows/types";
import { NODE_META, summary } from "./nodeMeta";

export interface BlockData extends Record<string, unknown> {
  node: FlowNode;
  errors: number;
  warnings: number;
  /** The block the in-browser preview is currently on. */
  active: boolean;
  /** Outputs that go nowhere yet, shown with a pulsing amber dot so the gap is obvious. */
  open: string[];
}

// Large, easy-to-hit connection points: a thumb has to land on them.
const handleBase = "!h-5 !w-5 !border-2 !border-white !shadow";

function Choice({ handle, label, muted, open }: { handle: string; label: string; muted?: boolean; open?: boolean }) {
  return (
    <div className={`relative flex items-center rounded-lg px-3 py-2 text-xs font-semibold ${muted ? "border border-dashed border-slate-300 text-slate-400" : "bg-white text-slate-800 ring-1 ring-slate-200"}`}>
      <span className="truncate pr-4">{label || <span className="text-slate-300">(no label)</span>}</span>
      <Handle type="source" position={Position.Right} id={handle} className={`${handleBase} ${open ? "!bg-amber-400 animate-pulse" : muted ? "!bg-slate-300" : "!bg-violet-500"}`} />
    </div>
  );
}

function FlowNodeCardImpl({ data, selected }: NodeProps) {
  const { node, errors, warnings, active, open } = data as BlockData;
  const gap = (h: string) => open.includes(h) ? "!bg-amber-400 animate-pulse" : "";
  const meta = NODE_META[node.type];
  const Icon = meta.icon;
  const d = node.data as any;
  const choices: { handle: string; label: string }[] =
    node.type === "buttons" ? (d as NodeDataMap["buttons"]).buttons.map((b) => ({ handle: `btn:${b.id}`, label: b.title }))
    : node.type === "list" ? (d as NodeDataMap["list"]).rows.map((r) => ({ handle: `row:${r.id}`, label: r.title }))
    : [];
  const canGiveUp = ["buttons", "list", "question", "location"].includes(node.type);

  return (
    <div
      className={`w-[270px] animate-in fade-in zoom-in-95 rounded-2xl bg-white shadow-md ring-1 transition duration-200 ${
        active ? "ring-4 ring-emerald-400 shadow-emerald-200" : selected ? `ring-2 ${meta.ring} shadow-lg` : errors ? "ring-2 ring-rose-300" : "ring-slate-200 hover:shadow-lg"
      }`}
    >
      {node.type !== "start" && <Handle type="target" position={Position.Top} id="in" className={`${handleBase} !bg-slate-400`} />}

      <div className={`flex items-center gap-2.5 rounded-t-2xl px-3 py-2.5 ${meta.tint}`}>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.chip}`}><Icon className="h-4 w-4" aria-hidden /></span>
        <span className="text-sm font-bold text-slate-800">{meta.label}</span>
        {(errors > 0 || warnings > 0) && (
          <span
            title={errors ? `${errors} problem${errors > 1 ? "s" : ""} to fix` : `${warnings} suggestion${warnings > 1 ? "s" : ""}`}
            className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${errors ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden /> {errors || warnings}
          </span>
        )}
      </div>

      <div className="space-y-2 px-3 py-3">
        <p className={`line-clamp-3 whitespace-pre-wrap text-[13px] leading-snug ${summary(node).endsWith("…") ? "italic text-slate-400" : "text-slate-600"}`}>{summary(node)}</p>

        {node.type === "question" && (
          <p className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-500">
            <span className="rounded bg-slate-100 px-1.5 py-0.5">{(d as NodeDataMap["question"]).input}</span>
            {d.variable && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">saves as {d.variable}</span>}
          </p>
        )}

        {choices.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {choices.map((c) => <Choice key={c.handle} handle={c.handle} label={c.label} open={open.includes(c.handle)} />)}
          </div>
        )}
        {canGiveUp && choices.length > 0 && <Choice handle="giveup" label="No valid answer" muted />}
      </div>

      {node.type === "condition" && (
        <div className="relative flex justify-between px-6 pb-3 text-[11px] font-bold">
          <span className="text-emerald-600">Yes</span>
          <span className="text-rose-500">No</span>
          <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "25%" }} className={`${handleBase} ${gap("yes") || "!bg-emerald-500"}`} />
          <Handle type="source" position={Position.Bottom} id="no" style={{ left: "75%" }} className={`${handleBase} ${gap("no") || "!bg-rose-500"}`} />
        </div>
      )}

      {["start", "message", "tag", "lead", "wait", "pay", "webhook"].includes(node.type) && (
        <Handle type="source" position={Position.Bottom} id="next" className={`${handleBase} ${gap("next") || "!bg-sky-500"}`} />
      )}
      {["question", "location"].includes(node.type) && (
        <>
          <Handle type="source" position={Position.Bottom} id="next" style={{ left: "35%" }} className={`${handleBase} ${gap("next") || "!bg-sky-500"}`} />
          <Handle type="source" position={Position.Bottom} id="giveup" style={{ left: "80%" }} className={`${handleBase} !bg-slate-300`} />
          <div className="flex justify-between px-6 pb-2 text-[10px] font-semibold text-slate-400"><span>Next</span><span>If they give up</span></div>
        </>
      )}
    </div>
  );
}

export const FlowNodeCard = memo(FlowNodeCardImpl);
