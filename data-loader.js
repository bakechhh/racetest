/**
 * データローダー（キャッシュ機能付き）:
 * - 初回アクセス時に全データを一括取得してキャッシュ
 * - レース切替時はキャッシュから即座に返す（Supabase呼ばない）
 * - 手動更新ボタンで特定レースだけ再取得可能
 * - 日付が変わったらキャッシュを自動破棄
 *
 * app.js / index.html からは以下の関数を呼び出す:
 *   - loadAllRaceData()      : 全レースデータ取得
 *   - loadOddsData(raceId)   : オッズデータ取得
 *   - loadSingleRaceData(raceId) : 単一レースデータ取得
 *   - refreshRaceData(raceId)    : 特定レースを強制再取得（新規追加）
 *   - refreshAllData()           : 全データを強制再取得（新規追加）
 */

// ========================================
// キャッシュ変数
// ========================================
let cachedAllRaces = null;           // 全レースデータの配列
let cachedRaceDataMap = {};          // race_id → レースデータ
let cachedOddsDataMap = {};          // race_id → オッズデータ
let cacheInitialized = false;        // 初期化済みフラグ
let cacheInitPromise = null;         // 初期化中のPromise（重複防止）
let cacheDate = null;                // キャッシュした日付（YYYY-MM-DD）

// ========================================
// 日付ユーティリティ
// ========================================
function getTodayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isCacheExpired() {
    if (!cacheDate) return true;
    return cacheDate !== getTodayString();
}

function clearCache() {
    console.log('[DataLoader] キャッシュをクリア');
    cachedAllRaces = null;
    cachedRaceDataMap = {};
    cachedOddsDataMap = {};
    cacheInitialized = false;
    cacheInitPromise = null;
    cacheDate = null;
}

// ========================================
// Supabase クライアント取得
// ========================================
function getSupabaseClient() {
    const client = window.supabaseClient;
    if (!client) {
        console.error('Supabase クライアント (window.supabaseClient) が初期化されていません。');
        throw new Error('Supabase client not initialized');
    }
    return client;
}

// ========================================
// キャッシュ初期化（全データ一括取得）
// ========================================
async function initializeCache() {
    // 日付が変わっていたらキャッシュをクリア
    if (isCacheExpired()) {
        clearCache();
    }
    
    // 既に初期化済みならスキップ
    if (cacheInitialized) {
        return;
    }
    
    // 初期化中なら待機（重複リクエスト防止）
    if (cacheInitPromise) {
        return cacheInitPromise;
    }
    
    cacheInitPromise = (async () => {
        try {
            console.log('[DataLoader] キャッシュ初期化開始...');
            const supabase = getSupabaseClient();
            
            // レースデータ一括取得
            const { data: raceRows, error: raceError } = await supabase
                .from('race_data_json')
                .select('race_id, data');
            
            if (raceError) {
                console.error('レースデータ取得エラー:', raceError);
                throw raceError;
            }
            
            // オッズデータ一括取得
            const { data: oddsRows, error: oddsError } = await supabase
                .from('race_odds_json')
                .select('race_id, data');
            
            if (oddsError) {
                console.error('オッズデータ取得エラー:', oddsError);
                throw oddsError;
            }
            
            // キャッシュに格納
            cachedAllRaces = [];
            cachedRaceDataMap = {};
            cachedOddsDataMap = {};
            
            if (raceRows) {
                raceRows.forEach(row => {
                    if (row.data) {
                        cachedAllRaces.push(row.data);
                        cachedRaceDataMap[row.race_id] = row.data;
                    }
                });
            }
            
            if (oddsRows) {
                oddsRows.forEach(row => {
                    if (row.data) {
                        cachedOddsDataMap[row.race_id] = row.data;
                    }
                });
            }
            
            cacheInitialized = true;
            cacheDate = getTodayString();
            console.log(`[DataLoader] キャッシュ初期化完了: ${cachedAllRaces.length}レース, ${Object.keys(cachedOddsDataMap).length}オッズ (${cacheDate})`);
            
        } catch (error) {
            console.error('[DataLoader] キャッシュ初期化エラー:', error);
            throw error;
        } finally {
            cacheInitPromise = null;
        }
    })();
    
    return cacheInitPromise;
}

// ========================================
// 全レースデータを読み込む
// ========================================
async function loadAllRaceData() {
    await initializeCache();
    return cachedAllRaces || [];
}

// ========================================
// 特定のレースのレースデータを読み込む
// ========================================
async function loadSingleRaceData(raceId) {
    await initializeCache();
    
    const data = cachedRaceDataMap[raceId];
    if (!data) {
        console.warn(`[DataLoader] レースデータが見つかりません: ${raceId}`);
        throw new Error(`レースデータが見つかりません: ${raceId}`);
    }
    return data;
}

// ========================================
// 特定のレースのオッズデータを読み込む
// ========================================
async function loadOddsData(raceId) {
    await initializeCache();
    
    const data = cachedOddsDataMap[raceId];
    if (!data) {
        console.warn(`[DataLoader] オッズデータが見つかりません: ${raceId}`);
        return [];
    }
    return data;
}

// ========================================
// 特定レースのデータを強制再取得（更新ボタン用）
// ========================================
async function refreshRaceData(raceId) {
    try {
        console.log(`[DataLoader] レースデータ再取得: ${raceId}`);
        const supabase = getSupabaseClient();
        
        // レースデータ再取得
        const { data: raceRow, error: raceError } = await supabase
            .from('race_data_json')
            .select('race_id, data')
            .eq('race_id', raceId)
            .maybeSingle();
        
        if (raceError) {
            console.error('レースデータ再取得エラー:', raceError);
            throw raceError;
        }
        
        // オッズデータ再取得
        const { data: oddsRow, error: oddsError } = await supabase
            .from('race_odds_json')
            .select('race_id, data')
            .eq('race_id', raceId)
            .maybeSingle();
        
        if (oddsError) {
            console.error('オッズデータ再取得エラー:', oddsError);
            throw oddsError;
        }
        
        // キャッシュ更新
        if (raceRow && raceRow.data) {
            cachedRaceDataMap[raceId] = raceRow.data;
            // cachedAllRaces も更新
            const index = cachedAllRaces.findIndex(r => 
                `${r.place}${r.round}R` === raceId || r.race_number === raceId
            );
            if (index >= 0) {
                cachedAllRaces[index] = raceRow.data;
            }
        }
        
        if (oddsRow && oddsRow.data) {
            cachedOddsDataMap[raceId] = oddsRow.data;
        }
        
        console.log(`[DataLoader] レースデータ再取得完了: ${raceId}`);
        return {
            raceData: cachedRaceDataMap[raceId],
            oddsData: cachedOddsDataMap[raceId]
        };
        
    } catch (error) {
        console.error(`[DataLoader] レースデータ再取得エラー: ${raceId}`, error);
        throw error;
    }
}

// ========================================
// 全データを強制再取得
// ========================================
async function refreshAllData() {
    console.log('[DataLoader] 全データ強制再取得...');
    cacheInitialized = false;
    cachedAllRaces = null;
    cachedRaceDataMap = {};
    cachedOddsDataMap = {};
    await initializeCache();
    return {
        raceCount: cachedAllRaces.length,
        oddsCount: Object.keys(cachedOddsDataMap).length
    };
}

// ========================================
// キャッシュ状態を取得（デバッグ用）
// ========================================
function getCacheStatus() {
    return {
        initialized: cacheInitialized,
        raceCount: cachedAllRaces ? cachedAllRaces.length : 0,
        oddsCount: Object.keys(cachedOddsDataMap).length,
        raceIds: Object.keys(cachedRaceDataMap),
        oddsIds: Object.keys(cachedOddsDataMap)
    };
}

// ========================================
// グローバルに公開
// ========================================
window.loadAllRaceData = loadAllRaceData;
window.loadOddsData = loadOddsData;
window.loadSingleRaceData = loadSingleRaceData;
window.refreshRaceData = refreshRaceData;
window.refreshAllData = refreshAllData;
window.getCacheStatus = getCacheStatus;
