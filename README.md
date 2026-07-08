# Svelte (SvelteKit SPA) パッケージ構成ベストプラクティス

SvelteKit を SPA として使う場合のフォルダ構成・命名規則・feature 内部の分け方をまとめる。

> SPA 化は `adapter-static` + ルートレイアウトでの `export const ssr = false` で行う。
> 構成自体は SSR の場合と変わらない。

---

## 1. 全体構成

基本原則は SvelteKit 公式の役割分担に従う。

- **`src/routes/`** — ルーティング専用。ページは「組み立て」だけを行い、薄く保つ
- **`src/lib/` (`$lib`)** — 再利用するコードすべて。feature ベースの分割はこの中で行う

```
src/
├── lib/
│   ├── features/              # 機能単位
│   │   ├── auth/
│   │   │   ├── components/    # LoginForm.svelte など
│   │   │   ├── api/           # authApi.ts
│   │   │   ├── stores/        # authState.svelte.ts (Svelte 5 runes)
│   │   │   ├── types.ts
│   │   │   └── index.ts       # feature の公開 API
│   │   └── products/
│   │       └── ...
│   ├── shared/                # 横断的な共有コード
│   │   ├── components/        # Button.svelte, Modal.svelte
│   │   └── utils/             # formatDate.ts
│   └── api/                   # API クライアント基盤 (fetch ラッパー等)
└── routes/                    # $lib/features から組み立てるだけ
    └── (app)/products/[productId]/
        ├── +page.svelte
        └── +page.ts
```

### bulletproof 構成 (feature ベース) について

- 中規模以上のアプリでは有効。ただし bulletproof-react をそのまま持ち込まず、
  `routes/` と `$lib` の役割分担に合わせて適用する
- **feature 間の直接 import を禁止**する(依存は shared 経由か、feature の
  `index.ts` 公開 API 経由のみ)。bulletproof の肝はフォルダ分けよりこの依存ルール
- `index.ts` によるバレルエクスポートは「feature の境界を示す」目的に絞る。
  shared 配下の細かいファイルまでバレル化するのはやりすぎ
- 小規模なうちは `lib/components`, `lib/utils` のフラット構成で十分。
  機能が 5〜6 個を超えたあたりで feature 分割に移行するのが現実的

---

## 2. 命名規則

Svelte に公式の強制ルールはほぼなく、以下がコミュニティの主流。

| 対象 | 規則 | 例 |
|---|---|---|
| コンポーネント | PascalCase | `LoginForm.svelte` |
| フォルダ | kebab-case か小文字 1 語 | `user-profile/`, `auth/` |
| TS/JS モジュール | camelCase | `formatDate.ts`, `productApi.ts` |
| runes を使う状態ファイル | camelCase + `.svelte.ts` | `authState.svelte.ts` |
| ルートパラメータ | camelCase | `[productId]` |

- コンポーネントの PascalCase は公式ドキュメントも採用する事実上の標準。
  テンプレート内のタグ名 (`<LoginForm />`) と一致する
- 非コンポーネントのファイル名は camelCase 派と kebab-case 派で割れている。
  どちらでもよいが、**プロジェクト内で統一されていること**が重要

### 「+」プレフィックス

`+` は **SvelteKit が予約している記号で、`src/routes/` 配下のルートファイル専用**。
自分のファイルに付けるものではない。

- 使える名前は固定: `+page.svelte`, `+page.ts`, `+page.server.ts`,
  `+layout.svelte`, `+layout.ts`, `+layout.server.ts`, `+server.ts`, `+error.svelte`
- `routes/` 内にこれ以外の `+` 始まりファイルを置くとビルドエラー
- `$lib` 配下のファイルに `+` を付ける慣習はない

---

## 3. feature 内部の分け方

`components / api / stores / types / index.ts` は厳密な MECE ではなく
「役割(レイヤー)による分類」。曖昧なケースの寄せ先と依存方向のルールを
セットで決めて初めて機能する。

### 各フォルダの責務

| フォルダ | 責務 |
|---|---|
| `components/` | UI。`.svelte` のみ。通信や複雑な状態管理ロジックは持たない |
| `api/` | サーバー通信。fetch 呼び出し、リクエスト/レスポンス型、ドメイン型へのマッピング |
| `stores/` | コンポーネントをまたいで共有する状態。Svelte 5 なら `xxxState.svelte.ts` |
| `types/` | feature のドメインモデル(`Product`, `Order` など複数箇所から参照される型) |
| `utils/` | 純粋関数。入力→出力だけで状態も通信も持たない |
| `index.ts` | 分類ではなく**公開窓口**。外部が使ってよいものだけを re-export |

React hooks に相当する「状態を持つ再利用ロジック」は、Svelte 5 では runes を
使った関数(`useCountdown.svelte.ts` など)として書ける。stores/ と utils/ の
どちらに置くか事前に決めておく。

### 依存方向のルール

分類の重複は依存の方向で解決する。

```
components → stores → api → types
                ↘  utils  ↗   (utils と types はどこからでも参照可、逆は不可)
```

この一方向ルールがあると「component が直接 fetch している」「api が store を
参照している」といった逸脱をレビューで機械的に指摘できる。
**フォルダ分けそのものより、この依存方向の方が構造を守る効果が大きい。**

### 曖昧なケースの寄せ先(規約として決めておく)

1. **API レスポンスの型は api/ か types/ か**
   → レスポンスの生の形(`ProductResponse`)は **api/ に置き**、アプリ内で
   引き回すドメイン型(`Product`)だけを types/ に置く。
   「types/ に全部の型」と決めると api/ を触るたびに types/ も触ることになる

2. **データ取得と状態保持が混ざるコード**
   → **store が api を呼ぶ**形にする。小さい feature なら `+page.ts` の
   `load` から直接 api/ を呼び、store を省略してもよい。
   stores/ は「共有が必要になったら作る」で十分

3. **1 つのコンポーネントでしか使わない状態**
   → stores/ に出さず**コンポーネント内に持たせる**。
   stores/ 行きの基準は「複数コンポーネントで共有するか、
   画面を離れても保持したいか」

### 運用上のポイント

**フォルダを最初から全部作らない。** feature が小さいうちは以下で十分:

```
features/products/
├── ProductList.svelte
├── productApi.ts
├── types.ts
└── index.ts
```

同種のファイルが 3 つ以上になったらフォルダに昇格させる。
空フォルダだらけの構成より、実態に合わせて育てる方がよい。
