/**
 * 競馬AI予測ツール - クリップボード共有機能
 * AI分析結果から「総評」「狙い目分析」「馬印」「全馬総評」「データ分析詳細」を抽出してクリップボードにコピー
 */

/**
 * AI分析結果をクリップボードにコピー
 */
function copyToClipboard() {
    const aiResultDiv = document.getElementById('aiResult');
    
    if (!aiResultDiv || !aiResultDiv.textContent.trim()) {
        alert('共有するAI分析結果がありません。先にAI分析を実行してください。');
        return;
    }

    if (!selectedRace) {
        alert('レースが選択されていません。');
        return;
    }

    // AI分析結果のテキストを取得（HTMLタグを除去）
    const resultText = aiResultDiv.innerText || aiResultDiv.textContent;
    
    // 共有用テキストを生成（必要なセクションのみ抽出）
    const shareText = generateShareText(selectedRace, resultText);
    
    // クリップボードにコピー
    navigator.clipboard.writeText(shareText).then(() => {
        alert('クリップボードにコピーしました！\nLINEなどで貼り付けて共有できます。');
    }).catch(err => {
        console.error('クリップボードへのコピーに失敗しました:', err);
        alert('クリップボードへのコピーに失敗しました。ブラウザの設定を確認してください。');
    });
}

/**
 * 共有用テキストを生成（総評、狙い目分析、馬印、全馬総評、データ分析詳細）
 * @param {object} race - レースデータ
 * @param {string} aiResult - AI分析結果のテキスト
 * @returns {string} 共有用テキスト
 */
function generateShareText(race, aiResult) {
    // レース情報
    const raceInfo = `🏇 ${race.race_number} ${race.race_name}\n${race.distance} / ${race.track_condition} / ${race.start_time}\n`;
    
    // 必要なセクションを抽出
    const sections = extractSections(aiResult);
    
    // 共有テキストを組み立て
    let shareText = raceInfo + '\n';
    
    // 📊 レース総評
    if (sections.summary) {
        shareText += '📊 レース総評\n' + sections.summary + '\n\n';
    }
    
    // 狙い目分析
    if (sections.targets) {
        shareText += sections.targets + '\n\n';
    }
    
    // 🐴 馬印
    if (sections.marks) {
        shareText += '🐴 馬印\n' + sections.marks + '\n\n';
    }
    
    // 🐴 全馬総評
    if (sections.allHorses) {
        shareText += '🐴 全馬総評\n' + sections.allHorses + '\n\n';
    }
    
    // 🔍 データ分析詳細
    if (sections.dataAnalysis) {
        shareText += '🔍 データ分析詳細\n' + sections.dataAnalysis + '\n\n';
    }
    
    shareText += '競馬AI予測ツール - UmaAi';
    
    return shareText;
}

/**
 * AI分析結果から必要なセクションを抽出
 * @param {string} text - AI分析結果のテキスト
 * @returns {object} 抽出されたセクション
 */
function extractSections(text) {
    const sections = {
        summary: '',
        targets: '',
        marks: '',
        allHorses: '',
        dataAnalysis: ''
    };
    
    // セクションの開始位置を検索
    const summaryStart = text.indexOf('📊 レース総評');
    const targetsStart = text.indexOf('狙い目分析');
    const marksStart = text.indexOf('🐴 馬印');
    const allHorsesStart = text.indexOf('🐴 全馬総評');
    const recommendStart = text.indexOf('🎯 推奨馬券');
    const dataAnalysisStart = text.indexOf('🔍 データ分析詳細');
    const cautionStart = text.indexOf('⚠️ 注意事項');
    
    // 📊 レース総評（狙い目分析の前まで）
    if (summaryStart !== -1 && targetsStart !== -1) {
        sections.summary = text.substring(summaryStart + '📊 レース総評'.length, targetsStart).trim();
    } else if (summaryStart !== -1 && marksStart !== -1) {
        sections.summary = text.substring(summaryStart + '📊 レース総評'.length, marksStart).trim();
    }
    
    // 狙い目分析（馬印の前まで）
    if (targetsStart !== -1 && marksStart !== -1) {
        sections.targets = text.substring(targetsStart, marksStart).trim();
    }
    
    // 🐴 馬印
    if (marksStart !== -1 && allHorsesStart !== -1) {
        sections.marks = text.substring(marksStart + '🐴 馬印'.length, allHorsesStart).trim();
    }
    
    // 🐴 全馬総評
    if (allHorsesStart !== -1 && recommendStart !== -1) {
        sections.allHorses = text.substring(allHorsesStart + '🐴 全馬総評'.length, recommendStart).trim();
    }
    
    // 🔍 データ分析詳細
    if (dataAnalysisStart !== -1) {
        const dataAnalysisEnd = cautionStart !== -1 ? cautionStart : text.length;
        sections.dataAnalysis = text.substring(dataAnalysisStart + '🔍 データ分析詳細'.length, dataAnalysisEnd).trim();
    }
    
    return sections;
}

/**
 * AI分析結果表示エリアにクリップボードコピーボタンを追加
 */
function addCopyButton() {
    const aiResultDiv = document.getElementById('aiResult');
    if (!aiResultDiv) return;

    // ボタンが既に存在する場合は追加しない
    if (document.getElementById('copyBtn')) return;

    // ボタンを作成
    const button = document.createElement('button');
    button.id = 'copyBtn';
    button.innerHTML = '📋 クリップボードにコピー';
    button.style.cssText = `
        width: 100%;
        padding: 15px;
        margin-top: 20px;
        border: none;
        border-radius: 8px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-weight: bold;
        font-size: 16px;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: all 0.3s;
    `;
    
    button.onmouseover = function() {
        this.style.opacity = '0.9';
        this.style.transform = 'translateY(-2px)';
    };
    
    button.onmouseout = function() {
        this.style.opacity = '1';
        this.style.transform = 'translateY(0)';
    };
    
    button.onclick = copyToClipboard;
    
    // AI分析結果の最後に追加
    aiResultDiv.appendChild(button);
}

/**
 * AI分析実行後にクリップボードコピーボタンを自動追加
 */
function initCopyButton() {
    // MutationObserverでAI分析結果の変更を監視
    const aiResultDiv = document.getElementById('aiResult');
    if (!aiResultDiv) return;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && aiResultDiv.textContent.trim()) {
                // AI分析結果が更新されたらボタンを追加
                setTimeout(() => {
                    addCopyButton();
                }, 500);
            }
        });
    });

    observer.observe(aiResultDiv, {
        childList: true,
        subtree: true
    });
}

// ページ読み込み時にクリップボードコピーボタンの監視を開始
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCopyButton);
} else {
    initCopyButton();
}
