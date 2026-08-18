"use client";

import { useTheme } from "./theme-provider";

export default function ThemeToggle() {
  const { toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      title="Toggle theme"
      aria-label="Toggle theme"
      className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      <svg
        viewBox="0 0 20 20"
        className="hidden size-3.5 dark:block"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0 1a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm7-5a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1ZM5 10a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm10.07-5.07a1 1 0 0 1 0 1.41l-.7.71a1 1 0 1 1-1.42-1.42l.71-.7a1 1 0 0 1 1.41 0ZM7.05 12.95a1 1 0 0 1 0 1.41l-.71.71a1 1 0 0 1-1.41-1.42l.7-.7a1 1 0 0 1 1.42 0Zm8.02 2.12a1 1 0 0 1-1.41 0l-.71-.71a1 1 0 0 1 1.42-1.41l.7.7a1 1 0 0 1 0 1.42ZM4.93 4.93a1 1 0 0 1 1.41 0l.71.7A1 1 0 1 1 5.64 7.05l-.71-.71a1 1 0 0 1 0-1.41Z" />
      </svg>
      <svg
        viewBox="0 0 20 20"
        className="size-3.5 dark:hidden"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M17 12.6A7 7 0 1 1 7.4 3a5.6 5.6 0 0 0 9.6 9.6Z" />
      </svg>
    </button>
  );
}
