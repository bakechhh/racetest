/**
 * 既存のJSONファイルをSupabaseにアップロードするスクリプト
 *
 * 使用方法:
 * 1. .envファイルを作成してSupabaseの認証情報を設定
 * 2. npm run upload を実行
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// .envファイルを読み込む
dotenv.config();

// ESモジュールで__dirnameを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数から取得
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ エラー: SUPABASE_URLとSUPABASE_ANON_KEYを.envファイルに設定してください');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 指定されたディレクトリのJSONファイルを読み込む
 */
function loadJSONFiles(dirName) {
    const dirPath = path.join(__dirname, dirName);
    const files = fs.readdirSync(dirPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    return jsonFiles.map(file => {
        const filePath = path.join(dirPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const raceId = file.replace('.json', ''); // ファイル名からrace_idを取得
        return {
            race_id: raceId,
            data: JSON.parse(content)
        };
    });
}

/**
 * レースデータをSupabaseにアップロード
 */
async function uploadRaceData() {
    console.log('📊 レースデータをアップロード中...');

    const raceDataList = loadJSONFiles('racedata');
    console.log(`  ${raceDataList.length}件のレースデータを読み込みました`);

    for (const raceData of raceDataList) {
        const { error } = await supabase
            .from('race_data')
            .upsert({
                race_id: raceData.race_id,
                data: raceData.data,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'race_id'
            });

        if (error) {
            console.error(`  ❌ エラー: ${raceData.race_id}`, error.message);
        } else {
            console.log(`  ✅ ${raceData.race_id}`);
        }
    }

    console.log('✨ レースデータのアップロード完了\n');
}

/**
 * オッズデータをSupabaseにアップロード
 */
async function uploadOddsData() {
    console.log('💰 オッズデータをアップロード中...');

    const oddsDataList = loadJSONFiles('odds');
    console.log(`  ${oddsDataList.length}件のオッズデータを読み込みました`);

    for (const oddsData of oddsDataList) {
        const { error } = await supabase
            .from('odds_data')
            .upsert({
                race_id: oddsData.race_id,
                data: oddsData.data,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'race_id'
            });

        if (error) {
            console.error(`  ❌ エラー: ${oddsData.race_id}`, error.message);
        } else {
            console.log(`  ✅ ${oddsData.race_id}`);
        }
    }

    console.log('✨ オッズデータのアップロード完了\n');
}

/**
 * メイン処理
 */
async function main() {
    console.log('🚀 Supabaseへのデータアップロードを開始します\n');

    try {
        await uploadRaceData();
        await uploadOddsData();
        console.log('🎉 すべてのデータのアップロードが完了しました！');
    } catch (error) {
        console.error('❌ エラーが発生しました:', error);
        process.exit(1);
    }
}

main();
