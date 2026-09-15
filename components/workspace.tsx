"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import SignOutButton from "@/components/auth/sign-out-button";
import Wordmark from "@/components/ui/wordmark";
import SchemaCanvas from "@/components/canvas/schema-canvas";
import SchemaEditor from "@/components/editor/schema-editor";
import { useI18n } from "@/components/i18n-provider";
import LocaleToggle from "@/components/locale-toggle";
import AnalysisPanel from "@/components/panels/analysis-panel";
import ChecksPanel from "@/components/panels/checks-panel";
import ShareDialog from "@/components/share/share-dialog";
import { useTheme } from "@/components/theme-provider";
import ThemeToggle from "@/components/theme-toggle";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import IconButton, { iconButtonClass } from "@/components/ui/icon-button";
import {
  CloseIcon,
  EditorIcon,
  HorizontalIcon,
  ImportIcon,
  LegalIcon,
  PanelIcon,
  RelayoutIcon,
  ResetIcon,
  VerticalIcon,
} from "@/components/ui/icons";
import type { LayoutDirection } from "@/lib/flow/layout";
import { buildFlow } from "@/lib/flow/to-flow";
import { useParsedSchema } from "@/lib/hooks/use-parsed-schema";
import { ORM_CATALOG, ORM_LIST, initialSources } from "@/lib/orm/catalog";
import { MAX_IMPORTED_FILES, normalizeFileName, workspaceFiles } from "@/lib/orm/files";
import { ORM_IDS, type OrmId } from "@/lib/orm/types";
import { MAX_SOURCE_BYTES } from "@/lib/security/body";
import { clearWorkspace, readWorkspace, writeWorkspace } from "@/lib/storage/workspace";
import { readFlowPalette } from "@/lib/theme/read-palette";

type PanelTab = "checks" | "ai";

export interface WorkspaceProps {
  initialOrm?: OrmId;
  initialSources?: Record<string, string>;
  showSignOut?: boolean;
  showLegal?: boolean;
}

export default function Workspace({
  initialOrm = "drizzle",
  initialSources: sharedSources,
  showSignOut = false,
  showLegal = false,
}: WorkspaceProps) {
  const { t, locale } = useI18n();
  const { theme } = useTheme();

  const [orm, setOrm] = useState<OrmId>(initialOrm);
  const [sources, setSources] = useState<Record<OrmId, Record<string, string>>>(() => {
    const base = initialSources();
    if (sharedSources) base[initialOrm] = { ...base[initialOrm], ...sharedSources };
    return base;
  });

  const [activeFile, setActiveFile] = useState(ORM_CATALOG[orm].files[0].key);
  const [panelTab, setPanelTab] = useState<PanelTab>("checks");
  const [direction, setDirection] = useState<LayoutDirection>("LR");
  const [highlight, setHighlight] = useState<Record<string, string[]>>({});
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [showEditor, setShowEditor] = useState(true);
  const [showPanel, setShowPanel] = useState(true);
  const [fitSignal, setFitSignal] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openedFromShare = sharedSources !== undefined;

  useEffect(() => {
    if (openedFromShare) return;

    const stored = readWorkspace();
    if (!stored) return;

    setOrm(stored.orm);
    setActiveFile(ORM_CATALOG[stored.orm].files[0].key);
    setSources((previous) => {
      const merged = { ...previous };
      for (const id of ORM_IDS) merged[id] = { ...previous[id], ...stored.sources[id] };
      return merged;
    });
  }, [openedFromShare]);

  useEffect(() => {
    const timer = setTimeout(() => writeWorkspace({ orm, sources }), 500);
    return () => clearTimeout(timer);
  }, [orm, sources]);

  const resetToSamples = useCallback(() => {
    clearWorkspace();
    const base = initialSources();
    setSources(base);
    setActiveFile(ORM_CATALOG[orm].files[0].key);
    setHighlight({});
  }, [orm]);

  const currentSources = sources[orm];
  const { schema, staticFindings, isParsing, error } = useParsedSchema(orm, currentSources, locale);

  // Reading dropped files is asynchronous; this is what the workspace holds
  // once the read finishes, rather than what it held when the drop started.
  const sourcesRef = useRef(sources);
  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  const { nodes, edges } = useMemo(
    () => buildFlow(schema, { direction, highlight, palette: readFlowPalette(theme) }),
    [schema, direction, highlight, theme],
  );

  const handleOrmChange = useCallback((next: OrmId) => {
    setOrm(next);
    setActiveFile(ORM_CATALOG[next].files[0].key);
    setHighlight({});
  }, []);

  const handleSourceChange = useCallback(
    (fileKey: string, value: string) => {
      setSources((previous) => ({ ...previous, [orm]: { ...previous[orm], [fileKey]: value } }));
      setImportNotice(null);
    },
    [orm],
  );

  const handleHover = useCallback((table: string | null, columns: string[]) => {
    setHighlight(table ? { [table]: columns } : {});
  }, []);

  const files = useMemo(() => workspaceFiles(orm, currentSources), [orm, currentSources]);
  const openFile = files.find((file) => file.key === activeFile) ?? files[0];

  /**
   * Reads dropped or picked files into new editor tabs. A file whose name
   * matches one of the ORM's own tabs replaces that tab instead of adding a
   * duplicate, so importing `schema.ts` does what you would expect.
   */
  const importFiles = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return;

      const builtIn = ORM_CATALOG[orm].files;
      const accepted: { key: string; name: string; content: string }[] = [];
      const rejected: string[] = [];
      const unreadable: string[] = [];

      for (const file of incoming) {
        const name = normalizeFileName(file.name);
        if (!name) {
          rejected.push(file.name);
          continue;
        }

        try {
          const content = await file.text();
          const match = builtIn.find((item) => item.name === name);
          accepted.push({ key: match ? match.key : name, name, content });
        } catch {
          unreadable.push(file.name);
        }
      }

      const notices: string[] = [];
      if (rejected.length > 0) notices.push(t.editor.rejected(rejected.join(", ")));
      if (unreadable.length > 0) notices.push(t.editor.unreadable(unreadable.join(", ")));

      if (accepted.length > 0) {
        const builtInKeys = new Set(builtIn.map((item) => item.key));
        const added = Object.fromEntries(accepted.map((file) => [file.key, file.content]));
        const merged = { ...sourcesRef.current[orm], ...added };

        const importedCount = Object.keys(merged).filter((key) => !builtInKeys.has(key)).length;
        const totalBytes = Object.values(merged).reduce((sum, value) => sum + value.length, 0);

        if (importedCount > MAX_IMPORTED_FILES) {
          notices.push(t.editor.tooManyFiles(MAX_IMPORTED_FILES));
        } else if (totalBytes > MAX_SOURCE_BYTES) {
          notices.push(t.editor.tooLarge(MAX_SOURCE_BYTES / 1024));
        } else {
          // Merge into the current state, not into the snapshot this callback
          // closed over, so edits made while the files were read survive.
          setSources((previous) => ({ ...previous, [orm]: { ...previous[orm], ...added } }));
          setActiveFile(accepted[0].key);
          setHighlight({});
        }
      }

      setImportNotice(notices.length > 0 ? notices.join(" ") : null);
    },
    [orm, t],
  );

  const removeFile = useCallback(
    (key: string) => {
      setSources((previous) => {
        const next = { ...previous[orm] };
        delete next[key];
        return { ...previous, [orm]: next };
      });
      setActiveFile((current) => (current === key ? ORM_CATALOG[orm].files[0].key : current));
      setImportNotice(null);
    },
    [orm],
  );

  const [pendingAction, setPendingAction] = useState<"relayout" | "reset" | null>(null);

  const relayout = useCallback(() => setLayoutVersion((version) => version + 1), []);

  const confirmPending = useCallback(() => {
    if (pendingAction === "relayout") relayout();
    if (pendingAction === "reset") resetToSamples();
    setPendingAction(null);
  }, [pendingAction, relayout, resetToSamples]);

  const errorCount = schema.diagnostics.filter((item) => item.level === "error").length;
  const entityCount =
    schema.dialect === "mongo"
      ? t.header.collections(schema.tables.length)
      : t.header.tables(schema.tables.length);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg text-fg">
      <header className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-line bg-surface px-4 py-2">
        <Wordmark className="whitespace-nowrap text-sm font-semibold tracking-tight" />

        <label className="flex shrink-0 items-center gap-1.5">
          <span className="sr-only">{t.header.orm}</span>
          <select
            value={orm}
            onChange={(event) => handleOrmChange(event.target.value as OrmId)}
            className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-medium text-fg outline-none transition-colors hover:bg-surface-3 focus:border-accent"
          >
            {ORM_LIST.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="hidden items-center gap-2 whitespace-nowrap text-[11px] text-fg-muted sm:flex">
          <span>{entityCount}</span>
          <span className="text-line-strong">·</span>
          <span>{t.header.relations(edges.length)}</span>
          {schema.dialect !== "unknown" ? (
            <>
              <span className="text-line-strong">·</span>
              <span className="uppercase">{schema.dialect}</span>
            </>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {isParsing ? (
            <span className="whitespace-nowrap text-[11px] text-fg-faint">{t.header.parsing}</span>
          ) : null}
          {error ? (
            <span className="whitespace-nowrap text-[11px]" style={{ color: "var(--sev-critical)" }}>
              {error}
            </span>
          ) : null}
          {errorCount > 0 ? (
            <span
              className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: "var(--sev-critical-bg)", color: "var(--sev-critical)" }}
            >
              {t.header.parseErrors(errorCount)}
            </span>
          ) : null}

          <ShareDialog orm={orm} sources={currentSources} />

          <span className="mx-0.5 h-4 w-px bg-line" aria-hidden="true" />

          <IconButton
            label={t.header.editor}
            active={showEditor}
            aria-pressed={showEditor}
            onClick={() => {
              setShowEditor((value) => !value);
              setFitSignal((value) => value + 1);
            }}
          >
            <EditorIcon />
          </IconButton>

          <IconButton
            label={t.header.panel}
            active={showPanel}
            aria-pressed={showPanel}
            onClick={() => {
              setShowPanel((value) => !value);
              setFitSignal((value) => value + 1);
            }}
          >
            <PanelIcon />
          </IconButton>

          <IconButton
            label={direction === "LR" ? t.header.horizontal : t.header.vertical}
            onClick={() => {
              setDirection((current) => (current === "LR" ? "TB" : "LR"));
              relayout();
            }}
          >
            {direction === "LR" ? <HorizontalIcon /> : <VerticalIcon />}
          </IconButton>

          <IconButton label={t.header.relayout} onClick={() => setPendingAction("relayout")}>
            <RelayoutIcon />
          </IconButton>

          <IconButton label={t.header.reset} onClick={() => setPendingAction("reset")}>
            <ResetIcon />
          </IconButton>

          {showLegal ? (
            <Link
              href="/legal/privacy"
              title={t.legal.title}
              aria-label={t.legal.title}
              className={iconButtonClass()}
            >
              <LegalIcon />
            </Link>
          ) : null}

          <LocaleToggle />
          <ThemeToggle />
          {showSignOut ? <SignOutButton /> : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section
          className={`${showEditor ? "flex" : "hidden"} relative min-h-0 w-[38%] min-w-[300px] max-w-[560px] flex-col border-r border-line bg-surface`}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setIsDragging(false);
          }}
          onDrop={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            setIsDragging(false);
            void importFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line pr-1">
            {files.map((file) => (
              <span key={file.key} className="group relative flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => setActiveFile(file.key)}
                  title={file.name}
                  className={`max-w-[160px] truncate py-2 pl-3 text-[11px] font-medium transition-colors ${
                    file.imported ? "pr-6" : "pr-3"
                  } ${
                    openFile?.key === file.key
                      ? "border-b-2 border-accent text-fg"
                      : "text-fg-faint hover:text-fg"
                  }`}
                >
                  {file.name}
                </button>
                {file.imported ? (
                  <button
                    type="button"
                    onClick={() => removeFile(file.key)}
                    title={t.editor.remove(file.name)}
                    aria-label={t.editor.remove(file.name)}
                    className="absolute right-1 flex size-4 items-center justify-center rounded text-fg-faint transition-colors hover:bg-surface-3 hover:text-fg"
                  >
                    <CloseIcon className="size-2.5" />
                  </button>
                ) : null}
              </span>
            ))}

            <IconButton
              label={t.editor.import}
              className={`${iconButtonClass()} ml-auto`}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImportIcon />
            </IconButton>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".ts,.tsx,.mts,.cts,.js,.jsx,.mjs,.cjs,.prisma"
              className="hidden"
              onChange={(event) => {
                void importFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </div>

          {importNotice ? (
            <p
              className="shrink-0 border-b px-3 py-2 text-[11px] leading-relaxed"
              style={{
                borderColor: "var(--sev-medium)",
                background: "var(--sev-medium-bg)",
                color: "var(--sev-medium)",
              }}
              role="status"
            >
              {importNotice}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-hidden">
            {openFile ? (
              <SchemaEditor
                key={`${orm}:${openFile.key}`}
                path={`${orm}/${openFile.name}`}
                language={openFile.language}
                value={currentSources[openFile.key] ?? ""}
                onChange={(value) => handleSourceChange(openFile.key, value)}
              />
            ) : null}
          </div>

          {isDragging ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed border-accent bg-bg/80 text-xs font-medium text-fg">
              {t.editor.drop}
            </div>
          ) : null}
        </section>

        <section className="relative min-h-0 min-w-0 flex-1">
          <SchemaCanvas
            nodes={nodes}
            edges={edges}
            layoutVersion={layoutVersion}
            fitSignal={fitSignal}
          />
        </section>

        <aside
          className={`${showPanel ? "flex" : "hidden"} min-h-0 w-[340px] shrink-0 flex-col border-l border-line bg-surface`}
        >
          <div className="flex shrink-0 border-b border-line">
            <button
              type="button"
              onClick={() => setPanelTab("checks")}
              className={`px-3 py-2 text-[11px] font-medium transition-colors ${
                panelTab === "checks"
                  ? "border-b-2 border-accent text-fg"
                  : "text-fg-faint hover:text-fg"
              }`}
            >
              {t.panel.checks(staticFindings.length + schema.diagnostics.length)}
            </button>
            <button
              type="button"
              onClick={() => setPanelTab("ai")}
              className={`px-3 py-2 text-[11px] font-medium transition-colors ${
                panelTab === "ai"
                  ? "border-b-2 border-accent text-fg"
                  : "text-fg-faint hover:text-fg"
              }`}
            >
              {t.panel.ai}
            </button>
          </div>

          {panelTab === "checks" ? (
            <ChecksPanel
              findings={staticFindings}
              diagnostics={schema.diagnostics}
              onHover={handleHover}
            />
          ) : (
            <AnalysisPanel
              orm={orm}
              sources={currentSources}
              disabled={schema.tables.length === 0}
              onHover={handleHover}
            />
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction === "reset" ? t.confirm.resetTitle : t.confirm.relayoutTitle}
        body={pendingAction === "reset" ? t.confirm.resetBody : t.confirm.relayoutBody}
        confirmLabel={pendingAction === "reset" ? t.confirm.resetAction : t.confirm.relayoutAction}
        destructive={pendingAction === "reset"}
        onConfirm={confirmPending}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
