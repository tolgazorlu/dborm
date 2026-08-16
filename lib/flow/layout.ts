import { Graph, layout } from "@dagrejs/dagre";

import { NODE_WIDTH, nodeHeight } from "./constants";
import type { RelationEdge, TableNode } from "./types";

export type LayoutDirection = "LR" | "TB";

/**
 * Dagre ile katmanlı yerleşim. Dagre koordinatları node'un **merkezini**
 * verir; React Flow ise sol-üst köşeyi ister, bu yüzden yarı boyut çıkarılır.
 *
 * Kullanıcının sürüklediği konumlar burada değil, canvas bileşeninde korunur
 * (bkz. `schema-canvas.tsx`): yerleşim saf bir fonksiyon olarak kalsın diye.
 */
export function layoutGraph(
  nodes: TableNode[],
  edges: RelationEdge[],
  direction: LayoutDirection = "LR",
): TableNode[] {
  if (nodes.length === 0) return nodes;

  const graph = new Graph({ multigraph: true, directed: true });
  graph.setGraph({
    rankdir: direction,
    nodesep: 48,
    ranksep: 140,
    marginx: 32,
    marginy: 32,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: nodeHeight(node.data.table) });
  }
  for (const edge of edges) {
    // Ok yönü çocuk → ebeveyn; dagre'de ebeveyni sola almak için ters bağlıyoruz.
    graph.setEdge(edge.target, edge.source, {}, edge.id);
  }

  layout(graph);

  return nodes.map((node) => {
    const positioned = graph.node(node.id);
    if (!positioned) return node;

    return {
      ...node,
      position: {
        x: positioned.x - NODE_WIDTH / 2,
        y: positioned.y - nodeHeight(node.data.table) / 2,
      },
    };
  });
}
