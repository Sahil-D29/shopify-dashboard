export interface LayoutNode<T = unknown> {
  id: string;
  position: { x: number; y: number };
  data?: T;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

/** Produce a stable top-to-bottom layout without changing nodes or execution edges. */
export function arrangeJourneyNodes<T extends LayoutNode>(nodes: T[], edges: LayoutEdge[]): T[] {
  if (nodes.length < 2) return nodes.map(node => ({ ...node, position: { ...node.position } }));

  const ids = new Set(nodes.map(node => node.id));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  nodes.forEach(node => incoming.set(node.id, 0));
  edges.forEach(edge => {
    if (!ids.has(edge.source) || !ids.has(edge.target)) return;
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  });

  const roots = nodes.filter(node => (incoming.get(node.id) ?? 0) === 0).map(node => node.id);
  const queue = roots.length ? roots : [nodes[0].id];
  const level = new Map<string, number>(queue.map(id => [id, 0]));
  const seen = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const nextLevel = (level.get(current) ?? 0) + 1;
    for (const target of outgoing.get(current) ?? []) {
      level.set(target, Math.max(level.get(target) ?? 0, nextLevel));
      queue.push(target);
    }
  }

  let fallbackLevel = Math.max(0, ...level.values()) + 1;
  nodes.forEach(node => {
    if (!level.has(node.id)) level.set(node.id, fallbackLevel++);
  });

  const byLevel = new Map<number, T[]>();
  nodes.forEach(node => {
    const depth = level.get(node.id) ?? 0;
    byLevel.set(depth, [...(byLevel.get(depth) ?? []), node]);
  });

  const horizontalGap = 360;
  const verticalGap = 280;
  const positioned = new Map<string, { x: number; y: number }>();
  for (const [depth, levelNodes] of [...byLevel.entries()].sort(([a], [b]) => a - b)) {
    levelNodes.sort((a, b) => a.position.x - b.position.x || a.id.localeCompare(b.id));
    const width = (levelNodes.length - 1) * horizontalGap;
    levelNodes.forEach((node, index) => {
      positioned.set(node.id, { x: index * horizontalGap - width / 2, y: depth * verticalGap });
    });
  }

  return nodes.map(node => ({ ...node, position: positioned.get(node.id) ?? node.position }));
}
