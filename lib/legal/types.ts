export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] };

export interface LegalDocument {
  title: string;
  blocks: Block[];
}

export interface DocumentInput {
  operatorName: string;
  contact: string;
  address: string;
  analyticsEnabled: boolean;
  authEnabled: boolean;
  aiProvider: string;
}
