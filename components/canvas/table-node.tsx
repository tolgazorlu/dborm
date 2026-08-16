"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import {
  HEADER_HEIGHT,
  NODE_WIDTH,
  ROW_HEIGHT,
  TABLE_ANCHOR,
  sourceHandleId,
  targetHandleId,
} from "@/lib/flow/constants";
import type { TableNode as TableNodeType } from "@/lib/flow/types";
import type { ParsedColumn } from "@/lib/orm/types";

/**
 * Her kolon satırı kendi tutamaçlarını (Handle) taşır. Tutamaçlar satırın
 * içinde `position: absolute` ile konumlandığı için oklar tam olarak ilgili
 * kolonun hizasından çıkar — dbdiagram.io'daki his bundan geliyor.
 *
 * Satır başına 4 tutamaç var (sol/sağ × source/target). Hangisinin
 * kullanılacağına yerleşimden sonra `to-flow.ts` karar veriyor.
 */
function ColumnHandles({ columnKey }: { columnKey: string }) {
  const style = { opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: "none" };

  return (
    <>
      <Handle type="target" position={Position.Left} id={targetHandleId(columnKey, "left")} style={style} isConnectable={false} />
      <Handle type="source" position={Position.Left} id={sourceHandleId(columnKey, "left")} style={style} isConnectable={false} />
      <Handle type="target" position={Position.Right} id={targetHandleId(columnKey, "right")} style={style} isConnectable={false} />
      <Handle type="source" position={Position.Right} id={sourceHandleId(columnKey, "right")} style={style} isConnectable={false} />
    </>
  );
}

function KeyIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3 shrink-0"
      style={{ color: "var(--sev-medium)" }}
      fill="currentColor"
      aria-label="birincil anahtar"
    >
      <path d="M10 1a5 5 0 0 0-4.9 6L1 11.1V15h3.9l1-1v-1.5h1.5l1-1V10h1L10 9.9A5 5 0 1 0 10 1Zm1.5 3.5a1 1 0 1 1-1.4 1.4 1 1 0 0 1 1.4-1.4Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3 shrink-0 text-accent"
      fill="currentColor"
      aria-label="yabancı anahtar"
    >
      <path d="M6.6 9.4a2.5 2.5 0 0 1 0-3.5l2-2a2.5 2.5 0 0 1 3.5 3.5l-.9.9a.75.75 0 1 1-1-1l.8-1a1 1 0 0 0-1.4-1.4l-2 2a1 1 0 0 0 0 1.4.75.75 0 0 1-1 1Zm2.8-2.8a2.5 2.5 0 0 1 0 3.5l-2 2a2.5 2.5 0 0 1-3.5-3.5l.9-.9a.75.75 0 1 1 1 1l-.8 1a1 1 0 0 0 1.4 1.4l2-2a1 1 0 0 0 0-1.4.75.75 0 0 1 1-1Z" />
    </svg>
  );
}

function ColumnRow({ column, isHighlighted }: { column: ParsedColumn; isHighlighted: boolean }) {
  return (
    <div
      className="relative flex items-center gap-1.5 px-3 text-[11px] odd:bg-row-stripe"
      style={{ height: ROW_HEIGHT, background: isHighlighted ? "var(--row-highlight)" : undefined }}
    >
      <ColumnHandles columnKey={column.key} />

      {column.isPrimaryKey ? (
        <KeyIcon />
      ) : column.reference ? (
        <LinkIcon />
      ) : (
        <span className="size-3 shrink-0" />
      )}

      <span className="truncate font-medium text-fg">{column.name}</span>

      {column.isNotNull && !column.isPrimaryKey ? (
        <span
          className="text-[9px] font-semibold"
          style={{ color: "var(--sev-critical)" }}
          title="NOT NULL"
        >
          *
        </span>
      ) : null}
      {column.isUnique ? (
        <span
          className="text-[9px] font-semibold"
          style={{ color: "var(--sev-low)" }}
          title="UNIQUE"
        >
          U
        </span>
      ) : null}

      <span className="ml-auto truncate font-mono text-[10px] text-fg-faint">
        {column.displayType}
      </span>
    </div>
  );
}

function TableNode({ data, selected }: NodeProps<TableNodeType>) {
  const { table, highlightedColumns, isDimmed } = data;

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-surface shadow-lg transition-opacity ${
        selected ? "border-accent" : "border-line-strong"
      } ${isDimmed ? "opacity-35" : "opacity-100"}`}
      style={{ width: NODE_WIDTH }}
    >
      <div
        className="relative flex items-center gap-2 border-b border-line px-3"
        style={{
          height: HEADER_HEIGHT,
          background: "linear-gradient(90deg, var(--node-header-from), var(--node-header-to))",
        }}
      >
        <ColumnHandles columnKey={TABLE_ANCHOR} />
        <span className="truncate text-sm font-semibold text-fg">{table.name}</span>
        <span className="ml-auto shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-fg-muted">
          {table.columns.length}
        </span>
      </div>

      <div>
        {table.columns.map((column) => (
          <ColumnRow
            key={column.key}
            column={column}
            isHighlighted={highlightedColumns.includes(column.key)}
          />
        ))}
      </div>

      {table.compositePrimaryKey.length > 0 || table.indexes.length > 0 ? (
        <div className="border-t border-line bg-surface-2 px-3 py-1.5 text-[9px] leading-relaxed text-fg-faint">
          {table.compositePrimaryKey.length > 0 ? (
            <div>PK ({table.compositePrimaryKey.join(", ")})</div>
          ) : null}
          {table.indexes.map((index, position) => (
            <div key={index.name ?? position}>
              {index.isUnique ? "UNIQUE " : ""}INDEX ({index.columns.join(", ")})
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default memo(TableNode);
