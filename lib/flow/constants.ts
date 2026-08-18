import { Position } from "@xyflow/react";

import type { ParsedTable } from "@/lib/orm/types";

export const NODE_WIDTH = 288;
export const HEADER_HEIGHT = 44;
export const ROW_HEIGHT = 28;
export const NODE_PADDING = 8;

export function nodeHeight(table: ParsedTable): number {
  return HEADER_HEIGHT + table.columns.length * ROW_HEIGHT + NODE_PADDING;
}

export const TABLE_ANCHOR = "__table__";

export type HandleSide = "left" | "right";

export function sourceHandleId(columnKey: string, side: HandleSide): string {
  return `${columnKey}:source:${side}`;
}

export function targetHandleId(columnKey: string, side: HandleSide): string {
  return `${columnKey}:target:${side}`;
}

export function tableHandles(table: ParsedTable): {
  id: string;
  type: "source" | "target";
  position: Position;
  x: number;
  y: number;
  width: number;
  height: number;
}[] {
  const rows: { key: string; centerY: number }[] = [
    { key: TABLE_ANCHOR, centerY: HEADER_HEIGHT / 2 },
    ...table.columns.map((column, index) => ({
      key: column.key,
      centerY: HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2,
    })),
  ];

  return rows.flatMap(({ key, centerY }) =>
    (["left", "right"] as const).flatMap((side) => {
      const x = side === "left" ? 0 : NODE_WIDTH;
      const position = side === "left" ? Position.Left : Position.Right;
      return [
        { id: sourceHandleId(key, side), type: "source" as const, position, x, y: centerY, width: 1, height: 1 },
        { id: targetHandleId(key, side), type: "target" as const, position, x, y: centerY, width: 1, height: 1 },
      ];
    }),
  );
}
