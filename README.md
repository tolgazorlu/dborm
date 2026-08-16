# ORMLens

ORM şema kodunu canlı ER diyagramına çeviren, yapay zekâ ile analiz eden
dbdiagram.io benzeri bir araç. Next.js App Router, React Flow, ts-morph ve
Vercel AI SDK (Google Gemini) üzerine kurulu.

**Desteklenen ORM'ler:** Drizzle · Prisma · TypeORM · MikroORM · Sequelize ·
Kysely · Mongoose (header'daki seçiciden)
**Diller:** Türkçe · English
**Tema:** koyu · açık

- **Sol**: Monaco editör (ORM'e göre değişen dosya sekmeleri)
- **Orta**: React Flow canvas — tablolar node, referanslar edge
- **Sağ**: Deterministik kural motoru + akış hâlinde gelen AI analizi

Sayfa hiçbir zaman kaymaz: header sabittir, üç bölmenin her biri kendi içinde
scroll olur.

## Kurulum

```bash
npm install
cp .env.example .env.local   # GOOGLE_GENERATIVE_AI_API_KEY ekleyin (opsiyonel)
npm run dev
```

Anahtar olmadan da uygulama tamamen çalışır; yalnızca "AI analizi" sekmesi 501
döner. Parser, kural motoru, diyagram ve paylaşım anahtarsız çalışır.
Anahtarı [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
adresinden alabilirsiniz.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm test` | Parser testleri (32 test, node:test + tsx) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Mimari

```
app/
  layout.tsx                Tema script'i (flash önleme) + dil çerezi + sağlayıcılar
  page.tsx                  Çalışma alanını açar
  s/[token]/page.tsx        Tek kullanımlık link — onay ekranı
  api/parse/route.ts        Kod → ParsedSchema + statik bulgular
  api/analyze/route.ts      ParsedSchema → akış hâlinde AI analizi (Gemini)
  api/share/…               Tek kullanımlık link oluştur / kontrol et / aç
components/
  workspace.tsx             İstemci orkestratörü (ORM, sekmeler, yerleşim)
  i18n-provider.tsx         Dil bağlamı (çerez tabanlı)
  theme-provider.tsx        data-theme + localStorage
  editor/schema-editor.tsx  Monaco + özel sözdizimi teması + Prisma tokenizer
  canvas/                   React Flow tuvali ve tablo düğümü
  panels/                   Bulgu kartı, kural motoru paneli, AI paneli
  share/                    Paylaş kutusu ve açma ekranı
lib/
  orm/
    types.ts                Tüm ORM'lerin ürettiği ortak ParsedSchema
    catalog.ts              İstemci tarafı ORM listesi, dosya sekmeleri, örnekler
    parse.ts                Sunucu tarafı dağıtıcı
    ts-project.ts           TS tabanlı ORM'ler için ortak ts-morph kurulumu
    validate.ts             ORM'den bağımsız yapısal denetim
    decorators.ts           TypeORM/MikroORM için ortak dekoratör okuyucuları
    drizzle/ prisma/ typeorm/ mikroorm/ sequelize/ kysely/ mongoose/
  flow/                     ParsedSchema → node/edge + dagre yerleşimi
  analysis/                 Deterministik kural motoru
  ai/                       Zod şeması, prompt, şema özeti
  i18n/                     Sözlükler, locale yardımcıları
  share/store.ts            Tek kullanımlık kayıt deposu
  theme/read-palette.ts     CSS değişkenlerini Monaco/React Flow için okur
```

### Yeni bir ORM eklemek

1. `lib/orm/<orm>/index.ts` içinde `(files, locale) => ParsedSchema` imzalı bir
   parser yaz. TypeScript tabanlıysa `createTsProject` + `ast-utils`, kendi
   DSL'i varsa Prisma parser'ındaki blok okuyucu kalıbı işini görür.
2. `lib/orm/types.ts` içindeki `ORM_IDS` listesine kimliği ekle.
3. `lib/orm/samples.ts` içine örnek şema, `catalog.ts` içine etiket ve dosya
   sekmelerini ekle.
4. `lib/orm/parse.ts` sözlüğüne parser'ı bağla.

Diyagram, kural motoru ve AI katmanı yalnızca `ParsedSchema` bildiği için
başka hiçbir yere dokunmak gerekmiyor.

### Parser neden sunucuda?

`ts-morph` TypeScript derleyicisini de beraberinde getirir (~6 MB). İstemci
paketine koymak ilk yüklemeyi ciddi yavaşlatır. `lib/orm/*` saf fonksiyonlar
olduğu için tarayıcıda çalıştırmak isterseniz aynı fonksiyonları bir Web Worker
içinde çağırmanız yeterli — UI tarafında değişiklik gerekmez.

### Renkler ve diyagram ölçüleri tek yerde

Bütün palet `app/globals.css` içindeki CSS değişkenlerinde. Monaco ve React
Flow CSS sınıfı kabul etmediği için renkleri `getComputedStyle` ile oradan
okuyoruz (`lib/theme/read-palette.ts`).

Bir tuzak: CSS derleyicisi hex renkleri kısaltıyor (`#ffffff` → `#fff`), Monaco
ise yalnızca 6/8 haneli hex kabul edip istisna fırlatıyor. Okuma katmanı kısa
formu geri açıyor.

Node boyutları ve tutamaç konumları `lib/flow/constants.ts` içinde hesaplanıp
node nesnesine yazılıyor. React Flow bunları vermediğinizde ölçümü tamamen
`ResizeObserver`'a bırakır; ölçüm gelmezse **oklar hiç çizilmez**. Değerleri
zaten bildiğimiz için ölçüme hiç ihtiyaç duymuyoruz — görünüm sığdırma da aynı
sebeple `fitView` yerine elle hesaplanıyor.

## Analitik

Microsoft Clarity, `components/analytics/clarity.tsx` içinde `next/script` ile
yükleniyor. Geliştirme ortamında devre dışı: yerel gezinmeler panoya gerçek
oturum olarak düşmesin.

Script etiketinin `id`'si **"clarity" olamaz** — tarayıcı id'li elementleri aynı
adla `window` üzerine koyduğu için Clarity'nin kuyruk fonksiyonu oluşmuyor ve
kütüphane `a[c] is not a function` ile patlıyor.

## Dil ve tema

Tema `localStorage`'ta, dil çerezde tutuluyor. Ayrım kasıtlı:

- **Tema** bir öznitelik (`<html data-theme>`), satır içi script ile ilk
  boyamadan önce düzeltilebiliyor — geçiş anı (flash) yok.
- **Dil** metnin kendisini değiştirir. `localStorage`'tan okunsaydı sunucunun
  ürettiği HTML ile istemcinin metni uyuşmaz, her metin düğümünde hydration
  hatası olurdu. Çerez istekle birlikte gittiği için sunucu doğru dilde render
  ediyor.

Sunucuda üretilen metinler (parser teşhisleri, kural motoru bulguları, AI
çıktısı) de dile duyarlı: locale istekle birlikte gidiyor.

## Tek kullanımlık paylaşım linki

Header'daki **Paylaş**, şemayı (ve hangi ORM olduğunu) `/s/<token>` adresine
taşıyan bir link üretir. Link **bir kez** açılabilir: içerik okunduğu anda
sunucudan silinir, ikinci ziyarette "kullanılmış" ekranı gelir. Açılmayan
linkler 24 saat sonra kendini siler.

İki tasarım detayı:

- **GET tüketmez.** Mesajlaşma uygulamalarının link önizlemesi ya da tarayıcı
  ön-getirmesi bir GET atar; içerik GET'te açılsaydı link kullanıcı görmeden
  yanardı. Bu yüzden sayfa önce bir onay ekranı gösterir, içerik yalnızca
  kullanıcının tetiklediği POST ile açılır.
- **Tek kullanım garantisi `rename` ile.** POSIX'te rename atomik olduğu için
  eşzamanlı iki istekten yalnızca biri kaydı ele geçirir.

Depolama dosya sistemidir (`.data/shares`, git'e girmez) — harici bir bağımlılık
gerektirmesin diye. Tek süreçli sunucuda (dev, `next start`, Docker) doğru
çalışır. **Serverless'ta her örnek kendi diskini gördüğü için üretimde
`lib/share/store.ts` dosyasını Redis/Vercel KV ile değiştirin**; dışa açılan
dört fonksiyon aynı kalabilir.

## Desteklenen sözdizimi

Kapsam `lib/orm/*/**.test.ts` içinde testlerle sabitlenmiştir.

**Drizzle** — `pgTable`/`mysqlTable`/`sqliteTable` (lehçe otomatik), adlı ve
adsız kolonlar, zincir metotları (`primaryKey`, `notNull`, `unique`, `default*`,
`array`, `references`), üçüncü argümanın hem dizi hem obje formu (`index`,
`uniqueIndex`, `primaryKey({columns})`, `foreignKey({...})`), `pgEnum` ve satır
içi `{ enum: [...] }`, `relations()` blokları.

**Prisma** — `datasource` provider'ından lehçe, `model`/`enum`/`view` blokları,
`@id`/`@unique`/`@default`/`@map`/`@db.*`/`@relation`, `@@map`/`@@id`/`@@index`/
`@@unique`, opsiyonel (`?`) ve liste (`[]`) alanlar. İlişki alanı ile yabancı
anahtar kolonu ayırt edilir: diyagramda kolon olarak yalnızca ikincisi görünür.

**TypeORM** — `@Entity` sınıfları, `@PrimaryGeneratedColumn`/`@PrimaryColumn`/
`@Column` seçenekleri, `@CreateDateColumn` ailesi, TS tipinden tip çıkarımı,
sınıf ve alan seviyesinde `@Index`/`@Unique`, `@ManyToOne`/`@OneToMany`/
`@OneToOne`/`@ManyToMany`, `@JoinColumn({ name })`. Prisma'daki ayrımın aynısı:
ilişki alanı kolon değildir, yabancı anahtar ayrı alandadır.

**MikroORM** — `@Entity({ tableName })`, `@PrimaryKey`/`@Property`/`@Enum`
seçenekleri, `@Index`/`@Unique({ properties })`, ilişki dekoratörleri. Önemli
fark: `@ManyToOne` alanı **kendisi** yabancı anahtar kolonudur.

**Sequelize** — `sequelize.define(...)` ve `class X extends Model` + `X.init(...)`,
kısa (`DataTypes.STRING`) ve uzun öznitelik yazımı, `field`/`allowNull`/`unique`/
`primaryKey`/`autoIncrement`/`defaultValue`/`references`, `tableName`,
`indexes`, varsayılan `timestamps` ve örtük `id`; `belongsTo`/`hasMany`/`hasOne`/
`belongsToMany` çağrıları (yabancı anahtar kolonu şemada yoksa eklenir).

**Kysely** — tablo arayüzleri, `Database` haritasından tablo adları,
`Generated<>` ve `ColumnType<>` sarmalayıcıları, `| null` ve `?` ile
nullable'lık, dizi tipleri. Kysely tip katmanı ilişki taşımadığı için
yabancı anahtarlar yalnızca **kolon adı tablo adıyla eşleştiğinde**
(`user_id` → `users`) çıkarılır, diyagramda kesik çizgiyle gösterilir ve
"onDelete eksik" gibi kısıta dair kontroller bu referanslara uygulanmaz.

**Mongoose** — `new Schema({...}, {...})`, `mongoose.model('Ad', şema)`
eşlemesi, kısa (`String`) ve uzun (`{ type: String, required: true }`) alan
yazımı, `ref` ile ilişkiler, `enum`, `unique`, `index: true`, `schema.index()`,
`timestamps`, gömülü alt belgeler, örtük `_id`.
