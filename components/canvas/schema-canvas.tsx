"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type NodeMouseHandler,
  type OnNodeDrag,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import "@xyflow/react/dist/style.css";

import { useI18n } from "@/components/i18n-provider";
import { useTheme } from "@/components/theme-provider";
import { NODE_WIDTH } from "@/lib/flow/constants";
import { attachHandles } from "@/lib/flow/to-flow";
import type { RelationEdge, TableNode } from "@/lib/flow/types";
import { readFlowPalette } from "@/lib/theme/read-palette";
import TableNodeView from "./table-node";

const nodeTypes = { table: TableNodeView };

export interface SchemaCanvasProps {
  nodes: TableNode[];
  edges: RelationEdge[];
  layoutVersion: number;
  fitSignal: number;
  onTableSelected?: (tableId: string | null) => void;
}

function CanvasInner({
  nodes: incoming,
  edges: incomingEdges,
  layoutVersion,
  fitSignal,
  onTableSelected,
}: SchemaCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<TableNode>(incoming);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RelationEdge>(incomingEdges);
  const { setViewport, getNodes } = useReactFlow<TableNode, RelationEdge>();
  const { theme } = useTheme();
  const gridDot = useMemo(() => readFlowPalette(theme).gridDot, [theme]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fitTo = useCallback(
    (list: TableNode[]) => {
      const element = containerRef.current;
      if (!element || list.length === 0) return;

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const node of list) {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + (node.width ?? NODE_WIDTH));
        maxY = Math.max(maxY, node.position.y + (node.height ?? 0));
      }

      const graphWidth = Math.max(maxX - minX, 1);
      const graphHeight = Math.max(maxY - minY, 1);
      const padding = 1.25;
      const zoom = Math.min(
        rect.width / (graphWidth * padding),
        rect.height / (graphHeight * padding),
        1.4,
      );

      setViewport({
        x: rect.width / 2 - (minX + graphWidth / 2) * zoom,
        y: rect.height / 2 - (minY + graphHeight / 2) * zoom,
        zoom,
      });
    },
    [setViewport],
  );

  const draggedPositions = useRef<Record<string, { x: number; y: number }>>({});
  const appliedLayoutVersion = useRef(layoutVersion);
  const lastSignature = useRef("");
  const currentNodes = useRef<TableNode[]>(incoming);

  useEffect(() => {
    const isRelayout = appliedLayoutVersion.current !== layoutVersion;
    if (isRelayout) {
      appliedLayoutVersion.current = layoutVersion;
      draggedPositions.current = {};
    }

    const kept = draggedPositions.current;
    const merged = incoming.map((node) =>
      kept[node.id] ? { ...node, position: kept[node.id] } : node,
    );

    setNodes(merged);
    setEdges(attachHandles(merged, incomingEdges));
    currentNodes.current = merged;

    const signature = merged.map((node) => node.id).join("|");
    if (!isRelayout && signature === lastSignature.current) return;

    const run = () => {
      lastSignature.current = signature;
      fitTo(merged);
    };

    if (document.visibilityState !== "visible") {
      const onVisible = () => {
        if (document.visibilityState !== "visible") return;
        document.removeEventListener("visibilitychange", onVisible);
        run();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }

    const timer = setTimeout(run, 0);
    return () => clearTimeout(timer);
  }, [incoming, incomingEdges, layoutVersion, setNodes, setEdges, fitTo]);

  const firstFitSignal = useRef(fitSignal);

  useEffect(() => {
    if (firstFitSignal.current === fitSignal) return;
    const timer = setTimeout(() => fitTo(currentNodes.current), 0);
    return () => clearTimeout(timer);
  }, [fitSignal, fitTo]);

  const handleDragStop = useCallback<OnNodeDrag<TableNode>>(
    (_event, node) => {
      draggedPositions.current[node.id] = node.position;
      const current = getNodes();
      currentNodes.current = current;
      setEdges((existing) => attachHandles(current, existing));
    },
    [getNodes, setEdges],
  );

  const handleNodeClick = useCallback<NodeMouseHandler<TableNode>>(
    (_event, node) => onTableSelected?.(node.id),
    [onTableSelected],
  );

  return (
    <div ref={containerRef} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleDragStop}
        onNodeClick={handleNodeClick}
        onPaneClick={() => onTableSelected?.(null)}
        onError={(code, message) => console.warn(`[React Flow ${code}]`, message)}
        colorMode={theme}
        minZoom={0.1}
        maxZoom={2}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={gridDot} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          maskColor={theme === "dark" ? "rgba(10, 12, 17, 0.75)" : "rgba(246, 247, 249, 0.75)"}
          nodeColor={() => readFlowPalette(theme).fk}
        />
      </ReactFlow>
    </div>
  );
}

export default function SchemaCanvas(props: SchemaCanvasProps) {
  const { t } = useI18n();

  return (
    <div className="absolute inset-0 bg-bg">
      {props.nodes.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-fg-muted">{t.canvas.emptyTitle}</p>
          <p className="max-w-xs text-xs text-fg-faint">{t.canvas.emptyHint}</p>
        </div>
      ) : (
        <ReactFlowProvider>
          <CanvasInner {...props} />
        </ReactFlowProvider>
      )}
    </div>
  );
}
