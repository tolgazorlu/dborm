import type { Theme } from "@/components/theme-provider";

/**
 * Monaco ve React Flow renkleri CSS sınıfı değil, düz hex değer ister.
 * Renkleri ikinci kez TypeScript'te tanımlamak yerine `globals.css`'teki
 * değişkenleri okuyoruz — tek kaynak, kopya yok.
 *
 * Sunucu render'ında `getComputedStyle` yok; o durumda aşağıdaki yedek
 * değerler kullanılıyor (koyu tema, sunucunun varsayılan `data-theme` değeri).
 */

export interface FlowPalette {
  fk: string;
  logical: string;
  labelBg: string;
  gridDot: string;
}

export interface CodePalette {
  bg: string;
  fg: string;
  gutter: string;
  line: string;
  selection: string;
  keyword: string;
  string: string;
  number: string;
  comment: string;
  type: string;
  function: string;
  punctuation: string;
}

const FLOW_FALLBACK: Record<Theme, FlowPalette> = {
  dark: { fk: "#7c8cff", logical: "#5c6579", labelBg: "#11141b", gridDot: "#232834" },
  light: { fk: "#4f46e5", logical: "#94a3b8", labelBg: "#ffffff", gridDot: "#d3d8e0" },
};

const CODE_FALLBACK: CodePalette = {
  bg: "#11141b",
  fg: "#e6eaf2",
  gutter: "#4d566a",
  line: "#171b24",
  selection: "#2b3350",
  keyword: "#c39bff",
  string: "#7fd6a2",
  number: "#ffb072",
  comment: "#5c6579",
  type: "#74c4f5",
  function: "#8fa5ff",
  punctuation: "#7d8798",
};

/**
 * CSS derleyicisi hex renkleri kısaltıyor: `#ffffff` → `#fff`. Monaco ise
 * yalnızca 6/8 haneli hex kabul eder ve kısasını görünce istisna fırlatır.
 * Bu yüzden okuduğumuz her değeri uzun forma geri açıyoruz.
 */
function expandHex(value: string): string {
  const match = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i.exec(value);
  if (!match) return value;
  const [, r, g, b, a] = match;
  return `#${r}${r}${g}${g}${b}${b}${a ? `${a}${a}` : ""}`;
}

function cssReader(): ((name: string, fallback: string) => string) | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const style = getComputedStyle(document.documentElement);
  return (name, fallback) => {
    const value = style.getPropertyValue(name).trim();
    return value ? expandHex(value) : fallback;
  };
}

export function readFlowPalette(theme: Theme): FlowPalette {
  const read = cssReader();
  const fallback = FLOW_FALLBACK[theme];
  if (!read) return fallback;

  return {
    fk: read("--edge-fk", fallback.fk),
    logical: read("--edge-logical", fallback.logical),
    labelBg: read("--edge-label-bg", fallback.labelBg),
    gridDot: read("--grid-dot", fallback.gridDot),
  };
}

export function readCodePalette(): CodePalette {
  const read = cssReader();
  if (!read) return CODE_FALLBACK;

  return {
    bg: read("--code-bg", CODE_FALLBACK.bg),
    fg: read("--fg", CODE_FALLBACK.fg),
    gutter: read("--code-gutter", CODE_FALLBACK.gutter),
    line: read("--code-line", CODE_FALLBACK.line),
    selection: read("--code-selection", CODE_FALLBACK.selection),
    keyword: read("--code-keyword", CODE_FALLBACK.keyword),
    string: read("--code-string", CODE_FALLBACK.string),
    number: read("--code-number", CODE_FALLBACK.number),
    comment: read("--code-comment", CODE_FALLBACK.comment),
    type: read("--code-type", CODE_FALLBACK.type),
    function: read("--code-function", CODE_FALLBACK.function),
    punctuation: read("--code-punctuation", CODE_FALLBACK.punctuation),
  };
}
