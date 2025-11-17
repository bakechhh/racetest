/**
 * データローダー: racedata/とodds/フォルダから個別JSONファイルを読み込む
 */

const GITHUB_PAGES_BASE = 'https://bakechhh.github.io/keiba-index';
const ODDS_TYPES = ['tansho', 'fukusho', 'wakuren', 'umaren', 'wide', 'umatan', 'sanrenpuku', 'sanrentan'];

/**
 * racedataフォルダから全レースデータを読み込む
 * @returns {Promise<Array>} レースデータの配列
 */
async function loadAllRaceData() {
    try {
        // まずraceid.csvを読み込んでレース一覧を取得
        // キャッシュバスティング: タイムスタンプを追加して毎回最新データを取得
        const timestamp = new Date().getTime();
        const raceidUrl = `${GITHUB_PAGES_BASE}/raceid.csv?_=${timestamp}`;
        const response = await fetch(raceidUrl, {
            cache: 'no-store',  // キャッシュを使用しない
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            throw new Error('raceid.csvの読み込みに失敗しました');
        }
        
        const csvText = await response.text();
        const raceIds = parseRaceIdCSV(csvText);
        
        // 各レースのJSONを並列で読み込む
        const raceDataPromises = raceIds.map(async (raceId) => {
            try {
                // キャッシュバスティング: タイムスタンプを追加
                const raceUrl = `${GITHUB_PAGES_BASE}/racedata/${raceId}.json?_=${timestamp}`;
                const raceResponse = await fetch(raceUrl, {
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });
                
                if (!raceResponse.ok) {
                    console.warn(`レースデータの読み込みに失敗: ${raceId}`);
                    return null;
                }
                
                return await raceResponse.json();
            } catch (error) {
                console.warn(`レースデータの読み込みエラー: ${raceId}`, error);
                return null;
            }
        });
        
        const allRaceData = await Promise.all(raceDataPromises);
        
        // nullを除外（障害レースなど、racedataがないレース）
        return allRaceData.filter(race => race !== null);
        
    } catch (error) {
        console.error('レースデータの読み込みエラー:', error);
        throw error;
    }
}

/**
 * raceid.csvをパースしてレース名一覧を取得
 * @param {string} csvText - CSVテキスト
 * @returns {Array<string>} レース名一覧（例: 福島1R、東京1R）
 */
function parseRaceIdCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const raceNames = [];
    
    // ヘッダー行をスキップ（1行目）
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = line.split(',');
        if (columns.length >= 1) {
            const raceName = columns[0].trim(); // 1列目がレース名（例: 福島1R、東京1R）
            if (raceName) {
                raceNames.push(raceName);
            }
        }
    }
    
    return raceNames;
}

/**
 * 特定のレースのオッズデータを読み込む（全券種）
 * @param {string} raceId - レースID（例: 東京1R）
 * @returns {Promise<Array>} オッズデータの配列（全券種が含まれる）
 */
async function loadOddsData(raceId) {
    try {
        // レース別の単一ファイルを読み込む（全券種が含まれる）
        // キャッシュバスティング: タイムスタンプを追加
        const timestamp = new Date().getTime();
        const oddsUrl = `${GITHUB_PAGES_BASE}/odds/${raceId}.json?_=${timestamp}`;
        const response = await fetch(oddsUrl, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            console.warn(`オッズデータの読み込みに失敗: ${raceId}`);
            return [];
        }
        
        // JSONは配列形式（全券種が含まれる）
        const oddsData = await response.json();
        
        return oddsData;
        
    } catch (error) {
        console.error('オッズデータの読み込みエラー:', error);
        throw error;
    }
}

/**
 * 特定のレースのレースデータを読み込む
 * @param {string} raceId - レースID（例: 東京1R）
 * @returns {Promise<Object>} レースデータ
 */
async function loadSingleRaceData(raceId) {
    try {
        // キャッシュバスティング: タイムスタンプを追加
        const timestamp = new Date().getTime();
        const raceUrl = `${GITHUB_PAGES_BASE}/racedata/${raceId}.json?_=${timestamp}`;
        const response = await fetch(raceUrl, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`レースデータの読み込みに失敗: ${raceId}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('レースデータの読み込みエラー:', error);
        throw error;
    }
}

// 関数をグローバルに公開
window.loadAllRaceData = loadAllRaceData;
window.loadOddsData = loadOddsData;
window.loadSingleRaceData = loadSingleRaceData;
