/**
 * 競馬AI予測ツール - 共有画像生成機能
 * 一覧表をOGP画像として生成（AI単勝順、最終スコアは一番右）
 */

/**
 * 一覧表をOGP画像として生成してダウンロード（横長 SNS 向け）
 * @param {object} race - レースデータ
 */
function generateShareImage(race) {
    if (!race || !race.horses) {
        alert('レースデータが見つかりません');
        return;
    }

    // AI単勝順にソート
    const sortedHorses = [...race.horses].sort((a, b) => {
        const aWinRate = a.predictions ? a.predictions.win_rate : 0;
        const bWinRate = b.predictions ? b.predictions.win_rate : 0;
        return bWinRate - aWinRate;
    });

    const horseCount = sortedHorses.length;
    
    // Canvasを作成（高さは馬の頭数に応じて動的に調整）
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 幅は固定、高さは馬の頭数に応じて調整
    canvas.width = 1200;
    const headerHeight = 180;
    const rowHeight = 50;
    const tableHeaderHeight = 40;
    const footerHeight = 40;
    canvas.height = headerHeight + tableHeaderHeight + (rowHeight * horseCount) + footerHeight + 40;

    // 背景のグラデーション
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 白い背景領域（内側）
    const padding = 20;
    const innerX = padding;
    const innerY = padding;
    const innerWidth = canvas.width - padding * 2;
    const innerHeight = canvas.height - padding * 2;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(innerX, innerY, innerWidth, innerHeight);

    // ヘッダー部分
    ctx.fillStyle = '#667eea';
    ctx.fillRect(innerX, innerY, innerWidth, 80);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🏇 競馬AI予測ツール - UmaAi', innerX + 20, innerY + 50);

    // レース情報
    ctx.font = 'bold 24px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
    ctx.fillStyle = '#333';
    const raceTitle = `${race.race_number} ${race.race_name}`;
    ctx.fillText(raceTitle, innerX + 20, innerY + 110);

    // レース詳細
    ctx.font = '18px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
    ctx.fillStyle = '#666';
    const raceDetails = `${race.distance} / ${race.track_condition} / ${race.start_time}`;
    ctx.fillText(raceDetails, innerX + 20, innerY + 145);

    // テーブル開始位置
    const tableY = innerY + headerHeight;
    
    // 列幅の定義（順位、馬番、馬名、騎手、AI単勝、AI複勝、最終スコア）
    const colWidths = [70, 60, 280, 180, 140, 140, 140];
    const colX = [];
    let currentX = innerX + 20;
    for (let i = 0; i < colWidths.length; i++) {
        colX.push(currentX);
        currentX += colWidths[i];
    }

    // テーブルヘッダー
    ctx.fillStyle = '#667eea';
    ctx.fillRect(innerX + 20, tableY, innerWidth - 40, tableHeaderHeight);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
    ctx.textAlign = 'center';
    
    const headers = ['順位', '馬番', '馬名', '騎手', 'AI単勝', 'AI複勝', '最終スコア'];
    headers.forEach((header, i) => {
        const centerX = colX[i] + colWidths[i] / 2;
        ctx.fillText(header, centerX, tableY + 26);
    });

    // テーブル行（AI単勝順）
    sortedHorses.forEach((horse, index) => {
        const y = tableY + tableHeaderHeight + index * rowHeight;
        
        // 背景色（1-3位）
        if (index === 0) {
            ctx.fillStyle = '#ffd700'; // 金
        } else if (index === 1) {
            ctx.fillStyle = '#c0c0c0'; // 銀
        } else if (index === 2) {
            ctx.fillStyle = '#cd7f32'; // 銅
        } else {
            ctx.fillStyle = index % 2 === 0 ? '#f8f9fa' : 'white';
        }
        ctx.fillRect(innerX + 20, y, innerWidth - 40, rowHeight);

        // 罫線
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.strokeRect(innerX + 20, y, innerWidth - 40, rowHeight);

        // テキスト
        ctx.fillStyle = '#333';
        ctx.font = 'bold 18px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
        ctx.textAlign = 'center';

        // 順位
        ctx.fillText(`${index + 1}位`, colX[0] + colWidths[0] / 2, y + 33);

        // 馬番
        ctx.fillText(`${horse.horse_number}`, colX[1] + colWidths[1] / 2, y + 33);

        // 馬名（左寄せ）
        ctx.textAlign = 'left';
        ctx.font = 'bold 17px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
        const horseName = horse.horse_name.length > 14 ? horse.horse_name.substring(0, 14) + '...' : horse.horse_name;
        ctx.fillText(horseName, colX[2] + 10, y + 33);

        // 騎手（左寄せ）
        ctx.font = '16px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
        const jockeyName = horse.jockey.name.length > 10 ? horse.jockey.name.substring(0, 10) + '...' : horse.jockey.name;
        ctx.fillText(jockeyName, colX[3] + 10, y + 33);

        // AI単勝スコア（中央寄せ）
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
        ctx.fillStyle = '#e74c3c';
        const winRate = horse.predictions ? (horse.predictions.win_rate * 100).toFixed(1) : '-';
        ctx.fillText(winRate, colX[4] + colWidths[4] / 2, y + 33);

        // AI複勝スコア（中央寄せ）
        ctx.fillStyle = '#27ae60';
        const showRate = horse.predictions ? (horse.predictions.show_rate * 100).toFixed(1) : '-';
        ctx.fillText(showRate, colX[5] + colWidths[5] / 2, y + 33);

        // 最終スコア（中央寄せ、一番右）
        ctx.fillStyle = '#667eea';
        const finalScore = horse.indices && horse.indices.final_score ? horse.indices.final_score.toFixed(1) : '-';
        ctx.fillText(finalScore, colX[6] + colWidths[6] / 2, y + 33);
    });

    // フッター
    ctx.fillStyle = '#999';
    ctx.font = '14px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
    ctx.textAlign = 'right';
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    ctx.fillText(`生成日時: ${dateStr}`, innerX + innerWidth - 20, canvas.height - 25);

    // 画像をダウンロード
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = `umaai_${race.race_number.replace(/\s/g, '_')}_${now.getTime()}.png`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('共有画像を生成しました！');
    }, 'image/png');
}

/**
 * 記事・note向け：スマホで見やすい縦長画像を生成してダウンロード
 * - 幅 900px の縦長
 * - 全頭を AI複勝順で表示
 * - 文字大きめでスマホ画面でも読めるサイズ
 *
 * @param {object} race - レースデータ
 */
function generateNoteImage(race) {
    if (!race || !race.horses) {
        alert('レースデータが見つかりません');
        return;
    }

    // AI複勝順にソート（全頭対象）
    const sortedHorses = [...race.horses].sort((a, b) => {
        const aShowRate = a.predictions ? a.predictions.show_rate : 0;
        const bShowRate = b.predictions ? b.predictions.show_rate : 0;
        return bShowRate - aShowRate;
    });

    // 全頭表示
    const displayHorses = sortedHorses;
    const horseCount = displayHorses.length;

    // Canvas を生成（縦長）
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 900; // スマホ画面で横いっぱいに表示されやすい幅
    const headerHeight = 220;
    const rowHeight = 72;
    const tableHeaderHeight = 48;
    const footerHeight = 56;
    const padding = 24;

    canvas.height = headerHeight + tableHeaderHeight + (rowHeight * horseCount) + footerHeight + padding * 2;

    // 背景のグラデーション
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 白い内枠
    const innerX = padding;
    const innerY = padding;
    const innerWidth = canvas.width - padding * 2;
    const innerHeight = canvas.height - padding * 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(innerX, innerY, innerWidth, innerHeight);

    // ヘッダーバー
    ctx.fillStyle = '#667eea';
    ctx.fillRect(innerX, innerY, innerWidth, 90);

    // タイトル
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('UmaAi 予測 - 共有用レース表', innerX + 24, innerY + 58);

    // レースタイトル
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 26px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
    const raceTitle = `${race.race_number} ${race.race_name}`;
    ctx.fillText(raceTitle, innerX + 24, innerY + 120);

    // レース詳細（距離・馬場・発走時刻）
    ctx.font = '20px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
    ctx.fillStyle = '#555555';
    const raceDetails = `${race.distance} / ${race.track_condition} / ${race.start_time}`;
    ctx.fillText(raceDetails, innerX + 24, innerY + 150);

    // テーブル開始位置
    const tableY = innerY + headerHeight;

    // 列構成：順位・馬番・馬名・人気・AI複勝%・最終スコア
    const colWidths = [70, 60, 270, 120, 160, 140];
    const colX = [];
    let currentX = innerX + 20;
    for (let i = 0; i < colWidths.length; i++) {
        colX.push(currentX);
        currentX += colWidths[i];
    }

    // テーブルヘッダー
    ctx.fillStyle = '#f0f2ff';
    ctx.fillRect(innerX + 16, tableY, innerWidth - 32, tableHeaderHeight);

    ctx.fillStyle = '#444';
    ctx.font = 'bold 18px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
    ctx.textAlign = 'center';

    const headers = ['順位', '馬番', '馬名', '人気', 'AI複勝(%)', '最終指数'];
    headers.forEach((header, i) => {
        const centerX = colX[i] + colWidths[i] / 2;
        ctx.fillText(header, centerX, tableY + 32);
    });

    // 各行（全頭）
    displayHorses.forEach((horse, index) => {
        const y = tableY + tableHeaderHeight + index * rowHeight;

        // 背景：上位3頭は色付き
        if (index === 0) {
            ctx.fillStyle = '#fff8d5';
        } else if (index === 1) {
            ctx.fillStyle = '#f0f4f8';
        } else if (index === 2) {
            ctx.fillStyle = '#f9f1ea';
        } else {
            ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f7f8fc';
        }
        ctx.fillRect(innerX + 16, y, innerWidth - 32, rowHeight);

        // 枠線
        ctx.strokeStyle = '#e0e3ef';
        ctx.lineWidth = 1;
        ctx.strokeRect(innerX + 16, y, innerWidth - 32, rowHeight);

        // 文字描画
        ctx.textAlign = 'center';
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 22px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';

        // 順位
        ctx.fillText(`${index + 1}`, colX[0] + colWidths[0] / 2, y + 44);

        // 馬番
        ctx.fillText(`${horse.horse_number}`, colX[1] + colWidths[1] / 2, y + 44);

        // 馬名（左寄せ）
        ctx.textAlign = 'left';
        ctx.font = 'bold 20px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
        const rawName = horse.horse_name || '';
        const name = rawName.length > 10 ? rawName.substring(0, 10) + '…' : rawName;
        ctx.fillText(name, colX[2] + 8, y + 44);

        // 人気
        ctx.textAlign = 'center';
        ctx.font = '20px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
        const pop = typeof horse.popularity === 'number' ? `${horse.popularity}人気` : '-';
        ctx.fillText(pop, colX[3] + colWidths[3] / 2, y + 44);

        // AI複勝％
        ctx.font = 'bold 22px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
        const showRate = horse.predictions ? (horse.predictions.show_rate * 100).toFixed(1) : '-';
        ctx.fillStyle = '#1e9c5b';
        ctx.fillText(showRate === '-' ? '-' : `${showRate}`, colX[4] + colWidths[4] / 2, y + 44);

        // 最終指数
        ctx.fillStyle = '#4353d8';
        const finalScore = horse.indices && typeof horse.indices.final_score === 'number'
            ? horse.indices.final_score.toFixed(1)
            : '-';
        ctx.fillText(finalScore, colX[5] + colWidths[5] / 2, y + 44);
    });

    // フッターテキスト
    ctx.fillStyle = '#777777';
    ctx.font = '18px "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif';
    ctx.textAlign = 'right';
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    ctx.fillText(`Generated by UmaAi | ${dateStr}`, innerX + innerWidth - 20, canvas.height - padding - 10);

    // 画像をダウンロード
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = `umaai_detail_${race.race_number.replace(/\s/g, '_')}_${now.getTime()}.png`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('縦長の共有用画像を生成しました！（全頭・スマホ向け）');
    }, 'image/png');
}
