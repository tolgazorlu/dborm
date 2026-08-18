import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11.5 8.5a3 3 0 0 1 0 4.2l-2 2a3 3 0 0 1-4.2-4.2l.8-.8" />
      <path d="M8.5 11.5a3 3 0 0 1 0-4.2l2-2a3 3 0 0 1 4.2 4.2l-.8.8" />
    </Icon>
  );
}

export function EditorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path d="M8 3.5v13" />
    </Icon>
  );
}

export function PanelIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path d="M12 3.5v13" />
    </Icon>
  );
}

export function HorizontalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10h14" />
      <path d="M6 7l-3 3 3 3" />
      <path d="M14 7l3 3-3 3" />
    </Icon>
  );
}

export function VerticalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 3v14" />
      <path d="M7 6l3-3 3 3" />
      <path d="M7 14l3 3 3-3" />
    </Icon>
  );
}

export function RelayoutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16.5 8.5A6.5 6.5 0 0 0 4.8 5.8" />
      <path d="M3.5 11.5a6.5 6.5 0 0 0 11.7 2.7" />
      <path d="M4.5 2.8v3h3" />
      <path d="M15.5 17.2v-3h-3" />
    </Icon>
  );
}

export function ResetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 10a6.5 6.5 0 1 0 1.9-4.6" />
      <path d="M3.2 3.2v3.4h3.4" />
    </Icon>
  );
}

export function LegalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3h6l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M11 3v4h4" />
      <path d="M7 11h6M7 14h4" />
    </Icon>
  );
}

export function SignOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 17H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3" />
      <path d="M13 13.5 16.5 10 13 6.5" />
      <path d="M16.5 10H8" />
    </Icon>
  );
}
