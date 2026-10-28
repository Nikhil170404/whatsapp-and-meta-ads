import type { FlowDefinition, FlowNode } from "./types";

const COL = 320; // horizontal spacing between blocks
const GAP = 70; // vertical space between levels

/** Rough card height on the canvas, so tall blocks (menus, buttons) do not overlap the next level. */
function heightOf(n: FlowNode): number {
  const d = n.data as any;
  if (n.type === "buttons") return 130 + 42 * (d.buttons?.length ?? 2);
  if (n.type === "list") return 130 + 42 * Math.min(d.rows?.length ?? 2, 10);
  if (n.type === "question" || n.type === "location" || n.type === "pay") return 150;
  return 120;
}

/**
 * Tidies a flow top to bottom: each block sits one level below the blocks that lead to it, and
 * blocks on the same level are ordered by where their parents are, which keeps lines from crossing.
 * Blocks not connected to the Start are placed in a row underneath.
 */
export function autoLayout(def: FlowDefinition): FlowDefinition {
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const start = def.nodes.find((n) => n.type === "start");
  if (!start) return def;

  // Level = longest path from the start, ignoring edges that would make a cycle.
  const level = new Map<string, number>([[start.id, 0]]);
  const order: string[] = [start.id];
  for (let pass = 0; pass < def.nodes.length; pass++) {
    let changed = false;
    for (const e of def.edges) {
      if (!level.has(e.source) || !byId.has(e.target)) continue;
      const next = level.get(e.source)! + 1;
      if (next > (level.get(e.target) ?? -1) && next <= def.nodes.length) {
        level.set(e.target, next);
        if (!order.includes(e.target)) order.push(e.target);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const levels = new Map<number, string[]>();
  for (const id of order) levels.set(level.get(id)!, [...(levels.get(level.get(id)!) ?? []), id]);

  const x = new Map<string, number>([[start.id, 0]]);
  const maxLevel = Math.max(...levels.keys());
  for (let l = 0; l <= maxLevel; l++) {
    const ids = levels.get(l) ?? [];
    const key = (id: string) => {
      const parents = def.edges.filter((e) => e.target === id && x.has(e.source)).map((e) => x.get(e.source)!);
      return parents.length ? parents.reduce((a, b) => a + b, 0) / parents.length : 0;
    };
    ids.sort((a, b) => key(a) - key(b));
    ids.forEach((id, i) => x.set(id, (i - (ids.length - 1) / 2) * COL));
  }

  const top = new Map<number, number>();
  let y = 0;
  for (let l = 0; l <= maxLevel; l++) {
    top.set(l, y);
    y += Math.max(...(levels.get(l) ?? []).map((id) => heightOf(byId.get(id)!)), 0) + GAP;
  }

  const placed = new Set(order);
  const loose = def.nodes.filter((n) => !placed.has(n.id));
  return {
    edges: def.edges,
    nodes: def.nodes.map((n) => {
      if (placed.has(n.id)) return { ...n, position: { x: x.get(n.id) ?? 0, y: top.get(level.get(n.id)!) ?? 0 } };
      const i = loose.indexOf(n);
      return { ...n, position: { x: i * COL, y: y + GAP } };
    }),
  };
}
