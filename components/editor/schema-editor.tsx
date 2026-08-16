"use client";

import Editor, { type BeforeMount, type Monaco, type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { useTheme, type Theme } from "@/components/theme-provider";
import type { EditorLanguage } from "@/lib/orm/catalog";
import { readCodePalette } from "@/lib/theme/read-palette";

export interface SchemaEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Monaco'nun her sekme için ayrı model (ve undo geçmişi) tutmasını sağlar. */
  path: string;
  language: EditorLanguage;
}

const THEME_NAME = "ormlens";

/**
 * Monaco'nun hazır temaları bu kod için pek işe yaramıyor: şema dosyaları
 * ağırlıklı olarak tanımlayıcı, çağrı ve string'den oluşuyor ve hepsi aynı
 * renge düşüyor. Burada token'ları uygulamanın paletine bağlıyoruz.
 */
function defineTheme(monaco: Monaco, theme: Theme): boolean {
  const palette = readCodePalette();

  try {
    monaco.editor.defineTheme(THEME_NAME, {
      base: theme === "light" ? "vs" : "vs-dark",
      inherit: true,
      // Token kuralları '#' istemez; `colors` ise ister.
      rules: [
        { token: "", foreground: palette.fg },
        { token: "comment", foreground: palette.comment, fontStyle: "italic" },
        { token: "string", foreground: palette.string },
        { token: "string.escape", foreground: palette.number },
        { token: "number", foreground: palette.number },
        { token: "regexp", foreground: palette.string },
        { token: "keyword", foreground: palette.keyword },
        { token: "annotation", foreground: palette.function },
        { token: "type", foreground: palette.type },
        { token: "type.identifier", foreground: palette.type },
        { token: "identifier", foreground: palette.fg },
        { token: "delimiter", foreground: palette.punctuation },
        { token: "delimiter.bracket", foreground: palette.punctuation },
        { token: "delimiter.parenthesis", foreground: palette.punctuation },
        { token: "operator", foreground: palette.punctuation },
      ].map((rule) => ({ ...rule, foreground: rule.foreground.replace("#", "") })),
      colors: {
        "editor.background": palette.bg,
        "editor.foreground": palette.fg,
        "editorLineNumber.foreground": palette.gutter,
        "editorLineNumber.activeForeground": palette.fg,
        "editor.lineHighlightBackground": palette.line,
        "editor.selectionBackground": palette.selection,
        "editor.inactiveSelectionBackground": palette.line,
        "editorIndentGuide.background1": palette.line,
        "editorGutter.background": palette.bg,
        "editorWidget.background": palette.line,
        "editorWidget.border": palette.line,
        "scrollbarSlider.background": `${palette.gutter}55`,
        "scrollbarSlider.hoverBackground": `${palette.gutter}88`,
        "scrollbarSlider.activeBackground": `${palette.gutter}aa`,
      },
    });
    return true;
  } catch (error) {
    // Bozuk tek bir renk yüzünden tüm uygulama çökmesin: Monaco kendi
    // varsayılan temasıyla devam eder, sadece renkler jenerik olur.
    console.error("Monaco teması tanımlanamadı:", error);
    return false;
  }
}

/** Prisma, Monaco'da tanımlı diller arasında yok; küçük bir tokenizer yazıyoruz. */
function registerPrisma(monaco: Monaco): void {
  if (monaco.languages.getLanguages().some((item: { id: string }) => item.id === "prisma")) return;

  monaco.languages.register({ id: "prisma" });

  monaco.languages.setMonarchTokensProvider("prisma", {
    defaultToken: "identifier",
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/@@?[\w.]+/, "annotation"],
        [/\b(model|enum|datasource|generator|type|view)\b/, "keyword"],
        [
          /\b(String|Boolean|Int|BigInt|Float|Decimal|DateTime|Json|Bytes|Unsupported)\b/,
          "type",
        ],
        [/"(?:[^"\\]|\\.)*"/, "string"],
        [/\b\d+(\.\d+)?\b/, "number"],
        [/[{}()[\]]/, "delimiter.bracket"],
        [/[,:?=]/, "delimiter"],
        [/[A-Z]\w*/, "type.identifier"],
        [/\w+/, "identifier"],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration("prisma", {
    comments: { lineComment: "//" },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
  });
}

export default function SchemaEditor({ value, onChange, path, language }: SchemaEditorProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const monacoRef = useRef<Monaco | null>(null);
  const [themeName, setThemeName] = useState(THEME_NAME);

  /**
   * ORM paketlerinin tip tanımları Monaco'ya yüklenmediği için semantik
   * denetim her satırı kırmızıya boyardı. Sözdizimi denetimi açık kalıyor:
   * asıl ihtiyacımız olan geri bildirim o.
   */
  const handleBeforeMount = useCallback<BeforeMount>(
    (monaco) => {
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: true,
      });
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        allowNonTsExtensions: true,
      });
      registerPrisma(monaco);
      setThemeName(defineTheme(monaco, theme) ? THEME_NAME : theme === "light" ? "vs" : "vs-dark");
    },
    [theme],
  );

  const handleMount = useCallback<OnMount>((_editor, monaco) => {
    monacoRef.current = monaco;
  }, []);

  // Tema değişince CSS değişkenleri de değişmiş olur; temayı yeniden tanımla.
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    const next = defineTheme(monaco, theme) ? THEME_NAME : theme === "light" ? "vs" : "vs-dark";
    setThemeName(next);
    monaco.editor.setTheme(next);
  }, [theme]);

  return (
    <Editor
      path={path}
      value={value}
      language={language}
      theme={themeName}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      onChange={(next) => onChange(next ?? "")}
      loading={<div className="p-4 text-xs text-fg-faint">{t.editor.loading}</div>}
      options={{
        fontSize: 12.5,
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        tabSize: 2,
        padding: { top: 12, bottom: 24 },
        renderLineHighlight: "line",
        automaticLayout: true,
        fontLigatures: true,
        guides: { indentation: true, bracketPairs: false },
        bracketPairColorization: { enabled: false },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      }}
    />
  );
}
