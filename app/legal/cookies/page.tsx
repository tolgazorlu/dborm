import LegalDocumentView from "@/components/legal/legal-document";
import { renderLegal } from "@/lib/legal/render";

export default async function Page() {
  return <LegalDocumentView {...(await renderLegal("cookies"))} />;
}
