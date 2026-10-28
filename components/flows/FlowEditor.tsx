"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Background, BackgroundVariant, Controls, MarkerType, ReactFlow, ReactFlowProvider, addEdge, applyEdgeChanges, applyNodeChanges, useReactFlow,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange,
} from "@xyflow/react";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Loader2, Play, Plus, Rocket, Send, Settings2, Smartphone, Wand2, X } from "lucide-react";
import type { FlowDefinition, FlowEdge, FlowNode, FlowSettings } from "@/lib/flows/types";
import { VARIABLE_RE, BUILTIN_VARIABLES, outputHandles } from "@/lib/flows/types";
import { hasErrors, sanitize, validateFlow, NODE_LABELS } from "@/lib/flows/validate";
import { autoLayout } from "@/lib/flows/layout";
import { FlowNodeCard, type BlockData } from "./FlowNodeCard";
import { Inspector } from "./Inspector";
import { Simulator } from "./Simulator";
import { NODE_META, PALETTE, newNode, summary } from "./nodeMeta";

interface FlowRecord {
  id: string; name: string; status: "draft" | "published"; trigger_type: FlowSettings["trigger_type"]; keywords: string[]; exit_keywords: string[];
  definition: FlowDefinition; published_at: string | null;
}
interface Props { flow: FlowRecord; otherKeywords: string[] }

const nodeTypes = { block: FlowNodeCard };
type Panel = null | "add" | "inspect" | "preview" | "settings" | "problems" | "test";
type Save = "saved" | "saving" | "error";

const edgeStyle = { stroke: "#94a3b8", strokeWidth: 2 };
const toRfEdge = (e: FlowEdge): Edge => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target, targetHandle: "in", markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" }, style: edgeStyle, animated: false });
const uid = () => `e_${Math.random().toString(36).slice(2, 9)}`;

function Editor({ flow, otherKeywords }: Props) {
  const rf = useReactFlow();
  const [name, setName] = useState(flow.name);
  const [settings, setSettings] = useState<FlowSettings>({ trigger_type: flow.trigger_type, keywords: flow.keywords, exit_keywords: flow.exit_keywords });
  const [nodes, setNodes] = useState<FlowNode[]>(flow.definition.nodes);
  const [edges, setEdges] = useState<FlowEdge[]>(flow.definition.edges);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [save, setSave] = useState<Save>("saved");
  const [status, setStatus] = useState(flow.status);
  const [dirtySincePublish, setDirty] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  // The side panel (desktop) and the bottom sheet (phone) are never both on the page, so ids stay unique.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(q.matches);
    on(); q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  const [busy, setBusy] = useState<null | "publish" | "test">(null);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const snapshot = useRef(JSON.stringify({ name: flow.name, settings: { trigger_type: flow.trigger_type, keywords: flow.keywords, exit_keywords: flow.exit_keywords }, definition: flow.definition }));
  // React Flow measures each card; controlled nodes must carry that size back or they stay hidden.
  const [dims, setDims] = useState<Record<string, { width: number; height: number }>>({});
  const wrapper = useRef<HTMLDivElement>(null);

  const definition = useMemo<FlowDefinition>(() => ({ nodes, edges }), [nodes, edges]);
  const issues = useMemo(() => validateFlow(definition, settings, { otherKeywords }), [definition, settings, otherKeywords]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const variables = useMemo(() => [...BUILTIN_VARIABLES, ...new Set(nodes.map((n) => (n.data as any).variable as string | undefined).filter((v): v is string => !!v && VARIABLE_RE.test(v)))], [nodes]);
  const selectedNode = nodes.find((n) => n.id === selected) ?? null;

  const say = (text: string, tone: "ok" | "err" = "ok") => { setToast({ text, tone }); window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 4500); };

  // Autosave: wait for a pause in editing, then save the draft. Failures are shown, never silent.
  useEffect(() => {
    const current = JSON.stringify({ name, settings, definition });
    if (current === snapshot.current) return;
    setSave("saving"); setDirty(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/whatsapp/flows/${flow.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, settings, definition: sanitize(definition) }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not save");
        snapshot.current = current; setSave("saved");
      } catch (e: any) { setSave("error"); say(e.message || "Could not save your changes. Check your connection.", "err"); }
    }, 900);
    return () => window.clearTimeout(t);
  }, [definition, name, settings, flow.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (save !== "saved") { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  const issuesByNode = useMemo(() => {
    const m = new Map<string, { e: number; w: number }>();
    for (const i of issues) if (i.nodeId) { const c = m.get(i.nodeId) ?? { e: 0, w: 0 }; i.level === "error" ? c.e++ : c.w++; m.set(i.nodeId, c); }
    return m;
  }, [issues]);

  const handleLabel = (n: FlowNode, h: string): string => {
    const d = n.data as any;
    if (h === "next") return n.type === "start" ? "Starts with" : "Then";
    if (h === "yes") return "If yes";
    if (h === "no") return "If no";
    if (h === "giveup") return "If they give up";
    if (h.startsWith("btn:")) return `If they tap “${d.buttons?.find((b: any) => `btn:${b.id}` === h)?.title || "button"}”`;
    if (h.startsWith("row:")) return `If they pick “${d.rows?.find((r: any) => `row:${r.id}` === h)?.title || "option"}”`;
    return h;
  };
  const edgeFrom = (id: string, h: string) => edges.find((e) => e.source === id && e.sourceHandle === h)?.target ?? null;
  const openByNode = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of nodes) m.set(n.id, outputHandles(n).filter((h) => h !== "giveup" && !edges.some((e) => e.source === n.id && e.sourceHandle === h)));
    return m;
  }, [nodes, edges]);
  const openCount = [...openByNode.values()].reduce((a, v) => a + v.length, 0);
  const targetOptions = useMemo(() => nodes.filter((n) => n.type !== "start").map((n) => ({ id: n.id, label: `${NODE_LABELS[n.type]}: ${(summary(n) || "").replace(/…$/, "").slice(0, 32) || "(empty)"}` })), [nodes]);
  const links = selectedNode ? outputHandles(selectedNode).map((h) => ({ handle: h, label: handleLabel(selectedNode, h), target: edgeFrom(selectedNode.id, h), optional: h === "giveup" })) : [];
  const setLink = (handle: string, target: string | null) => {
    if (!selectedNode) return;
    setEdges((es) => { const rest = es.filter((e) => !(e.source === selectedNode.id && e.sourceHandle === handle)); return target ? [...rest, { id: uid(), source: selectedNode.id, sourceHandle: handle, target }] : rest; });
  };

  const rfNodes: Node[] = useMemo(() => nodes.map((n) => ({
    id: n.id, type: "block", position: n.position, selected: n.id === selected, draggable: true, measured: dims[n.id], deletable: n.type !== "start",
    data: { node: n, errors: issuesByNode.get(n.id)?.e ?? 0, warnings: issuesByNode.get(n.id)?.w ?? 0, active: n.id === active, open: openByNode.get(n.id) ?? [] } satisfies BlockData,
  })), [nodes, issuesByNode, selected, active, dims, openByNode]);
  const rfEdges = useMemo(() => edges.map(toRfEdge), [edges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const sizes = changes.filter((c): c is Extract<NodeChange, { type: "dimensions" }> => c.type === "dimensions" && !!c.dimensions);
    if (sizes.length) setDims((d) => { const next = { ...d }; for (const c of sizes) next[c.id] = c.dimensions!; return next; });
    const rfNow = applyNodeChanges(changes, rfNodes);
    setNodes((prev) => prev.filter((n) => rfNow.some((r) => r.id === n.id) && !(n.type === "start" && changes.some((c) => c.type === "remove" && c.id === n.id))).map((n) => ({ ...n, position: rfNow.find((r) => r.id === n.id)?.position ?? n.position })));
    const removed = changes.filter((c) => c.type === "remove").map((c: any) => c.id);
    if (removed.length) { setEdges((es) => es.filter((e) => !removed.includes(e.source) && !removed.includes(e.target))); if (removed.includes(selected)) { setSelected(null); setPanel(null); } }
  }, [rfNodes, selected]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const rfNow = applyEdgeChanges(changes, rfEdges);
    setEdges((prev) => prev.filter((e) => rfNow.some((r) => r.id === e.id)));
  }, [rfEdges]);

  // One connection per output: connecting again replaces the old line, so a button never goes two places.
  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    const handle = c.sourceHandle ?? "next";
    setEdges((es) => [...es.filter((e) => !(e.source === c.source && e.sourceHandle === handle)), { id: uid(), source: c.source!, sourceHandle: handle, target: c.target! }]);
  }, []);

  /** Adds a block; if a block is selected with a free output, connects to it automatically. */
  const addBlock = useCallback((type: FlowNode["type"], at?: { x: number; y: number }) => {
    const anchor = nodes.find((n) => n.id === selected) ?? nodes.find((n) => n.type === "start");
    const viewport = wrapper.current?.getBoundingClientRect();
    const position = at ?? (anchor ? { x: anchor.position.x, y: anchor.position.y + 220 } : rf.screenToFlowPosition({ x: (viewport?.left ?? 0) + 200, y: (viewport?.top ?? 0) + 200 }));
    const node = newNode(type, position);
    setNodes((ns) => [...ns, node]);
    if (!at && anchor) {
      const used = new Set(edges.filter((e) => e.source === anchor.id).map((e) => e.sourceHandle));
      const free = outputHandles(anchor).find((h) => !used.has(h) && h !== "giveup");
      if (free) setEdges((es) => [...es, { id: uid(), source: anchor.id, sourceHandle: free, target: node.id }]);
    }
    setSelected(node.id); setPanel("inspect");
    window.setTimeout(() => rf.fitView({ nodes: [{ id: node.id }], duration: 400, maxZoom: 1, padding: 0.6 }), 60);
  }, [nodes, edges, selected, rf]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/x-flow-block") as FlowNode["type"];
    if (!type || !NODE_META[type]) return;
    addBlock(type, rf.screenToFlowPosition({ x: e.clientX - 135, y: e.clientY - 20 }));
  };

  const updateData = (data: any) => setNodes((ns) => ns.map((n) => (n.id === selected ? ({ ...n, data } as FlowNode) : n)));
  const deleteSelected = () => {
    if (!selectedNode || selectedNode.type === "start") return;
    setNodes((ns) => ns.filter((n) => n.id !== selected)); setEdges((es) => es.filter((e) => e.source !== selected && e.target !== selected));
    setSelected(null); setPanel(null);
  };
  const tidy = () => { const d = autoLayout(definition); setNodes(d.nodes); window.setTimeout(() => rf.fitView({ duration: 500, padding: 0.2 }), 60); say("Blocks tidied up."); };
  const focusNode = (id: string) => { setSelected(id); setPanel("inspect"); rf.fitView({ nodes: [{ id }], duration: 500, maxZoom: 1, padding: 0.6 }); };

  const publish = async () => {
    if (errors.length) { setPanel("problems"); return say(`Fix ${errors.length} problem${errors.length > 1 ? "s" : ""} before publishing.`, "err"); }
    if (save === "saving") return say("Saving your latest changes. Try again in a moment.", "err");
    setBusy("publish");
    try {
      const res = await fetch(`/api/whatsapp/flows/${flow.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publish: true }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not publish");
      setStatus("published"); setDirty(false); say("Published. Customers will now get this flow.");
    } catch (e: any) { say(e.message, "err"); } finally { setBusy(null); }
  };

  const unpublish = async () => {
    setBusy("publish");
    try {
      const res = await fetch(`/api/whatsapp/flows/${flow.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publish: false }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not turn off");
      setStatus("draft"); say("Flow turned off. Customers will no longer enter it.");
    } catch (e: any) { say(e.message, "err"); } finally { setBusy(null); }
  };

  const testLive = async () => {
    setBusy("test");
    try {
      const res = await fetch(`/api/whatsapp/flows/${flow.id}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: testPhone }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not start the test");
      say("Test started. Check WhatsApp on that phone."); setPanel(null);
    } catch (e: any) { say(e.message, "err"); } finally { setBusy(null); }
  };

  const needsRepublish = status === "published" && dirtySincePublish;
  // One plain next step, so nobody has to guess what to do.
  const guide: { text: string; action?: { label: string; run: () => void } } =
    nodes.length <= 1 ? { text: "Step 1 of 4. Add your first block: it sends your opening message.", action: { label: "Add a block", run: () => setPanel("add") } }
    : errors.length ? { text: `Step 2 of 4. Fix ${errors.length} thing${errors.length > 1 ? "s" : ""} before this can go live.`, action: { label: "Show me", run: () => setPanel("problems") } }
    : openCount ? { text: `Step 2 of 4. ${openCount} block${openCount > 1 ? "s" : ""} lead nowhere yet. Connect the pulsing dots, or pick the next block from the list.`, action: { label: "Show me", run: () => setPanel("problems") } }
    : status !== "published" ? { text: "Step 3 of 4. Looks good. Try it as a customer, then publish.", action: { label: "Preview", run: () => setPanel("preview") } }
    : needsRepublish ? { text: "You changed a live flow. Publish to send the changes to customers.", action: { label: "Publish changes", run: publish } }
    : { text: "Step 4 of 4. This flow is live. Test it on your own phone.", action: { label: "Test on WhatsApp", run: () => setPanel("test") } };

  const saveLabel = save === "saving" ? "Saving…" : save === "error" ? "Not saved" : "Saved";

  const sideContent = (
    <>
      {panel === "add" && (
        <div>
          <h2 className="mb-1 text-base font-extrabold text-slate-900">Add a block</h2>
          <p className="mb-4 text-xs text-slate-500">Tap to add, or drag onto the canvas. {selectedNode ? "It connects to the selected block automatically." : ""}</p>
          {(["Talk", "Ask", "Logic", "Act"] as const).map((g) => (
            <div key={g} className="mb-4">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g === "Talk" ? "Say something" : g === "Ask" ? "Ask the customer" : g === "Logic" ? "Decide and wait" : "Take action"}</p>
              <div className="grid gap-1.5">
                {PALETTE.filter((t) => NODE_META[t].group === g).map((t) => {
                  const m = NODE_META[t]; const Icon = m.icon;
                  return (
                    <button key={t} type="button" draggable onDragStart={(e) => { e.dataTransfer.setData("application/x-flow-block", t); e.dataTransfer.effectAllowed = "move"; }} onClick={() => addBlock(t)}
                      className="flex cursor-grab items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition hover:-translate-y-0.5 hover:border-[#25D366] hover:shadow-md active:scale-[0.98] active:cursor-grabbing">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.chip}`}><Icon className="h-4 w-4" aria-hidden /></span>
                      <span className="min-w-0"><span className="block text-sm font-bold text-slate-800">{m.label}</span><span className="block text-xs leading-snug text-slate-500">{m.help}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {panel === "inspect" && selectedNode && (
        <Inspector node={selectedNode} issues={issues.filter((i) => i.nodeId === selectedNode.id)} variables={variables} onChange={updateData} onDelete={deleteSelected} onClose={() => setPanel(null)} links={links} targets={targetOptions.filter((t) => t.id !== selectedNode.id)} onLink={setLink} />
      )}

      {panel === "preview" && (
        <div className="flex h-full min-h-0 flex-col">
          <h2 className="mb-1 text-base font-extrabold text-slate-900">Preview</h2>
          <p className="mb-3 text-xs text-slate-500">Reply like a customer. This runs your real flow, but nothing is sent to anyone.</p>
          <div className="min-h-0 flex-1"><Simulator definition={definition} exitKeywords={settings.exit_keywords} onVisit={setActive} /></div>
        </div>
      )}

      {panel === "settings" && (
        <div className="space-y-5">
          <h2 className="text-base font-extrabold text-slate-900">When does this start?</h2>
          <div role="radiogroup" aria-label="Trigger" className="grid gap-2">
            {([["keyword", "A customer sends a keyword", "For example “book” or “price”."], ["welcome", "A new customer says hello", "Only the first time someone messages you."], ["any", "Any message", "Starts whenever nothing else matches."]] as const).map(([v, t, d]) => (
              <button key={v} type="button" role="radio" aria-checked={settings.trigger_type === v} onClick={() => setSettings({ ...settings, trigger_type: v })}
                className={`rounded-xl border p-3 text-left transition ${settings.trigger_type === v ? "border-[#25D366] bg-emerald-50 ring-2 ring-[#25D366]/30" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <span className="block text-sm font-bold text-slate-800">{t}</span><span className="block text-xs text-slate-500">{d}</span>
              </button>
            ))}
          </div>
          {settings.trigger_type === "keyword" && (
            <div>
              <label htmlFor="kw" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Keywords (separate with commas)</label>
              <input id="kw" defaultValue={settings.keywords.join(", ")} onBlur={(e) => setSettings({ ...settings, keywords: [...new Set(e.target.value.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 20) })}
                placeholder="book, appointment, hi" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 sm:text-sm" />
            </div>
          )}
          <div>
            <label htmlFor="exitkw" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Words that stop the flow</label>
            <input id="exitkw" defaultValue={settings.exit_keywords.join(", ")} onBlur={(e) => setSettings({ ...settings, exit_keywords: [...new Set(e.target.value.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 20) })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 sm:text-sm" />
            <p className="mt-1 text-xs text-slate-500">Customers can type any of these at any time to leave the conversation.</p>
          </div>
        </div>
      )}

      {panel === "problems" && (
        <div>
          <h2 className="mb-1 text-base font-extrabold text-slate-900">{issues.length ? "Check your flow" : "Everything looks good"}</h2>
          {!issues.length && <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-5 w-5" aria-hidden /> No problems found. You can publish.</p>}
          <ul className="space-y-2">
            {issues.map((i, idx) => (
              <li key={idx}>
                <button type="button" disabled={!i.nodeId} onClick={() => i.nodeId && focusNode(i.nodeId)} className={`w-full rounded-xl border p-3 text-left transition ${i.level === "error" ? "border-rose-200 bg-rose-50 hover:bg-rose-100" : "border-amber-200 bg-amber-50 hover:bg-amber-100"}`}>
                  <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${i.level === "error" ? "text-rose-700" : "text-amber-700"}`}><AlertTriangle className="h-3.5 w-3.5" aria-hidden />{i.level === "error" ? "Must fix" : "Worth a look"}{i.nodeId ? ` · ${NODE_LABELS[nodes.find((n) => n.id === i.nodeId)?.type ?? "message"]}` : ""}</span>
                  <span className="mt-1 block text-sm text-slate-800">{i.message}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {panel === "test" && (
        <div className="space-y-4">
          <h2 className="text-base font-extrabold text-slate-900">Test on WhatsApp</h2>
          <p className="text-sm leading-relaxed text-slate-600">This sends the <strong>published</strong> flow to a real phone. WhatsApp only allows it if that phone messaged your number in the last 24 hours, so send “hi” from it first.</p>
          {status !== "published" && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Publish the flow first. Use Preview to test drafts.</p>}
          {needsRepublish && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">You have unpublished changes. The test uses the last published version.</p>}
          <div>
            <label htmlFor="tp" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Phone number with country code</label>
            <input id="tp" inputMode="tel" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+919876543210" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 sm:text-sm" />
          </div>
          <button type="button" onClick={testLive} disabled={busy === "test" || status !== "published" || testPhone.replace(/\D/g, "").length < 8} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1fb857] active:scale-[0.98] disabled:opacity-50">
            {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />} Send test
          </button>
        </div>
      )}
    </>
  );

  const tools: { id: Exclude<Panel, "inspect" | null>; label: string; icon: typeof Plus; badge?: number }[] = [
    { id: "add", label: "Add", icon: Plus },
    { id: "preview", label: "Preview", icon: Smartphone },
    { id: "problems", label: "Check", icon: AlertTriangle, badge: errors.length || warnings.length },
    { id: "settings", label: "Trigger", icon: Settings2 },
    { id: "test", label: "Test", icon: Send },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-50 lg:left-72">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5 sm:gap-3 sm:px-4">
        <Link href="/wa/flows" aria-label="Back to flows" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></Link>
        <input aria-label="Flow name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-base font-extrabold text-slate-900 outline-none focus:bg-slate-100 sm:max-w-sm" />
        <span role="status" className={`hidden items-center gap-1 text-xs font-semibold sm:flex ${save === "error" ? "text-rose-600" : "text-slate-400"}`}>
          {save === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : save === "saved" ? <Check className="h-3.5 w-3.5" aria-hidden /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}{saveLabel}
        </span>
        <span className={`hidden rounded-full px-2.5 py-1 text-xs font-bold sm:inline ${status === "published" ? (needsRepublish ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800") : "bg-slate-100 text-slate-600"}`}>
          {status === "published" ? (needsRepublish ? "Live · changes not published" : "Live") : "Draft"}
        </span>
        <button type="button" onClick={tidy} aria-label="Tidy up blocks" title="Tidy up blocks" className="hidden rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 sm:block"><Wand2 className="h-5 w-5" /></button>
        {status === "published" && !needsRepublish && <button type="button" onClick={unpublish} disabled={busy !== null} className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 sm:block">Turn off</button>}
        <button type="button" onClick={publish} disabled={busy !== null || (status === "published" && !needsRepublish)} className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1fb857] active:scale-95 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none">
          {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Rocket className="h-4 w-4" aria-hidden />}{status === "published" ? (needsRepublish ? "Publish changes" : "Published") : "Publish"}
        </button>
      </header>

      <div role="status" className="flex items-center gap-3 border-b border-slate-200 bg-emerald-50 px-3 py-2 text-sm text-slate-800 sm:px-4">
        <p className="min-w-0 flex-1 leading-snug">{guide.text}</p>
        {guide.action && <button type="button" onClick={guide.action.run} className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-black active:scale-95">{guide.action.label}</button>}
      </div>

      <div className="flex min-h-0 flex-1">
        <div ref={wrapper} className="relative min-w-0 flex-1" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={onDrop}>
          <ReactFlow
            nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_, n) => { setSelected(n.id); setPanel("inspect"); }} onPaneClick={() => { setSelected(null); setPanel((p) => (p === "inspect" ? null : p)); }}
            onInit={(inst) => {
              // Open on the start of the flow at a readable size, not the whole chain squeezed small.
              const first = [...nodes].sort((a, b) => a.position.y - b.position.y).slice(0, 4).map((n) => ({ id: n.id }));
              window.setTimeout(() => inst.fitView({ nodes: first, padding: 0.35, maxZoom: 1, minZoom: 0.7 }), 80);
            }}
            minZoom={0.2} maxZoom={1.5} deleteKeyCode={["Backspace", "Delete"]}
            connectionRadius={40} panOnScroll proOptions={{ hideAttribution: true }} defaultEdgeOptions={{ style: edgeStyle }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="#cbd5e1" />
            <Controls showInteractive={false} position="bottom-right" className="!mb-24 lg:!mb-3" />
          </ReactFlow>
          {toast && (
            <div role="status" className={`absolute left-1/2 top-3 z-10 max-w-[92%] -translate-x-1/2 animate-in fade-in slide-in-from-top-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg ${toast.tone === "ok" ? "bg-slate-900 text-white" : "bg-rose-600 text-white"}`}>{toast.text}</div>
          )}
        </div>

        {/* Desktop side panel */}
        <aside className={`hidden shrink-0 overflow-y-auto border-l border-slate-200 bg-white transition-all duration-300 lg:block ${panel ? "w-[380px] p-5" : "w-0 overflow-hidden border-0 p-0"}`}>
          {panel && wide && (<>{panel !== "inspect" && <button type="button" onClick={() => setPanel(null)} aria-label="Close panel" className="float-right -mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>}{sideContent}</>)}
        </aside>
      </div>

      {/* Desktop toolbar */}
      <nav aria-label="Flow tools" className="absolute bottom-0 left-0 right-0 z-20 flex justify-around border-t border-slate-200 bg-white/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:bottom-4 lg:left-4 lg:right-auto lg:rounded-2xl lg:border lg:px-2 lg:pb-1 lg:shadow-lg">
        {tools.map((t) => {
          const Icon = t.icon; const on = panel === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setPanel(on ? null : t.id)} aria-pressed={on}
              className={`relative flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition active:scale-95 lg:flex-row lg:gap-2 lg:text-xs ${on ? "bg-emerald-50 text-[#128C7E]" : "text-slate-500 hover:bg-slate-100"}`}>
              <Icon className="h-5 w-5" aria-hidden />{t.label}
              {!!t.badge && <span className={`absolute right-1.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] text-white ${errors.length ? "bg-rose-500" : "bg-amber-500"}`}>{t.badge}</span>}
            </button>
          );
        })}
        <button type="button" onClick={tidy} className="flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-slate-500 transition hover:bg-slate-100 active:scale-95 sm:hidden"><Wand2 className="h-5 w-5" aria-hidden />Tidy</button>
      </nav>

      {/* Mobile bottom sheet */}
      {panel && !wide && (
        <div className="fixed inset-0 z-30 flex items-end bg-slate-900/30 lg:hidden" onClick={() => setPanel(null)}>
          <div role="dialog" aria-modal="true" className="max-h-[78vh] w-full animate-in slide-in-from-bottom overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
            {panel !== "inspect" && <button type="button" onClick={() => setPanel(null)} aria-label="Close" className="float-right -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>}
            {sideContent}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FlowEditor(props: Props) {
  return <ReactFlowProvider><Editor {...props} /></ReactFlowProvider>;
}
