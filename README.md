# 競馬分析システム

GitHub→NetlifyでSupabaseからデータを読み取る競馬分析システムです。

## セットアップ

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com/)でプロジェクトを作成
2. SQL Editorでテーブルを作成

#### 方法A: SQLファイルを使用（推奨）

Supabase Dashboard > SQL Editor で以下のいずれかを実行:

**最小限のセットアップ（すぐに使い始める）:**
```bash
# supabase-setup-minimal.sql の内容をコピー&ペーストして実行
```

**完全なセットアップ（本番運用向け）:**
```bash
# supabase-schema.sql の内容をコピー&ペーストして実行
# 自動更新タイムスタンプ、追加インデックス、RLS設定を含む
```

#### 方法B: 手動でSQLを実行

```sql
-- race_data テーブル
CREATE TABLE race_data (
  race_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_race_data_race_id ON race_data(race_id);

-- odds_data テーブル
CREATE TABLE odds_data (
  race_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_odds_data_race_id ON odds_data(race_id);

-- RLS設定（セキュリティ）
ALTER TABLE race_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
ON race_data FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users"
ON odds_data FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only"
ON race_data FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only"
ON race_data FOR UPDATE USING (true);

CREATE POLICY "Enable insert for authenticated users only"
ON odds_data FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only"
ON odds_data FOR UPDATE USING (true);
```

### 2. データの投入

既存のJSONファイルをSupabaseに投入します。以下の2つの方法があります:

#### 方法A: Python スクリプト（推奨）

**初回セットアップ:**

```bash
# Python仮想環境を作成（推奨）
python -m venv venv

# 仮想環境を有効化
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 依存パッケージをインストール
pip install -r requirements.txt

# .envファイルを作成
cp .env.example .env
# .envファイルを編集してSupabase認証情報を設定
```

**1回だけ実行する場合:**

```bash
python update_supabase.py
```

**5分ごとに自動更新する場合（常時起動）:**

```bash
python scheduler.py
```

スケジューラーは以下の動作をします:
- 起動時に即座に1回実行
- その後5分ごとに自動実行
- `Ctrl+C`で停止

#### 方法B: Node.js スクリプト

```bash
# 依存パッケージをインストール
npm install

# .envファイルを作成
cp .env.example .env
# .envファイルを編集してSupabase認証情報を設定

# データをアップロード
npm run upload
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

## データ更新ワークフロー

### ローカルPCでのデータ管理

1. **JSONファイルの生成**（既存のワークフロー）
   - ローカルPCで`racedata/`と`odds/`フォルダにJSONファイルを生成
   - ファイル名: `東京1R.json`, `京都2R.json` など
   - JSON形式: 既存のフォーマットのまま（変更不要）

2. **Supabaseへの自動アップロード**
   ```bash
   # スケジューラーを起動（常時起動）
   python scheduler.py
   ```

   スケジューラーが以下を自動実行:
   - 5分ごとに`racedata/`と`odds/`フォルダをスキャン
   - 新規・更新されたJSONファイルを自動検出
   - Supabaseに自動アップロード（upsert: 存在すれば更新、なければ挿入）
   - ファイル形式は一切変更なし、そのままJSONBとして保存

3. **Netlifyでの表示**
   - NetlifyデプロイされたWebアプリがSupabaseから最新データを自動取得
   - リアルタイムでレース情報が更新

### 手動での1回だけのアップロード

```bash
python update_supabase.py
```

## ローカル開発（フロントエンド）

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

## ファイル説明

### SQLファイル

- **supabase-setup-minimal.sql**: 最小限のセットアップ（すぐに使い始める場合）
- **supabase-schema.sql**: 完全なスキーマ（本番運用向け、トリガーや追加インデックスを含む）

### Pythonスクリプト

- **update_supabase.py**: JSONファイルをSupabaseにアップロードするメインスクリプト
- **scheduler.py**: 5分ごとに自動実行するスケジューラー
- **requirements.txt**: Python依存パッケージ

### JavaScriptファイル

- **data-loader.js**: Supabaseからデータを読み込むクライアントライブラリ
- **supabase-client.js**: Supabaseクライアントの初期化
- **upload-to-supabase.js**: Node.jsでのデータアップロードスクリプト

### 設定ファイル

- **.env.example**: 環境変数のテンプレート
- **netlify.toml**: Netlify設定
- **package.json**: Node.js依存関係
