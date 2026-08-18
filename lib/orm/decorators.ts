import { Node, type ClassDeclaration, type Decorator, type PropertyDeclaration } from "ts-morph";

import {
  literalValue,
  objectArgToRecord,
  qualifiedReference,
  stringArrayElements,
  unwrapToExpression,
} from "./ast-utils";

export interface ReadDecorator {
  name: string;
  args: Node[];
  options: Record<string, unknown>;
}

export function readDecorators(node: ClassDeclaration | PropertyDeclaration): ReadDecorator[] {
  return node.getDecorators().map((decorator: Decorator) => {
    const args = decorator.getArguments();
    return {
      name: decorator.getName(),
      args,
      options: objectArgToRecord(args.find(Node.isObjectLiteralExpression)),
    };
  });
}

export function findDecorator(
  decorators: ReadDecorator[],
  ...names: string[]
): ReadDecorator | undefined {
  return decorators.find((decorator) => names.includes(decorator.name));
}

export function hasDecorator(decorators: ReadDecorator[], ...names: string[]): boolean {
  return decorators.some((decorator) => names.includes(decorator.name));
}

export function optionStringArray(decorator: ReadDecorator, key: string): string[] {
  const object = decorator.args.find(Node.isObjectLiteralExpression);
  const property = object?.getProperty(key);
  if (!property || !Node.isPropertyAssignment(property)) return [];
  return stringArrayElements(property.getInitializer());
}

export function entityTableName(decorator: ReadDecorator | undefined, fallback: string): string {
  if (!decorator) return fallback;

  const positional = literalValue(decorator.args[0]);
  if (typeof positional === "string") return positional;

  const named = decorator.options.tableName ?? decorator.options.name;
  return typeof named === "string" ? named : fallback;
}

export function relationTarget(decorator: ReadDecorator): string | undefined {
  for (const arg of decorator.args) {
    const unwrapped = unwrapToExpression(arg);
    if (!unwrapped) continue;

    if (Node.isIdentifier(unwrapped)) return unwrapped.getText();
    if (Node.isStringLiteral(unwrapped)) return unwrapped.getLiteralValue();

    if (Node.isArrayLiteralExpression(unwrapped)) {
      const first = unwrapped.getElements()[0];
      if (first && Node.isIdentifier(first)) return first.getText();
    }
  }
  return undefined;
}

export function inverseFieldName(decorator: ReadDecorator): string | undefined {
  for (const arg of decorator.args) {
    if (!Node.isArrowFunction(arg)) continue;
    const reference = qualifiedReference(arg.getBody());
    if (reference) return reference.property;
  }
  return undefined;
}

export function propertyTypeText(property: PropertyDeclaration): string {
  const typeNode = property.getTypeNode();
  if (typeNode) return typeNode.getText();

  const initializer = property.getInitializer();
  if (!initializer) return "unknown";
  if (Node.isStringLiteral(initializer)) return "string";
  if (Node.isNumericLiteral(initializer)) return "number";
  return "unknown";
}

export function unwrapTypeText(text: string): {
  base: string;
  isArray: boolean;
  isNullable: boolean;
} {
  let value = text.trim();
  let isNullable = false;

  const parts = value.split("|").map((part) => part.trim());
  if (parts.length > 1) {
    isNullable = parts.some((part) => part === "null" || part === "undefined");
    value = parts.find((part) => part !== "null" && part !== "undefined") ?? value;
  }

  let isArray = false;
  if (value.endsWith("[]")) {
    isArray = true;
    value = value.slice(0, -2);
  }

  const generic = /^(Collection|Array|Rel|Ref|IdentifiedReference)<\s*([^,>]+)/.exec(value);
  if (generic) {
    if (generic[1] === "Collection" || generic[1] === "Array") isArray = true;
    value = generic[2].trim();
  }

  return { base: value.replace(/\?$/, "").trim(), isArray, isNullable };
}
