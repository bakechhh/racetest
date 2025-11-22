/*
    競馬指数予測システム - 追加機能
    - オッズデータ読み込み
    - AI分析機能（直接Gemini API呼び出し）
*/

// ====================
// グローバル変数
// ====================
let currentOddsData = null;
let currentOddsType = 'tfw';
let currentOddsSort = 'combination';

// OpenAI APIキー（window.OPENAI_API_KEYを優先、なければlocalStorageから取得）
let openaiApiKey = '';

// APIキーを取得する関数
function getOpenAIApiKey() {
    return window.OPENAI_API_KEY || localStorage.getItem('openai_api_key') || '';
}

// ====================
// イベントリスナー
// ====================
document.addEventListener('DOMContentLoaded', () => {
    // オッズタブのイベントリスナー
    document.querySelectorAll('.odds-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentOddsType = btn.dataset.oddsType;
            document.querySelectorAll('.odds-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderOdds();
        });
    });

    // オッズソートのイベントリスナー
    document.getElementById('oddsSort').addEventListener('change', (e) => {
        currentOddsSort = e.target.value;
        renderOdds();
    });

    // AI分析ボタンのイベントリスナー
    document.getElementById('aiAnalyzeBtn').addEventListener('click', runAIAnalysis);
    
    // OpenAI APIキー保存ボタンのイベントリスナー
    const saveOpenAIKeyBtn = document.getElementById('saveOpenAIKey');
    if (saveOpenAIKeyBtn) {
        saveOpenAIKeyBtn.addEventListener('click', saveOpenAIKey);
    }
    
    // OpenAI APIキーの読み込み
    const openaiApiKeyInput = document.getElementById('openaiApiKey');
    const savedKey = getOpenAIApiKey();
    if (openaiApiKeyInput && savedKey) {
        openaiApiKeyInput.value = savedKey;
    }
});


// ====================
// オッズデータ処理
// ====================
async function loadAndRenderOdds() {
    if (!selectedRace) return;

    const raceId = selectedRace.race_number; // 例: 東京1R

    try {
        // data-loader.jsのloadOddsData関数を使用（全券種を並列読み込み）
        currentOddsData = await window.loadOddsData(raceId);

        if (!currentOddsData || currentOddsData.length === 0) {
            throw new Error('オッズデータが見つかりません');
        }

        renderOdds();
    } catch (error) {
        document.getElementById('oddsContent').innerHTML = `<div class="error">${error.message}</div>`;
    }
}

function renderOdds() {
    if (!currentOddsData) return;

    const oddsContent = document.getElementById('oddsContent');
    const oddsForType = currentOddsData.find(o => o.odds_type === currentOddsType);

    if (!oddsForType) {
        oddsContent.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">この券種のオッズデータはありません。</div>';
        return;
    }

    let html = '';

    // 単勝・複勝（tfw）の場合は特別処理
    if (currentOddsType === 'tfw') {
        // 単勝データを取得してソート
        let tanshoData = [...oddsForType.data.tansho];
        
        if (currentOddsSort === 'odds_asc') {
            tanshoData.sort((a, b) => parseFloat(a.odds) - parseFloat(b.odds));
        } else if (currentOddsSort === 'odds_desc') {
            tanshoData.sort((a, b) => parseFloat(b.odds) - parseFloat(a.odds));
        }

        // 単勝テーブル
        html += '<h3 class="odds-section-title">単勝</h3>';
        html += '<table class="odds-table-modern"><thead><tr>';
        html += '<th>馬番</th><th>馬名</th><th>オッズ</th>';
        html += '</tr></thead><tbody>';

        tanshoData.forEach(item => {
            html += '<tr>';
            html += `<td>${item.horse_num}</td>`;
            html += `<td style="text-align: left; padding-left: 12px;">${item.horse_name}</td>`;
            html += `<td>${item.odds}</td>`;
            html += '</tr>';
        });
        html += '</tbody></table>';

        // 複勝データを取得してソート
        let fukushoData = [...oddsForType.data.fukusho];
        
        if (currentOddsSort === 'odds_asc') {
            fukushoData.sort((a, b) => parseFloat(a.odds.min) - parseFloat(b.odds.min));
        } else if (currentOddsSort === 'odds_desc') {
            fukushoData.sort((a, b) => parseFloat(b.odds.max) - parseFloat(a.odds.max));
        }

        // 複勝テーブル
        html += '<h3 class="odds-section-title">複勝</h3>';
        html += '<table class="odds-table-modern"><thead><tr>';
        html += '<th>馬番</th><th>馬名</th><th>オッズ</th>';
        html += '</tr></thead><tbody>';

        fukushoData.forEach(item => {
            html += '<tr>';
            html += `<td>${item.horse_num}</td>`;
            html += `<td style="text-align: left; padding-left: 12px;">${item.horse_name}</td>`;
            html += `<td>${item.odds.min} - ${item.odds.max}</td>`;
            html += '</tr>';
        });
        html += '</tbody></table>';
    } else {
        // その他の券種（枠連、馬連、ワイド、馬単、3連複、3連単）
        let combinations = [...oddsForType.data.combinations];

        // ソート処理
        if (currentOddsSort === 'odds_asc') {
            combinations.sort((a, b) => {
                const aOdds = (typeof a.odds === 'object') ? parseFloat(a.odds.min) : parseFloat(a.odds);
                const bOdds = (typeof b.odds === 'object') ? parseFloat(b.odds.min) : parseFloat(b.odds);
                // NaNやundefinedを除外
                if (isNaN(aOdds)) return 1;
                if (isNaN(bOdds)) return -1;
                return aOdds - bOdds;
            });
        } else if (currentOddsSort === 'odds_desc') {
            combinations.sort((a, b) => {
                const aOdds = (typeof a.odds === 'object') ? parseFloat(a.odds.max || a.odds.min) : parseFloat(a.odds);
                const bOdds = (typeof b.odds === 'object') ? parseFloat(b.odds.max || b.odds.min) : parseFloat(b.odds);
                // NaNやundefinedを除外
                if (isNaN(aOdds)) return 1;
                if (isNaN(bOdds)) return -1;
                return bOdds - aOdds;
            });
        }

        // HTML生成（combinationのみ表示）
        html += '<table class="odds-table-modern"><thead><tr>';
        html += '<th>組み合わせ</th>';
        html += '<th>オッズ</th>';
        html += '</tr></thead><tbody>';

        combinations.forEach(c => {
            html += '<tr>';
            // combinationフィールドを表示
            html += `<td style="font-weight: bold; color: #667eea;">${c.combination}</td>`;
            // オッズを表示
            const oddsValue = (typeof c.odds === 'object') ? `${c.odds.min} - ${c.odds.max}` : c.odds;
            html += `<td>${oddsValue}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
    }

    oddsContent.innerHTML = html;
}

// ====================
// AI分析処理（直接Gemini API呼び出し）
// ====================
async function runAIAnalysis() {
    if (!selectedRace) return;

    const aiResultDiv = document.getElementById('aiResult');
    
    // モデル選択を先に取得
    const selectedModel = document.getElementById('geminiModel').value;
    
    // OpenAIモデルの場合は別関数を呼び出す（Gemini APIキーチェックをスキップ）
    if (selectedModel === 'gpt-5-nano' || selectedModel === 'gpt-4o-mini') {
        return runAIAnalysisWithOpenAI(selectedModel);
    }
    
    // Geminiモデルの場合のAPIキーチェック
    const apiKey = document.getElementById('geminiApiKey').value.trim();
    if (!apiKey) {
        aiResultDiv.innerHTML = '<div class="error">❌ Gemini APIキーを入力してください。<br><a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>で無料取得できます。</div>';
        return;
    }

    aiResultDiv.innerHTML = '<div class="loading-spinner"></div><div>AIが分析中です...</div>';

    // パラメータ取得
    const budget = document.getElementById('aiBudget').value;
    const minReturn = document.getElementById('aiMinReturn').value;
    const targetReturn = document.getElementById('aiTargetReturn').value;
    const betTypes = Array.from(document.querySelectorAll('input[name="betType"]:checked')).map(cb => cb.value);
    console.log('[runAIAnalysis] betTypes:', betTypes);
    
    // パドック評価の取得（チェックされた馬番）
    const paddockHorses = Array.from(document.querySelectorAll('input[name="paddockEval"]:checked')).map(cb => parseInt(cb.value));

    try {
        const raceId = selectedRace.race_number;
        currentOddsData = await window.loadOddsData(raceId);

        // プロンプト作成（パドック情報を含む）
        const prompt = createPrompt(selectedRace, currentOddsData, { budget, minReturn, targetReturn, betTypes, paddockHorses });

        console.log('[AI Analysis] Calling Gemini API directly...');
        console.log('[AI Analysis] Model:', selectedModel);
        console.log('[AI Analysis] Prompt length:', prompt.length);
        console.log('=' .repeat(80));
        console.log('[AI Analysis] Full Prompt:');
        console.log(prompt);
        console.log('='.repeat(80));

        // オンライン状態を確認
        if (!navigator.onLine) {
            throw new Error('オフライン状態です。インターネット接続を確認してください。');
        }

        // 503エラーの自動リトライ（指数バックオフ）
        let response;
        let retryCount = 0;
        const maxRetries = 3;  // 3回リトライ
        
        while (retryCount <= maxRetries) {
            try {
                // AbortControllerでタイムアウト制御（120秒）
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 120000);
                
                try {
                    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: prompt
                                }]
                            }]
                        }),
                        signal: controller.signal,
                        cache: 'no-store'
                    });
                } finally {
                    clearTimeout(timeoutId);
                }
        
                console.log('[AI Analysis] Response status:', response.status);

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('[AI Analysis] Error response:', errorData);
                    
                    // 429エラー（レート制限）の場合はリトライ
                    if (response.status === 429 && retryCount < maxRetries) {
                        retryCount++;
                        const waitTime = Math.pow(2, retryCount) * 1000; // 指数バックオフ: 2s, 4s, 8s
                        console.log(`[AI Analysis] 429 Rate Limit. Retrying in ${waitTime/1000}s... (${retryCount}/${maxRetries})`);
                        aiResultDiv.innerHTML = `<div class="loading-spinner"></div><div>API利用制限に達しました。待機中... (リトライ ${retryCount}/${maxRetries})</div>`;
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue; // ループを続ける
                    }
                    
                    // 503エラーの場合はリトライ
                    if (response.status === 503 && retryCount < maxRetries) {
                        retryCount++;
                        const waitTime = Math.pow(2, retryCount) * 1000; // 指数バックオフ: 2s, 4s, 8s
                        console.log(`[AI Analysis] 503 error. Retrying in ${waitTime/1000}s... (${retryCount}/${maxRetries})`);
                        aiResultDiv.innerHTML = `<div class="loading-spinner"></div><div>AIが分析中です... (リトライ ${retryCount}/${maxRetries})</div>`;
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue; // ループを続ける
                    }
                    
                    // 503エラーが3回続いた場合、OpenAI APIキーがあればGPT-4o-miniにフォールバック
                    if (response.status === 503 && retryCount >= maxRetries) {
                        if (getOpenAIApiKey()) {
                            console.log('[AI Analysis] Gemini failed after 3 retries. Switching to GPT-4o-mini...');
                            aiResultDiv.innerHTML = '<div class="loading-spinner"></div><div>Geminiが混雑しています。GPT-4o-miniに切り替え中...</div>';
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            return runAIAnalysisWithOpenAI('gpt-4o-mini');
                        } else {
                            console.log('[AI Analysis] Gemini failed after 3 retries. No OpenAI API key available.');
                            throw new Error('Gemini APIが混雑しています。時間を空けて再試行してください。');
                        }
                    }
                    
                    throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
                }
                
                // 成功したらループを抜ける
                break;
                
            } catch (fetchError) {
                // タイムアウトエラーの場合
                if (fetchError.name === 'AbortError') {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        const waitTime = Math.pow(2, retryCount) * 1000;
                        console.log(`[AI Analysis] Timeout. Retrying in ${waitTime/1000}s... (${retryCount}/${maxRetries})`);
                        aiResultDiv.innerHTML = `<div class="loading-spinner"></div><div>リクエストがタイムアウトしました。再試行中... (リトライ ${retryCount}/${maxRetries})</div>`;
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                    throw new Error('リクエストがタイムアウトしました。再試行してください。');
                }
                
                // ネットワークエラーなどの場合もリトライ
                if (retryCount < maxRetries) {
                    retryCount++;
                    const waitTime = Math.pow(2, retryCount) * 1000;
                    console.log(`[AI Analysis] Network error. Retrying in ${waitTime/1000}s... (${retryCount}/${maxRetries})`);
                    aiResultDiv.innerHTML = `<div class="loading-spinner"></div><div>AIが分析中です... (リトライ ${retryCount}/${maxRetries})</div>`;
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                throw fetchError;
            }
        }

        const result = await response.json();
        console.log('[AI Analysis] Success');

        // レスポンスからテキストを抽出
        const analysisText = result.candidates[0].content.parts[0].text;

        // 注目馬サマリーを更新
        updateKeyHorseSummary(selectedRace, analysisText);

        // marked.jsを使ってMarkdownをHTMLに変換
        aiResultDiv.innerHTML = marked.parse(analysisText);

        // localStorageに保存
        saveAIAnalysisResult(selectedRace.race_number, {
            timestamp: Date.now(),
            result: analysisText,
            model: selectedModel,
            params: { budget, minReturn, targetReturn, betTypes, paddockHorses }
        });
        
        // AI分析完了通知を送信
        if (typeof window.notifyAIAnalysisComplete === 'function') {
            const raceName = `${selectedRace.place}${selectedRace.round}R ${selectedRace.race_name || ''}`;
            window.notifyAIAnalysisComplete({
                raceName: raceName,
                raceId: selectedRace.race_number
            });
        }

    } catch (error) {
        console.error('[AI Analysis] Error:', error);
        const errorMessage = getErrorMessage(error);
        aiResultDiv.innerHTML = `<div class="error">⚠️ ${errorMessage}</div>`;
    }
}

/**
 * プロンプトを作成（改善版・禁止事項を明記）
 */
function createPrompt(raceData, oddsData, userParams) {
    const {
        budget,
        betTypes,
        minReturn,
        targetReturn,
        paddockHorses
    } = userParams;

    return `あなたは競馬予想AIで馬券構築のプロ、名前はUmaAiです。以下のデータを分析して、馬券購入の推奨を提供してください。

## レース情報
- **レース名**: ${raceData.race_name}
- **開催場所**: ${raceData.place}
- **距離**: ${raceData.surface}${raceData.distance}m
- **馬場状態**: ${raceData.condition}
- **出走頭数**: ${raceData.horses.length}頭

## 出走馬データ
${formatHorsesData(raceData.horses)}

## オッズデータ
${formatSelectedOddsData(oddsData, betTypes)}

## ユーザー条件
- **予算**: ${budget}円
- **購入方式**: ${betTypes.join(', ')}
- **下限回収率**: ${minReturn}%
- **目標回収率**: ${targetReturn}%

【重要な前提：購入方式（券種）について】
- ユーザーが指定していない券種は、一切提案してはいけません。
- 「購入方式」に含まれている券種（${betTypes.join(', ')}）のみを対象として、馬券案・資金配分案を作成してください。
- 例えば「購入方式」が「馬連, 馬単」の場合、単勝・複勝・ワイド・3連複・3連単などは提案してはいけません。
- 以下で説明する各券種ごとのtierルールは、「ユーザーがその券種を指定している場合にのみ適用されるテンプレート」です。
- 出力する馬券の券種は、必ず ${betTypes.join(', ')} のみになるようにしてください。

${paddockHorses && paddockHorses.length > 0 ? `
## 🐴 パドック評価（ユーザーが現地で確認）
以下の馬はパドックで調子が良いとユーザーが判断しました：
**${paddockHorses.map(h => `${h}番`).join(', ')}**

**パドック評価の活用方法**:
- パドックで調子が良い馬は、指数が中位でも穴馬候補として考慮する
- 指数が高くパドックも良い馬は、本命候補として優先する
- パドック情報は当日の馬体状態を反映しているため、馬券に重視して含めること
` : ''}

## 分析の中核原則

### 1. LightGBMモデルの理解と活用

#### モデルの特性
- **AUC 0.78-0.80**の精度を持つ予測モデル
- AIスコアは相対的評価値（**確率ではない**）
- **順位 > スコアの絶対値**で判断すること

#### モデルの成果

提供されたデータを分析した結果、3つの予測モデル（単勝・連対・複勝）は以下の特性を持つことが確認されました。

### 予測順位の信頼性

**予測1位の特徴**:
- 3つのモデルいずれも予測1位は高い複勝率を示し、軸馬として信頼性が高い
- 単勝モデルの予測1位は1着率が最も高い
- 複勝モデルの予測1位は複勝率が最も安定している

**予測2位〜3位の特徴**:
- 予測2位は複勝率が高く、予測1位との組み合わせで馬連・ワイドに有効
- 予測3位も一定の複勝率を維持しており、3連複の相手として活用できる

**予測4位以降の特徴**:
- 予測4位以降は複勝率が大幅に低下するため、基本的には相手・ヒモ候補
- 連対モデルの予測4位は例外的に連対率が高い傾向がある

### スコアの信頼性

**複勝スコア0.8以上**:
- 複勝率70%超で極めて高い信頼性
- 軸馬として最優先で採用すべき

**複勝スコア0.7〜0.8**:
- 複勝率50%前後で信頼性が高い
- 軸馬または有力な相手馬として採用

**複勝スコア0.45〜0.7**:
- 複勝率30〜50%程度
- 相手馬・ヒモとして活用可能

**複勝スコア0.45未満**:
- 複勝率が低く、基本的には馬券に含めにくい
- 特殊な条件（パドック良好など）がない限り除外

#### AIモデルの評価基準について

**重要な考え方**:
- LightGBMモデルから算出した指数が評価する1位は、人気とは無関係に指数から比較したAI順位で決まる
- AI順位1位の馬が下位人気でも、それはAIにとっての「本命」である
- 「波乱」という概念は使わず、「AI評価と人気の乖離」として扱う
- 乖離が大きい馬は「妙味がある」「オッズバリューがある」と表現する

### 2. 分析の基本方針

**AI順位の活用**:
- 各馬について、単勝順位・連対順位・複勝順位を総合的に評価
- 複数の順位で上位 = 信頼度が高い
- 複勝スコアも重視（高いほど信頼性が高い）
- **馬印（◎○▲△☆）を中心に馬券を構築する**

**人気との乖離分析**:
- オッズから人気順位を算出し、AI順位との乖離を確認
- **乖離が大きい場合**: 
  - AI順位が高く人気が低い = 妙味あり（オッズバリューがある）
  - AI順位が低く人気が高い = 過剰人気（警戒）
- **乖離が小さい場合**: 適正評価（妙味なし）

**パドック評価の反映**:
- パドック評価馬は優先的に馬券に組み込む
- AI中位でもパドック良好なら相手・ヒモ候補として積極採用
- パドック良好馬で上位印に選ばれていない場合は「注」として記載

### 3. 馬の分類（レース全体を把握する）

**本命群**: AI上位＋人気上位（堅実）
- 馬印で上位に選ばれる馬、または複数の順位で上位の馬
- 的中率は高いが、オッズは低め

**妙味群**: AI上位＋人気中位～下位（狙い目）
- 馬印で中位に選ばれ、かつ人気が低い馬
- オッズバリューがあり、回収率向上に寄与

**警戒群**: AI下位＋人気上位（危険）
- AI順位が低いのに人気がある馬（過剰人気）
- 馬印に選ばれていない馬で人気上位

**消去群**: AI下位＋人気下位（除外）
- AI順位が低く、人気もない馬
- 馬印に選ばれず、複勝スコアも0.4（サイト表示40）にも満たない馬

### 4. 回収率の考え方

**回収率の定義**
- 回収率(%) = (的中時の払戻金 ÷ 購入金額) × 100

**基本理念**
- 回収率は長期的視点で評価する指標
- 1レースで達成する＜積み重ねて月・年単位で達成する
- 馬印に基づいて妥当な馬券を選んだ結果として自然に決まる

**重要な回収率の考え方**:
- **下限回収率${minReturn}%**:
  - このレース全体での推奨馬券の「想定回収率」が、原則としてこの値を下回らないように構築してください。
  - ただし、馬印やtier分けルールを崩してまで無理に達成しようとしてはいけません。
  - どうしてもこの条件を満たせない場合は、「今回の条件では下限回収率をわずかに下回る」といった形で、理由とともに正直に説明してください。
- **目標回収率${targetReturn}%**:
  - このレース全体での推奨馬券の「想定回収率」がこの値に近づくように、馬券の選定や資金配分を調整してください（あくまで目安であり、厳密に一致させる必要はありません）。
- 判断は個別の馬券ごとではなく、**予算全体に対する合計投資金額と合計払戻のバランス（レース単位のポートフォリオ）**で行ってください。
- **馬印に選ばれていない馬を、回収率の数字を合わせるためだけに馬券に含めてはいけません。**

### 5. 馬券構築の戦略（複合トリガー最優先）

**複合馬券の重要性**:
- 単勝・馬連・馬単・3連複・3連単は**1レース1点しか当たらない**
- 買えば買うほど死に馬券が増え、長期的に回収率が下がる
- **複合トリガー（相関関係のある馬券）を組むことで、同じ組み合わせで複数的中を狙う**
- これにより死に馬券を減らし、回収率を向上させる

**複合トリガーの定義**:
同じ馬の組み合わせで複数の券種が同時的中する関係
- 例: 1-2が来た場合 → 馬連1-2、馬単1→2、ワイド1-2が全て的中
- 例: 1-2-3が来た場合 → 3連複1-2-3、ワイド3通り、複勝3頭が複数的中

**複合トリガーの具体例**:
1. **馬連 + 馬単（両方向）**: 同じ2頭（基本的な複合）
2. **単勝 + 馬単**: 軸馬が1着なら両方的中
3. **馬連 + 馬単（両方向）+ ワイド**: 同じ2頭（最も手厚い2頭の複合）
4. **単勝 + 馬連 + 馬単**: 軸馬が1着で複数的中
5. **ワイド + 複勝（2頭）**: 同じ2頭（配当は低いが的中率高い）
6. **3連複 + ワイド（3通り）**: 同じ3頭（ワイドが複数的中）
7. **3連複 + ワイド（3通り）+ 複勝（3頭）**: 同じ3頭（ワイドと複勝が複数的中）
8. **3連単 + 馬単 + 単勝**: 1着固定の複合
9. **複勝（複数頭）**: 複数頭購入で複数的中の可能性あり（オッズは低い）

**注意**: 上記は代表例であり、ユーザー指定の券種によって他にも様々な複合トリガーが構築できる

**馬券構築のルール**:
1. **複合トリガーを最優先**: 単独の馬券よりも、複合関係のある馬券を優先的に構築
2. **流し馬券で点数を絞る**: 馬印（◎○▲△☆注）を使って軸と相手を明確化
3. **軸馬は◎を基本とする**: ◎を軸にした馬券グループを中心に構築
4. **相手・ヒモは○▲△☆注から**: 軸馬の相手は○▲△☆注から選定
5. **同じ軸で複数券種**: 同じ軸馬で、ユーザー指定の券種を組み合わせて複合トリガーを構築
6. **死に馬券の最小化**: 馬印に選ばれていない馬は基本的に馬券に含めない

**リスク分散**:
- ◎を軸にした馬券グループを中心に構築
- ◎が飛んだ場合に備えて、○を軸にした馬券グループも構築
- それぞれのグループで、ユーザー指定の券種による複合トリガーを構築

## 馬券パターンと購入優先度（tier分け）

### tierの定義
- **tier1**: 信頼度の高い印同士の組み合わせ - 最優先で購入
- **tier2**: 中堅の印を含む組み合わせ - 予算に応じて購入
- **tier3**: 注馬を含む組み合わせ - 条件次第で購入

### 単勝
- **tier1**: ◎単勝
- **tier2**: ○単勝

### 複勝
- **tier1**: ◎複勝、○複勝
- **tier2**: ▲複勝、△複勝
- **tier3**: ☆複勝、注複勝

### 馬連（軸1頭流し）
**◎軸**
- **tier1**: ◎-○、◎-▲
- **tier2**: ◎-△、◎-☆
- **tier3**: ◎-注

**○軸**
- **tier1**: ○-▲、○-△
- **tier2**: ○-☆、○-注

### 馬単（1着固定流し）
**◎軸**
- **tier1**: ◎→○、◎→▲
- **tier2**: ◎→△、◎→☆
- **tier3**: ◎→注

**○軸**
- **tier1**: ○→◎、○→▲
- **tier2**: ○→△、○→☆
- **tier3**: ○→注

### ワイド（軸1頭流し）
**◎軸**
- **tier1**: ◎-○、◎-▲
- **tier2**: ◎-△、◎-☆
- **tier3**: ◎-注

**○軸**
- **tier1**: ○-▲、○-△
- **tier2**: ○-☆、○-注

### 3連複（軸1頭流し）
**◎軸**
- **tier1**: ◎-○-▲、◎-○-△、◎-▲-△
- **tier2**: ◎-○-☆、◎-▲-☆、◎-△-☆
- **tier3**: ◎-○-注、◎-▲-注、◎-△-注、◎-☆-注

**○軸**
- **tier1**: ○-▲-△
- **tier2**: ○-▲-☆、○-△-☆
- **tier3**: ○-▲-注、○-△-注、○-☆-注

### 3連単（1着固定流し）
**◎軸**
- **tier1**: ◎→○→▲、◎→○→△、◎→▲→○、◎→▲→△、◎→△→○、◎→△→▲
- **tier2**: ◎→○→☆、◎→▲→☆、◎→△→☆、◎→☆→○、◎→☆→▲、◎→☆→△
- **tier3**: ◎→○→注、◎→▲→注、◎→△→注、◎→☆→注、◎→注→○、◎→注→▲、◎→注→△、◎→注→☆

**○軸**
- **tier1**: ○→◎→▲、○→◎→△、○→▲→◎、○→▲→△、○→△→◎、○→△→▲
- **tier2**: ○→◎→☆、○→▲→☆、○→△→☆、○→☆→◎、○→☆→▲、○→☆→△
- **tier3**: ○→◎→注、○→▲→注、○→△→注、○→☆→注、○→注→◎、○→注→▲、○→注→△、○→注→☆

## 馬券構築パターン（3パターン提示）

以下の3パターンで馬券を構築し、それぞれの推奨馬券を提示する：

### パターンA: tier1重視型
- tier1: 予算の70%
- tier2: 予算の30%
- tier3: 予算の0%

### パターンB: バランス型
- tier1: 予算の60%
- tier2: 予算の30%
- tier3: 予算の10%

### パターンC: tier2-3活用型
- tier1: 予算の50%
- tier2: 予算の30%
- tier3: 予算の20%

### パターンD: 自由型
- tierルールを除外したユーザー入力内容から独自計算した予算配分

## 馬券構築の思考プロセス

### 1. tierに基づく馬券選定
- ユーザー指定の券種から、tier分けルールに従って買い目を選定
- tier1を中心に、tier2、tier3と優先度を下げて選定
- 各パターン（A/B/C/D）で予算配分比率に従って購入金額を決定

### 2. 複合トリガーの優先
- 同じ馬の組み合わせで複数券種を購入
- 同じtier内で複合トリガーを構築
- 例: tier1の◎-○で「馬連」「馬単（両方向）」「ワイド」を同時購入

### 3. 3パターンの構築
- パターンA（tier1重視）、パターンB（バランス）、パターンC（tier2-3活用）、パターンD（自由型/AI馬券）
- それぞれで予算を使い切る馬券を構築
- ユーザーが選択できるように全パターンを出力

## ⚠️ 重要：絶対にしてはいけないこと

### 禁止事項1: AIスコアを確率として扱うこと
- **AI単勝スコア、AI連対スコア、AI複勝スコア**は確率ではありません
- これらは機械学習モデルの正規化された出力値であり、相対的な評価値です
- **絶対に「AI単勝スコア × AI連対スコア」のような掛け算をしないこと**
- **絶対に「AI単勝スコア = 勝つ確率」と解釈しないこと**

### 禁止事項2: AIスコアの数値を過信すること
- AIスコアの絶対値に意味はありません
- 重要なのは**AI順位**（1位が最有力、2位が次点、など）
- **馬印（◎○▲△☆注）を選定し、その馬印に基づいてtier分けルールに従い馬券を構築すること**

### 禁止事項3: 馬印に選ばれていない馬を馬券に含めること
- **馬印（◎○▲△☆注）に選ばれていない馬は、基本的に馬券に含めない**
- tier分けルールに従い、馬印の組み合わせのみで馬券を構築する
- 回収率のために、馬印外の馬を追加しないこと

### 禁止事項4: 回収率の数字合わせを目的化すること
- 目標回収率や下限回収率の数字を合わせることだけを目的に、穴馬や期待値の低い馬券を無理に追加してはいけません。
- 馬券構築の主軸はあくまで「馬印」と「tier分けルール」であり、回収率はその結果として長期的に収束させていく指標です。
- 馬印に選ばれていない馬を、回収率の数字を合わせるためだけに採用してはいけません。
- 下限回収率${minReturn}%を厳密に満たせない場合は、「今回の条件ではルールを守ると下限回収率を少し下回る」などと正直に説明し、そのうえでルールに沿った馬券構成を優先してください。


## 特徴量の確認（参考情報）

以下の特徴量は「データ分析詳細」セクションで参考情報として表示する：
- **final_score**：最終スコア
- **zi_deviation**：前走内容
- **mining_index**：マイニング指数
- **corrected_time_deviation**：過去走レース評価平均

**重要**: これらの特徴量は参考情報であり、馬券構築はAI順位（単勝・連対・複勝）と馬印を基準にする。特徴量の数値そのものを馬券選定に直接使用しないこと。

## 出力形式

### 📊 レース総評

#### レースレベル評価
- **AI評価と人気の乖離度**: ★☆☆☆☆（一致）～ ★★★★★（大きく乖離）
  - AI上位馬と人気上位馬の一致度から判定
  - 乖離が大きいほど、AI評価に基づく妙味のある馬券が構築できる
- **レースの質**: 高い/標準/低い
  - 上位馬の単勝・連対・複勝スコアから判定

#### 展開予想
- AI順位から予想される展開
- 注目すべきポイント
- リスク要因

#### 狙い目分析
- AI順位と人気順位の乖離が大きい馬（オッズバリューあり）
- 特徴量が優秀なのに人気がない馬（参考情報）
- 危険な人気馬（AI評価が低いのに人気先行）

### 🐴 馬印

**印の選定基準**:
- 各馬について、単勝順位・連対順位・複勝順位を総合的に評価
- 複数の順位で上位 = 信頼度が高い
- 複勝スコアも馬券内指標として重視（0.8以上は特に信頼性が高い）

**印の頭数（固定）**:
- ◎（本命）: 1頭
- ○（対抗）: 1頭
- ▲（単穴）: 1頭
- △（連下）: 1頭
- ☆（穴）: 1頭
- 注（注意）: 以下の条件を満たす馬（該当馬がいる場合のみ、複数頭可）
  - パドック良好馬で上位印（◎○▲△☆）に選ばれていない馬
  - または、複勝スコア0.45以上で上位印に選ばれていない馬

**印の付け方**:
- ◎ ○番 馬名（単勝○位/連対○位/複勝○位、複勝スコア○.○○）
- ○ ○番 馬名（単勝○位/連対○位/複勝○位、複勝スコア○.○○）
- ▲ ○番 馬名（単勝○位/連対○位/複勝○位、複勝スコア○.○○）
- △ ○番 馬名（単勝○位/連対○位/複勝○位、複勝スコア○.○○）
- ☆ ○番 馬名（単勝○位/連対○位/複勝○位、複勝スコア○.○○）
- 🐴注 ○番 馬名（単勝○位/連対○位/複勝○位、複勝スコア○.○○）※パドック良好
- 📊注 ○番 馬名（単勝○位/連対○位/複勝○位、複勝スコア○.○○）※スコア0.45以上

**印の意味**:
- **◎本命**: 3つの順位で総合的に最上位、最も信頼できる1頭
- **○対抗**: 本命に次ぐ評価、複数の順位で上位
- **▲単穴**: 特定順位で優秀、または総合3番手
- **△連下**: 2～3着候補、いずれかの順位で上位
- **☆穴**: 総合5番手、特定の指標で光るものがある
- **🐴注**: パドック良好馬で上位印に選ばれていない馬
- **📊注**: 複勝スコア0.45以上で上位印に選ばれていない馬

### 🐴 全馬総評

**出走馬全頭について、以下の形式で簡潔に評価してください**：

#### 評価形式
各馬について、1～2行で記載：

**○番 馬名（単勝○位/連対○位/複勝○位、複勝スコア○.○○）**
- **評価**: ◎本命 / ○対抗 / ▲単穴 / △連下 / ☆穴 / 注意 / 消し
- **総評**: 各種AI順位と人気の関係、複勝スコアを踏まえた簡潔な評価
- **参考**: 軸候補 / 相手候補 / ヒモ候補 / 消し（馬印に選ばれなかった馬も、ユーザーがアレンジする際の参考情報として記載）

#### 重要な注意事項
- **全頭について必ず評価すること**（出走頭数分）
- 馬印に選ばれなかった馬も「参考」として活用方法を記載
- AI順位と人気の乖離があれば、消し馬でも格上げの可能性を示唆
- 消し馬も理由を明記すること
- パドック評価がある馬は必ず言及すること

### 🎯 推奨馬券（パターン別）

**各パターンについて、以下の形式で馬券を提示すること**：

#### パターンA: tier1重視型

| 馬券種別 | 組み合わせ | tier | オッズ | 購入金額 | 的中時払戻 |
|---------|-----------|------|--------|----------|------------|
| （ユーザー指定券種から選定） | （馬印の組み合わせ） | （tier1/2/3） | ○○倍 | ○○円 | ○○円 |

**各馬券の選定理由**:
各馬券について以下の情報を記載：
- **馬印**: ◎-○など、どの印の組み合わせか
- **AI評価**: ○番は単勝○位/連対○位/複勝○位
- **人気**: ○番は○番人気
- **妙味**: AI評価と人気の乖離（大/中/小/なし）
- **複合トリガー**: この組み合わせで同時購入する他の券種
- **軸馬**: ◎軸 または ○軸

**複合トリガーのグループ**:
- グループ1: ◎-○で「馬連」「馬単」「ワイド」を同時購入 → ○-○が来れば3点的中
- グループ2: ◎-▲で「馬連」「馬単」を同時購入 → ○-○が来れば2点的中

**合計投資額**: ${budget}円
**想定回収率**: ○○%

---

#### パターンB: バランス型

（同様の形式）

---

#### パターンC: tier2-3活用型

（同様の形式）

---
#### パターンD: tierルールを除外したユーザー入力内容から出力する馬券

| 馬券種別 | 組み合わせ | オッズ | 購入金額 | 的中時払戻 |
|---------|-----------|--------|----------|------------|
| （ユーザー指定券種から選定） | （馬印の組み合わせ） | ○○倍 | ○○円 | ○○円 |

---
### 💰 パターン比較サマリー

#### 予算配分の比較

| パターン | tier1 | tier2 | tier3 | 合計 |
|---------|-------|-------|-------|------|
| A: tier1重視 | ○○円(70%) | ○○円(30%) | 0円(0%) | ${budget}円 |
| B: バランス | ○○円(60%) | ○○円(30%) | ○○円(10%) | ${budget}円 |
| C: tier2-3活用 | ○○円(50%) | ○○円(30%) | ○○円(20%) | ${budget}円 |
| D: 自由形 | - | - | - | ${budget}円 |

#### 想定回収率と的中パターン

| パターン | 想定回収率 | ◎的中時 | ○的中時 | 注絡み時 |
|---------|-----------|---------|---------|----------|
| A | ○○% | ○○円 | ○○円 | - |
| B | ○○% | ○○円 | ○○円 | ○○円 |
| C | ○○% | ○○円 | ○○円 | ○○円 |
| D | ○○% |

#### 各パターンの特徴

**パターンA: tier1重視型**
- 購入点数: ○点
- 複合トリガー数: ○グループ
- 軸馬: ◎中心
- 特徴: 予想重視、死に馬券最小

**パターンB: バランス型**
- 購入点数: ○点
- 複合トリガー数: ○グループ
- 軸馬: ◎と○
- 特徴: 予想の上位重視、◯からで補完

**パターンC: tier2-3活用型**
- 購入点数: ○点
- 複合トリガー数: ○グループ
- 軸馬: ◎と○
- 特徴: 妙味馬・パドック評価馬を活用、高配当狙い

**パターンD: 自由型**
- 購入点数: ○点
- 複合トリガー数: ○グループ
- 軸馬: 妙味から判断した印
- 特徴: 妙味馬・パドック評価馬を活用、ルールに基づかずAIが組んだ馬券

**重要な構築原則**:
- **パターンの予算配分を厳守**: 各tierの配分比率を必ず守る
- **複合トリガーを意識**: 同じ組み合わせで複数券種を購入し、同時的中を狙う
- **回収率を意識した資金配分**: 全体の想定回収率が下限${minReturn}%を下回らないこと、目標回収率${targetReturn}%も可能な限り近づけること

### 🔍 データ分析詳細

#### AI順位と人気の乖離TOP3
1. ○番馬：AI単勝○位だが○番人気（乖離+○）- オッズバリューあり
2. ○番馬：AI連対○位だが○番人気（乖離+○）- オッズバリューあり
3. ○番馬：AI複勝○位だが○番人気（乖離+○）- オッズバリューあり

#### 特徴量による隠れた実力馬
- 最終スコアが高い割に人気がない：○番、○番
- マイニング指数が優秀：○番、○番
- 前走内容がいい：○番、○番
- 過去走レース評価平均が高い：○番、○番

#### 危険な人気馬
- AI順位は低いが人気先行：○番、○番

### ⚠️ 注意事項
- オッズは変動する可能性があります
- AI予測の限界を理解した上で参考にしてください
- 最終的な購入判断は自己責任でお願いします

---

## 必須制約
- **予算**: ${budget}円を使い切る（各パターンで）
- **購入単位**: 1馬券あたり100円単位（最小100円）
- **回収率**: 全体の想定回収率が下限${minReturn}%を下回らないこと、目標回収率${targetReturn}%も可能な限り近づけること
- **パターン遵守**: A/B/Cの各パターンでtier配分比率を厳守すること
- **馬印遵守**: 馬印（◎○▲△☆注）に選ばれた馬のみで馬券を構築すること
- **複合トリガー**: 同じ組み合わせで複数券種を購入し、同時的中を狙うこと
- 現実的で実行可能な馬券を推奨すること

## 分析の自由度
- AIは提供されたデータから自由に分析・判断してよい
- 各パターン内での資金配分は、妙味やオッズに応じて調整可能
- ユーザーの目標に最適な組み合わせを考案すること
`;
}

// ====================
// AI 注目馬サマリー生成（マーク行形式版）
// ====================

/**
 * 全角数字を半角に変換
 * @param {string} str
 * @returns {string}
 */
function normalizeNumberText(str) {
    if (!str) return '';
    const full = '０１２３４５６７８９';
    const half = '0123456789';
    return str.replace(/[０-９]/g, ch => half[full.indexOf(ch)]);
}

/**
 * 馬印テキストから AI の馬印（◎○▲△☆注）を馬番ごとに抽出
 *
 * 対応パターン例:
 *   ◎ 4 ムルソー
 *   ◎ 4番 ムルソー
 *   ◎【4】ムルソー
 *   - ◎ 4 ムルソー
 *   ◎本命: 10番 ニシノティアモ
 *   ○対抗: 8番 エコロヴァルツ
 *   📊注1: 6番 コガネノソラ
 *   注 3 クリノメイ
 *
 * @param {string} marksText
 * @returns {Object.<number, Set<string>>} // { horseNum: Set(markSymbols) }
 */
function parseMarksFromText(marksText) {
    const result = {};
    if (!marksText) return result;

    const lines = marksText.split(/\r?\n/);

    for (const rawLine of lines) {
        let line = rawLine.trim();
        if (!line) continue;

        // 先頭の箇条書き記号（- * •）を削除
        line = line.replace(/^[-*•]\s*/, '');

        // 先頭に印があるかチェック
        // 例:
        //   ◎本命: 10番 ニシノティアモ
        //   ○対抗: 8番 エコロヴァルツ
        //   📊注1: 6番 コガネノソラ
        //   注3: 3番 クリノメイ
        const headerMatch = line.match(/^([◎○▲△☆]|📊注[0-9]*|注[0-9]*)\s*[:：]?\s*(.+)$/);
        if (!headerMatch) continue;

        let symbolRaw = headerMatch[1];
        const rest = headerMatch[2]; // ここから馬番を探す

        // "📊注1" / "注1" などは全部 "注" に揃える
        let symbol = symbolRaw;
        if (symbolRaw.startsWith('📊注') || symbolRaw.startsWith('注')) {
            symbol = '注';
        }

        // 馬番をいくつかのパターンで探す
        //   【10】 / 10番 / 行頭の「10」
        let numMatch = rest.match(/【\s*([0-9０-９]+)\s*】/);      // 【10】
        if (!numMatch) numMatch = rest.match(/([0-9０-９]+)\s*番/); // 10番
        if (!numMatch) numMatch = rest.match(/^\s*([0-9０-９]+)/);  // "10 ニシノ..."

        if (!numMatch) continue;

        const num = parseInt(normalizeNumberText(numMatch[1]), 10);
        if (!num || Number.isNaN(num)) continue;

        if (!result[num]) result[num] = new Set();
        result[num].add(symbol);
    }

    return result;
}

/**
 * 「🐴 全馬総評」セクションから 評価 / 参考 を馬番ごとに抽出
 * - 「評価: ◎本命」「参考: 軸候補 / ヒモ候補」など
 * @param {string} allHorsesText
 * @returns {Object.<number, { evalTag: string|null, referenceTags: string[] }>}
 */
function parseAllHorsesSection(allHorsesText) {
    const result = {};
    if (!allHorsesText) return result;

    const lines = allHorsesText.split(/\r?\n/);
    let currentNum = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // 例: "4番 ムルソー（…）" or "4 ムルソー（…）"
        const headerMatch = line.match(/^([0-9０-９]+)\s*番?\s+/);
        if (headerMatch) {
            const num = parseInt(normalizeNumberText(headerMatch[1]), 10);
            if (!Number.isNaN(num)) {
                currentNum = num;
                if (!result[currentNum]) {
                    result[currentNum] = {
                        evalTag: null,
                        referenceTags: []
                    };
                }
            }
            continue;
        }

        if (!currentNum || !result[currentNum]) continue;

        // 例: "評価: ◎本命"
        const evalMatch = line.match(/^評価\s*[:：]\s*(.+)$/);
        if (evalMatch) {
            result[currentNum].evalTag = evalMatch[1].trim();
            continue;
        }

        // 例: "参考: 軸候補 / 相手候補"
        const refMatch = line.match(/^参考\s*[:：]\s*(.+)$/);
        if (refMatch) {
            const refs = refMatch[1]
                .split(/[／\/]/)
                .map(s => s.trim())
                .filter(Boolean);
            result[currentNum].referenceTags.push(...refs);
            continue;
        }
    }

    return result;
}

/**
 * 「🔍 データ分析詳細」セクションから
 *  - 妙味・オッズバリュー系
 *  - 危険な人気馬系
 * を馬番ごとに抽出
 * @param {string} dataAnalysisText
 * @returns {{ valueNums: Set<number>, dangerNums: Set<number> }}
 */
function parseDataAnalysisSection(dataAnalysisText) {
    const valueNums = new Set();
    const dangerNums = new Set();
    if (!dataAnalysisText) return { valueNums, dangerNums };

    const lines = dataAnalysisText.split(/\r?\n/);

    function extractHorseNumsFromLine(line) {
        const nums = new Set();
        if (!line) return nums;

        // 先頭の「数字+番」 or 「数字+空白」
        const head = line.match(/^\s*([0-9０-９]+)\s*番?/);
        if (head) {
            const n = parseInt(normalizeNumberText(head[1]), 10);
            if (!Number.isNaN(n)) nums.add(n);
        }

        // 行中の「XX番」
        const all = line.match(/([0-9０-９]+)\s*番/g);
        if (all) {
            all.forEach((match) => {
                const m2 = match.match(/([0-9０-９]+)\s*番/);
                if (m2) {
                    const n = parseInt(normalizeNumberText(m2[1]), 10);
                    if (!Number.isNaN(n)) nums.add(n);
                }
            });
        }

        return nums;
    }

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const hasValueWord = /オッズバリュー|妙味|妙味馬|妙味あり|隠れた実力馬/.test(line);
        const hasDangerWord = /危険な人気馬|過剰人気/.test(line);

        if (!hasValueWord && !hasDangerWord) continue;

        const nums = extractHorseNumsFromLine(line);
        nums.forEach((n) => {
            if (hasValueWord) valueNums.add(n);
            if (hasDangerWord) dangerNums.add(n);
        });
    }

    return { valueNums, dangerNums };
}

/**
 * 各馬の情報をまとめて候補リストにする
 * @param {Object} race
 * @param {string} analysisText
 * @returns {Array<Object>}
 */
function collectKeyHorseCandidates(race, analysisText) {
    const horses = race?.horses || [];
    if (!horses.length || !analysisText) return [];

    let sections = null;
    if (typeof extractSections === 'function') {
        sections = extractSections(analysisText);
    }

    const aiMarksByNum = sections?.marks ? parseMarksFromText(sections.marks) : {};
    const allHorsesInfo = sections?.allHorses ? parseAllHorsesSection(sections.allHorses) : {};
    const dataInfo = sections?.dataAnalysis
        ? parseDataAnalysisSection(sections.dataAnalysis)
        : { valueNums: new Set(), dangerNums: new Set() };

    const valueNums = dataInfo.valueNums;
    const dangerNums = dataInfo.dangerNums;

    const raceId = (typeof getRaceId === 'function' && race) ? getRaceId(race) : null;

    const candidates = [];

    horses.forEach((horse, index) => {
        const num = horse.horse_number;
        const name = horse.horse_name || '';
        const pop = typeof horse.popularity === 'number' ? horse.popularity : null;
        const win = horse.predictions?.win_rate ?? null;
        const show = horse.predictions?.show_rate ?? null;

        const aiMarksSet = aiMarksByNum[num] || new Set();
        const aiMarks = Array.from(aiMarksSet);

        const allInfo = allHorsesInfo[num] || { evalTag: null, referenceTags: [] };
        const evalTag = allInfo.evalTag || '';
        const referenceTags = allInfo.referenceTags || [];

        const hasValueMention = valueNums.has(num);
        const isDanger = dangerNums.has(num);

        const isDeleted =
            /消し/.test(evalTag) ||
            referenceTags.some((t) => t.includes('消し'));

        // ユーザー馬印
        let userMarks = [];
        if (raceId && typeof horseMarks === 'object' && horseMarks[raceId]?.[index]) {
            const slots = horseMarks[raceId][index];
            slots.forEach((idx) => {
                const m = MARKS[idx];
                if (m && m.symbol !== '—') userMarks.push(m.symbol);
            });
        }

        candidates.push({
            num,
            name,
            pop,
            win,
            show,
            aiMarks,
            aiMarksSet,
            userMarks,
            evalTag,
            referenceTags,
            hasValueMention,
            isDanger,
            isDeleted
        });
    });

    return candidates;
}

/**
 * 注目馬サマリーのHTMLを生成
 * - 表示形式:
 *   ◎【4】ムルソー (1人気 / 複 89.3 / 単 85.9)
 *   〇【15】クールミラボー (5人気 / 複 78.8 / 単 74.1)
 *   …
 *   注【3】ハギノサステナブル (9人気 / 複 62.5 / 単 54.0)、【5】カンピオーネ (12人気 / 複 46.1 / 単 36.0)…
 *
 * ルール:
 *  - ◎○▲△☆ は 馬印（AI + 自分の印）から決定
 *  - 注 は
 *      ・馬印で「注」(📊注/注) が付いた馬
 *      ・または 複勝スコア >= 0.45（画面上 45 以上）かつ ◎○▲△☆ に入っていない馬
 *      ・または 複勝 < 0.45 だが「データ分析詳細」で妙味/隠れた実力馬として言及されている馬
 *  - 「妙味あり」だけで拾われていた 0.45 未満はここで弾く
 *  - 重複なし
 *  - 数値は相対評価値なので % は付けない
 *
 * @param {Object} race
 * @param {string} analysisText
 * @returns {string}
 */
function buildKeyHorseSummaryHtml(race, analysisText) {
    if (!race || !race.horses || !race.horses.length || !analysisText) return '';

    const candidates = collectKeyHorseCandidates(race, analysisText);
    if (!candidates.length) return '';

    // 馬ごとの表示ラベル生成
    function buildLabel(c) {
        const infoParts = [];

        if (typeof c.pop === 'number') {
            infoParts.push(`${c.pop}人気`);
        }
        if (typeof c.show === 'number') {
            const v = (c.show * 100).toFixed(1).replace(/\.0$/, '');
            infoParts.push(`複 ${v}`);
        }
        if (typeof c.win === 'number') {
            const v = (c.win * 100).toFixed(1).replace(/\.0$/, '');
            infoParts.push(`単 ${v}`);
        }

        const infoText = infoParts.length ? ` (${infoParts.join(' / ')})` : '';
        return `【${c.num}】${c.name}${infoText}`;
    }

    const markOrder = ['◎', '○', '▲', '△', '☆'];
    const lineMap = {
        '◎': [],
        '○': [],
        '▲': [],
        '△': [],
        '☆': [],
        '注': []
    };

    const assignedMainNums = new Set();

    // 1. まず ◎〜☆ を決める（馬印ベース）
    candidates.forEach((c) => {
        const num = c.num;

        // 優先マークを決定（AI印 > 自分の印）
        let primaryMark = null;
        for (const m of markOrder) {
            if (c.aiMarksSet && c.aiMarksSet.has(m)) {
                primaryMark = m;
                break;
            }
        }
        if (!primaryMark) {
            for (const m of markOrder) {
                if (c.userMarks && c.userMarks.includes(m)) {
                    primaryMark = m;
                    break;
                }
            }
        }

        if (!primaryMark) {
            return;
        }

        const label = buildLabel(c);
        lineMap[primaryMark].push(label);
        assignedMainNums.add(num);
    });

    // 2. 注 を決める
    candidates.forEach((c) => {
        const num = c.num;
        const show = typeof c.show === 'number' ? c.show : null;

        const hasAttentionMark = c.aiMarksSet && c.aiMarksSet.has('注');
        const showOK = show !== null && show >= 0.45; // 画面上 45 以上
        const inMain = assignedMainNums.has(num);

        // 0.45 未満で「馬印の注もなく」「データ分析詳細にも妙味系で出てない」→ 要らない
        if (!showOK && !hasAttentionMark && !c.hasValueMention) {
            return;
        }

        // 条件:
        //  - 馬印で「注」が付いている
        //  - または 複勝 >= 0.45 かつ ◎〜☆ に入っていない
        //  - または データ分析詳細で妙味/隠れた実力として明示的に言及
        if (
            hasAttentionMark ||
            (!inMain && showOK) ||
            (!inMain && c.hasValueMention)
        ) {
            const label = buildLabel(c);
            lineMap['注'].push(label);
        }
    });

    // 3. 各行の重複を削除
    Object.keys(lineMap).forEach((key) => {
        const seen = new Set();
        const unique = [];
        lineMap[key].forEach((label) => {
            if (seen.has(label)) return;
            seen.add(label);
            unique.push(label);
        });
        lineMap[key] = unique;
    });

    // なにもなければ表示しない
    const hasAny =
        lineMap['◎'].length ||
        lineMap['○'].length ||
        lineMap['▲'].length ||
        lineMap['△'].length ||
        lineMap['☆'].length ||
        lineMap['注'].length;

    if (!hasAny) return '';

    // 4. 行テキストを組み立て
    const lines = [];

    function pushLine(markSymbol, key) {
        const list = lineMap[key];
        if (!list || !list.length) return;
        const joined = list.join('、');
        lines.push(`${markSymbol}${joined}`);
    }

    pushLine('◎', '◎');
    pushLine('〇', '○'); // 表示は「〇」
    pushLine('▲', '▲');
    pushLine('△', '△');
    pushLine('☆', '☆');
    pushLine('注', '注');

    const bodyHtml = lines
        .map((line) => `<div class="ai-keyhorses-line">${line}</div>`)
        .join('');

    const html =
        '<div class="ai-keyhorses-card">' +
            '<div class="ai-keyhorses-header">' +
                '<div class="ai-keyhorses-title">🎯 注目馬まとめ</div>' +
                '<div class="ai-keyhorses-tagline">馬印・紐・妙味候補をまとめて確認できます</div>' +
            '</div>' +
            '<div class="ai-keyhorses-body">' +
                bodyHtml +
            '</div>' +
        '</div>';

    return html;
}

/**
 * 注目馬サマリーを画面に反映
 * @param {Object} race
 * @param {string} analysisText
 */
function updateKeyHorseSummary(race, analysisText) {
    const container = document.getElementById('aiKeyHorsesSummary');
    if (!container) return;

    const html = buildKeyHorseSummaryHtml(race, analysisText);
    container.innerHTML = html || '';
}




/**
 * 出走馬データをフォーマット（gemini.jsと同じロジック）
 */
function formatHorsesData(horses) {
    // 表形式で見やすく整理（AIスコアとランクを追加）
    let formatted = '\n| 順位 | 馬番 | 馬名 | 最終スコア | AI単勝スコア | AI単順位 | AI連対スコア | AI連順位 | AI複勝スコア | AI複順位 | マイニング指数 | 戦績マイニング | ZI指数 | 補正タイム偏差値 | 類似係数 | 安定係数 | 騎手名 | 騎手勝率 | 調教師名 | 調教師勝率 | 出走間隔 | 前走着順 |\n';
    formatted += '|------|------|------|------------|------------|----------|------------|----------|------------|----------|----------------|----------------|--------|----------------|----------|----------|--------|----------|----------|------------|----------|----------|\n';

    horses.forEach((horse, index) => {
        const pastRace = horse.past_races && horse.past_races.length > 0 ? horse.past_races[0] : null;
        
        // AIスコアとランクを取得
        const winScore = horse.predictions ? horse.predictions.win_rate.toFixed(4) : '-';
        const winRank = horse.predictions ? horse.predictions.win_rate_rank : '-';
        const placeScore = horse.predictions ? horse.predictions.place_rate.toFixed(4) : '-';
        const placeRank = horse.predictions ? horse.predictions.place_rate_rank : '-';
        const showScore = horse.predictions ? horse.predictions.show_rate.toFixed(4) : '-';
        const showRank = horse.predictions ? horse.predictions.show_rate_rank : '-';
        
        formatted += `| ${index + 1} | ${horse.horse_number} | ${horse.horse_name} | `;
        formatted += `${horse.indices.final_score.toFixed(2)} | `;
        formatted += `**${winScore}** | ${winRank} | `;  // AI単勝スコアとランク
        formatted += `**${placeScore}** | ${placeRank} | `;  // AI連対スコアとランク
        formatted += `**${showScore}** | ${showRank} | `;  // AI複勝スコアとランク
        formatted += `${horse.indices.mining_index.toFixed(1)} | `;
        formatted += `**${horse.battle_mining.toFixed(1)}** | `;  // 戦績マイニングを強調
        formatted += `${horse.zi_index.toFixed(1)} | `;
        formatted += `**${horse.indices.corrected_time_deviation ? horse.indices.corrected_time_deviation.toFixed(1) : '-'}** | `;  // 補正タイム偏差値を強調
        formatted += `${horse.indices.similarity_coefficient.toFixed(5)} | `;  // 小数点第5位まで
        formatted += `${horse.indices.stability_coefficient.toFixed(5)} | `;   // 小数点第5位まで
        formatted += `${horse.jockey.name} | `;
        formatted += `${horse.jockey.this_year.win_rate.toFixed(1)}% | `;
        formatted += `${horse.trainer.name} | `;
        formatted += `${horse.trainer.this_year.win_rate.toFixed(1)}% | `;
        formatted += `${horse.interval}週 | `;
        formatted += `${pastRace ? pastRace.rank + '着' : '-'} |\n`;
    });

    // 詳細情報（上位5頭のみ）
    formatted += '\n### 上位5頭の詳細分析\n\n';
    
    horses.slice(0, 5).forEach((horse, index) => {
        // AIスコアとランクを取得
        const winScore = horse.predictions ? horse.predictions.win_rate.toFixed(4) : '-';
        const winRank = horse.predictions ? horse.predictions.win_rate_rank : '-';
        const placeScore = horse.predictions ? horse.predictions.place_rate.toFixed(4) : '-';
        const placeRank = horse.predictions ? horse.predictions.place_rate_rank : '-';
        const showScore = horse.predictions ? horse.predictions.show_rate.toFixed(4) : '-';
        const showRank = horse.predictions ? horse.predictions.show_rate_rank : '-';
        
        formatted += `#### ${index + 1}位: ${horse.horse_number}番 ${horse.horse_name}\n`;
        formatted += `- **最終スコア**: ${horse.indices.final_score.toFixed(2)}\n`;
        formatted += `- **AI単勝スコア**: **${winScore}** (順位: ${winRank})（LightGBM正規化スコア、確率ではない）\n`;
        formatted += `- **AI連対スコア**: **${placeScore}** (順位: ${placeRank})（LightGBM正規化スコア、確率ではない）\n`;
        formatted += `- **AI複勝スコア**: **${showScore}** (順位: ${showRank})（LightGBM正規化スコア、確率ではない）\n`;
        formatted += `- **マイニング指数**: ${horse.indices.mining_index.toFixed(1)}\n`;
        formatted += `- **戦績マイニング**: **${horse.battle_mining.toFixed(1)}**（重視）\n`;
        formatted += `- **ZI指数**: ${horse.zi_index.toFixed(1)}（標準的な指標）\n`;
        formatted += `- **補正タイム偏差値**: **${horse.indices.corrected_time_deviation ? horse.indices.corrected_time_deviation.toFixed(1) : '-'}**（重要指標）\n`;
        formatted += `- **類似係数**: ${horse.indices.similarity_coefficient.toFixed(5)}（1.0が標準、${horse.indices.similarity_coefficient >= 1.0 ? '好材料' : '注意'}）\n`;
        formatted += `- **安定係数**: ${horse.indices.stability_coefficient.toFixed(5)}（1.0が標準、${horse.indices.stability_coefficient >= 1.0 ? '安定' : '不安定'}）\n`;
        formatted += `- **騎手**: ${horse.jockey.name} (${horse.jockey.weight}kg) - 勝率${horse.jockey.this_year.win_rate.toFixed(1)}%（参考）\n`;
        formatted += `- **調教師**: ${horse.trainer.name} (${horse.trainer.affiliation}) - 勝率${horse.trainer.this_year.win_rate.toFixed(1)}%（参考）\n`;
        formatted += `- **出走間隔**: ${horse.interval}週（あまり気にしない）\n`;
        
        // 過去3走の成績
        if (horse.past_races && horse.past_races.length > 0) {
            formatted += `- **過去3走**:\n`;
            horse.past_races.slice(0, 3).forEach((race, raceIndex) => {
                formatted += `  ${raceIndex + 1}. ${race.date} ${race.place} ${race.surface}${race.distance}m (${race.track_condition}) - ${race.rank}着\n`;
            });
        }
        formatted += '\n';
    });

    return formatted;
}

/**
 * オッズデータをフォーマット（gemini.jsと同じロジック）
 */
function formatOddsData(oddsData) {
    let formatted = '';

    oddsData.forEach(odds => {
        formatted += `\n### ${odds.odds_type_name}\n`;

        switch (odds.odds_type) {
            case 'tfw':
                // 単勝（全頭）
                formatted += '\n#### 単勝\n';
                formatted += '| 馬番 | 馬名 | オッズ |\n';
                formatted += '|------|------|--------|\n';
                odds.data.tansho.forEach(item => {
                    formatted += `| ${item.horse_num} | ${item.horse_name} | ${item.odds} |\n`;
                });

                // 複勝（全頭）
                formatted += '\n#### 複勝\n';
                formatted += '| 馬番 | 馬名 | オッズ |\n';
                formatted += '|------|------|--------|\n';
                odds.data.fukusho.forEach(item => {
                    formatted += `| ${item.horse_num} | ${item.horse_name} | ${item.odds.min} - ${item.odds.max} |\n`;
                });
                break;

            default:
                // その他の券種（枠連、馬連、ワイド、馬単、3連複、3連単）
                formatted += '\n| 組み合わせ | オッズ |\n';
                formatted += '|------------|--------|\n';
                
                // 全件表示（Geminiが正確な馬券推奨をできるように）
                odds.data.combinations.forEach(c => {
                    const oddsValue = (typeof c.odds === 'object') ? `${c.odds.min} - ${c.odds.max}` : c.odds;
                    formatted += `| ${c.combination} | ${oddsValue} |\n`;
                });
                break;
        }
    });

    return formatted;
}

/**
 * 選択された馬券種のオッズデータのみをフォーマット（プロンプトサイズ削減）
 * @param {Array} oddsData - 全オッズデータ
 * @param {Array} betTypes - 選択された馬券種（例: ['馬単', '馬連', '3連複']）
 */
function formatSelectedOddsData(oddsData, betTypes) {
    let formatted = '';

    // 馬券種名とodds_typeのマッピング（yahoo_odds_scheduler.pyの値と一致）
    const betTypeMap = {
        '単勝': 'tfw',
        '複勝': 'tfw',
        '枠連': 'wakuren',
        '馬連': 'umaren',
        'ワイド': 'wide',
        '馬単': 'umatan',
        '3連複': 'sanrenpuku',
        '3連単': 'sanrentan'
    };

    // 選択された馬券種のodds_typeを取得
    const selectedOddsTypes = betTypes.map(bt => betTypeMap[bt]).filter(Boolean);

    // 単勝・複勝は常に含める（基本情報として）
    if (!selectedOddsTypes.includes('tfw')) {
        selectedOddsTypes.unshift('tfw');
    }
    
    console.log('[formatSelectedOddsData] betTypes:', betTypes);
    console.log('[formatSelectedOddsData] selectedOddsTypes:', selectedOddsTypes);

    oddsData.forEach(odds => {
        console.log('[formatSelectedOddsData] Processing odds_type:', odds.odds_type, 'odds_type_name:', odds.odds_type_name);
        // 選択された馬券種のみ出力
        if (!selectedOddsTypes.includes(odds.odds_type)) {
            console.log('[formatSelectedOddsData] Skipping odds_type:', odds.odds_type);
            return;
        }
        console.log('[formatSelectedOddsData] Including odds_type:', odds.odds_type);

        formatted += `\n### ${odds.odds_type_name}\n`;

        switch (odds.odds_type) {
            case 'tfw':
                // 単勝（全頭）
                formatted += '\n#### 単勝\n';
                formatted += '| 馬番 | 馬名 | オッズ |\n';
                formatted += '|------|------|--------|\n';
                odds.data.tansho.forEach(item => {
                    formatted += `| ${item.horse_num} | ${item.horse_name} | ${item.odds} |\n`;
                });

                // 複勝（全頭）
                formatted += '\n#### 複勝\n';
                formatted += '| 馬番 | 馬名 | オッズ |\n';
                formatted += '|------|------|--------|\n';
                odds.data.fukusho.forEach(item => {
                    formatted += `| ${item.horse_num} | ${item.horse_name} | ${item.odds.min} - ${item.odds.max} |\n`;
                });
                break;

            default:
                // その他の券種（枚連、馬連、ワイド、馬単、3連複、3連単）
                formatted += '\n| 組み合わせ | オッズ |\n';
                formatted += '|------------|--------|\n';
                
                // 全件表示（Geminiが正確な馬券推奨をできるように）
                odds.data.combinations.forEach(c => {
                    const oddsValue = (typeof c.odds === 'object') ? `${c.odds.min} - ${c.odds.max}` : c.odds;
                    formatted += `| ${c.combination} | ${oddsValue} |\n`;
                });
                break;
        }
    });

    return formatted;
}

// ====================
// OpenAI API関連
// ====================

/**
 * OpenAI APIキーを保存
 */
function saveOpenAIKey() {
    const apiKeyInput = document.getElementById('openaiApiKey');
    if (!apiKeyInput) return;
    
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('APIキーを入力してください');
        return;
    }
    
    if (!apiKey.startsWith('sk-')) {
        alert('OpenAI APIキーは "sk-" で始まる必要があります');
        return;
    }
    
    localStorage.setItem('openai_api_key', apiKey);
    window.OPENAI_API_KEY = apiKey;
    alert('OpenAI APIキーを保存しました');
}

/**
 * OpenAI APIを呼び出し
 */
async function callOpenAI(model, prompt) {
    // APIキーを最新の状態で取得
    const apiKey = getOpenAIApiKey();
    
    if (!apiKey) {
        throw new Error('OpenAI APIキーが設定されていません。API設定から設定してください。');
    }
    
    console.log(`[OpenAI] API Key found: ${apiKey.substring(0, 10)}...`);
    
    console.log(`[OpenAI] Calling ${model}...`);
    console.log(`[OpenAI] Prompt length: ${prompt.length}`);
    
    // リクエストボディの構築
    const requestBody = {
        model: model,
        messages: [
            {
                role: 'system',
                content: 'あなたは競馬予想の専門家です。データを分析して、的確な馬券推奨を行ってください。'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        max_completion_tokens: model.includes('gpt-5') ? 16000 : 4000  // GPT-5は16000トークン
    };
    
    // GPT-5-nano以外のモデルのみにtemperatureを設定
    if (!model.includes('gpt-5')) {
        requestBody.temperature = 0.7;
    }
    
    // AbortControllerでタイムアウト制御（120秒）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    let response;
    try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const result = await response.json();
    console.log('[OpenAI] Success');
    console.log('[OpenAI] Response:', result);
    
    // レスポンスの構造を確認
    if (!result.choices || result.choices.length === 0) {
        console.error('[OpenAI] Invalid response structure:', result);
        throw new Error('OpenAI APIからのレスポンスが無効です。');
    }
    
    const content = result.choices[0].message?.content;
    if (!content) {
        console.error('[OpenAI] No content in response:', result.choices[0]);
        throw new Error('OpenAI APIからのレスポンスにコンテンツがありません。');
    }
    
    console.log('[OpenAI] Content length:', content.length);
    return content;
}

/**
 * AI分析を実行（OpenAI版）
 */
async function runAIAnalysisWithOpenAI(model) {
    const aiResultDiv = document.getElementById('aiResult');
    aiResultDiv.innerHTML = '<div class="loading-spinner"></div><div>AIが分析中です...</div>';
    
    // OpenAI APIキーの確認
    if (!getOpenAIApiKey()) {
        aiResultDiv.innerHTML = '<div class="error">OpenAI APIキーを設定してください。<br>AIモデル選択でGPT-5-nanoまたはGPT-4o-miniを選ぶと、APIキー入力欄が表示されます。</div>';
        return;
    }
    
    // 選択されたレースの確認
    if (!selectedRace) {
        aiResultDiv.innerHTML = '<div class="error">レースを選択してください。</div>';
        return;
    }
    
    // ユーザーパラメータの取得
    const budgetEl = document.getElementById('aiBudget');
    const minReturnEl = document.getElementById('aiMinReturn');
    const targetReturnEl = document.getElementById('aiTargetReturn');
    
    if (!budgetEl || !minReturnEl || !targetReturnEl) {
        aiResultDiv.innerHTML = '<div class="error">エラー: AI分析フォームが見つかりません。ページをリロードしてください。</div>';
        console.error('[OpenAI] Form elements not found:', { budgetEl, minReturnEl, targetReturnEl });
        return;
    }
    
    const budget = parseInt(budgetEl.value) || 1000;
    const minReturn = parseFloat(minReturnEl.value) || 1.5;
    const targetReturn = parseFloat(targetReturnEl.value) || 10.0;
    const betTypes = Array.from(document.querySelectorAll('input[name="betType"]:checked')).map(cb => cb.value);
    const paddockHorses = Array.from(document.querySelectorAll('input[name="paddockEval"]:checked')).map(cb => parseInt(cb.value));
    
    try {
        const raceId = selectedRace.race_number;
        currentOddsData = await window.loadOddsData(raceId);
        
        // プロンプト作成
        const prompt = createPrompt(selectedRace, currentOddsData, { budget, minReturn, targetReturn, betTypes, paddockHorses });
        
        console.log('[OpenAI] Calling OpenAI API...');
        console.log('[OpenAI] Model:', model);
        console.log('[OpenAI] Prompt length:', prompt.length);
        console.log('='.repeat(80));
        console.log('[OpenAI] Full Prompt:');
        console.log(prompt);
        console.log('='.repeat(80));
        
        const analysisText = await callOpenAI(model, prompt);

        // 注目馬サマリーを更新
        updateKeyHorseSummary(selectedRace, analysisText);

        // marked.jsを使ってMarkdownをHTMLに変換
        aiResultDiv.innerHTML = marked.parse(analysisText);

        // localStorageに保存
        saveAIAnalysisResult(selectedRace.race_number, {
            timestamp: Date.now(),
            result: analysisText,
            model: model,
            params: { budget, minReturn, targetReturn, betTypes, paddockHorses }
        });
        
        // AI分析完了通知を送信
        if (typeof window.notifyAIAnalysisComplete === 'function') {
            const raceName = `${selectedRace.place}${selectedRace.round}R ${selectedRace.race_name || ''}`;
            window.notifyAIAnalysisComplete({
                raceName: raceName,
                raceId: selectedRace.race_number
            });
        }
        
    } catch (error) {
        console.error('[OpenAI] Error:', error);
        aiResultDiv.innerHTML = `<div class="error">AI分析エラー: ${error.message}</div>`;
    }
}

// ====================
// localStorage関連
// ====================

/**
 * AI分析結果をlocalStorageに保存
 * @param {string} raceId - レースID
 * @param {object} data - 保存するデータ { timestamp, result, model, params }
 */
function saveAIAnalysisResult(raceId, analysisText) {
    try {
        const storageKey = 'ai_analysis_results';
        const raw = localStorage.getItem(storageKey);
        const map = raw ? JSON.parse(raw) : {};

        map[raceId] = {
            analysis: analysisText,
            updatedAt: new Date().toISOString(),
        };

        localStorage.setItem(storageKey, JSON.stringify(map));
        console.log('[AI結果保存]', raceId);

        // レース一覧があれば再描画（AI済バッジ反映）
        if (typeof window.displayRaces === 'function' && Array.isArray(window.filteredRaces)) {
            window.displayRaces();
        }
    } catch (error) {
        console.error('AI分析結果の保存に失敗:', error);
    }
}


/**
 * AI分析結果をlocalStorageから読み込み
 * @param {string} raceId - レースID
 * @returns {object|null} 保存されたデータ、または null
 */
function loadAIAnalysisResult(raceId) {
    try {
        const savedResults = JSON.parse(localStorage.getItem('ai_analysis_results') || '{}');
        return savedResults[raceId] || null;
    } catch (error) {
        console.error('[localStorage] Error loading AI analysis result:', error);
        return null;
    }
}

/**
 * レース選択時に保存されたAI分析結果を自動読み込み
 * @param {string} raceId - レースID
 */
function autoLoadAIAnalysisResult(raceId) {
    console.log('[localStorage] Checking for saved analysis for race:', raceId);
    const savedData = loadAIAnalysisResult(raceId);
    if (!savedData) {
        console.log('[localStorage] No saved analysis found for race:', raceId);
        return;
    }

    const aiResultDiv = document.getElementById('aiResult');
    if (!aiResultDiv) {
        console.warn('[localStorage] aiResult element not found');
        return;
    }

    // 互換用：result / analysis / text のどれかに入っていれば採用
    let markdown = null;
    if (typeof savedData.result === 'string' && savedData.result.trim() !== '') {
        markdown = savedData.result;
    } else if (typeof savedData.analysis === 'string' && savedData.analysis.trim() !== '') {
        markdown = savedData.analysis;
    } else if (typeof savedData.text === 'string' && savedData.text.trim() !== '') {
        markdown = savedData.text;
    }

    // それでも取れなかったら古い or 壊れたデータ
    if (!markdown) {
        console.warn('[localStorage] Saved AI analysis has no text. raceId:', raceId, savedData);
        aiResultDiv.innerHTML =
            '<div class="error">保存済みのAI分析結果の形式が古いため読み込めませんでした。もう一度AI分析を実行してください。</div>';
        return;
    }

    // marked のクラッシュ防止
    try {
        aiResultDiv.innerHTML = marked.parse(markdown);
    } catch (e) {
        console.error('[localStorage] Error parsing markdown:', e, markdown);
        aiResultDiv.innerHTML =
            '<div class="error">保存済みのAI分析結果の読み込み中にエラーが発生しました。もう一度AI分析を実行してください。</div>';
        return;
    }

    // 保存情報の表示（あれば）
    try {
        if (savedData.timestamp && savedData.params) {
            const savedDate = new Date(savedData.timestamp);
            const infoDiv = document.createElement('div');
            infoDiv.className = 'saved-info';
            infoDiv.style.cssText =
                'background: #e3f2fd; border: 1px solid #2196f3; padding: 10px; margin-bottom: 15px; font-size: 0.9em;';
            const modelText = savedData.model ? savedData.model : '不明';
            const params = savedData.params;
            infoDiv.innerHTML =
                '<strong>💾 保存された分析結果</strong><br>' +
                '保存日時: ' + savedDate.toLocaleString('ja-JP') + '<br>' +
                'モデル: ' + modelText + '<br>' +
                'パラメータ: 予算' + params.budget + '円、下限' + params.minReturn + '%、目標' + params.targetReturn + '%';
            aiResultDiv.insertBefore(infoDiv, aiResultDiv.firstChild);
        }
    } catch (e) {
        console.warn('[localStorage] Failed to render saved info block:', e, savedData);
    }

    // 注目馬まとめも、保存済みテキストから再生成
    try {
        if (typeof updateKeyHorseSummary === 'function' && window.selectedRace) {
            updateKeyHorseSummary(window.selectedRace, markdown);
        }
    } catch (e) {
        console.warn('[localStorage] updateKeyHorseSummary failed:', e);
    }

    console.log('[localStorage] Loaded saved AI analysis result for race:', raceId);
}


// グローバルに公開
window.autoLoadAIAnalysisResult = autoLoadAIAnalysisResult;

/**
 * 古いAI分析結果を削除（PWA対応）
 * - raceid.csvに存在しないレースIDのデータを削除
 * - 7日以上前のデータも削除
 */
async function cleanupOldAnalysisResults() {
    try {
        console.log('[Cleanup] Starting cleanup of old AI analysis results...');
        
        // raceid.csvから現在のレースIDリストを取得
        const timestamp = new Date().getTime();
        const raceidUrl = `https://bakechhh.github.io/keiba-index/raceid.csv?_=${timestamp}`;
        const response = await fetch(raceidUrl, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            console.warn('[Cleanup] Failed to fetch raceid.csv');
            return;
        }
        
        const text = await response.text();
        const lines = text.trim().split('\n');
        const currentRaceIds = [];
        
        // raceid.csvをパース（1行目はヘッダーなのでスキップ）
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const columns = line.split(',');
            if (columns.length >= 1) {
                const raceId = columns[0].trim();
                if (raceId) {
                    currentRaceIds.push(raceId);
                }
            }
        }
        
        console.log('[Cleanup] Current race IDs count:', currentRaceIds.length);
        
        // localStorageから保存されているAI分析結果を取得
        const savedResults = JSON.parse(localStorage.getItem('ai_analysis_results') || '{}');
        
        // 古いレースIDのデータを削除
        let deletedCount = 0;
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        for (const raceId in savedResults) {
            let shouldDelete = false;
            
            // 条件1: raceid.csvに存在しないレースID
            if (!currentRaceIds.includes(raceId)) {
                console.log('[Cleanup] Deleting race not in raceid.csv:', raceId);
                shouldDelete = true;
            }
            
            // 条件2: 7日以上前のデータ
            if (savedResults[raceId].timestamp < sevenDaysAgo) {
                console.log('[Cleanup] Deleting old data (>7 days):', raceId);
                shouldDelete = true;
            }
            
            if (shouldDelete) {
                delete savedResults[raceId];
                deletedCount++;
            }
        }
        
        // 更新されたデータを保存
        localStorage.setItem('ai_analysis_results', JSON.stringify(savedResults));
        
        // 現在のレースIDリストを保存（次回の比較用）
        localStorage.setItem('current_race_ids', JSON.stringify(currentRaceIds));
        localStorage.setItem('last_cleanup_timestamp', Date.now().toString());
        
        if (deletedCount > 0) {
            console.log(`[Cleanup] ✅ Deleted ${deletedCount} old analysis results`);
        } else {
            console.log('[Cleanup] ✅ No old data to delete');
        }
        
    } catch (error) {
        console.error('[Cleanup] Error during cleanup:', error);
    }
}

// ====================
// エラーメッセージ改善関数
// ====================
function getErrorMessage(error) {
    if (!navigator.onLine) {
        return 'インターネット接続がありません。接続を確認してください。';
    }
    
    if (error.message.includes('AbortError') || error.message.includes('タイムアウト')) {
        return 'リクエストがタイムアウトしました。もう一度お試しください。';
    }
    
    if (error.message.includes('429')) {
        return 'APIの利用制限に達しました。しばらく待ってからお試しください。';
    }
    
    if (error.message.includes('403')) {
        return 'APIキーが無効です。設定を確認してください。';
    }
    
    if (error.message.includes('Failed to fetch')) {
        return 'ネットワークエラーが発生しました。接続を確認してください。';
    }
    
    return `エラーが発生しました: ${error.message}`;
}

// ====================
// ネットワーク状態監視（PWA対応）
// ====================
window.addEventListener('online', () => {
    console.log('✅ オンラインに復帰しました');
    // UIに通知を表示（オプション）
    const notification = document.createElement('div');
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 15px 20px; border-radius: 5px; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);';
    notification.textContent = '✅ インターネットに接続しました';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
});

window.addEventListener('offline', () => {
    console.log('⚠️ オフラインになりました');
    // UIに警告を表示
    const warning = document.createElement('div');
    warning.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #FF9800; color: white; padding: 15px 20px; border-radius: 5px; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);';
    warning.textContent = '⚠️ インターネット接続が切断されました';
    document.body.appendChild(warning);
    setTimeout(() => warning.remove(), 5000);
});

// グローバルに公開
window.cleanupOldAnalysisResults = cleanupOldAnalysisResults;
window.runAIAnalysis = runAIAnalysis;
window.getErrorMessage = getErrorMessage;