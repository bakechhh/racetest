/**
 * データローダー: Supabaseからレースデータとオッズデータを読み込む
 */
import { getSupabase } from './supabase-client.js';

/**
 * Supabaseから全レースデータを読み込む
 * @returns {Promise<Array>} レースデータの配列
 */
async function loadAllRaceData() {
    try {
        // Supabaseクライアントを取得
        const supabase = await getSupabase();

        // Supabaseからすべてのレースデータを取得
        const { data, error } = await supabase
            .from('race_data')
            .select('race_id, data');

        if (error) {
            console.error('レースデータの読み込みエラー:', error);
            throw error;
        }

        // データをJSON形式で返す（data列にJSONBとして保存されている）
        return data.map(row => row.data);

    } catch (error) {
        console.error('レースデータの読み込みエラー:', error);
        throw error;
    }
}

/**
 * 特定のレースのオッズデータを読み込む（全券種）
 * @param {string} raceId - レースID（例: 東京1R）
 * @returns {Promise<Array>} オッズデータの配列（全券種が含まれる）
 */
async function loadOddsData(raceId) {
    try {
        // Supabaseクライアントを取得
        const supabase = await getSupabase();

        // Supabaseから特定のレースのオッズデータを取得
        const { data, error } = await supabase
            .from('odds_data')
            .select('data')
            .eq('race_id', raceId)
            .single();

        if (error) {
            console.warn(`オッズデータの読み込みに失敗: ${raceId}`, error);
            return [];
        }

        // データをJSON形式で返す（data列にJSONBとして保存されている）
        return data?.data || [];

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
        // Supabaseクライアントを取得
        const supabase = await getSupabase();

        // Supabaseから特定のレースデータを取得
        const { data, error } = await supabase
            .from('race_data')
            .select('data')
            .eq('race_id', raceId)
            .single();

        if (error) {
            console.error(`レースデータの読み込みに失敗: ${raceId}`, error);
            throw error;
        }

        // データをJSON形式で返す（data列にJSONBとして保存されている）
        return data?.data || null;

    } catch (error) {
        console.error('レースデータの読み込みエラー:', error);
        throw error;
    }
}

// 関数をグローバルに公開
window.loadAllRaceData = loadAllRaceData;
window.loadOddsData = loadOddsData;
window.loadSingleRaceData = loadSingleRaceData;
