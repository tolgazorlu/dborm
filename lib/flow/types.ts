import type { Edge, Node } from "@xyflow/react";

import type { ParsedTable } from "@/lib/orm/types";

export type TableNodeData = {
  table: ParsedTable;
  highlightedColumns: string[];
  isDimmed: boolean;
};

export type TableNode = Node<TableNodeData, "table">;

export type RelationEdgeData = {
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
