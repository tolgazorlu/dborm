import type { Edge, Node } from "@xyflow/react";

import type { ParsedTable } from "@/lib/orm/types";

/**
 * React Flow, node/edge `data` alanının `Record<string, unknown>` ile uyumlu
 * olmasını ister. Bu yüzden `interface` değil `type` kullanılıyor (TypeScript
 * yalnızca type alias'lara örtük index signature verir).
 */
export type TableNodeData = {
  table: ParsedTable;
  /** AI bulgusu ya da hover ile vurgulanan kolonlar */
  highlightedColumns: string[];
  isDimmed: boolean;
};

export type TableNode = Node<TableNodeData, "table">;

export type RelationEdgeData = {
  /** `fk`: veritabanı seviyesinde kısıt var. `logical`: sadece relations() tanımı. */
  kind: "fk" | "logical";
  cardinality: "1:1" | "N:1";
  onDelete?: string;
  sourceColumn?: string;
  targetColumn?: string;
};

export type RelationEdge = Edge<RelationEdgeData>;

export interface FlowGraph {
  nodes: TableNode[];
  edges: RelationEdge[];
}
