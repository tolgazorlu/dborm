import { Node, SyntaxKind } from "ts-morph";

export interface ChainCall {
  name: string;
  args: Node[];
}

export interface UnwrappedChain {
  baseName: string | null;
  baseArgs: Node[];
  calls: ChainCall[];
}

export function unwrapChain(expression: Node | undefined): UnwrappedChain {
  const calls: ChainCall[] = [];
  let current = expression;

  while (current && Node.isCallExpression(current)) {
    const callee = current.getExpression();

    if (Node.isPropertyAccessExpression(callee)) {
      calls.unshift({ name: callee.getName(), args: current.getArguments() });
      current = callee.getExpression();
      continue;
    }

    return {
      baseName: Node.isIdentifier(callee) ? callee.getText() : callee.getText(),
      baseArgs: current.getArguments(),
      calls,
    };
  }

  return {
    baseName: current && Node.isIdentifier(current) ? current.getText() : null,
    baseArgs: [],
    calls,
  };
}

export function findCall(chain: UnwrappedChain, name: string): ChainCall | undefined {
  return chain.calls.find((call) => call.name === name);
}

export function hasCall(chain: UnwrappedChain, ...names: string[]): boolean {
  return chain.calls.some((call) => names.includes(call.name));
}

export function literalValue(node: Node | undefined): string | number | boolean | null | undefined {
  if (!node) return undefined;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue();
  }
  if (Node.isNumericLiteral(node)) return node.getLiteralValue();
  if (node.getKind() === SyntaxKind.TrueKeyword) return true;
  if (node.getKind() === SyntaxKind.FalseKeyword) return false;
  if (node.getKind() === SyntaxKind.NullKeyword) return null;
  if (Node.isPrefixUnaryExpression(node)) {
    const operand = literalValue(node.getOperand());
    if (typeof operand === "number" && node.getOperatorToken() === SyntaxKind.MinusToken) {
      return -operand;
    }
  }
  return undefined;
}

export function stringArg(args: Node[], index: number): string | undefined {
  const value = literalValue(args[index]);
  return typeof value === "string" ? value : undefined;
}

export function objectArgToRecord(node: Node | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!node || !Node.isObjectLiteralExpression(node)) return result;

  for (const property of node.getProperties()) {
    if (!Node.isPropertyAssignment(property)) continue;
    const key = propertyName(property);
    if (!key) continue;
    const initializer = property.getInitializer();
    const value = literalValue(initializer);
    result[key] = value === undefined ? initializer?.getText() : value;
  }

  return result;
}

export function propertyName(property: Node): string | undefined {
  if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
    const nameNode = property.getNameNode();
    if (Node.isStringLiteral(nameNode) || Node.isNoSubstitutionTemplateLiteral(nameNode)) {
      return nameNode.getLiteralValue();
    }
    if (Node.isComputedPropertyName(nameNode)) {
      const value = literalValue(nameNode.getExpression());
      return typeof value === "string" ? value : undefined;
    }
    return nameNode.getText();
  }
  return undefined;
}

export function arrayElements(node: Node | undefined): Node[] {
  if (!node || !Node.isArrayLiteralExpression(node)) return [];
  return node.getElements();
}

export function stringArrayElements(node: Node | undefined): string[] {
  return arrayElements(node)
    .map((element) => literalValue(element))
    .filter((value): value is string => typeof value === "string");
}

export function unwrapToExpression(node: Node | undefined): Node | undefined {
  let current = node;

  if (current && (Node.isArrowFunction(current) || Node.isFunctionExpression(current))) {
    current = current.getBody();
  }
  while (current && Node.isParenthesizedExpression(current)) {
    current = current.getExpression();
  }
  if (current && Node.isBlock(current)) {
    const returnStatement = current.getStatements().find(Node.isReturnStatement);
    current = returnStatement?.getExpression();
    while (current && Node.isParenthesizedExpression(current)) {
      current = current.getExpression();
    }
  }

  return current;
}

export interface QualifiedReference {
  object: string;
  property: string;
}

export function qualifiedReference(node: Node | undefined): QualifiedReference | undefined {
  const expression = unwrapToExpression(node);
  if (!expression || !Node.isPropertyAccessExpression(expression)) return undefined;
  return {
    object: expression.getExpression().getText(),
    property: expression.getName(),
  };
}

export function referencedColumnKeys(node: Node | undefined): string[] {
  return arrayElements(node)
    .map((element) => qualifiedReference(element)?.property)
    .filter((value): value is string => Boolean(value));
}

export function referencedTable(node: Node | undefined): string | undefined {
  for (const element of arrayElements(node)) {
    const reference = qualifiedReference(element);
    if (reference) return reference.object;
  }
  return undefined;
}
