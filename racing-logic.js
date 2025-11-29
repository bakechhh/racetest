/**
 * js/racing-logic.js
 * 競馬脳ロジック Ver 4.1 (Hybrid Power + 妙味軸 + 新レース判定)
 * コンセプト:
 *   PowerScoreによる絶対序列
 *   ＋ 人気と実力のGAPで妙味検出
 *   ＋ 下位馬の厳格フィルタリング
 *   ＋ 準軸（妙味軸）を明示的に扱う
 *   ＋ 勝負/チャンス判定を競馬脳寄りに再設計
 */

const RacingLogic = {
    CONFIG: {
        MIN_FINAL_SCORE: 45.0,  // 紐（Safe）判定用の基準
        SAFE_AI_SCORE:   0.45,  // 紐（Safe）判定用のAI基準（単勝AI）
        EFFICIENCY_LINE: 400    // 効率ライン（回収率%）= 単勝4倍相当
    },

    /**
     * 単勝オッズから資金効率ランクを計算
     * 競馬脳の考え方：「同じ利益を得るのに必要な投資額」で判定
     * 
     * @param {number} odds - 単勝オッズ
     * @returns {Object} 効率情報 { returnRate, rank, label, color, description }
     */
    calculateEfficiency: function(odds) {
        if (!odds || odds <= 1) {
            return {
                returnRate: 0,
                rank: '-',
                label: '-',
                color: '#94a3b8',
                description: 'オッズ不明'
            };
        }

        // 回収率 = オッズ × 100（%）
        const returnRate = Math.round(odds * 100);

        // 効率ランク判定（400%を基準）
        if (returnRate >= 2000) {
            return {
                returnRate,
                rank: 'SS',
                label: '🔥超効率',
                color: '#dc2626',
                description: `${odds}倍：20回に1回で大幅プラス`
            };
        }
        if (returnRate >= 1000) {
            return {
                returnRate,
                rank: 'S',
                label: '🔥高効率',
                color: '#ea580c',
                description: `${odds}倍：10回に1回でプラス`
            };
        }
        if (returnRate >= 400) {
            return {
                returnRate,
                rank: 'A',
                label: '✅効率的',
                color: '#16a34a',
                description: `${odds}倍：4回に1回でトントン以上`
            };
        }
        if (returnRate >= 250) {
            return {
                returnRate,
                rank: 'B',
                label: '⚠️標準',
                color: '#ca8a04',
                description: `${odds}倍：投資効率はギリギリ`
            };
        }
        return {
            returnRate,
            rank: 'C',
            label: '❌非効率',
            color: '#6b7280',
            description: `${odds}倍：当てても投資額が重い`
        };
    },

    /**
     * レース単位メイン入口
     */
    analyzeRace: function (race) {
        if (!race || !race.horses) return race;

        // 1. 各指数のランク化
        this.calculateDynamicRanks(race.horses);

        // 2. 総合期待値（PowerScore）の計算
        this.calculatePowerScore(race.horses);

        // 3. 各馬の評価
        race.horses.forEach(horse => {
            horse.analysis = this.evaluateHorse(horse);
        });

        // 4. レース判定
        this.evaluateRace(race);

        return race;
    },

    /**
     * 各指標をランク化
     */
    calculateDynamicRanks: function (horses) {
        const assignRank = (keyPath, rankKey) => {
            const getValue = (h) => {
                const keys = keyPath.split('.');
                let val = h;
                for (const k of keys) val = val ? val[k] : null;
                return val !== null && val !== undefined ? parseFloat(val) : -9999;
            };
            const sorted = [...horses].sort((a, b) => getValue(b) - getValue(a));
            sorted.forEach((h, i) => {
                const targetH = horses.find(org => org.horse_number === h.horse_number);
                if (targetH) targetH[rankKey] = i + 1;
            });
        };

        assignRank('indices.mining_index',              'miningRank');
        assignRank('indices.corrected_time_deviation',  'raceEvalRank');
        assignRank('indices.zi_deviation',              'ziRank');
        assignRank('indices.base_score',                'baseRank');
        assignRank('indices.final_score',               'finalRank');
    },

    /**
     * PowerScore計算（AI3つ＋最終スコアの単純和）
     */
    calculatePowerScore: function (horses) {
        horses.forEach(h => {
            const aiWin   = h.predictions ? h.predictions.win_rate   : 0;
            const aiPlace = h.predictions ? h.predictions.place_rate : 0;
            const aiShow  = h.predictions ? h.predictions.show_rate  : 0;
            const finalSc = h.indices     ? h.indices.final_score    : 0;

            // 総合スコア = (AI3指数の和 * 100) + 最終スコア
            h.powerScore = (aiWin * 100) + (aiPlace * 100) + (aiShow * 100) + finalSc;
        });

        const sorted = [...horses].sort((a, b) => b.powerScore - a.powerScore);
        sorted.forEach((h, i) => {
            const targetH = horses.find(org => org.horse_number === h.horse_number);
            if (targetH) targetH.powerRank = i + 1;
        });
    },

    /**
     * 個別馬評価
     */
    evaluateHorse: function (horse) {
        const result = { status: 'delete', isBuy: false, badges: [] };

        if (!horse.popularity || !horse.indices || !horse.predictions) {
            return result;
        }

        const pop       = horse.popularity;
        const powerRank = horse.powerRank;
        const preds     = horse.predictions;
        const idx       = horse.indices;

        // ----------------------------------------------------
        // 1. 全指標のGAPスキャン（妙味候補抽出）
        // ----------------------------------------------------
        let gapCount = 0;
        let maxGap   = 0;

        const checkMetric = (rank, name, type) => {
            if (!rank || rank > 99) return;
            // 上位(1〜5位)はGap2、下位はGap3以上で反応
            const threshold = rank <= 5 ? 2 : 3;
            const gap = pop - rank;

            if (gap >= threshold) {
                // 人気より評価が高い → 妙味バッジ
                result.badges.push({
                    text:  name,
                    type,
                    style: 'gap',
                    val:   `G${gap}`
                });
                gapCount++;
                if (gap > maxGap) maxGap = gap;
            } else if (rank <= 3) {
                // Gapはないが上位 → 実力バッジ
                result.badges.push({
                    text:  name,
                    type,
                    style: 'rank',
                    val:   `${rank}位`
                });
            }
        };

        checkMetric(preds.win_rate_rank,   '単勝AI',  'win');
        checkMetric(preds.place_rate_rank, '連対AI',  'place');
        checkMetric(preds.show_rate_rank,  '複勝AI',  'show');
        checkMetric(horse.finalRank,       '最終Sc',  'final');
        checkMetric(horse.miningRank,      'Mining',  'mining');
        checkMetric(horse.raceEvalRank,    'R評価',   'ability');
        checkMetric(horse.ziRank,          '前走ZI',  'zi');
        checkMetric(horse.baseRank,        '基礎Sc',  'base');

        // ----------------------------------------------------
        // 2. ステータス判定（PowerRankベース）
        // ----------------------------------------------------

        // --- A. 総合1位（メイン軸 1頭固定） ---
        if (powerRank === 1) {
            // Gapがあれば激熱軸（過小人気の本命）
            if (gapCount > 0) {
                result.status = 'value_high';
                result.badges.unshift({
                    text:  '🔥激熱軸',
                    type:  'axis_rebel',
                    style: 'main',
                    val:   `G${maxGap}`
                });
            }
            // 圧倒的強者（AI単勝0.78以上 or 最終スコア65以上）
            else if (preds.win_rate >= 0.78 || idx.final_score >= 65.0) {
                result.status = 'axis_iron';
                result.badges.unshift({
                    text:  '👑鉄板軸',
                    type:  'axis',
                    style: 'main',
                    val:   idx.final_score.toFixed(0)
                });
            }
            // それ以外は普通の軸
            else {
                result.status = 'axis_strong';
                result.badges.unshift({
                    text:  '🎯有力軸',
                    type:  'axis_weak',
                    style: 'main',
                    val:   ''
                });
            }
        }

        // --- B. 総合2〜3位（相手候補 ＋ 準軸判定） ---
        else if (powerRank <= 3) {
            const popGap        = pop - powerRank;
            const isStrongScore = (idx.final_score >= 60.0 || preds.win_rate >= 0.55 || preds.show_rate >= 0.60);

            // 条件を満たすと「妙味軸（準軸）」として格上げ
            if (gapCount > 0 && popGap >= 2 && isStrongScore) {
                result.status = 'axis_value';
                result.badges.unshift({
                    text:  '💡妙味軸',
                    type:  'axis_value',
                    style: 'main',
                    val:   `G${popGap}`
                });
            }
            // それ以外でGapがある → 純粋な妙味馬
            else if (gapCount > 0) {
                result.status = 'value'; // 人気薄なら妙味
            }
            // Gapがなく能力通り → 実力評価
            else {
                result.status = 'ability'; // 人気通りなら実力
            }
        }

        // --- C. 総合4位以下（紐・穴）★厳格フィルタ適用 ---
        else {
            const finalSc = idx.final_score;
            let isQualified = false;

            // ★ 追加: 総合4〜5位でGapが1つでもあれば妙味として採用
            if (powerRank <= 5 && gapCount >= 1) {
                isQualified = true;
            } else {
                // 1. スコア40未満: 論外 (Gapがあっても無視)
                if (finalSc < 40.0) {
                    isQualified = false;
                }
                // 2. スコア40〜49: 平均以下 (強い根拠が必要)
                else if (finalSc < 50.0) {
                    // Gapが3個以上、または特大Gap(5以上)なら合格
                    if (gapCount >= 3 || maxGap >= 5) {
                        isQualified = true;
                    }
                }
                // 3. スコア50以上: 合格点 (Gap1つでもOK)
                else {
                    if (gapCount >= 1) {
                        isQualified = true;
                    }
                }
            }

            // 判定適用
            if (isQualified) {
                result.status = 'value'; // 妙味認定
            } else {
                // 妙味にはならなかったが、紐（Safe）として残すか？
                const isSafe =
                    (finalSc >= this.CONFIG.MIN_FINAL_SCORE) ||
                    (preds.win_rate >= this.CONFIG.SAFE_AI_SCORE);

                if (isSafe) {
                    result.status = 'safe';
                }
                // それ以外は delete（バッジがあっても捨てる）
            }
        }

        // ----------------------------------------------------
        // 3. 最終仕上げ（バッジ整理・isBuy）
        // ----------------------------------------------------
        if (result.status === 'delete') {
            result.badges = [];
            result.isBuy  = false;
        } else {
            result.isBuy = true;
            // メイン軸バッジ → GAPバッジ → Rankバッジ の優先度でソート
            result.badges.sort((a, b) => {
                const priority = { main: 4, gap: 3, rank: 1 };
                return (priority[b.style] || 0) - (priority[a.style] || 0);
            });
        }

        return result;
    },

    /**
     * レース全体の判定
     *
     * 競馬脳ルール（改良版）:
     *   勝負: (激熱軸 or 妙味軸 or 有力軸 or 鉄板軸) が「効率的(A)以上」
     *   チャンス: 軸が「標準(B)」だが妙味馬に高効率がいる
     *   堅実: 軸はいるが効率が低い
     *   
     * ポイント：「単勝を買える軸がいるか」でレースを選ぶ
     */
    evaluateRace: function (race) {
        if (!race || !race.horses) return;

        const horsesWithAna = race.horses.filter(h => h.analysis);

        // ★ デバッグログ
        console.group(`[evaluateRace] ${race.place}${race.round}R`);
        horsesWithAna.forEach(h => {
            const effRank = h.efficiency ? h.efficiency.rank : '-';
            console.log(
                `馬番${h.horse_number}`,
                'status:', h.analysis.status,
                'pop:', h.popularity,
                'odds:', h.tanshoOdds,
                'eff:', effRank
            );
        });
        console.groupEnd();

        // --- 軸馬の抽出 ---
        const axisStatuses = ['axis_iron', 'axis_strong', 'axis_value', 'value_high'];
        const axisHorses = horsesWithAna.filter(h => axisStatuses.includes(h.analysis.status));
        
        // 軸馬の中で最も効率の良い馬を取得
        const getEfficiencyScore = (rank) => {
            const scores = { 'SS': 5, 'S': 4, 'A': 3, 'B': 2, 'C': 1, '-': 0 };
            return scores[rank] || 0;
        };
        
        let bestAxis = null;
        let bestAxisEffScore = 0;
        axisHorses.forEach(h => {
            const effScore = h.efficiency ? getEfficiencyScore(h.efficiency.rank) : 0;
            if (effScore > bestAxisEffScore) {
                bestAxisEffScore = effScore;
                bestAxis = h;
            }
        });

        // 軸の効率判定
        const axisIsEfficient = bestAxisEffScore >= 3;  // A以上
        const axisIsStandard = bestAxisEffScore === 2;  // B
        const axisIsInefficient = bestAxisEffScore <= 1; // C以下

        // --- 妙味馬の抽出 ---
        const valueLikeStatuses = ['value', 'value_high', 'axis_value'];
        const safeLikeStatuses  = ['safe'];

        const valueHorses = horsesWithAna.filter(h =>
            valueLikeStatuses.includes(h.analysis.status)
        );
        const valueCount = valueHorses.length;

        // 妙味馬の中で高効率（S以上）がいるか
        const hasHighEfficiencyValue = valueHorses.some(h => 
            h.efficiency && getEfficiencyScore(h.efficiency.rank) >= 4
        );

        const safeHorses = horsesWithAna.filter(h =>
            safeLikeStatuses.includes(h.analysis.status)
        );
        const safeCount = safeHorses.length;

        // --- ステータス別フラグ ---
        const hasValueHigh = horsesWithAna.some(h => h.analysis.status === 'value_high');
        const hasAxisValue = horsesWithAna.some(h => h.analysis.status === 'axis_value');
        const hasAxisIron = horsesWithAna.some(h => h.analysis.status === 'axis_iron');
        const hasAxisStrong = horsesWithAna.some(h => h.analysis.status === 'axis_strong');

        // --- レース判定 ---
        let result = {
            type: 'KEN',
            label: '👁️ 見',
            color: '#94a3b8',
            bg: '#f1f5f9',
            description: '妙味薄。無理に勝負する必要はありません。'
        };

        // 1. 🔥勝負レース: 軸が効率的(A)以上
        if (axisHorses.length > 0 && axisIsEfficient) {
            const axisType = bestAxis.analysis.status;
            const axisOdds = bestAxis.tanshoOdds ? bestAxis.tanshoOdds.toFixed(1) : '?';
            const axisEff = bestAxis.efficiency ? bestAxis.efficiency.label : '';
            
            if (axisType === 'value_high' || axisType === 'axis_value') {
                result = {
                    type: 'SUPER',
                    label: '🔥 勝負',
                    color: '#dc2626',
                    bg: '#fef2f2',
                    description: `妙味軸が${axisOdds}倍で${axisEff}！単勝狙い目のレースです。`
                };
            } else {
                result = {
                    type: 'SUPER',
                    label: '🔥 勝負',
                    color: '#dc2626',
                    bg: '#fef2f2',
                    description: `軸が${axisOdds}倍で${axisEff}！単勝から勝負できるレースです。`
                };
            }
        }
        // 2. 🎯チャンス: 軸は標準(B)だが、高効率の妙味馬がいる
        else if (axisHorses.length > 0 && axisIsStandard && hasHighEfficiencyValue) {
            result = {
                type: 'GOOD',
                label: '🎯 チャンス',
                color: '#ea580c',
                bg: '#fff7ed',
                description: '軸の単勝は非効率だが、妙味馬に高効率あり。実力・妙味馬の単勝を狙え。'
            };
        }
        // 3. ✅堅実: 軸はいるが効率は標準以下
        else if (axisHorses.length > 0 && (axisIsStandard || axisIsInefficient)) {
            const axisOdds = bestAxis && bestAxis.tanshoOdds ? bestAxis.tanshoOdds.toFixed(1) : '?';
            result = {
                type: 'SOLID',
                label: '✅ 堅実',
                color: '#15803d',
                bg: '#f0fdf4',
                description: `軸${axisOdds}倍は単勝非効率。馬連・ワイド中心で点数を絞る。`
            };
        }
        // 4. 💰波乱: 軸不在だが妙味馬多数
        else if (valueCount >= 3) {
            result = {
                type: 'CHAOS',
                label: '💰 波乱',
                color: '#7e22ce',
                bg: '#faf5ff',
                description: '軸不明で妙味馬多数。BOXや穴狙い向きのレースです。'
            };
        }
        // 5. 🤔混戦: 妙味が少しある
        else if (valueCount >= 1) {
            result = {
                type: 'NORMAL',
                label: '🤔 混戦',
                color: '#b45309',
                bg: '#fffbeb',
                description: '方向性は悪くないが決め手に欠ける混戦レースです。'
            };
        }
        // 6. 👁️見: 完全ケン
        // （デフォルト値のまま）

        console.log(
            '[evaluateRaceResult]',
            'axisCount=', axisHorses.length,
            'bestAxisEff=', bestAxisEffScore,
            'valueCount=', valueCount,
            'hasHighEffValue=', hasHighEfficiencyValue,
            'finalType=', result.type
        );

        race.eval = result;
    }
};

window.RacingLogic = RacingLogic;