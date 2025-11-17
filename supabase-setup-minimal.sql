-- ================================================
-- 最小限のセットアップ（すぐに使い始めたい場合）
-- ================================================

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

-- RLSを有効化して全ユーザーが読み取り可能に
ALTER TABLE race_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
ON race_data FOR SELECT
USING (true);

CREATE POLICY "Enable read access for all users"
ON odds_data FOR SELECT
USING (true);

CREATE POLICY "Enable insert for authenticated users only"
ON race_data FOR INSERT
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only"
ON race_data FOR UPDATE
USING (true);

CREATE POLICY "Enable insert for authenticated users only"
ON odds_data FOR INSERT
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only"
ON odds_data FOR UPDATE
USING (true);
