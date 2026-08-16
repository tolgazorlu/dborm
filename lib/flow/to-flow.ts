import { MarkerType } from "@xyflow/react";

import type { ParsedSchema, ParsedTable } from "@/lib/orm/types";
import type { FlowPalette } from "@/lib/theme/read-palette";
import {
  NODE_WIDTH,
  TABLE_ANCHOR,
  nodeHeight,
  sourceHandleId,
  tableHandles,
  targetHandleId,
} from "./constants";
import { layoutGraph, type LayoutDirection } from "./layout";
import type { FlowGraph, RelationEdge, RelationEdgeData, TableNode } from "./types";

export interface BuildFlowOptions {
  direction?: LayoutDirection;
  /** Vurgulanacak tablo → kolon anahtarları. Boşsa hiçbir şey soluklaştırılmaz. */
  highlight?: Record<string, string[]>;
  /** Aktif temanın ok renkleri (React Flow CSS sınıfı değil, düz renk ister). */
  palette: FlowPalette;
}

/**
 * ParsedSchema → React Flow node/edge grafiği.
 *
 * İki tür ok üretilir:
 *  - **fk**: `.references()` / `foreignKey()` ile tanımlı, veritabanı seviyesinde
 *    garanti edilen ilişki (düz çizgi).
 *  - **logical**: yalnızca `relations()` içinde tanımlı, FK karşılığı olmayan
 *    ilişki (kesik çizgi). Bu ayrım, "relation var ama FK yok" hatasını
 *    diyagramda anında görünür kılar.
 */
export function buildFlow(schema: ParsedSchema, options: BuildFlowOptions): FlowGraph {
  const { direction = "LR", highlight, palette } = options;

  const tables = new Map(schema.tables.map((table) => [table.id, table]));
  const highlightActive = Boolean(highlight && Object.keys(highlight).length > 0);

  const nodes: TableNode[] = schema.tables.map((table) => ({
    id: table.id,
    type: "table",
    position: { x: 0, y: 0 },
    // Boyutları zaten kendimiz hesaplıyoruz (dagre için). Node'a da yazınca
    // React Flow ölçüm beklemeden doğru `fitView` yapabiliyor.
    width: NODE_WIDTH,
    height: nodeHeight(table),
    handles: tableHandles(table),
    data: {
      table,
      highlightedColumns: highlight?.[table.id] ?? [],
      isDimmed: highlightActive && !highlight?.[table.id],
    },
  }));

  const edges: RelationEdge[] = [];
  const columnPairs = new Set<string>();
  const tablePairs = new Set<string>();

  // 1) Veritabanı seviyesindeki foreign key'ler.
  for (const table of schema.tables) {
    for (const column of table.columns) {
      const reference = column.reference;
      if (!reference || !tables.has(reference.table)) continue;

      const pair = `${table.id}.${column.key}->${reference.table}.${reference.column}`;
      if (columnPairs.has(pair)) continue;
      columnPairs.add(pair);
      tablePairs.add(unordered(table.id, reference.table));

      edges.push(
        makeEdge(palette, `fk:${pair}`, table.id, reference.table, {
          // Adlandırmadan çıkarılan referanslar (Kysely) "kesin" değildir.
          kind: reference.isInferred ? "logical" : "fk",
          cardinality: isUniqueColumn(table, column.key) ? "1:1" : "N:1",
          onDelete: reference.onDelete,
          sourceColumn: column.key,
          targetColumn: reference.column,
        }),
      );
    }
  }

  // 2) relations() içinde tanımlı ama FK karşılığı olmayan mantıksal ilişkiler.
  for (const relation of schema.relations) {
    if (!tables.has(relation.sourceTable) || !tables.has(relation.targetTable)) continue;

    // FK'yi tutan taraf: `one` ise kaynak, `many` ise hedef tablo.
    const child = relation.kind === "one" ? relation.sourceTable : relation.targetTable;
    const parent = relation.kind === "one" ? relation.targetTable : relation.sourceTable;
    const childColumn = relation.kind === "one" ? relation.fields[0] : undefined;
    const parentColumn = relation.kind === "one" ? relation.references[0] : undefined;

    if (childColumn && parentColumn) {
      const pair = `${child}.${childColumn}->${parent}.${parentColumn}`;
      if (columnPairs.has(pair)) continue;
      columnPairs.add(pair);
      tablePairs.add(unordered(child, parent));

      edges.push(
        makeEdge(palette, `rel:${relation.id}`, child, parent, {
          kind: "logical",
          cardinality: isUniqueColumn(tables.get(child), childColumn) ? "1:1" : "N:1",
          sourceColumn: childColumn,
          targetColumn: parentColumn,
        }),
      );
      continue;
    }

    // Kolon bilgisi yok (`many(...)` ya da fields'sız `one(...)`): iki tablo
    // arasında zaten bir ok varsa tekrar çizme, yoksa tablo seviyesinde çiz.
    const key = unordered(child, parent);
    if (tablePairs.has(key)) continue;
    tablePairs.add(key);

    edges.push(
      makeEdge(palette, `rel:${relation.id}`, child, parent, {
        kind: "logical",
        cardinality: relation.kind === "many" ? "N:1" : "1:1",
      }),
    );
  }

  const positioned = layoutGraph(nodes, edges, direction);
  return { nodes: positioned, edges: attachHandles(positioned, edges) };
}

function makeEdge(
  palette: FlowPalette,
  id: string,
  source: string,
  target: string,
  data: RelationEdgeData,
): RelationEdge {
  const color = data.kind === "fk" ? palette.fk : palette.logical;

  return {
    id,
    source,
    target,
    type: "smoothstep",
    data,
    label: data.onDelete ? `${data.cardinality} · ${data.onDelete}` : data.cardinality,
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: palette.labelBg, fillOpacity: 0.92 },
    labelStyle: { fill: color, fontSize: 10, fontWeight: 600 },
    style: {
      stroke: color,
      strokeWidth: 1.5,
      strokeDasharray: data.kind === "logical" ? "6 4" : undefined,
    },
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
  };
}

/**
 * Yerleşim bittikten sonra okların hangi kenardan çıkacağını belirler:
 * hedef sağdaysa sağ tutamaçtan çık, solundaysa sol tutamaçtan. Böylece
 * çizgiler node'un etrafında dolanmaz.
 *
 * Kullanıcı bir tabloyu sürükleyince canvas bunu yeniden çağırır; oklar
 * anında doğru kenara geçer.
 */
export function attachHandles(nodes: TableNode[], edges: RelationEdge[]): RelationEdge[] {
  const x = new Map(nodes.map((node) => [node.id, node.position.x]));

  return edges.map((edge) => {
    const sourceSide = (x.get(edge.source) ?? 0) <= (x.get(edge.target) ?? 0) ? "right" : "left";
    const targetSide = sourceSide === "right" ? "left" : "right";

    return {
      ...edge,
      sourceHandle: sourceHandleId(edge.data?.sourceColumn ?? TABLE_ANCHOR, sourceSide),
      targetHandle: targetHandleId(edge.data?.targetColumn ?? TABLE_ANCHOR, targetSide),
    };
  });
}

function isUniqueColumn(table: ParsedTable | undefined, columnKey: string | undefined): boolean {
  if (!table || !columnKey) return false;
  const column = table.columns.find((item) => item.key === columnKey);
  if (!column) return false;
  if (column.isPrimaryKey || column.isUnique) return true;
  return table.indexes.some(
    (index) => index.isUnique && index.columns.length === 1 && index.columns[0] === columnKey,
  );
}

function unordered(a: string, b: string): string {
  return [a, b].sort().join("|");
}
