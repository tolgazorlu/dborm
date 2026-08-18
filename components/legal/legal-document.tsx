import type { LegalDocument } from "@/lib/legal/types";
import LegalBody from "./legal-body";

export interface LegalDocumentViewProps {
  document: LegalDocument;
  updatedLabel: string;
  unconfiguredNote: string | null;
}

export default function LegalDocumentView({
  document,
  updatedLabel,
  unconfiguredNote,
}: LegalDocumentViewProps) {
  return (
    <>
      <h1>{document.title}</h1>
      <p className="text-[11.5px] text-fg-faint">{updatedLabel}</p>
      {unconfiguredNote ? <p className="legal-note">{unconfiguredNote}</p> : null}
      <LegalBody blocks={document.blocks} />
    </>
  );
}
