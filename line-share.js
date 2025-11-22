/**
 * 競馬AI予測ツール - クリップボード共有機能
 * AI分析結果から「総評」「狙い目分析」「馬印」「全馬総評」「データ分析詳細」を抽出してクリップボードにコピー
 */

/**
 * AI分析結果をクリップボードにコピー（LINE など汎用）
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
 * 記事・ブログ向け：AI分析結果を Markdown 形式でクリップボードにコピー
 */
function copyNoteText() {
    const aiResultDiv = document.getElementById('aiResult');
    
    if (!aiResultDiv || !aiResultDiv.textContent.trim()) {
        alert('詳細テキストとして共有するAI分析結果がありません。先にAI分析を実行してください。');
        return;
    }

    if (!selectedRace) {
        alert('レースが選択されていません。');
        return;
    }

    const resultText = aiResultDiv.innerText || aiResultDiv.textContent;

    const noteText = generateNoteShareText(selectedRace, resultText);

    navigator.clipboard.writeText(noteText).then(() => {
        alert('記事用テキストをクリップボードにコピーしました！\nnoteやブログの本文にそのまま貼り付けできます。');
    }).catch(err => {
        console.error('記事用テキストのコピーに失敗しました:', err);
        alert('記事用テキストのコピーに失敗しました。ブラウザの設定を確認してください。');
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
 * 記事・ブログ向け共有テキストを Markdown 形式で生成
 * @param {object} race - レースデータ
 * @param {string} aiResult - AI分析結果のテキスト
 * @returns {string} Markdown テキスト
 */
function generateNoteShareText(race, aiResult) {
    const sections = extractSections(aiResult);

    // レース情報（見出し＋基本情報）
    let text = '';

    text += `# 🏇 ${race.race_number} ${race.race_name}\n\n`;

    text += `- 条件: ${race.distance} / ${race.track_condition}\n`;
    if (race.start_time) {
        text += `- 発走時刻: ${race.start_time}\n`;
    }
    if (race.num_horses) {
        text += `- 頭数: ${race.num_horses}頭\n`;
    }
    text += '\n';

    // レース総評
    if (sections.summary) {
        text += '## 📊 レース総評\n\n';
        text += sections.summary.trim() + '\n\n';
    }

    // 狙い目分析
    if (sections.targets) {
        text += '## 🎯 狙い目分析\n\n';
        text += sections.targets.trim() + '\n\n';
    }

    // 馬印
    if (sections.marks) {
        text += '## 🐴 馬印\n\n';
        text += sections.marks.trim() + '\n\n';
    }

    // 全馬総評
    if (sections.allHorses) {
        text += '## 🐴 全馬総評\n\n';
        text += sections.allHorses.trim() + '\n\n';
    }

    // データ分析詳細
    if (sections.dataAnalysis) {
        text += '## 🔍 データ分析詳細\n\n';
        text += sections.dataAnalysis.trim() + '\n\n';
    }

    text += '---\n\n';
    text += '※本記事は「競馬AI予測ツール - UmaAi」による自動分析結果をもとに作成されています。';

    return text;
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
 * - 通常共有ボタン
 * - 記事用Markdown共有ボタン
 */
function addCopyButton() {
    const aiResultDiv = document.getElementById('aiResult');
    if (!aiResultDiv) return;

    // 既にボタンが存在する場合は追加しない
    if (document.getElementById('copyBtn') && document.getElementById('noteCopyBtn')) return;

    // ラッパー div（ボタンを縦に2つ並べる）
    let wrapper = document.getElementById('copyButtonsWrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'copyButtonsWrapper';
        wrapper.style.width = '100%';
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '10px';
        wrapper.style.marginTop = '20px';
        aiResultDiv.appendChild(wrapper);
    }

    // 通常共有ボタン
    if (!document.getElementById('copyBtn')) {
        const button = document.createElement('button');
        button.id = 'copyBtn';
        button.innerHTML = '📋 クリップボードにコピー（汎用共有）';
        button.style.cssText = `
            width: 100%;
            padding: 14px;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: bold;
            font-size: 15px;
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

        wrapper.appendChild(button);
    }

    // 記事用共有ボタン（Markdown）
    if (!document.getElementById('noteCopyBtn')) {
        const noteButton = document.createElement('button');
        noteButton.id = 'noteCopyBtn';
        noteButton.innerHTML = '✏️ 記事用テキストをコピー（Markdown）';
        noteButton.style.cssText = `
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: #ffffff;
            color: #667eea;
            font-weight: bold;
            font-size: 14px;
            cursor: pointer;
            border: 1px solid #667eea;
            box-shadow: 0 2px 4px rgba(0,0,0,0.06);
            transition: all 0.3s;
        `;
        
        noteButton.onmouseover = function() {
            this.style.background = '#f3f4ff';
        };
        
        noteButton.onmouseout = function() {
            this.style.background = '#ffffff';
        };
        
        noteButton.onclick = copyNoteText;

        wrapper.appendChild(noteButton);
    }
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
