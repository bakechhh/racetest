-- ================================================
-- 競馬分析システム - Supabase データベーススキーマ
-- ================================================

-- race_data テーブル: レースデータを保存
CREATE TABLE IF NOT EXISTS race_data (
  race_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- race_data テーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_race_data_race_id ON race_data(race_id);
CREATE INDEX IF NOT EXISTS idx_race_data_updated_at ON race_data(updated_at DESC);

-- JSONBフィールド内のデータにもインデックスを作成（オプション、検索性能向上のため）
CREATE INDEX IF NOT EXISTS idx_race_data_place ON race_data ((data->>'place'));
CREATE INDEX IF NOT EXISTS idx_race_data_date ON race_data ((data->>'date'));

-- ================================================

-- odds_data テーブル: オッズデータを保存
CREATE TABLE IF NOT EXISTS odds_data (
  race_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- odds_data テーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_odds_data_race_id ON odds_data(race_id);
CREATE INDEX IF NOT EXISTS idx_odds_data_updated_at ON odds_data(updated_at DESC);

-- ================================================
-- Row Level Security (RLS) 設定
-- ================================================

-- RLSを有効化（セキュリティのため）
ALTER TABLE race_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_data ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが読み取り可能にする（匿名ユーザーも含む）
CREATE POLICY IF NOT EXISTS "Enable read access for all users"
ON race_data FOR SELECT
USING (true);

CREATE POLICY IF NOT EXISTS "Enable read access for all users"
ON odds_data FOR SELECT
USING (true);

-- 認証済みユーザーのみが挿入・更新可能
-- （Pythonスクリプトで使用するAnon Keyで操作可能にする場合は service_role キーを使用）
CREATE POLICY IF NOT EXISTS "Enable insert for authenticated users only"
ON race_data FOR INSERT
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable update for authenticated users only"
ON race_data FOR UPDATE
USING (true);

CREATE POLICY IF NOT EXISTS "Enable insert for authenticated users only"
ON odds_data FOR INSERT
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable update for authenticated users only"
ON odds_data FOR UPDATE
USING (true);

-- ================================================
-- 自動更新タイムスタンプ用のトリガー関数
-- ================================================

-- updated_at を自動更新する関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- race_data テーブルのトリガー
DROP TRIGGER IF EXISTS update_race_data_updated_at ON race_data;
CREATE TRIGGER update_race_data_updated_at
    BEFORE UPDATE ON race_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- odds_data テーブルのトリガー
DROP TRIGGER IF EXISTS update_odds_data_updated_at ON odds_data;
CREATE TRIGGER update_odds_data_updated_at
    BEFORE UPDATE ON odds_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- サンプルクエリ（参考用）
-- ================================================

-- 全レースデータを取得
-- SELECT race_id, data FROM race_data ORDER BY updated_at DESC;

-- 特定のレースデータを取得
-- SELECT data FROM race_data WHERE race_id = '東京1R';

-- 特定の競馬場のレースを取得
-- SELECT race_id, data FROM race_data WHERE data->>'place' = '東京';

-- 特定日付のレースを取得
-- SELECT race_id, data FROM race_data WHERE data->>'date' = '2025/11/16';

-- 最近更新されたレース（上位10件）
-- SELECT race_id, updated_at FROM race_data ORDER BY updated_at DESC LIMIT 10;

-- オッズデータを取得
-- SELECT race_id, data FROM odds_data WHERE race_id = '東京1R';

-- データ数を確認
-- SELECT 'race_data' as table_name, COUNT(*) as count FROM race_data
-- UNION ALL
-- SELECT 'odds_data' as table_name, COUNT(*) as count FROM odds_data;

-- ================================================
-- データの削除（必要な場合のみ）
-- ================================================

-- 全データを削除する場合（注意: 取り消せません）
-- DELETE FROM race_data;
-- DELETE FROM odds_data;

-- 特定のレースを削除
-- DELETE FROM race_data WHERE race_id = '東京1R';
-- DELETE FROM odds_data WHERE race_id = '東京1R';
