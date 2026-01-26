# カード相場チェッカー 🔥

ポケモンカードの高回転カードを分析し、仕入れ判断をサポートするWebアプリ。

## 機能

- 📈 高回転カード検索（成約数ベース）
- 💰 仕入れ推奨価格の自動計算
- 🔍 メルカリ/ヤフフリへの価格範囲付き検索
- 📊 成約履歴の表示
- ⚙️ 手数料・ROI設定のカスタマイズ

## 検索条件

| フィルター | 選択肢 |
|------------|--------|
| 期間 | 1日 / 3日 / 5日 / 7日 / 14日 |
| 最低成約数 | 2件 / 3件 / 5件 / 7件 / 10件 |
| 状態 | PSA10 / 美品A / B |
| 価格帯 | 自由設定 |
| パックコード | 自由入力（SV8a, M2など） |
| ソート | 成約数 / 価格 / ROI |

## セットアップ

### 1. 依存関係インストール

```bash
npm install
```

### 2. 環境変数設定

`.env.local` を作成：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. 開発サーバー起動

```bash
npm run dev
```

### 4. ビルド

```bash
npm run build
```

## Netlifyデプロイ

1. GitHubにpush
2. Netlifyで「New site from Git」
3. 環境変数を設定：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. デプロイ完了！

## 技術スタック

- Next.js 16 (Static Export)
- Supabase (PostgreSQL)
- Netlify (Hosting)
- PWA対応

## 今後の拡張案

- [ ] プッシュ通知（条件に合うカード出現時）
- [ ] お気に入りカード登録
- [ ] 仕入れ履歴管理
- [ ] 損益計算・レポート
