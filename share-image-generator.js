/**
 * 競馬AI予測ツール - 共有画像生成機能
 * 一覧表をOGP画像として生成（AI単勝順、最終スコアは一番右）
 */

/**
 * 一覧表をOGP画像として生成してダウンロード
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
