/**
 * データローダー:
 * - レースデータ: Supabase の race_data_json テーブルから読み込む
 * - オッズデータ: 既存の GitHub Pages 上の odds/*.json から読み込む
 *
 * app.js からは以下の3関数を呼び出す前提:
 *   - loadAllRaceData()
 *   - loadOddsData(raceId)
 *   - loadSingleRaceData(raceId)
 *
 * 関数名・返り値の形式は従来と完全互換。
 */

// GitHub Pages 上のオッズJSONのベースURL（従来どおり）
const GITHUB_PAGES_BASE = 'https://bakechhh.github.io/keiba-index';

// オッズ種別（現状は使っていないが、互換のため残しておく）
const ODDS_TYPES = [
    'tansho',
    'fukusho',
    'wakuren',
    'umaren',
    'wide',
    'umatan',
    'sanrenpuku',
    'sanrentan',
];

/**
 * Supabase クライアント取得ヘルパー
 * index.html 側で下記のように定義されている前提:
 *
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * <script>
 *   window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 * </script>
 */
function getSupabaseClient() {
    const client = window.supabaseClient;
    if (!client) {
        console.error('Supabase クライアント (window.supabaseClient) が初期化されていません。index.html を確認してください。');
        throw new Error('Supabase client not initialized');
    }
    return client;
}

/**
 * 全レースデータを読み込む
 * - Supabase の race_data_json テーブルから data(jsonb) をそのまま取得
 * - 返り値は従来と同じく「レースオブジェクトの配列」
 *
 * @returns {Promise<Array>} レースデータの配列
 */
async function loadAllRaceData() {
    try {
        const supabase = getSupabaseClient();

        // race_data_json から data カラムを全件取得
        const { data, error } = await supabase
            .from('race_data_json')
            .select('data');

        if (error) {
            console.error('Supabase からのレースデータ取得エラー:', error);
            throw new Error('Supabase レースデータ取得に失敗しました');
        }

        if (!data || data.length === 0) {
            console.warn('Supabase にレースデータが存在しません');
            return [];
        }

        // data 配列の各要素は { data: <京都1R.jsonの中身> } という形
        const allRaceData = data
            .map((row) => row.data)
            .filter((race) => race != null);

        return allRaceData;
    } catch (error) {
        console.error('レースデータの読み込みエラー:', error);
        throw error;
    }
}

/**
 * 特定のレースのレースデータを読み込む
 * - Supabase の race_data_json から race_id で1件取得
 * - 返り値は従来と同じく「京都1R.jsonの1オブジェクト」
 *
 * @param {string} raceId - レースID（例: 東京1R, 京都10R）
 * @returns {Promise<Object>} レースデータ
 */
async function loadSingleRaceData(raceId) {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('race_data_json')
            .select('data')
            .eq('race_id', raceId)
            .maybeSingle();

        if (error) {
            console.error(`Supabase レースデータ取得エラー: ${raceId}`, error);
            throw new Error(`Supabase レースデータ取得に失敗しました: ${raceId}`);
        }

        if (!data || !data.data) {
            console.error(`Supabase にレースデータが見つかりません: ${raceId}`);
            throw new Error(`レースデータが見つかりません: ${raceId}`);
        }

        // data.data が racedata/〇〇.json の中身そのもの
        return data.data;
    } catch (error) {
        console.error('レースデータの読み込みエラー:', error);
        throw error;
    }
}

/**
 * 特定のレースのオッズデータを読み込む（全券種）
 * - 現時点では従来どおり GitHub Pages 上の odds/*.json を参照
 * - 将来 JRA 版 Supabase に切り替えるときは、この関数だけ差し替えればよい
 *
 * @param {string} raceId - レースID（例: 東京1R, 京都10R）
 * @returns {Promise<Array>} オッズデータの配列（全券種が含まれる）
 */
 async function loadOddsData(raceId) {
     const supabase = getSupabaseClient();

     const { data, error } = await supabase
         .from("race_odds_json")
         .select("data")
         .eq("race_id", raceId)
         .maybeSingle();

     if (error) {
         console.warn("Supabase オッズ取得エラー:", raceId, error);
         return [];
     }
     if (!data || !data.data) {
         console.warn("Supabase にオッズデータがありません:", raceId);
         return [];
     }

     // data.data が odds/京都1R.json の中身そのまま
     return data.data;
 }


// 関数をグローバルに公開（app.js から今まで通り呼べるようにする）
window.loadAllRaceData = loadAllRaceData;
window.loadOddsData = loadOddsData;
window.loadSingleRaceData = loadSingleRaceData;
