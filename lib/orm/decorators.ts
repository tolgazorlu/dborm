import { Node, type ClassDeclaration, type Decorator, type PropertyDeclaration } from "ts-morph";

import {
  literalValue,
  objectArgToRecord,
  qualifiedReference,
  stringArrayElements,
  unwrapToExpression,
} from "./ast-utils";

/**
 * Dekoratör tabanlı ORM'ler (TypeORM, MikroORM) için ortak okuyucular.
 *
 * İkisi de aynı şekli kullanır: sınıf `@Entity()`, alanlar `@Column()` /
 * `@Property()` ve ilişkiler `@ManyToOne(() => Hedef, ...)`. Farklar
 * (seçenek adları, ilişki alanının kolon olup olmaması) parser'lara bırakıldı.
 */

export interface ReadDecorator {
  name: string;
  args: Node[];
  /** İlk obje literali argümanının düz kayda çevrilmiş hâli */
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

/**
 * Dekoratör seçeneklerindeki string dizisini okur:
 * `@Index({ properties: ['a', 'b'] })` → ['a', 'b']
 *
 * `objectArgToRecord` dizi değerlerini ham metne çevirdiği için burada
 * doğrudan AST'den okuyoruz.
 */
export function optionStringArray(decorator: ReadDecorator, key: string): string[] {
  const object = decorator.args.find(Node.isObjectLiteralExpression);
  const property = object?.getProperty(key);
  if (!property || !Node.isPropertyAssignment(property)) return [];
  return stringArrayElements(property.getInitializer());
}

/** `@Entity('users')` ya da `@Entity({ tableName: 'users' })` → 'users' */
export function entityTableName(decorator: ReadDecorator | undefined, fallback: string): string {
  if (!decorator) return fallback;

  const positional = literalValue(decorator.args[0]);
  if (typeof positional === "string") return positional;

  const named = decorator.options.tableName ?? decorator.options.name;
  return typeof named === "string" ? named : fallback;
}

/**
 * `@ManyToOne(() => User, ...)` içindeki hedef sınıfı çıkarır.
 * Ok fonksiyonu, doğrudan tanımlayıcı ve `'User'` metin biçimini destekler.
 */
export function relationTarget(decorator: ReadDecorator): string | undefined {
  for (const arg of decorator.args) {
    const unwrapped = unwrapToExpression(arg);
    if (!unwrapped) continue;

    if (Node.isIdentifier(unwrapped)) return unwrapped.getText();
    if (Node.isStringLiteral(unwrapped)) return unwrapped.getLiteralValue();

    // `() => [User]` gibi dizi biçimleri
    if (Node.isArrayLiteralExpression(unwrapped)) {
      const first = unwrapped.getElements()[0];
      if (first && Node.isIdentifier(first)) return first.getText();
    }
  }
  return undefined;
}

/** `(post) => post.author` → 'author' (karşı taraftaki alan adı) */
export function inverseFieldName(decorator: ReadDecorator): string | undefined {
  for (const arg of decorator.args) {
    if (!Node.isArrowFunction(arg)) continue;
    const reference = qualifiedReference(arg.getBody());
    if (reference) return reference.property;
  }
  return undefined;
}

/** Sınıf üyesinin TypeScript tip metni: `string`, `Date`, `User`, `Post[]` */
export function propertyTypeText(property: PropertyDeclaration): string {
  const typeNode = property.getTypeNode();
  if (typeNode) return typeNode.getText();

  // Tip yazılmamışsa başlangıç değerinden tahmin et: `name = ''` → string
  const initializer = property.getInitializer();
  if (!initializer) return "unknown";
  if (Node.isStringLiteral(initializer)) return "string";
  if (Node.isNumericLiteral(initializer)) return "number";
  return "unknown";
}

/** `string | null`, `Post[]`, `Collection<Post>` gibi sarmalayıcıları soyar. */
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
