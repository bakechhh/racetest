/**
 * Netlify Function: Gemini API呼び出し（最終版）
 * 競馬データとオッズデータを分析して馬券推奨を返す
 */

import { GoogleGenAI } from "@google/genai";

export const handler = async (event, context) => {
  // CORSヘッダー
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONSリクエスト(プリフライト)への対応
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // POSTリクエストのみ許可
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // リクエストボディを解析
    const { raceData, oddsData, userParams } = JSON.parse(event.body);

    // 必須パラメータのチェック
    if (!raceData || !oddsData || !userParams) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Gemini AI初期化
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // プロンプト作成
    const prompt = createPrompt(raceData, oddsData, userParams);

    // Gemini API呼び出し
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    // 成功レスポンス
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        analysis: response.text,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Gemini API Error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal Server Error'
      })
    };
  }
};

/**
 * プロンプトを作成
 */
function createPrompt(raceData, oddsData, userParams) {
  const {
    budget,
    betTypes,
    minReturn,
    targetReturn
  } = userParams;

  return `あなたは競馬予想AIです。以下のデータを分析して、馬券購入の推奨を提供してください。

## レース情報
- **レース名**: ${raceData.race_name}
- **開催場所**: ${raceData.place}
- **距離**: ${raceData.surface}${raceData.distance}m
- **馬場状態**: ${raceData.condition}
- **出走頭数**: ${raceData.horses.length}頭

## 出走馬データ
${formatHorsesData(raceData.horses)}

## オッズデータ
${formatOddsData(oddsData)}

## ユーザー条件
- **予算**: ${budget}円
- **購入方式**: ${betTypes.join(', ')}
- **下限回収率**: ${minReturn}%
- **目標回収率**: ${targetReturn}%

### 回収率の定義
\`\`\`
回収率(%) = (的中時の払戻金 ÷ 購入金額) × 100
\`\`\`

**例**:
- 単勝5.0倍に100円購入 → 的中時500円払戻 → 回収率500%
- 3連単100倍に100円購入 → 的中時10,000円払戻 → 回収率10,000%

**重要**: 
- 下限回収率${minReturn}%は「この回収率を下回る馬券は推奨しない」という意味
- 目標回収率${targetReturn}%は「この回収率を目指して馬券を選定する」という意味
- 的中確率とオッズのバランスを考慮して、期待値が高い馬券を推奨すること

## 分析指示

### 1. データの読み方と重視度

#### 最重要指標（必ず確認）
- **final_score（最終スコア）**: 総合評価指数。高いほど有力。**そこそこ重視**
- **battle_mining（戦績マイニング）**: 過去の戦績から算出した実力指数。**重視する（ただし重くしすぎない）**
- **オッズとの乖離**: 指数が高いのにオッズが高い馬は狙い目

#### 重要指標
- **mining_index（マイニング指数）**: タイム・戦績から算出した基礎能力
- **zi_index（ZI指数）**: 前走の補正タイム偏差値。**標準的な指標**（前走のレース内容だけの指数のため、過度に重視しない）
- **similarity_coefficient（類似係数）**: 馬券内に来た馬と似た走りをしているか
  - **1.0が標準**。1.00001以上なら好材料、1.0未満なら注意
  - 動き幅が小さい係数なので、小数点第5位まで見て判断
- **stability_coefficient（安定係数）**: 成績の安定性
  - **1.0が標準**。1.00001以上なら安定、1.0未満なら不安定
  - 動き幅が小さい係数なので、小数点第5位まで見て判断

#### 参考指標（過度に重視しない）
- **騎手勝率・複勝率**: 今年の実績（参考程度）
- **調教師勝率・複勝率**: 今年の実績（参考程度）
- **出走間隔（interval）**: 前走からの週数。**あまり気にしすぎない**（休み明けでも好走する馬はいる）

#### 使用しない指標
- **脚質バランス**: JSONに平均脚質データがないため、脚質による展開予想は行わない

### 2. 分析のポイント

#### 本命候補の選定
- final_scoreが上位3頭を中心に分析
- battle_miningが高い馬を重視（ただし重くしすぎない）
- similarity_coefficient、stability_coefficientが1.0以上の馬は信頼度が高い

#### 穴候補の選定
- battle_miningが高いが、final_scoreが中位の馬（オッズ妙味あり）
- mining_indexが高く、オッズが高い馬
- similarity_coefficientが1.0以上で、オッズが高い馬

#### 消し馬の判断（慎重に行う）
- **以下の理由だけで消さないこと**:
  - 騎手・調教師の成績が悪い → 馬の実力とは別
  - 出走間隔が長い → 休み明けでも好走する馬はいる
  - 過去走で凡走続き → 今回は条件が違う可能性がある
- **消す場合の基準**:
  - すべての指数（final_score、battle_mining、mining_index）が極端に低い
  - similarity_coefficientとstability_coefficientが両方とも1.0を大きく下回る
  - オッズが極端に低く、指数とのバランスが悪い

#### オッズとの乖離を探す
- final_scoreやbattle_miningが高いのに、オッズが高い馬は狙い目
- 逆に、指数が低いのにオッズが低い馬は避ける

### 3. 馬券選定の戦略

#### 本線（的中確率重視）
- final_scoreとbattle_miningが高い馬の組み合わせ
- similarity_coefficient、stability_coefficientが1.0以上の馬を優先
- 回収率が下限を上回る組み合わせ

#### 抑え（バランス重視）
- 本命候補 + 穴候補の組み合わせ
- オッズ妙味がある馬を含める
- 回収率が目標値に近い組み合わせ

#### 大穴（高配当狙い）
- battle_miningが高いが、オッズが高い馬の組み合わせ
- similarity_coefficientが1.0以上で、オッズが高い馬
- 回収率が目標値を大きく上回る組み合わせ

#### 資金配分の目安
- 本線: 60-70%
- 抑え: 20-30%
- 大穴: 10-20%

## 出力形式
以下の形式でMarkdownで出力してください：

### 📊 総評
- レース全体の傾向（本命、対抗、穴馬の評価）
- 注目すべきポイント（オッズ妙味、指数の特徴）
- リスク要因（荒れる可能性、注意すべき馬）

### 🎯 推奨馬券
各購入方式ごとに、以下の情報を含めてください：

#### 単勝・複勝
- **馬番-馬名**: オッズ
- **購入金額**: ○○円
- **期待回収率**: ○○%
- **推奨理由**: （final_score、battle_mining、similarity_coefficient、stability_coefficientなどから）

#### 馬連・ワイド・馬単
- **組み合わせ**: 馬番-馬番
- **購入金額**: ○○円
- **期待回収率**: ○○%
- **推奨理由**: （2頭の指数、オッズ妙味など）

#### 3連複・3連単
- **組み合わせ**: 馬番-馬番-馬番
- **購入金額**: ○○円
- **期待回収率**: ○○%
- **推奨理由**: （3頭の組み合わせ妙味、指数バランスなど）

### 💰 資金配分
| 区分 | 馬券種別 | 組み合わせ | 購入金額 | 期待回収率 |
|------|----------|------------|----------|------------|
| 本線 | ○○ | ○-○ | ○○円 | ○○% |
| 抑え | ○○ | ○-○-○ | ○○円 | ○○% |
| 大穴 | ○○ | ○-○-○ | ○○円 | ○○% |
| **合計** | - | - | **○○円** | **平均○○%** |

### ⚠️ 注意事項
- リスクとリターンのバランス
- 推奨しない理由（該当する場合）
- その他の留意点

---

**重要な制約**: 
- 予算${budget}円を超えないこと
- すべての推奨馬券の回収率が下限${minReturn}%を下回らないこと
- 可能な限り目標回収率${targetReturn}%に近づけること
- 現実的で実行可能な馬券を推奨すること（1馬券あたり最低100円）
- 馬券の組み合わせは、実際のオッズデータに基づいて選定すること
- 消し馬の判断は慎重に行い、過度に消さないこと
`;
}

/**
 * 出走馬データをフォーマット（最終版）
 */
function formatHorsesData(horses) {
  // 表形式で見やすく整理
  let formatted = '\n| 順位 | 馬番 | 馬名 | 最終スコア | マイニング指数 | 戦績マイニング | ZI指数 | 類似係数 | 安定係数 | 騎手名 | 騎手勝率 | 調教師名 | 調教師勝率 | 出走間隔 | 前走着順 |\n';
  formatted += '|------|------|------|------------|----------------|----------------|--------|----------|----------|--------|----------|----------|------------|----------|----------|\n';

  horses.forEach((horse, index) => {
    const pastRace = horse.past_races && horse.past_races.length > 0 ? horse.past_races[0] : null;
    
    formatted += `| ${index + 1} | ${horse.horse_number} | ${horse.horse_name} | `;
    formatted += `${horse.indices.final_score.toFixed(2)} | `;
    formatted += `${horse.indices.mining_index.toFixed(1)} | `;
    formatted += `**${horse.battle_mining.toFixed(1)}** | `;  // 戦績マイニングを強調
    formatted += `${horse.zi_index.toFixed(1)} | `;
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
    formatted += `#### ${index + 1}位: ${horse.horse_number}番 ${horse.horse_name}\n`;
    formatted += `- **最終スコア**: ${horse.indices.final_score.toFixed(2)}\n`;
    formatted += `- **マイニング指数**: ${horse.indices.mining_index.toFixed(1)}\n`;
    formatted += `- **戦績マイニング**: **${horse.battle_mining.toFixed(1)}**（重視）\n`;
    formatted += `- **ZI指数**: ${horse.zi_index.toFixed(1)}（標準的な指標）\n`;
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
 * オッズデータをフォーマット（全件表示版）
 */
function formatOddsData(oddsData) {
  let formatted = '';

  oddsData.forEach(odds => {
    formatted += `\n### ${odds.odds_type_name}\n`;

    switch (odds.odds_type) {
      case 'tansho':
        // 単勝（全頭）
        formatted += '| 馬番 | オッズ |\n';
        formatted += '|------|--------|\n';
        if (odds.data.odds) {
          Object.entries(odds.data.odds).forEach(([horseNum, oddsValue]) => {
            formatted += `| ${horseNum} | ${oddsValue}倍 |\n`;
          });
        }
        break;

      case 'fukusho':
        // 複勝（全頭）
        formatted += '| 馬番 | オッズ |\n';
        formatted += '|------|--------|\n';
        if (odds.data.odds) {
          Object.entries(odds.data.odds).forEach(([horseNum, oddsRange]) => {
            formatted += `| ${horseNum} | ${oddsRange.min}-${oddsRange.max}倍 |\n`;
          });
        }
        break;

      case 'wakuren':
        // 枠連（全件）
        formatted += odds.data.combinations.map(item => 
          `- ${item.combination}: ${item.odds}倍`
        ).join('\n') + '\n';
        break;

      case 'umaren':
        // 馬連（全件）
        formatted += odds.data.combinations.map(item => 
          `- ${item.combination}: ${item.odds}倍`
        ).join('\n') + '\n';
        break;

      case 'wide':
        // ワイド（全件）
        formatted += odds.data.combinations.map(item => 
          `- ${item.combination}: ${item.odds.min}-${item.odds.max}倍`
        ).join('\n') + '\n';
        break;

      case 'umatan':
        // 馬単（全件）
        formatted += odds.data.combinations.map(item => 
          `- ${item.combination}: ${item.odds}倍`
        ).join('\n') + '\n';
        break;

      case 'sanrenpuku':
        // 3連複（全件）
        formatted += odds.data.combinations.map(item => 
          `- ${item.combination}: ${item.odds}倍`
        ).join('\n') + '\n';
        break;

      case 'sanrentan':
        // 3連単（全件）
        formatted += odds.data.combinations.map(item => 
          `- ${item.combination}: ${item.odds}倍`
        ).join('\n') + '\n';
        break;
    }
  });

  return formatted;
}
