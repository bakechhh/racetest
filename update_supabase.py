#!/usr/bin/env python3
"""
Supabaseデータ更新スクリプト

ローカルのJSONファイルをSupabaseにアップロード/更新します。
5分おきに自動実行することで、常に最新のデータをSupabaseに反映できます。

使用方法:
    1. .envファイルを作成してSupabase認証情報を設定
    2. python update_supabase.py を実行（1回だけ実行）
    または
    2. python scheduler.py を実行（5分おきに自動実行）
"""

import os
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# .envファイルを読み込む
load_dotenv()

# Supabase接続情報
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')

# データディレクトリ
RACE_DATA_DIR = Path(__file__).parent / 'racedata'
ODDS_DATA_DIR = Path(__file__).parent / 'odds'


class SupabaseUpdater:
    """Supabaseへのデータ更新を管理するクラス"""

    def __init__(self):
        """Supabaseクライアントを初期化"""
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise ValueError(
                '❌ エラー: SUPABASE_URLとSUPABASE_ANON_KEYを.envファイルに設定してください\n'
                '.env.exampleを参考にして.envファイルを作成してください。'
            )

        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        print(f'✅ Supabaseに接続しました: {SUPABASE_URL[:30]}...')

    def load_json_files(self, directory: Path) -> Dict[str, dict]:
        """
        指定ディレクトリ内のすべてのJSONファイルを読み込む

        Args:
            directory: JSONファイルが格納されているディレクトリ

        Returns:
            {race_id: json_data} の辞書
        """
        if not directory.exists():
            print(f'⚠️  ディレクトリが見つかりません: {directory}')
            return {}

        json_files = {}
        for json_file in directory.glob('*.json'):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    race_id = json_file.stem  # ファイル名から拡張子を除いたもの
                    json_files[race_id] = data
            except Exception as e:
                print(f'  ❌ エラー: {json_file.name} - {str(e)}')

        return json_files

    def update_race_data(self) -> tuple[int, int]:
        """
        レースデータをSupabaseに更新

        Returns:
            (成功数, 失敗数) のタプル
        """
        print('\n📊 レースデータを更新中...')

        race_data_list = self.load_json_files(RACE_DATA_DIR)
        if not race_data_list:
            print('  ⚠️  レースデータが見つかりませんでした')
            return 0, 0

        print(f'  {len(race_data_list)}件のレースデータを読み込みました')

        success_count = 0
        error_count = 0

        for race_id, data in race_data_list.items():
            try:
                # upsert: 存在する場合は更新、存在しない場合は挿入
                result = self.supabase.table('race_data').upsert({
                    'race_id': race_id,
                    'data': data,
                    'updated_at': datetime.utcnow().isoformat()
                }).execute()

                print(f'  ✅ {race_id}')
                success_count += 1
            except Exception as e:
                print(f'  ❌ エラー: {race_id} - {str(e)}')
                error_count += 1

        print(f'✨ レースデータの更新完了: 成功 {success_count}件, 失敗 {error_count}件')
        return success_count, error_count

    def update_odds_data(self) -> tuple[int, int]:
        """
        オッズデータをSupabaseに更新

        Returns:
            (成功数, 失敗数) のタプル
        """
        print('\n💰 オッズデータを更新中...')

        odds_data_list = self.load_json_files(ODDS_DATA_DIR)
        if not odds_data_list:
            print('  ⚠️  オッズデータが見つかりませんでした')
            return 0, 0

        print(f'  {len(odds_data_list)}件のオッズデータを読み込みました')

        success_count = 0
        error_count = 0

        for race_id, data in odds_data_list.items():
            try:
                # upsert: 存在する場合は更新、存在しない場合は挿入
                result = self.supabase.table('odds_data').upsert({
                    'race_id': race_id,
                    'data': data,
                    'updated_at': datetime.utcnow().isoformat()
                }).execute()

                print(f'  ✅ {race_id}')
                success_count += 1
            except Exception as e:
                print(f'  ❌ エラー: {race_id} - {str(e)}')
                error_count += 1

        print(f'✨ オッズデータの更新完了: 成功 {success_count}件, 失敗 {error_count}件')
        return success_count, error_count

    def update_all(self) -> bool:
        """
        すべてのデータ（レースデータとオッズデータ）を更新

        Returns:
            すべて成功した場合True、エラーがあった場合False
        """
        print(f'\n🚀 Supabaseへのデータ更新を開始します [{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}]')
        print('=' * 70)

        # レースデータの更新
        race_success, race_error = self.update_race_data()

        # オッズデータの更新
        odds_success, odds_error = self.update_odds_data()

        # 結果サマリー
        print('\n' + '=' * 70)
        print('📈 更新結果サマリー:')
        print(f'  レースデータ: 成功 {race_success}件, 失敗 {race_error}件')
        print(f'  オッズデータ: 成功 {odds_success}件, 失敗 {odds_error}件')
        print(f'  合計: 成功 {race_success + odds_success}件, 失敗 {race_error + odds_error}件')

        total_error = race_error + odds_error
        if total_error == 0:
            print('🎉 すべてのデータの更新が完了しました！')
            return True
        else:
            print(f'⚠️  {total_error}件のエラーがありました')
            return False


def main():
    """メイン処理"""
    try:
        updater = SupabaseUpdater()
        success = updater.update_all()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f'\n❌ 予期しないエラーが発生しました: {str(e)}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
