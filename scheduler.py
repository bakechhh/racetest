#!/usr/bin/env python3
"""
Supabaseデータ更新スケジューラー

5分おきにローカルのJSONファイルをSupabaseに自動アップロードします。

使用方法:
    python scheduler.py

停止方法:
    Ctrl+C を押す
"""

import time
import schedule
import sys
from datetime import datetime
from update_supabase import SupabaseUpdater


def update_job():
    """スケジュールされた更新ジョブ"""
    try:
        print('\n' + '='*70)
        print(f'⏰ スケジュール実行: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        print('='*70)

        updater = SupabaseUpdater()
        updater.update_all()

    except KeyboardInterrupt:
        raise
    except Exception as e:
        print(f'\n❌ エラーが発生しました: {str(e)}')
        import traceback
        traceback.print_exc()
        print('\n⏭️  次回の更新を待機します...')


def main():
    """メイン処理"""
    print('🎯 Supabaseデータ更新スケジューラーを起動しました')
    print('='*70)
    print('📅 更新間隔: 5分ごと')
    print('🛑 停止方法: Ctrl+C を押してください')
    print('='*70)

    # 初回実行
    print('\n🚀 初回実行を開始します...')
    update_job()

    # 5分ごとに実行するようにスケジュール
    schedule.every(5).minutes.do(update_job)

    print('\n⏳ 次回の更新を待機中... (5分後)')

    try:
        while True:
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        print('\n\n🛑 スケジューラーを停止しました')
        print('👋 お疲れ様でした！')
        sys.exit(0)


if __name__ == '__main__':
    main()
