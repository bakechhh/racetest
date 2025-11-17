/**
 * Supabaseクライアントの初期化
 * 環境変数からSupabase URLとAnon Keyを取得して接続
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

let supabase = null;

/**
 * Netlify Functionsから環境変数を取得
 */
async function getEnvVars() {
    try {
        const response = await fetch('/.netlify/functions/env');
        if (!response.ok) {
            throw new Error('環境変数の取得に失敗しました');
        }
        return await response.json();
    } catch (error) {
        console.error('環境変数の取得エラー:', error);
        return null;
    }
}

/**
 * Supabaseクライアントを初期化
 */
async function initSupabase() {
    // 環境変数を取得
    const env = await getEnvVars();

    if (!env || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
        console.error('❌ Supabase認証情報が見つかりません');
        console.error('Netlifyの場合: Site settings > Environment variables で SUPABASE_URL と SUPABASE_ANON_KEY を設定してください');
        throw new Error('Supabase認証情報が設定されていません');
    }

    // Supabaseクライアントの作成
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    console.log('✅ Supabaseクライアント初期化完了');
    console.log('Supabase URL:', env.SUPABASE_URL.substring(0, 30) + '...');

    return supabase;
}

// 初期化を開始
const supabasePromise = initSupabase();

// Supabaseクライアントを取得する関数
export async function getSupabase() {
    if (!supabase) {
        await supabasePromise;
    }
    return supabase;
}

// デフォルトエクスポート（後方互換性のため）
export { supabase };
