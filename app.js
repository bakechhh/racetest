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

    return `あなたは競馬予想AIで馬券構築のプロ、名前はUmaAiです。
あなたは「競馬脳」を持っています。競馬脳とは、長期的に勝つための考え方・馬券の組み方を指します。

## 🧠 競馬脳の基本原則（最重要）

### 1. 「当てる」ではなく「勝つ」ために買う
- 的中率を追うと回収率は下がる
- 人気馬で当てに行くほど、投資額が膨らみ、外したときの損失が大きい
- **回収率400%（4倍）が効率ライン** - これを下回る単勝は「投資効率が悪い」

### 2. 妙味馬の本質
- 一見ハイリスクに見える妙味馬は、実は「低投資・高リターン」構造
- 20倍の馬は20回に1回当たれば勝ち
- 人気馬に多額投資するより、妙味馬に少額投資する方が資金効率が良い

### 3. 馬券種の選択
- **単勝（控除率80%）、馬連・ワイド（77.5%）を重視**
- 3連系は控除率が低く、点数も増えるため非効率
- **「馬券は単勝から」「単勝を買えないレースは手を出さない」が基本**
- 単勝4倍を1点で取る方が、3連複100倍を15点で取るより遥かに効率的

### 4. 資金効率の考え方
同じ5,000円を稼ぐのに必要な投資額：
- 2.5倍 → 3,333円必要（❌非効率）
- 4.0倍 → 1,667円必要（⚠️ギリギリ）
- 10倍 → 556円必要（✅効率的）
- 20倍 → 278円必要（🔥高効率）

**効率ランク基準：**
| ランク | オッズ | 回収率 | 判定 |
|--------|--------|--------|------|
| SS | 20倍+ | 2000%+ | 🔥超効率 |
| S | 10-19倍 | 1000-1999% | 🔥高効率 |
| A | 4-9倍 | 400-999% | ✅効率的 |
| B | 2.5-3.9倍 | 250-399% | ⚠️標準 |
| C | 2.4倍以下 | 249%以下 | ❌非効率 |

### 5. レース選択の考え方
- **「単勝を買える軸がいるか」でレースを選ぶ**
- 鉄板軸でも2倍台なら単勝は非効率 → 馬連・ワイド中心
- 妙味軸が10倍以上なら → 単勝狙い目のレース

## レース情報
- **レース名**: ${raceData.race_name}
- **開催場所**: ${raceData.place}
- **距離**: ${raceData.surface}${raceData.distance}m
- **馬場状態**: ${raceData.condition}
- **出走頭数**: ${raceData.horses.length}頭

## 出走馬データ（競馬脳分析済み）
${formatHorsesDataWithEfficiency(raceData.horses)}

## オッズデータ
${formatSelectedOddsData(oddsData, betTypes)}

## ユーザー条件
- **予算**: ${budget}円
- **購入方式**: ${betTypes.join(', ')}
- **下限回収率**: ${minReturn}%
- **目標回収率**: ${targetReturn}%

【重要：券種制限】
ユーザーが指定した券種（${betTypes.join(', ')}）のみを提案してください。

${paddockHorses && paddockHorses.length > 0 ? `
## 🐴 パドック評価（ユーザーが現地で確認）
以下の馬はパドックで調子が良いとユーザーが判断しました：
**${paddockHorses.map(h => `${h}番`).join(', ')}**

**パドック評価の活用方法**:
- パドックで調子が良い馬は、指数が中位でも穴馬候補として考慮する
- 指数が高くパドックも良い馬は、本命候補として優先する
- パドック情報は当日の馬体状態を反映しているため、馬券に重視して含めること
` : ''}

## 分析の指針

### 総合期待値（PowerScore）の活用
- PowerScoreは「AI3指数 + 最終スコア」の総合評価
- **PowerRank 1位 = 軸馬候補**
- PowerRank上位でも人気上位（GAP小）なら妙味なし
- PowerRank上位で人気下位（GAP大）なら妙味あり

### 効率ランクの活用
- **軸馬の効率ランクがA以上** → 単勝から勝負できるレース
- **軸馬の効率ランクがB以下** → 単勝は非効率、馬連・ワイド中心
- **妙味馬に効率ランクS以上がいる** → その馬の単勝を狙う

### 判定ステータスの意味
| 判定 | 意味 | 馬券での扱い |
|------|------|-------------|
| 🔥激熱 | PowerRank1位 + 人気とのGAPあり | 単勝から全力 |
| 💡妙味軸 | PowerRank2-3位 + 大きなGAP | 単勝狙い目 |
| 👑鉄板軸 | PowerRank1位 + 圧倒的能力 | 効率次第で単勝 or 相手探し |
| 🎯有力軸 | PowerRank1位 + 普通の能力 | 馬連・ワイドの軸 |
| 💰妙味 | GAP馬 | 相手・ヒモ候補 |
| ✨実力 | 能力通りの評価 | 堅実な相手 |
| 紐 | 最低限の能力あり | ヒモ候補 |
| 消 | 能力不足 | 馬券から除外 |

### 回収率の考え方

**回収率の定義**
- 回収率(%) = (的中時の払戻金 ÷ 購入金額) × 100

**基本理念**
- 回収率は長期的視点で評価する指標
- 1レースで達成する＜積み重ねて月・年単位で達成する
- 馬印に基づいて妥当な馬券を選んだ結果として自然に決まる

**重要な回収率の考え方**:
- **下限回収率${minReturn}%**: このレース全体での推奨馬券の「想定回収率」が、原則としてこの値を下回らないように構築してください。ただし、競馬脳のルールを崩してまで無理に達成しようとしてはいけません。どうしてもこの条件を満たせない場合は、「今回の条件では下限回収率をわずかに下回る」といった形で、理由とともに正直に説明してください。
- **目標回収率${targetReturn}%**: このレース全体での推奨馬券の「想定回収率」がこの値に近づくように、馬券の選定や資金配分を調整してください（あくまで目安であり、厳密に一致させる必要はありません）。
- 判断は個別の馬券ごとではなく、**予算全体に対する合計投資金額と合計払戻のバランス（レース単位のポートフォリオ）**で行ってください。
- **馬印に選ばれていない馬を、回収率の数字を合わせるためだけに馬券に含めてはいけません。**

## 券種別の競馬脳戦略

**ユーザー指定券種**: ${betTypes.join(', ')}

${betTypes.includes('単勝') ? `
### 単勝の買い方
- 効率A以上の馬を全員リストアップ
- その中で**軸馬（鉄板軸・妙味軸・激熱軸）は厚めに**
- 妙味馬でも効率S以上なら少額で持つ
- 効率A以上が1頭もいなければ「単勝は見送り」
` : ''}

${betTypes.includes('複勝') ? `
### 複勝の買い方
- 単勝より効率基準は緩め（2倍台でも可）
- 軸馬・妙味馬の複勝を厚めに
- 複勝は「保険」ではなく「複勝で利益を出す」意識
- 複勝オッズ1.5倍以上を目安に
` : ''}

${betTypes.includes('馬連') ? `
### 馬連の買い方
- 軸1頭流しが基本（点数を絞る）
- 軸馬が非効率でも、相手に妙味馬がいれば組める
- 配当重視で相手を選定
- BOXは点数が増えるため非推奨（やるなら3頭まで）
` : ''}

${betTypes.includes('ワイド') ? `
### ワイドの買い方
- 軸1頭流しが基本
- 馬連より的中率重視の場面で使う
- 軸馬が堅いなら、穴馬との組み合わせで高配当を狙う
- 3頭BOXなら3点で複数的中の可能性あり
` : ''}

${betTypes.includes('馬単') ? `
### 馬単の買い方
- 軸馬が効率A以上かつ1着想定なら「1着固定」
- 軸馬が非効率or2着想定なら「裏表」or「2着固定で妙味馬頭」
- 馬連との複合トリガーを意識（同じ組み合わせで両方買う）
- 1着固定で点数を絞るのが基本
` : ''}

${betTypes.includes('3連複') ? `
### 3連複の買い方（注意：控除率75%で非効率）
- 点数が増えやすいため「軸1頭流し」で絞る
- **15点以内を目安に**（それ以上は死に馬券が増える）
- 100倍以下の3連複は効率悪い（単勝4倍×馬連4倍と同じ価値）
- ワイドとの複合トリガーを意識（同じ3頭でワイド3点的中）
- 軸が堅いときに相手を広げる用途で使う
` : ''}

${betTypes.includes('3連単') ? `
### 3連単の買い方（注意：控除率72.5%で最も非効率）
- **軸馬が効率A以上のときだけ検討**
- 軸馬1着固定で点数を絞る（フォーメーション推奨）
- **10点以内を目安に**
- 軸馬が非効率なら「3連単は見送り推奨」と明記
- 馬単との複合トリガーを意識
` : ''}

### 複合トリガーの考え方
同じ馬の組み合わせで複数券種が同時的中する買い方を優先する。
死に馬券を減らし、的中時の回収を最大化するため。

**今回使える複合トリガー**:
${betTypes.includes('単勝') && betTypes.includes('馬単') ? '- **単勝 + 馬単（軸1着）**: 軸が勝てば両方的中\n' : ''}
${betTypes.includes('馬連') && betTypes.includes('馬単') ? '- **馬連 + 馬単（両方向）**: 同じ2頭で最大3点的中\n' : ''}
${betTypes.includes('馬連') && betTypes.includes('ワイド') ? '- **馬連 + ワイド**: 同じ2頭で2点的中\n' : ''}
${betTypes.includes('ワイド') && betTypes.includes('3連複') ? '- **3連複 + ワイド3点**: 同じ3頭でワイド最大3点的中\n' : ''}
${betTypes.includes('馬単') && betTypes.includes('3連単') ? '- **馬単 + 3連単（軸1着）**: 軸が勝てば両方的中可能性\n' : ''}
${betTypes.includes('複勝') && betTypes.includes('ワイド') ? '- **複勝 + ワイド**: 同じ馬が3着内なら複勝的中、2頭来ればワイドも的中\n' : ''}

## 出力形式

### 📊 レース総評

#### 競馬脳診断
- **レースタイプ**: 勝負 / チャンス / 堅実 / 波乱 / 混戦 / 見送り
- **単勝狙い目**: あり / なし（理由を記載）
- **軸馬の効率**: ○番（○倍、効率ランク○）
- **推奨アプローチ**: 単勝勝負 / 馬連・ワイド中心 / 3連系で点数絞り / 見送り

#### 狙い方の方針
- 軸馬の単勝が効率的か？
- 単勝を買うべき馬は誰か？
- 馬連・ワイド中心にすべきか？
- 3連系を買うべきか？買うならどう絞るか？

### 🐴 馬印

**印の選定基準**:
競馬脳に基づき、**効率を重視して**選定：

- ◎（本命）: **単勝を買う馬**。効率A以上の軸馬。鉄板軸でも妙味軸でも、効率が良い方が◎
- ○（対抗）: 2番手。◎と違うタイプの軸（◎が妙味軸なら○は鉄板軸、など）
- ▲（単穴）: 妙味馬で高効率。少額でも単勝を持つ価値あり
- △（連下）: 相手候補。馬連・ワイドの相手
- ☆（穴）: 大穴候補。少額で持つ価値あり
- 注: パドック良好馬、その他注目馬

**重要：◎の決め方**
1. 軸馬（鉄板軸・有力軸・妙味軸・激熱軸）の中で**最も効率が良い馬**が◎
2. 鉄板軸が2倍（C）、妙味軸が15倍（S）なら → **妙味軸が◎**
3. 鉄板軸が5倍（A）、妙味軸が20倍（SS）なら → **どちらも単勝対象、効率高い方が◎**
4. 効率A以上の軸がいなければ、◎は「馬連・ワイドの軸」として扱い、単勝は買わない
5. **単勝が券種に含まれていない場合**：◎は「馬券の中心となる軸馬」として扱う

**印の形式**:
${betTypes.includes('単勝') ? 
`- ◎ ○番 馬名（PowerRank○位、○倍、効率○、判定ステータス）【単勝○○円】
- ○ ○番 馬名（PowerRank○位、○倍、効率○、判定ステータス）
- ▲ ○番 馬名（PowerRank○位、○倍、効率○、判定ステータス）【単勝少額】` 
: 
`- ◎ ○番 馬名（PowerRank○位、○倍、効率○、判定ステータス）【軸】
- ○ ○番 馬名（PowerRank○位、○倍、効率○、判定ステータス）
- ▲ ○番 馬名（PowerRank○位、○倍、効率○、判定ステータス）`}
- △ ○番 馬名（PowerRank○位、○倍、効率○、判定ステータス）
- ☆ ○番 馬名（PowerRank○位、○倍、効率○、判定ステータス）
- 注 ○番 馬名（理由）

### 🐴 全馬総評

**出走馬全頭について、1〜2行で簡潔に評価**:
- ○番 馬名：（判定ステータス）○○の理由で◎/○/▲/△/☆/消

### 🎯 推奨馬券

**競馬脳に基づく馬券構築**:

${betTypes.includes('単勝') ? `
#### 単勝
| 馬番 | 馬名 | オッズ | 効率 | 金額 | 理由 |
|------|------|--------|------|------|------|
| （効率A以上のみ記載。なければ「該当なし」） |
` : ''}

${betTypes.includes('複勝') ? `
#### 複勝
| 馬番 | 馬名 | オッズ | 金額 | 理由 |
|------|------|--------|------|------|
` : ''}

${betTypes.includes('馬連') || betTypes.includes('ワイド') ? `
#### 馬連・ワイド
| 券種 | 組み合わせ | オッズ | 金額 | 理由 |
|------|-----------|--------|------|------|
| （軸1頭流しを基本に記載） |
` : ''}

${betTypes.includes('馬単') ? `
#### 馬単
| 組み合わせ | オッズ | 金額 | 理由 |
|-----------|--------|------|------|
| （1着固定 or 裏表を明記） |
` : ''}

${betTypes.includes('3連複') ? `
#### 3連複
| 組み合わせ | オッズ | 金額 | 理由 |
|-----------|--------|------|------|
| （15点以内で記載。軸1頭流し推奨） |
` : ''}

${betTypes.includes('3連単') ? `
#### 3連単
| 組み合わせ | オッズ | 金額 | 理由 |
|-----------|--------|------|------|
| （10点以内で記載。軸1着固定推奨。軸が非効率なら「見送り推奨」と明記） |
` : ''}

#### 複合トリガーまとめ
同じ組み合わせで複数券種を買っているグループを明記：
- グループ1: ○-○で「○○」「○○」を同時購入 → 的中時○点回収
- グループ2: ...

#### 資金配分サマリー
| 券種 | 点数 | 合計金額 | 備考 |
|------|------|----------|------|
| 単勝 | ○点 | ○○円 | |
| 複勝 | ○点 | ○○円 | |
| ... | | | |
| **合計** | **○点** | **${budget}円** | |

**想定回収率**: ○○%（○○が的中した場合の最大払戻○○円 ÷ ${budget}円）

### 💡 競馬脳アドバイス

このレースのポイントを3点で簡潔に：
1. （単勝を買うべきか、誰の単勝か）
2. （馬連・ワイドの軸と相手の考え方）
3. （このレースの注意点・リスク）

### ⚠️ 注意事項
- 競馬に絶対はない。効率が良くても外れることはある
- 大事なのは1レースの結果ではなく、長期的な回収率
- 「週単位」ではなく「レース数単位」で収支を考える
- オッズは変動する可能性があります

---

## 必須制約
- **予算**: ${budget}円を使い切る
- **購入単位**: 1馬券あたり100円単位（最小100円）
- **回収率**: 想定回収率が下限${minReturn}%を下回らないこと
- **券種**: ユーザー指定の${betTypes.join(', ')}のみ
- **競馬脳遵守**: 効率の悪い馬券に多額投資しない
- **複合トリガー優先**: 同じ組み合わせで複数券種を買い、死に馬券を減らす
`;
}





/**
 * 出走馬データをフォーマット（競馬脳対応版）
 * PowerScore、効率ランク、判定ステータスを含む
 */
function formatHorsesDataWithEfficiency(horses) {
    let formatted = '\n| 判定 | 馬番 | 馬名 | PowerScore | PowerRank | 単勝オッズ | 効率 | 人気 | GAP | AI単勝 | AI連対 | AI複勝 | 最終Sc |\n';
    formatted += '|------|------|------|------------|-----------|------------|------|------|-----|--------|--------|--------|--------|\n';

    horses.forEach((horse) => {
        // 判定ステータス
        const status = horse.analysis ? horse.analysis.status : '-';
        const statusLabel = {
            'axis_iron': '👑鉄板',
            'axis_strong': '🎯有力',
            'axis_value': '💡妙味軸',
            'value_high': '🔥激熱',
            'value': '💰妙味',
            'ability': '✨実力',
            'safe': '紐',
            'delete': '消'
        }[status] || '-';

        // PowerScore
        const powerScore = horse.powerScore ? horse.powerScore.toFixed(1) : '-';
        const powerRank = horse.powerRank || '-';

        // 単勝オッズと効率
        const odds = horse.tanshoOdds ? horse.tanshoOdds.toFixed(1) : '-';
        const effLabel = horse.efficiency ? horse.efficiency.label : '-';
        const effRank = horse.efficiency ? horse.efficiency.rank : '-';

        // 人気とGAP
        const pop = horse.popularity || '-';
        const gap = (horse.popularity && horse.powerRank) ? horse.popularity - horse.powerRank : '-';

        // AIスコア
        const winRank = horse.predictions ? horse.predictions.win_rate_rank : '-';
        const placeRank = horse.predictions ? horse.predictions.place_rate_rank : '-';
        const showRank = horse.predictions ? horse.predictions.show_rate_rank : '-';
        const finalSc = horse.indices ? horse.indices.final_score.toFixed(0) : '-';

        formatted += `| ${statusLabel} | ${horse.horse_number} | ${horse.horse_name} | `;
        formatted += `${powerScore} | ${powerRank}位 | `;
        formatted += `${odds}倍 | ${effLabel}(${effRank}) | `;
        formatted += `${pop}人気 | ${gap >= 0 ? '+' : ''}${gap} | `;
        formatted += `${winRank}位 | ${placeRank}位 | ${showRank}位 | ${finalSc} |\n`;
    });

    // 競馬脳サマリー
    formatted += '\n### 競馬脳サマリー\n\n';
    
    // 軸馬の効率チェック
    const axisHorses = horses.filter(h => 
        h.analysis && ['axis_iron', 'axis_strong', 'axis_value', 'value_high'].includes(h.analysis.status)
    );
    
    if (axisHorses.length > 0) {
        formatted += '**軸馬の効率チェック**:\n';
        axisHorses.forEach(h => {
            const effLabel = h.efficiency ? h.efficiency.label : '-';
            const odds = h.tanshoOdds ? h.tanshoOdds.toFixed(1) : '-';
            const statusLabel = {
                'axis_iron': '👑鉄板',
                'axis_strong': '🎯有力',
                'axis_value': '💡妙味軸',
                'value_high': '🔥激熱'
            }[h.analysis.status];
            formatted += `- ${h.horse_number}番 ${h.horse_name}（${statusLabel}）: ${odds}倍 → ${effLabel}\n`;
        });
    }

    // 単勝狙い目の馬
    const efficientHorses = horses.filter(h => 
        h.efficiency && ['SS', 'S', 'A'].includes(h.efficiency.rank) &&
        h.analysis && h.analysis.status !== 'delete'
    );
    
    if (efficientHorses.length > 0) {
        formatted += '\n**単勝狙い目（効率A以上）**:\n';
        efficientHorses.slice(0, 5).forEach(h => {
            const effLabel = h.efficiency.label;
            const odds = h.tanshoOdds.toFixed(1);
            formatted += `- ${h.horse_number}番 ${h.horse_name}: ${odds}倍（${effLabel}）\n`;
        });
    }

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
 * @param {object} data - { timestamp, result, model, params }
 */
function saveAIAnalysisResult(raceId, data) {
    try {
        const storageKey = 'ai_analysis_results';
        const raw = localStorage.getItem(storageKey);
        const map = raw ? JSON.parse(raw) : {};

        // 呼び出し側から渡されたオブジェクトをそのまま保存
        // すでに analysis ラップして保存していた古いデータも残るが、
        // 読み込み側で両方に対応する
        map[raceId] = {
            timestamp: data.timestamp || Date.now(),
            result: data.result,
            model: data.model || null,
            params: data.params || null
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

// 保存済みAI結果の自動読み込み（古い形式も含めて広く対応）
function autoLoadAIAnalysisResult(raceId) {
    console.log('[localStorage] Checking for saved analysis for race:', raceId);
    const savedData = loadAIAnalysisResult(raceId);

    if (!savedData) {
        console.log('[localStorage] No saved analysis for race:', raceId);
        return;
    }

    const aiResultDiv = document.getElementById('aiResult');
    if (!aiResultDiv) {
        console.warn('[localStorage] aiResult element not found');
        return;
    }

    // ここでいろいろな保存形式に対応させる
    // 1. 新形式: { timestamp, result, model, params }
    // 2. 旧形式: { analysis: { timestamp, result, model, params }, updatedAt }
    // 3. さらに昔: 文字列そのもの
    let container = savedData;

    // パターン2: analysis オブジェクトの中に本体がある場合
    if (
        container &&
        typeof container === 'object' &&
        container.analysis &&
        typeof container.analysis === 'object' &&
        !container.result
    ) {
        container = {
            timestamp: container.analysis.timestamp || container.timestamp || container.updatedAt || null,
            result: container.analysis.result,
            model: container.analysis.model || null,
            params: container.analysis.params || null
        };
    }

    let markdown = null;

    // パターン3: 文字列そのものが保存されている場合
    if (typeof container === 'string') {
        markdown = container;
    }
    // パターン1・2: result プロパティにMarkdownが入っている場合
    else if (container && typeof container.result === 'string') {
        markdown = container.result;
    }
    // 念のため: analysis が文字列な場合にも対応
    else if (container && typeof container.analysis === 'string') {
        markdown = container.analysis;
    }

    if (!markdown || typeof markdown !== 'string' || markdown.trim() === '') {
        console.log('[localStorage] No markdown string found in saved analysis for race:', raceId, savedData);
        return;
    }

    // marked が失敗してもアプリが落ちないようにする
    try {
        aiResultDiv.innerHTML = marked.parse(markdown);
    } catch (e) {
        console.error('[localStorage] Error parsing markdown from saved analysis:', e);
        return;
    }

    // 追加情報（モデル・パラメータ・保存日時）があれば軽く表示
    try {
        const timestamp = container.timestamp || container.updatedAt || null;
        const params = container.params || null;
        const modelText = container.model ? container.model : '不明';

        if (timestamp && params) {
            const savedDate = new Date(timestamp);
            const infoDiv = document.createElement('div');
            infoDiv.className = 'saved-info';
            infoDiv.style.cssText =
                'background: #e3f2fd; border: 1px solid #2196f3; padding: 10px; margin-bottom: 15px; font-size: 0.9em;';
            infoDiv.innerHTML =
                '<strong>💾 保存された分析結果</strong><br>' +
                '保存日時: ' + savedDate.toLocaleString('ja-JP') + '<br>' +
                'モデル: ' + modelText + '<br>' +
                'パラメータ: 予算' + params.budget + '円、下限' + params.minReturn + '%、目標' + params.targetReturn + '%';

            aiResultDiv.insertBefore(infoDiv, aiResultDiv.firstChild);
        }
    } catch (e) {
        console.warn('[localStorage] Failed to render saved info block:', e, container);
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