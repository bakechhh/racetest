/**
 * Netlify Function: 環境変数をクライアントに提供
 * クライアントサイドで環境変数を安全に取得するためのエンドポイント
 */

export const handler = async (event, context) => {
    // CORSヘッダーを設定
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // プリフライトリクエストの処理
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // 環境変数を返す（Anon Keyは公開されても問題ないキー）
    const envVars = {
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
    };

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(envVars)
    };
};
