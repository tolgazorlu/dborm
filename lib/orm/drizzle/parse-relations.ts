import { Node, type VariableDeclaration } from "ts-morph";

import {
  objectArgToRecord,
  propertyName,
  referencedColumnKeys,
  unwrapToExpression,
} from "../ast-utils";
import type { ParsedRelation, RelationKind } from "../types";

export function isRelationsDeclaration(declaration: VariableDeclaration): boolean {
  const initializer = declaration.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) return false;
  const callee = initializer.getExpression();
  return Node.isIdentifier(callee) && callee.getText() === "relations";
}

export function parseRelationsDeclaration(declaration: VariableDeclaration): ParsedRelation[] {
  const initializer = declaration.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) return [];

  const args = initializer.getArguments();
  const sourceTable = args[0]?.getText();
  const body = unwrapToExpression(args[1]);
  if (!sourceTable || !body || !Node.isObjectLiteralExpression(body)) return [];

  const file = declaration.getSourceFile().getBaseName();
  const relations: ParsedRelation[] = [];

  for (const property of body.getProperties()) {
    if (!Node.isPropertyAssignment(property)) continue;

    const fieldName = propertyName(property);
    const call = property.getInitializer();
    if (!fieldName || !call || !Node.isCallExpression(call)) continue;

    const kind = relationKind(call.getExpression());
    if (!kind) continue;

    const callArgs = call.getArguments();
    const targetTable = callArgs[0]?.getText();
    if (!targetTable) continue;

    const options = callArgs[1];
    const fields = fieldsOf(options, "fields");
    const references = fieldsOf(options, "references");
    const relationName = objectArgToRecord(options).relationName;

    relations.push({
      id: `${sourceTable}.${fieldName}`,
      kind,
      sourceTable,
      fieldName,
      targetTable,
      fields,
      references,
      relationName: typeof relationName === "string" ? relationName : undefined,
      line: property.getStartLineNumber(),
      file,
    });
  }

  return relations;
}

function relationKind(callee: Node): RelationKind | undefined {
  const name = Node.isPropertyAccessExpression(callee) ? callee.getName() : callee.getText();
  return name === "one" || name === "many" ? name : undefined;
}

function fieldsOf(options: Node | undefined, key: "fields" | "references"): string[] {
  if (!options || !Node.isObjectLiteralExpression(options)) return [];
  const property = options.getProperties().find((item) => propertyName(item) === key);
  if (!property || !Node.isPropertyAssignment(property)) return [];
  return referencedColumnKeys(property.getInitializer());
}
