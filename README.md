# 競馬分析システム

GitHub→NetlifyでSupabaseからデータを読み取る競馬分析システムです。

## セットアップ

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com/)でプロジェクトを作成
2. 以下のテーブルを作成:

#### `race_data` テーブル

```sql
CREATE TABLE race_data (
  race_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX idx_race_data_race_id ON race_data(race_id);
```

#### `odds_data` テーブル

```sql
CREATE TABLE odds_data (
  race_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX idx_odds_data_race_id ON odds_data(race_id);
```

### 2. データの投入

既存のJSONファイルをSupabaseに投入します:

```javascript
// race_dataの投入例
const raceDataFiles = ['東京1R', '東京2R', ...];

for (const raceId of raceDataFiles) {
  const raceData = await fetch(`./racedata/${raceId}.json`).then(r => r.json());

  await supabase
    .from('race_data')
    .insert({
      race_id: raceId,
      data: raceData
    });
}

// odds_dataの投入例
const oddsDataFiles = ['東京1R', '東京2R', ...];

for (const raceId of oddsDataFiles) {
  const oddsData = await fetch(`./odds/${raceId}.json`).then(r => r.json());

  await supabase
    .from('odds_data')
    .insert({
      race_id: raceId,
      data: oddsData
    });
}
```

### 3. 環境変数の設定

#### ローカル開発（データアップロード用）

`.env.example`をコピーして`.env`を作成し、Supabaseの認証情報を設定:

```bash
cp .env.example .env
```

`.env`ファイルを編集:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

#### Netlifyでの設定（本番環境）

1. Netlifyダッシュボードを開く
2. **Site settings** > **Environment variables** に移動
3. 以下の環境変数を追加:
   - `SUPABASE_URL`: SupabaseのプロジェクトURL（例: `https://xxxxx.supabase.co`）
   - `SUPABASE_ANON_KEY`: Supabaseの匿名キー

**重要**: 環境変数を設定した後、Netlifyでサイトを再デプロイしてください。

### 4. デプロイ

```bash
git add .
git commit -m "Supabase統合"
git push origin main
```

Netlifyが自動的にデプロイします。

## ローカル開発

```bash
npm install
npm run dev
```

## データ構造

### race_data テーブル

- `race_id`: レースID（例: "東京1R"）
- `data`: レースデータのJSON（元のJSONファイルと同じ形式）

### odds_data テーブル

- `race_id`: レースID（例: "東京1R"）
- `data`: オッズデータのJSON配列（元のJSONファイルと同じ形式）

## API

### loadAllRaceData()

すべてのレースデータを取得

```javascript
const raceData = await loadAllRaceData();
```

### loadOddsData(raceId)

特定のレースのオッズデータを取得

```javascript
const oddsData = await loadOddsData('東京1R');
```

### loadSingleRaceData(raceId)

特定のレースデータを取得

```javascript
const raceData = await loadSingleRaceData('東京1R');
```
