import type { Locale } from "@/lib/i18n/locales";

/**
 * Kural motorunun ürettiği metinler. Bulgular sunucuda üretildiği için
 * çeviriler burada; kod parçaları (codeFix) ise dile değil ORM'e bağlı
 * olduğundan `static-checks.ts` içinde üretiliyor.
 */
export interface CheckMessages {
  missingPrimaryKey: { title: (table: string) => string; description: string; suggestion: string };
  fkNoIndex: {
    title: (table: string, column: string) => string;
    description: (target: string) => string;
    suggestion: (column: string) => string;
  };
  fkNoOnDelete: {
    title: (table: string, column: string) => string;
    description: string;
    suggestion: string;
  };
  uniqueLikely: {
    title: (table: string, column: string) => string;
    description: string;
    suggestion: string;
  };
  secretColumn: {
    title: (table: string, column: string) => string;
    description: string;
    suggestion: string;
  };
  textPrimaryKey: { title: (table: string) => string; description: string; suggestion: string };
  relationsMissing: { title: string; description: string; suggestion: string };
  relationNotDeclared: {
    title: (table: string, column: string) => string;
    description: string;
    suggestion: (table: string) => string;
  };
  relationWithoutFk: {
    title: (relation: string) => string;
    description: string;
    suggestion: string;
  };
}

export const CHECK_MESSAGES: Record<Locale, CheckMessages> = {
  tr: {
    missingPrimaryKey: {
      title: (table) => `\`${table}\` tablosunun birincil anahtarı yok`,
      description:
        "Birincil anahtarı olmayan tabloda satırlar tekil olarak adreslenemez; güncelleme/silme işlemleri ve replikasyon güvenilir çalışmaz.",
      suggestion: "Tekil bir kimlik kolonu ya da bileşik birincil anahtar tanımlayın.",
    },
    fkNoIndex: {
      title: (table, column) => `\`${table}.${column}\` referans kolonunda index yok`,
      description: (target) =>
        `Veritabanları referans kolonlarına otomatik index açmaz. Index olmadan \`${target}\` üzerinden yapılan join'ler ve ebeveyn kayıt silme işlemleri tam tablo taraması yapar.`,
      suggestion: (column) => `\`${column}\` için bir index tanımlayın.`,
    },
    fkNoOnDelete: {
      title: (table, column) => `\`${table}.${column}\` için silme davranışı belirtilmemiş`,
      description:
        "Varsayılan `no action` uygulanır: ebeveyn satır silinmek istendiğinde işlem hata ile döner.",
      suggestion: "İş kuralına göre `cascade`, `set null` veya `restrict` seçin.",
    },
    uniqueLikely: {
      title: (table, column) => `\`${table}.${column}\` benzersiz değil`,
      description:
        "Bu isimdeki alanlar genelde tekil olmalıdır; kısıt olmadan uygulama katmanındaki kontroller yarış koşullarında çift kayda izin verir.",
      suggestion: "Alana benzersizlik kısıtı ekleyin.",
    },
    secretColumn: {
      title: (table, column) => `\`${table}.${column}\` hassas veri içeriyor olabilir`,
      description:
        "Sır niteliğindeki alanlar düz metin saklanmamalı ve varsayılan sorgularla dışarı sızmamalıdır.",
      suggestion:
        "Değeri hash'leyerek saklayın (ör. argon2/bcrypt) ve alan adında `hash` ekiyle bunu açık edin; sorgularda alanı açıkça seçin.",
    },
    textPrimaryKey: {
      title: (table) => `\`${table}\` birincil anahtarı serbest metin`,
      description:
        "Uzunluğu sınırsız metin birincil anahtarlar index boyutunu büyütür ve join maliyetini artırır.",
      suggestion: "`uuid` ya da sabit uzunluklu bir tip tercih edin.",
    },
    relationsMissing: {
      title: "Hiç `relations()` tanımı yok",
      description:
        "Foreign key'ler tanımlı ama Drizzle'ın ilişkisel sorgu API'si (`db.query.*.findMany({ with })`) için gereken `relations()` bildirimleri eksik.",
      suggestion: "Her FK için sahibi tarafta `one()`, karşı tarafta `many()` tanımlayın.",
    },
    relationNotDeclared: {
      title: (table, column) => `\`${table}.${column}\` için \`one()\` ilişkisi tanımlı değil`,
      description:
        "Veritabanında foreign key var ama Drizzle tarafında karşılığı yok; bu kolon üzerinden `with` ile ilişkili kayıt çekilemez.",
      suggestion: (table) => `\`${table}Relations\` içine bu kolonu kullanan bir \`one()\` ekleyin.`,
    },
    relationWithoutFk: {
      title: (relation) => `\`${relation}\` ilişkisinin foreign key kısıtı yok`,
      description:
        "İlişki yalnızca uygulama katmanında tanımlı. Veritabanı, silinmiş bir ebeveyne işaret eden yetim satırları engelleyemez.",
      suggestion: "Kolona `.references()` ekleyerek kısıtı veritabanına taşıyın.",
    },
  },
  en: {
    missingPrimaryKey: {
      title: (table) => `Table \`${table}\` has no primary key`,
      description:
        "Without a primary key rows cannot be addressed individually; updates, deletes and replication become unreliable.",
      suggestion: "Define a unique identifier column or a composite primary key.",
    },
    fkNoIndex: {
      title: (table, column) => `Reference column \`${table}.${column}\` has no index`,
      description: (target) =>
        `Databases do not index reference columns automatically. Without one, joins through \`${target}\` and parent-row deletes fall back to a full scan.`,
      suggestion: (column) => `Add an index on \`${column}\`.`,
    },
    fkNoOnDelete: {
      title: (table, column) => `No delete behaviour set for \`${table}.${column}\``,
      description:
        "The default is `no action`: deleting a parent row fails with a constraint error.",
      suggestion: "Pick `cascade`, `set null` or `restrict` based on the business rule.",
    },
    uniqueLikely: {
      title: (table, column) => `\`${table}.${column}\` is not unique`,
      description:
        "Fields with this name are usually meant to be unique; without a constraint, application-level checks still allow duplicates under a race.",
      suggestion: "Add a uniqueness constraint to the field.",
    },
    secretColumn: {
      title: (table, column) => `\`${table}.${column}\` may hold sensitive data`,
      description:
        "Secret-like fields should not be stored in plain text, nor leak through default queries.",
      suggestion:
        "Store a hash instead (e.g. argon2/bcrypt) and say so in the field name with a `hash` suffix; select the field explicitly in queries.",
    },
    textPrimaryKey: {
      title: (table) => `Primary key of \`${table}\` is free-form text`,
      description:
        "Unbounded text primary keys inflate index size and make joins more expensive.",
      suggestion: "Prefer `uuid` or a fixed-length type.",
    },
    relationsMissing: {
      title: "No `relations()` declarations",
      description:
        "Foreign keys exist but the `relations()` declarations required by Drizzle's relational query API (`db.query.*.findMany({ with })`) are missing.",
      suggestion: "For every FK declare `one()` on the owning side and `many()` on the other.",
    },
    relationNotDeclared: {
      title: (table, column) => `No \`one()\` relation declared for \`${table}.${column}\``,
      description:
        "The foreign key exists in the database but has no Drizzle counterpart, so related rows cannot be fetched through `with`.",
      suggestion: (table) => `Add a \`one()\` using this column inside \`${table}Relations\`.`,
    },
    relationWithoutFk: {
      title: (relation) => `Relation \`${relation}\` has no foreign key constraint`,
      description:
        "The relation exists only at the application layer. The database cannot prevent orphan rows pointing at a deleted parent.",
      suggestion: "Move the constraint into the database by adding `.references()` to the column.",
    },
  },
};
