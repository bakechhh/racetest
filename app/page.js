'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// 設定のデフォルト値
const DEFAULT_SETTINGS = {
  snkrdunkFee: 9.5,
  mercariFee: 10.0,
  yahooFee: 5.0,
  shippingCost: 0,
  otherCost: 0,
  targetRoi: 10,
  searchMargin: 15,
  defaultPlatform: 'snkrdunk',
  workerId: null
}

// ローカルストレージ操作
const loadSettings = () => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const saved = localStorage.getItem('cardArbitrageSettings')
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
  } catch (e) {}
  return DEFAULT_SETTINGS
}

const saveSettings = (settings) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('cardArbitrageSettings', JSON.stringify(settings))
  } catch (e) {}
}

// プラットフォーム設定（settingsから手数料を取得）
const getPlatforms = (settings) => [
  { id: 'snkrdunk', name: 'スニダン', feeRate: settings.snkrdunkFee },
  { id: 'mercari', name: 'メルカリ', feeRate: settings.mercariFee },
  { id: 'yahoo', name: 'ヤフフリ', feeRate: settings.yahooFee },
]

// =====================================
// 統計分析関数群
// =====================================

// 基本統計量
const calcBasicStats = (prices) => {
  if (prices.length === 0) return null
  const sorted = [...prices].sort((a, b) => a - b)
  const n = sorted.length
  const sum = sorted.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const variance = sorted.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / n
  const stdDev = Math.sqrt(variance)
  const median = n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)]
  const q1 = sorted[Math.floor(n * 0.25)]
  const q3 = sorted[Math.floor(n * 0.75)]
  const iqr = q3 - q1
  const cv = mean > 0 ? (stdDev / mean * 100) : 0  // 変動係数
  
  return { mean, median, stdDev, variance, min: sorted[0], max: sorted[n-1], q1, q3, iqr, cv, n }
}

// ボリンジャーバンド計算
const calcBollingerBands = (prices, period = 5, multiplier = 2) => {
  if (prices.length < period) return null
  const recent = prices.slice(0, period)
  const sma = recent.reduce((a, b) => a + b, 0) / period
  const variance = recent.reduce((acc, p) => acc + Math.pow(p - sma, 2), 0) / period
  const stdDev = Math.sqrt(variance)
  
  return {
    middle: sma,
    upper: sma + (multiplier * stdDev),
    lower: sma - (multiplier * stdDev),
    bandwidth: ((sma + multiplier * stdDev) - (sma - multiplier * stdDev)) / sma * 100
  }
}

// RSI（相対力指数）計算 - 価格のモメンタム
const calcRSI = (prices, period = 7) => {
  if (prices.length < period + 1) return null
  
  // 価格は新しい順なので逆順にして計算
  const reversed = [...prices].reverse()
  let gains = 0, losses = 0
  
  for (let i = 1; i <= period && i < reversed.length; i++) {
    const change = reversed[i] - reversed[i - 1]
    if (change > 0) gains += change
    else losses += Math.abs(change)
  }
  
  const avgGain = gains / period
  const avgLoss = losses / period
  
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

// 移動平均とトレンド判定
const calcMovingAverages = (prices) => {
  if (prices.length < 3) return null
  
  const ma3 = prices.slice(0, 3).reduce((a, b) => a + b, 0) / 3
  const ma5 = prices.length >= 5 ? prices.slice(0, 5).reduce((a, b) => a + b, 0) / 5 : null
  const ma7 = prices.length >= 7 ? prices.slice(0, 7).reduce((a, b) => a + b, 0) / 7 : null
  
  // トレンド判定（短期MAと長期MAの比較）
  let trend = 'neutral'
  if (ma5 && ma7) {
    if (ma3 > ma5 && ma5 > ma7) trend = 'uptrend'
    else if (ma3 < ma5 && ma5 < ma7) trend = 'downtrend'
  }
  
  return { ma3, ma5, ma7, trend }
}

// 価格変動率（ボラティリティ）
const calcVolatility = (prices) => {
  if (prices.length < 2) return null
  
  const returns = []
  for (let i = 0; i < prices.length - 1; i++) {
    returns.push((prices[i] - prices[i + 1]) / prices[i + 1] * 100)
  }
  
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((acc, r) => acc + Math.pow(r - avgReturn, 2), 0) / returns.length
  
  return {
    dailyVolatility: Math.sqrt(variance),
    avgReturn,
    maxDrawdown: Math.min(...returns),
    maxGain: Math.max(...returns)
  }
}

// サポート・レジスタンスライン検出
const calcSupportResistance = (prices) => {
  if (prices.length < 5) return null
  
  const sorted = [...prices].sort((a, b) => a - b)
  const n = sorted.length
  
  // クラスタリングで価格帯を検出
  const support = sorted[Math.floor(n * 0.1)]  // 下位10%
  const resistance = sorted[Math.floor(n * 0.9)]  // 上位10%
  const pivot = (sorted[0] + sorted[n-1] + sorted[Math.floor(n/2)]) / 3
  
  return { support, resistance, pivot }
}

// 売買シグナル総合判定
const calcTradingSignal = (stats, bollinger, rsi, ma, volatility, currentPrice) => {
  let score = 50  // ニュートラルスタート
  const signals = []
  
  // RSIシグナル
  if (rsi !== null) {
    if (rsi < 30) {
      score += 15
      signals.push({ type: 'bullish', text: 'RSI売られすぎ（反発期待）', weight: 15 })
    } else if (rsi > 70) {
      score -= 15
      signals.push({ type: 'bearish', text: 'RSI買われすぎ（下落リスク）', weight: -15 })
    }
  }
  
  // ボリンジャーバンドシグナル
  if (bollinger && currentPrice) {
    if (currentPrice <= bollinger.lower) {
      score += 20
      signals.push({ type: 'bullish', text: 'ボリンジャー下限タッチ（買い場）', weight: 20 })
    } else if (currentPrice >= bollinger.upper) {
      score -= 10
      signals.push({ type: 'bearish', text: 'ボリンジャー上限タッチ（過熱）', weight: -10 })
    }
  }
  
  // トレンドシグナル
  if (ma) {
    if (ma.trend === 'uptrend') {
      score += 10
      signals.push({ type: 'bullish', text: '上昇トレンド継続中', weight: 10 })
    } else if (ma.trend === 'downtrend') {
      score -= 10
      signals.push({ type: 'bearish', text: '下落トレンド継続中', weight: -10 })
    }
  }
  
  // ボラティリティシグナル
  if (volatility) {
    if (volatility.dailyVolatility > 10) {
      signals.push({ type: 'warning', text: '高ボラティリティ（リスク注意）', weight: 0 })
    }
    if (volatility.dailyVolatility < 3) {
      score += 5
      signals.push({ type: 'bullish', text: '価格安定（低リスク）', weight: 5 })
    }
  }
  
  // 変動係数による安定性
  if (stats && stats.cv < 10) {
    score += 10
    signals.push({ type: 'bullish', text: '価格変動小（安定銘柄）', weight: 10 })
  } else if (stats && stats.cv > 20) {
    score -= 5
    signals.push({ type: 'warning', text: '価格変動大（注意）', weight: -5 })
  }
  
  // スコアを0-100に正規化
  score = Math.max(0, Math.min(100, score))
  
  let recommendation = 'HOLD'
  let color = '#888'
  if (score >= 70) {
    recommendation = 'STRONG BUY'
    color = '#00ff88'
  } else if (score >= 60) {
    recommendation = 'BUY'
    color = '#88ff88'
  } else if (score <= 30) {
    recommendation = 'AVOID'
    color = '#ff5252'
  } else if (score <= 40) {
    recommendation = 'CAUTION'
    color = '#ff9800'
  }
  
  return { score, recommendation, color, signals }
}

// 価格予測（線形回帰）
const predictPrice = (prices, daysAhead = 3) => {
  if (prices.length < 3) return null
  
  // 価格は新しい順なので逆順にして回帰
  const reversed = [...prices].reverse()
  const n = reversed.length
  
  // 最小二乗法
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += reversed[i]
    sumXY += i * reversed[i]
    sumX2 += i * i
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  
  // R²（決定係数）
  const yMean = sumY / n
  let ssTot = 0, ssRes = 0
  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept
    ssTot += Math.pow(reversed[i] - yMean, 2)
    ssRes += Math.pow(reversed[i] - predicted, 2)
  }
  const r2 = 1 - (ssRes / ssTot)
  
  // 予測
  const predictedPrice = slope * (n + daysAhead - 1) + intercept
  const dailyChange = slope
  const confidence = Math.max(0, Math.min(100, r2 * 100))
  
  return {
    predicted: Math.round(predictedPrice),
    dailyChange: Math.round(dailyChange),
    trend: slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat',
    confidence: Math.round(confidence),
    r2
  }
}

export default function Home() {
  // タブ状態
  const [activeTab, setActiveTab] = useState('search') // search | purchases
  
  // 検索関連
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  
  // 仕入れ関連
  const [purchases, setPurchases] = useState([])
  const [purchaseFilter, setPurchaseFilter] = useState('all') // all | stock | listing | sold
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [purchaseFormData, setPurchaseFormData] = useState(null)
  const [workers, setWorkers] = useState([])
  
  // フィルター状態
  const [filters, setFilters] = useState({
    days: '',
    minSales: '',
    condition: 'PSA10',
    minPrice: '',
    maxPrice: '',
    onlyBuyable: false,
    packCode: '',
    query: '',  // フリー検索（名前・番号両方）
    sortBy: 'sales',
    searchMode: 'market'  // market（相場検索） | database（カードDB）
  })
  
  // 表示モード
  const [viewMode, setViewMode] = useState('default') // default | compact | detailed | grid

  // 初回読み込み
  useEffect(() => {
    setSettings(loadSettings())
    fetchWorkers()
  }, [])

  // ワーカー取得
  const fetchWorkers = async () => {
    const { data } = await supabase.from('workers').select('*').order('name')
    if (data) setWorkers(data)
  }

  // 異常値除外して平均計算
  const calcCleanAverage = (prices) => {
    if (prices.length === 0) return 0
    if (prices.length === 1) return prices[0]
    
    const recent = prices.slice(0, 3)
    const cleaned = []
    
    for (let i = 0; i < recent.length; i++) {
      let isOutlier = false
      for (let j = 0; j < recent.length; j++) {
        if (i !== j) {
          const diff = Math.abs(recent[i] - recent[j]) / Math.min(recent[i], recent[j])
          if (diff > 0.3) {
            const median = [...recent].sort((a, b) => a - b)[Math.floor(recent.length / 2)]
            if (Math.abs(recent[i] - median) > Math.abs(recent[j] - median)) {
              isOutlier = true
              break
            }
          }
        }
      }
      if (!isOutlier) cleaned.push(recent[i])
    }
    
    if (cleaned.length === 0) {
      const sorted = [...recent].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    
    return cleaned.reduce((a, b) => a + b, 0) / cleaned.length
  }

  // カード検索
  const fetchCards = async () => {
    setLoading(true)
    try {
      const isDatabase = filters.searchMode === 'database'
      
      // ========== カードDB検索モード ==========
      if (isDatabase) {
        let query = supabase
          .from('card_prices')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(200)
        
        // フリー検索（名前・番号・パック全部）
        if (filters.query && filters.query.trim()) {
          const term = filters.query.trim()
          query = query.or(`card_name.ilike.%${term}%,card_number.ilike.%${term}%,pack_code.ilike.%${term}%,full_name.ilike.%${term}%`)
        }
        
        const { data: cardData, error } = await query
        if (error) throw error
        
        // 追加フィルタ（クライアント側でAND検索）
        let results = cardData || []
        if (filters.query && filters.query.trim()) {
          const keywords = filters.query.trim().toLowerCase().split(/\s+/)
          if (keywords.length > 1) {
            results = results.filter(c => {
              const text = `${c.card_name || ''} ${c.card_number || ''} ${c.pack_code || ''} ${c.full_name || ''}`.toLowerCase()
              return keywords.every(kw => text.includes(kw))
            })
          }
        }
        
        const fee = settings.snkrdunkFee / 100
        const roi = settings.targetRoi / 100
        
        const cards = results.map(c => {
          const avgPrice = c.psa10_latest_price || c.grade_a_latest_price || 0
          const netAvg = avgPrice * (1 - fee) - settings.shippingCost - settings.otherCost
          const recommended = Math.floor(netAvg / (1 + roi))
          const currentAsk = c.psa10_lowest_ask || c.grade_a_lowest_ask || 0
          
          return {
            snkrdunkId: c.snkrdunk_id,
            cardName: c.card_name || c.full_name || '不明',
            cardNumber: c.card_number || '---',
            packCode: c.pack_code || '---',
            imageUrl: c.image_url || '',
            snkrdunkUrl: c.snkrdunk_url || `https://snkrdunk.com/apparels/${c.snkrdunk_id}`,
            salesCount: c.psa10_sales_count_7days || 0,
            turnoverRate: ((c.psa10_sales_count_7days || 0) / 7).toFixed(2),
            avgPrice,
            minPrice: avgPrice,
            maxPrice: avgPrice,
            netAvg: Math.floor(netAvg),
            recommendedBuy: recommended,
            currentAsk,
            isBuy: currentAsk > 0 && currentAsk <= recommended,
            sales: [],
            conditions: ''
          }
        })
        
        setCards(cards)
        setLoading(false)
        return
      }
      
      // ========== 相場検索モード ==========
      const days = parseInt(filters.days) || 7
      const minSalesCount = parseInt(filters.minSales) || 1
      const minPriceVal = parseInt(filters.minPrice) || 0
      const maxPriceVal = parseInt(filters.maxPrice) || 999999
      
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      
      // 成約データ取得
      let histQuery = supabase
        .from('card_price_history')
        .select('snkrdunk_id, price, recorded_at, condition')
        .eq('type', 'sold')
        .gte('recorded_at', startDate.toISOString().split('T')[0])
        .order('recorded_at', { ascending: false })
        .limit(50000)
      
      // 状態フィルタ
      if (filters.condition) {
        histQuery = histQuery.eq('condition', filters.condition)
      }
      
      const { data: salesData, error } = await histQuery
      if (error) throw error
      
      const cardStats = {}
      salesData.forEach(sale => {
        const sid = sale.snkrdunk_id
        if (!cardStats[sid]) {
          cardStats[sid] = { salesCount: 0, prices: [], sales: [], conditions: new Set() }
        }
        cardStats[sid].salesCount++
        cardStats[sid].conditions.add(sale.condition)
        if (sale.price > 0) cardStats[sid].prices.push(sale.price)
        cardStats[sid].sales.push({
          price: sale.price,
          date: sale.recorded_at,
          condition: sale.condition
        })
      })
      
      // フィルタリング
      const filteredIds = Object.entries(cardStats)
        .filter(([_, stats]) => stats.salesCount >= minSalesCount && stats.prices.length > 0)
        .map(([id]) => id)
      
      if (filteredIds.length === 0) {
        setCards([])
        setLoading(false)
        return
      }
      
      // カード情報取得（バッチ処理）
      const cardInfo = {}
      const batchSize = 100
      for (let i = 0; i < Math.min(filteredIds.length, 1000); i += batchSize) {
        const batch = filteredIds.slice(i, i + batchSize)
        const { data: cardData } = await supabase
          .from('card_prices')
          .select('*')
          .in('snkrdunk_id', batch)
        cardData?.forEach(c => cardInfo[c.snkrdunk_id] = c)
      }
      
      const fee = settings.snkrdunkFee / 100
      const roi = settings.targetRoi / 100
      
      let results = filteredIds.map(sid => {
        const stats = cardStats[sid]
        const info = cardInfo[sid] || {}
        const avgPrice = calcCleanAverage(stats.prices)
        const netAvg = avgPrice * (1 - fee) - settings.shippingCost - settings.otherCost
        const recommended = Math.floor(netAvg / (1 + roi))
        const currentAsk = info.psa10_lowest_ask || info.psa10_latest_price || info.grade_a_lowest_ask || 0
        
        return {
          snkrdunkId: sid,
          cardName: info.card_name || '不明',
          cardNumber: info.card_number || '---',
          packCode: info.pack_code || '---',
          imageUrl: info.image_url || '',
          snkrdunkUrl: info.snkrdunk_url || `https://snkrdunk.com/apparels/${sid}`,
          salesCount: stats.salesCount,
          turnoverRate: (stats.salesCount / days).toFixed(2),
          avgPrice: Math.floor(avgPrice),
          minPrice: Math.min(...stats.prices),
          maxPrice: Math.max(...stats.prices),
          netAvg: Math.floor(netAvg),
          recommendedBuy: recommended,
          currentAsk,
          isBuy: currentAsk > 0 && currentAsk <= recommended,
          sales: stats.sales.slice(0, 10),
          conditions: Array.from(stats.conditions).join('/')
        }
      })
      
      // 価格フィルタ
      if (minPriceVal > 0) {
        results = results.filter(c => c.avgPrice >= minPriceVal)
      }
      if (maxPriceVal < 999999) {
        results = results.filter(c => c.avgPrice <= maxPriceVal)
      }
      
      // フリー検索（名前・番号・パック全部）
      if (filters.query && filters.query.trim()) {
        const keywords = filters.query.trim().toLowerCase().split(/\s+/)
        results = results.filter(c => {
          const text = `${c.cardName} ${c.cardNumber} ${c.packCode}`.toLowerCase()
          return keywords.every(kw => text.includes(kw))
        })
      }
      
      // 買い時のみ
      if (filters.onlyBuyable) {
        results = results.filter(c => c.isBuy)
      }
      
      // ソート
      if (filters.sortBy === 'sales') results.sort((a, b) => b.salesCount - a.salesCount)
      else if (filters.sortBy === 'price') results.sort((a, b) => b.avgPrice - a.avgPrice)
      else if (filters.sortBy === 'priceAsc') results.sort((a, b) => a.avgPrice - b.avgPrice)
      else if (filters.sortBy === 'name') results.sort((a, b) => a.cardName.localeCompare(b.cardName, 'ja'))
      else if (filters.sortBy === 'roi') {
        results.sort((a, b) => {
          const roiA = a.currentAsk > 0 ? (a.netAvg - a.currentAsk) / a.currentAsk : -999
          const roiB = b.currentAsk > 0 ? (b.netAvg - b.currentAsk) / b.currentAsk : -999
          return roiB - roiA
        })
      }
      
      setCards(results.slice(0, 100))
    } catch (error) {
      console.error('Error:', error)
      alert('データの取得に失敗しました')
    }
    setLoading(false)
  }

  // 仕入れ一覧取得
  const fetchPurchases = async () => {
    setLoading(true)
    let query = supabase
      .from('purchases')
      .select('*, workers(name)')
      .order('created_at', { ascending: false })
    
    if (purchaseFilter !== 'all') {
      query = query.eq('status', purchaseFilter)
    }
    
    const { data, error } = await query.limit(100)
    if (error) {
      console.error('Error:', error)
    } else {
      setPurchases(data || [])
    }
    setLoading(false)
  }

  // タブ切り替え時
  useEffect(() => {
    if (activeTab === 'purchases') {
      fetchPurchases()
    }
  }, [activeTab, purchaseFilter])

  // 検索URL生成
  const getSearchUrls = (card) => {
    const margin = settings.searchMargin / 100
    const minPrice = Math.floor(card.recommendedBuy * 0.5)
    const maxPrice = Math.floor(card.recommendedBuy * (1 + margin))
    const query = filters.condition === 'PSA10' ? `${card.cardNumber} PSA10` : card.cardNumber
    
    return {
      mercariUrl: `https://jp.mercari.com/search?keyword=${encodeURIComponent(query)}&price_min=${minPrice}&price_max=${maxPrice}&status=on_sale&sort=created_time&order=desc`,
      yahooUrl: `https://paypayfleamarket.yahoo.co.jp/search/${encodeURIComponent(query)}?sort=openTime&order=desc&minPrice=${minPrice}&maxPrice=${maxPrice}&open=1`,
      minPrice,
      maxPrice
    }
  }

  // 仕入れフォームを開く
  const openPurchaseForm = (card) => {
    const platforms = getPlatforms(settings)
    const platform = platforms.find(p => p.id === settings.defaultPlatform) || platforms[0]
    const feeAmount = Math.floor(card.avgPrice * (platform.feeRate / 100))
    const netRevenue = card.avgPrice - feeAmount - settings.shippingCost - settings.otherCost
    
    setPurchaseFormData({
      cardName: card.cardName,
      cardNumber: card.cardNumber,
      isPsa: filters.condition === 'PSA10',
      psaGrade: filters.condition === 'PSA10' ? 10 : null,
      purchasePrice: card.recommendedBuy,
      sellingPrice: card.avgPrice,
      platformId: platform.id,
      platformName: platform.name,
      feeRate: platform.feeRate,
      feeAmount,
      shippingCost: settings.shippingCost,
      otherCostsTotal: settings.otherCost,
      netRevenue,
      profit: netRevenue - card.recommendedBuy,
      roi: ((netRevenue - card.recommendedBuy) / card.recommendedBuy * 100).toFixed(1),
      salesCount3days: card.salesCount,
      judgment: card.isBuy ? 'buy' : 'consider',
      notes: ''
    })
    setShowPurchaseForm(true)
  }

  // 仕入れ登録
  const savePurchase = async () => {
    if (!settings.workerId) {
      alert('設定でワーカーを選択してください')
      return
    }
    
    const data = {
      worker_id: settings.workerId,
      card_name: purchaseFormData.cardName,
      card_number: purchaseFormData.cardNumber,
      is_psa: purchaseFormData.isPsa,
      psa_grade: purchaseFormData.psaGrade,
      purchase_price: parseInt(purchaseFormData.purchasePrice),
      selling_price: parseInt(purchaseFormData.sellingPrice),
      platform_id: purchaseFormData.platformId,
      platform_name: purchaseFormData.platformName,
      fee_rate: purchaseFormData.feeRate,
      fee_amount: parseInt(purchaseFormData.feeAmount),
      shipping_cost: parseInt(purchaseFormData.shippingCost),
      other_costs_total: parseInt(purchaseFormData.otherCostsTotal),
      net_revenue: parseInt(purchaseFormData.netRevenue),
      profit: parseInt(purchaseFormData.profit),
      roi: parseFloat(purchaseFormData.roi),
      sales_count_3days: purchaseFormData.salesCount3days,
      judgment: purchaseFormData.judgment,
      notes: purchaseFormData.notes,
      status: 'stock'
    }
    
    const { error } = await supabase.from('purchases').insert(data)
    
    if (error) {
      console.error('Error:', error)
      alert('登録に失敗しました')
    } else {
      alert('仕入れを登録しました！')
      setShowPurchaseForm(false)
      setPurchaseFormData(null)
    }
  }

  // ステータス更新
  const updatePurchaseStatus = async (id, status, actualPrice = null) => {
    const updateData = { status }
    if (status === 'sold') {
      updateData.sold_at = new Date().toISOString()
      if (actualPrice) updateData.actual_selling_price = actualPrice
    }
    
    const { error } = await supabase.from('purchases').update(updateData).eq('id', id)
    if (!error) fetchPurchases()
  }

  // 集計計算
  const calcSummary = () => {
    const stock = purchases.filter(p => p.status === 'stock')
    const sold = purchases.filter(p => p.status === 'sold')
    
    const totalInvested = stock.reduce((sum, p) => sum + p.purchase_price, 0)
    const totalProfit = sold.reduce((sum, p) => sum + p.profit, 0)
    const avgRoi = sold.length > 0 
      ? (sold.reduce((sum, p) => sum + p.roi, 0) / sold.length).toFixed(1)
      : 0
    
    return { stockCount: stock.length, soldCount: sold.length, totalInvested, totalProfit, avgRoi }
  }

  const summary = calcSummary()

  return (
    <div>
      {/* ヘッダー */}
      <header className="header">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1>🔥 カード相場</h1>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSettings(true)}>⚙️</button>
          </div>
        </div>
      </header>

      {/* タブ */}
      <div className="container" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button 
            className={`btn ${activeTab === 'search' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('search')}
          >
            🔍 検索
          </button>
          <button 
            className={`btn ${activeTab === 'purchases' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('purchases')}
          >
            📦 仕入れ管理
          </button>
        </div>
      </div>

      {/* 検索タブ */}
      {activeTab === 'search' && (
        <div className="container">
          {/* フィルター */}
          <div className="filters">
            {/* 検索モード切り替え */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button 
                className={`btn btn-sm ${filters.searchMode === 'market' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilters({...filters, searchMode: 'market'})}
              >
                📈 相場検索
              </button>
              <button 
                className={`btn btn-sm ${filters.searchMode === 'database' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilters({...filters, searchMode: 'database'})}
              >
                🗃️ カードDB
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button className={`btn btn-sm ${viewMode === 'default' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setViewMode('default')} title="デフォルト">📋</button>
                <button className={`btn btn-sm ${viewMode === 'compact' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setViewMode('compact')} title="コンパクト">📄</button>
                <button className={`btn btn-sm ${viewMode === 'detailed' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setViewMode('detailed')} title="詳細">📊</button>
                <button className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setViewMode('grid')} title="グリッド">🔲</button>
              </div>
            </div>
            
            {/* フリー検索 */}
            <div className="filter-group" style={{ marginBottom: 12 }}>
              <label>🔍 フリー検索（名前・番号・パック）</label>
              <input 
                type="text" 
                placeholder="リザードン SAR / 217/187 / SV8a..."
                value={filters.query}
                onChange={e => setFilters({...filters, query: e.target.value})}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                スペース区切りでAND検索
              </div>
            </div>
            
            {/* 相場検索時のみ表示 */}
            {filters.searchMode === 'market' && (
              <>
                <div className="filter-row">
                  <div className="filter-group">
                    <label>期間(日)</label>
                    <input type="text" value={filters.days} placeholder="7"
                      onChange={e => setFilters({...filters, days: e.target.value})}
                      style={{ width: 60 }} />
                  </div>
                  <div className="filter-group">
                    <label>最低成約</label>
                    <input type="text" value={filters.minSales} placeholder="1"
                      onChange={e => setFilters({...filters, minSales: e.target.value})}
                      style={{ width: 60 }} />
                  </div>
                  <div className="filter-group">
                    <label>状態</label>
                    <select value={filters.condition} onChange={e => setFilters({...filters, condition: e.target.value})}>
                      <option value="PSA10">PSA10</option>
                      <option value="A">美品A</option>
                      <option value="B">B</option>
                      <option value="">全て</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>ソート</label>
                    <select value={filters.sortBy} onChange={e => setFilters({...filters, sortBy: e.target.value})}>
                      <option value="sales">成約数↓</option>
                      <option value="price">価格↓</option>
                      <option value="priceAsc">価格↑</option>
                      <option value="name">名前順</option>
                      <option value="roi">ROI</option>
                    </select>
                  </div>
                </div>
                <div className="filter-row">
                  <div className="filter-group">
                    <label>最低価格</label>
                    <input type="text" value={filters.minPrice} placeholder="0"
                      onChange={e => setFilters({...filters, minPrice: e.target.value})}
                      style={{ width: 80 }} />
                  </div>
                  <div className="filter-group">
                    <label>最高価格</label>
                    <input type="text" value={filters.maxPrice} placeholder="上限なし"
                      onChange={e => setFilters({...filters, maxPrice: e.target.value})}
                      style={{ width: 80 }} />
                  </div>
                  <div className="filter-group">
                    <label>&nbsp;</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={filters.onlyBuyable} 
                        onChange={e => setFilters({...filters, onlyBuyable: e.target.checked})} />
                      買い時のみ
                    </label>
                  </div>
                </div>
              </>
            )}
            
            {/* カードDB検索時 */}
            {filters.searchMode === 'database' && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                💡 card_prices テーブルから直接検索。成約履歴がないカードも表示。
              </div>
            )}
            
            <button className="btn btn-primary" onClick={fetchCards} style={{ width: '100%', marginTop: 8 }}>
              🔍 検索
            </button>
          </div>

          {/* 結果件数 */}
          {cards.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
              {cards.length}件表示
            </div>
          )}

          {/* カードリスト */}
          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : cards.length === 0 ? (
            <div className="empty-state">
              <p>条件に合うカードがありません</p>
            </div>
          ) : viewMode === 'default' ? (
            // デフォルト表示
            <div className="card-list">
              {cards.map(card => (
                <div key={card.snkrdunkId} className={`card-item ${card.isBuy ? 'is-buy' : ''}`} onClick={() => setSelectedCard(card)}>
                  {card.imageUrl && <img src={card.imageUrl} alt={card.cardName} className="card-image" />}
                  <div className="card-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div className="card-name">{card.cardName}</div>
                        <div className="card-number">{card.cardNumber} ({card.packCode})</div>
                      </div>
                      {card.isBuy && <span className="card-badge">🎯 買い時</span>}
                    </div>
                    <div className="card-stats">
                      <div className="stat"><span className="stat-label">成約</span><span className="stat-value">{card.salesCount}件</span></div>
                      <div className="stat"><span className="stat-label">平均</span><span className="stat-value">¥{card.avgPrice.toLocaleString()}</span></div>
                      <div className="stat"><span className="stat-label">推奨</span><span className="stat-value profit">¥{card.recommendedBuy.toLocaleString()}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === 'compact' ? (
            // コンパクト表示
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {cards.map(card => (
                <div key={card.snkrdunkId} onClick={() => setSelectedCard(card)}
                  style={{ 
                    background: 'var(--bg-card)', 
                    padding: '8px 12px', 
                    borderRadius: 8, 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderLeft: card.isBuy ? '3px solid var(--success)' : 'none'
                  }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{card.cardName}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginLeft: 8 }}>{card.cardNumber}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem' }}>
                    <span>{card.salesCount}件</span>
                    <span>¥{card.avgPrice.toLocaleString()}</span>
                    <span style={{ color: 'var(--success)' }}>¥{card.recommendedBuy.toLocaleString()}</span>
                    {card.isBuy && <span>🎯</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === 'detailed' ? (
            // 詳細表示
            <div className="card-list">
              {cards.map(card => (
                <div key={card.snkrdunkId} className={`card-item ${card.isBuy ? 'is-buy' : ''}`} 
                  onClick={() => setSelectedCard(card)} style={{ flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {card.imageUrl && <img src={card.imageUrl} alt={card.cardName} className="card-image" />}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div className="card-name">{card.cardName}</div>
                        {card.isBuy && <span className="card-badge">🎯 買い時</span>}
                      </div>
                      <div className="card-number">{card.cardNumber} ({card.packCode}) {card.conditions && `[${card.conditions}]`}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8, fontSize: '0.75rem' }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>成約数</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{card.salesCount}件</div>
                      <div style={{ color: 'var(--text-secondary)' }}>{card.turnoverRate}/日</div>
                    </div>
                    <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>平均価格</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>¥{card.avgPrice.toLocaleString()}</div>
                      <div style={{ color: 'var(--text-secondary)' }}>¥{card.minPrice.toLocaleString()}〜</div>
                    </div>
                    <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>推奨仕入</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--success)' }}>¥{card.recommendedBuy.toLocaleString()}</div>
                      <div style={{ color: 'var(--text-secondary)' }}>手取り¥{card.netAvg.toLocaleString()}</div>
                    </div>
                    <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>最安出品</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: card.currentAsk > 0 ? (card.isBuy ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)' }}>
                        {card.currentAsk > 0 ? `¥${card.currentAsk.toLocaleString()}` : '---'}
                      </div>
                      {card.currentAsk > 0 && (
                        <div style={{ color: card.isBuy ? 'var(--success)' : 'var(--danger)' }}>
                          {card.isBuy ? '✨買い時' : `+¥${(card.currentAsk - card.recommendedBuy).toLocaleString()}`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // グリッド表示
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {cards.map(card => (
                <div key={card.snkrdunkId} onClick={() => setSelectedCard(card)}
                  style={{ 
                    background: 'var(--bg-card)', 
                    borderRadius: 12, 
                    padding: 8, 
                    cursor: 'pointer',
                    borderTop: card.isBuy ? '3px solid var(--success)' : 'none',
                    textAlign: 'center'
                  }}>
                  {card.imageUrl && <img src={card.imageUrl} alt={card.cardName} 
                    style={{ width: '100%', height: 160, objectFit: 'contain', borderRadius: 8 }} />}
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {card.cardName}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>{card.cardNumber}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--success)', marginTop: 4 }}>
                    ¥{card.recommendedBuy.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>{card.salesCount}件成約</div>
                  {card.isBuy && <div style={{ fontSize: '0.625rem', color: 'var(--success)', marginTop: 2 }}>🎯買い時</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 仕入れ管理タブ */}
      {activeTab === 'purchases' && (
        <div className="container">
          {/* サマリー */}
          <div className="filters" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>在庫</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{summary.stockCount}件</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>売却済</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{summary.soldCount}件</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>投資額</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>¥{summary.totalInvested.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>利益</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: summary.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  ¥{summary.totalProfit.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* フィルタ */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['all', 'stock', 'listing', 'sold'].map(f => (
              <button key={f} className={`btn btn-sm ${purchaseFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPurchaseFilter(f)}>
                {f === 'all' ? '全て' : f === 'stock' ? '在庫' : f === 'listing' ? '出品中' : '売却済'}
              </button>
            ))}
          </div>

          {/* 仕入れリスト */}
          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : purchases.length === 0 ? (
            <div className="empty-state"><p>仕入れデータがありません</p></div>
          ) : (
            <div className="card-list">
              {purchases.map(p => (
                <div key={p.id} className="card-item" style={{ flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="card-name">{p.card_name}</div>
                      <div className="card-number">{p.card_number} {p.is_psa && `PSA${p.psa_grade}`}</div>
                    </div>
                    <span className={`card-badge`} style={{ 
                      background: p.status === 'sold' ? 'var(--success)' : p.status === 'listing' ? 'var(--warning)' : 'var(--accent)' 
                    }}>
                      {p.status === 'stock' ? '在庫' : p.status === 'listing' ? '出品中' : '売却済'}
                    </span>
                  </div>
                  <div className="card-stats">
                    <div className="stat"><span className="stat-label">仕入</span><span className="stat-value">¥{p.purchase_price.toLocaleString()}</span></div>
                    <div className="stat"><span className="stat-label">売値</span><span className="stat-value">¥{p.selling_price.toLocaleString()}</span></div>
                    <div className="stat"><span className="stat-label">利益</span>
                      <span className={`stat-value ${p.profit >= 0 ? 'profit' : 'loss'}`}>¥{p.profit.toLocaleString()}</span>
                    </div>
                    <div className="stat"><span className="stat-label">ROI</span><span className="stat-value">{p.roi}%</span></div>
                  </div>
                  {p.status !== 'sold' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {p.status === 'stock' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => updatePurchaseStatus(p.id, 'listing')}>
                          出品中にする
                        </button>
                      )}
                      <button className="btn btn-sm btn-primary" onClick={() => {
                        const price = prompt('実売価格を入力', p.selling_price)
                        if (price) updatePurchaseStatus(p.id, 'sold', parseInt(price))
                      }}>
                        売却済にする
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 詳細モーダル */}
      {selectedCard && (
        <div className="modal-overlay" onClick={() => setSelectedCard(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div></div>
              <button className="modal-close" onClick={() => setSelectedCard(null)}>×</button>
            </div>
            
            {selectedCard.imageUrl && <img src={selectedCard.imageUrl} alt={selectedCard.cardName} className="modal-image" />}
            
            <h2 className="modal-title">{selectedCard.cardName}</h2>
            <p className="modal-subtitle">{selectedCard.cardNumber} ({selectedCard.packCode})</p>
            
            <div className="modal-stats">
              <div className="modal-stat-row"><span>📈 成約数</span><span style={{ color: 'var(--success)', fontWeight: 600 }}>{selectedCard.salesCount}件 ({selectedCard.turnoverRate}件/日)</span></div>
              <div className="modal-stat-row"><span>💰 平均価格</span><span>¥{selectedCard.avgPrice.toLocaleString()}</span></div>
              <div className="modal-stat-row"><span>📊 価格帯</span><span>¥{selectedCard.minPrice.toLocaleString()} 〜 ¥{selectedCard.maxPrice.toLocaleString()}</span></div>
              <div className="modal-stat-row"><span>💵 手取り</span><span>¥{selectedCard.netAvg.toLocaleString()}</span></div>
              {selectedCard.currentAsk > 0 && (
                <div className="modal-stat-row"><span>🏷️ 最安出品</span>
                  <span style={{ color: selectedCard.isBuy ? 'var(--success)' : 'var(--danger)' }}>
                    ¥{selectedCard.currentAsk.toLocaleString()} {selectedCard.isBuy ? '✨' : `(+¥${(selectedCard.currentAsk - selectedCard.recommendedBuy).toLocaleString()})`}
                  </span>
                </div>
              )}
            </div>
            
            <div className="recommend-box">
              <div className="recommend-label">✅ 仕入れ推奨価格</div>
              <div className="recommend-price">¥{selectedCard.recommendedBuy.toLocaleString()} 以下</div>
            </div>
            
            {(() => {
              const { mercariUrl, yahooUrl, minPrice, maxPrice } = getSearchUrls(selectedCard)
              return (
                <>
                  <div className="search-buttons">
                    <a href={selectedCard.snkrdunkUrl} target="_blank" className="btn btn-snkrdunk">スニダン</a>
                    <a href={mercariUrl} target="_blank" className="btn btn-mercari">メルカリ</a>
                    <a href={yahooUrl} target="_blank" className="btn btn-yahoo">ヤフフリ</a>
                  </div>
                  <div className="search-range">🔍 検索価格帯: ¥{minPrice.toLocaleString()} 〜 ¥{maxPrice.toLocaleString()}</div>
                </>
              )
            })()}
            
            {/* 仕入れ登録ボタン */}
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: 16 }} onClick={() => openPurchaseForm(selectedCard)}>
              📦 仕入れ登録
            </button>
            
            {/* テクニカル分析セクション */}
            {selectedCard.sales.length >= 3 && (() => {
              const prices = selectedCard.sales.map(s => s.price).filter(p => p > 0)
              const stats = calcBasicStats(prices)
              const bollinger = calcBollingerBands(prices)
              const rsi = calcRSI(prices)
              const ma = calcMovingAverages(prices)
              const volatility = calcVolatility(prices)
              const sr = calcSupportResistance(prices)
              const prediction = predictPrice(prices)
              const signal = calcTradingSignal(stats, bollinger, rsi, ma, volatility, selectedCard.currentAsk || stats?.mean)
              
              return (
                <div style={{ marginBottom: 16 }}>
                  {/* 売買シグナル */}
                  <div style={{ 
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    marginBottom: 16,
                    border: `2px solid ${signal.color}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>🤖 AI売買判定</span>
                      <span style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: 700, 
                        color: signal.color,
                        textShadow: `0 0 10px ${signal.color}40`
                      }}>
                        {signal.recommendation}
                      </span>
                    </div>
                    
                    {/* スコアバー */}
                    <div style={{ background: '#0f0f1a', borderRadius: 8, height: 8, marginBottom: 12, overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${signal.score}%`, 
                        height: '100%', 
                        background: `linear-gradient(90deg, #ff5252, #ff9800, #00ff88)`,
                        borderRadius: 8,
                        transition: 'width 0.5s'
                      }} />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      スコア: {signal.score}/100
                    </div>
                    
                    {/* シグナル一覧 */}
                    <div style={{ marginTop: 12 }}>
                      {signal.signals.map((s, i) => (
                        <div key={i} style={{ 
                          fontSize: '0.75rem', 
                          padding: '4px 8px',
                          marginBottom: 4,
                          borderRadius: 4,
                          background: s.type === 'bullish' ? '#1a472a' : s.type === 'bearish' ? '#4a1a1a' : '#3a3a1a',
                          color: s.type === 'bullish' ? '#00ff88' : s.type === 'bearish' ? '#ff5252' : '#ff9800'
                        }}>
                          {s.type === 'bullish' ? '📈' : s.type === 'bearish' ? '📉' : '⚠️'} {s.text}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* 価格チャート */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12 }}>📈 価格推移チャート</div>
                    <svg width="100%" height="120" viewBox="0 0 400 120" style={{ background: '#0f0f1a', borderRadius: 8 }}>
                      {/* グリッド線 */}
                      <line x1="40" y1="20" x2="380" y2="20" stroke="#333" strokeDasharray="4" />
                      <line x1="40" y1="60" x2="380" y2="60" stroke="#333" strokeDasharray="4" />
                      <line x1="40" y1="100" x2="380" y2="100" stroke="#333" strokeDasharray="4" />
                      
                      {/* ボリンジャーバンド */}
                      {bollinger && (() => {
                        const minP = Math.min(...prices, bollinger.lower) * 0.95
                        const maxP = Math.max(...prices, bollinger.upper) * 1.05
                        const range = maxP - minP
                        const upperY = 100 - ((bollinger.upper - minP) / range * 80)
                        const lowerY = 100 - ((bollinger.lower - minP) / range * 80)
                        const middleY = 100 - ((bollinger.middle - minP) / range * 80)
                        
                        return (
                          <>
                            <rect x="40" y={upperY} width="340" height={lowerY - upperY} fill="#667eea20" />
                            <line x1="40" y1={middleY} x2="380" y2={middleY} stroke="#667eea" strokeDasharray="4" />
                          </>
                        )
                      })()}
                      
                      {/* 価格ライン */}
                      {(() => {
                        const reversed = [...prices].reverse()
                        const minP = Math.min(...prices) * 0.95
                        const maxP = Math.max(...prices) * 1.05
                        const range = maxP - minP
                        const points = reversed.map((p, i) => {
                          const x = 40 + (i / (reversed.length - 1)) * 340
                          const y = 100 - ((p - minP) / range * 80)
                          return `${x},${y}`
                        }).join(' ')
                        
                        return (
                          <>
                            <polyline points={points} fill="none" stroke="#00ff88" strokeWidth="2" />
                            {reversed.map((p, i) => {
                              const x = 40 + (i / (reversed.length - 1)) * 340
                              const y = 100 - ((p - minP) / range * 80)
                              return <circle key={i} cx={x} cy={y} r="3" fill="#00ff88" />
                            })}
                          </>
                        )
                      })()}
                      
                      {/* 価格ラベル */}
                      <text x="35" y="24" fill="#888" fontSize="8" textAnchor="end">¥{Math.round(Math.max(...prices) * 1.05).toLocaleString()}</text>
                      <text x="35" y="104" fill="#888" fontSize="8" textAnchor="end">¥{Math.round(Math.min(...prices) * 0.95).toLocaleString()}</text>
                    </svg>
                    
                    {/* 凡例 */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.625rem', color: 'var(--text-secondary)' }}>
                      <span>🟢 価格推移</span>
                      {bollinger && <span>🟣 ボリンジャーバンド</span>}
                    </div>
                  </div>
                  
                  {/* テクニカル指標 */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12 }}>📊 テクニカル指標</div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {/* RSI */}
                      {rsi !== null && (
                        <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 12 }}>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>RSI (7)</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: rsi < 30 ? '#00ff88' : rsi > 70 ? '#ff5252' : '#fff' }}>
                            {rsi.toFixed(1)}
                          </div>
                          <div style={{ fontSize: '0.625rem', color: rsi < 30 ? '#00ff88' : rsi > 70 ? '#ff5252' : '#888' }}>
                            {rsi < 30 ? '売られすぎ' : rsi > 70 ? '買われすぎ' : 'ニュートラル'}
                          </div>
                        </div>
                      )}
                      
                      {/* ボラティリティ */}
                      {volatility && (
                        <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 12 }}>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>ボラティリティ</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: volatility.dailyVolatility > 10 ? '#ff9800' : '#00ff88' }}>
                            {volatility.dailyVolatility.toFixed(1)}%
                          </div>
                          <div style={{ fontSize: '0.625rem', color: volatility.dailyVolatility > 10 ? '#ff9800' : '#00ff88' }}>
                            {volatility.dailyVolatility > 10 ? '高変動' : volatility.dailyVolatility > 5 ? '中変動' : '安定'}
                          </div>
                        </div>
                      )}
                      
                      {/* 変動係数 */}
                      {stats && (
                        <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 12 }}>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>変動係数 (CV)</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                            {stats.cv.toFixed(1)}%
                          </div>
                          <div style={{ fontSize: '0.625rem', color: stats.cv < 10 ? '#00ff88' : '#ff9800' }}>
                            {stats.cv < 10 ? '価格安定' : '価格変動あり'}
                          </div>
                        </div>
                      )}
                      
                      {/* トレンド */}
                      {ma && (
                        <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 12 }}>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>トレンド</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: ma.trend === 'uptrend' ? '#00ff88' : ma.trend === 'downtrend' ? '#ff5252' : '#888' }}>
                            {ma.trend === 'uptrend' ? '↗ 上昇' : ma.trend === 'downtrend' ? '↘ 下落' : '→ 横ばい'}
                          </div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>
                            MA3: ¥{Math.round(ma.ma3).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 価格予測 */}
                  {prediction && (
                    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12 }}>🔮 価格予測（3日後）</div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: prediction.trend === 'up' ? '#00ff88' : prediction.trend === 'down' ? '#ff5252' : '#fff' }}>
                            ¥{prediction.predicted.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {prediction.trend === 'up' ? '📈' : prediction.trend === 'down' ? '📉' : '➡️'} 
                            日次変動: {prediction.dailyChange > 0 ? '+' : ''}¥{prediction.dailyChange.toLocaleString()}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>信頼度</div>
                          <div style={{ 
                            fontSize: '1.25rem', 
                            fontWeight: 700, 
                            color: prediction.confidence > 70 ? '#00ff88' : prediction.confidence > 40 ? '#ff9800' : '#ff5252' 
                          }}>
                            {prediction.confidence}%
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                        ※線形回帰モデルによる予測。R²={prediction.r2.toFixed(3)}
                      </div>
                    </div>
                  )}
                  
                  {/* サポート・レジスタンス */}
                  {sr && (
                    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12 }}>🎯 価格帯分析</div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.625rem', color: '#00ff88' }}>サポート</div>
                          <div style={{ fontWeight: 700 }}>¥{sr.support.toLocaleString()}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.625rem', color: '#667eea' }}>ピボット</div>
                          <div style={{ fontWeight: 700 }}>¥{Math.round(sr.pivot).toLocaleString()}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.625rem', color: '#ff5252' }}>レジスタンス</div>
                          <div style={{ fontWeight: 700 }}>¥{sr.resistance.toLocaleString()}</div>
                        </div>
                      </div>
                      
                      {/* 視覚的な価格帯バー */}
                      <div style={{ marginTop: 12, position: 'relative', height: 20 }}>
                        <div style={{ position: 'absolute', left: 0, right: 0, top: 8, height: 4, background: 'linear-gradient(90deg, #00ff88, #667eea, #ff5252)', borderRadius: 2 }} />
                        {selectedCard.currentAsk > 0 && (() => {
                          const pos = ((selectedCard.currentAsk - sr.support) / (sr.resistance - sr.support)) * 100
                          const clampedPos = Math.max(0, Math.min(100, pos))
                          return (
                            <div style={{ 
                              position: 'absolute', 
                              left: `${clampedPos}%`, 
                              top: 0, 
                              transform: 'translateX(-50%)',
                              fontSize: '0.75rem'
                            }}>
                              ▼
                            </div>
                          )
                        })()}
                      </div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 4 }}>
                        ▼ 現在価格の位置
                      </div>
                    </div>
                  )}
                  
                  {/* 統計サマリー */}
                  {stats && (
                    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12 }}>📐 統計データ</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: '0.75rem' }}>
                        <div><span style={{ color: 'var(--text-secondary)' }}>平均:</span> ¥{Math.round(stats.mean).toLocaleString()}</div>
                        <div><span style={{ color: 'var(--text-secondary)' }}>中央値:</span> ¥{Math.round(stats.median).toLocaleString()}</div>
                        <div><span style={{ color: 'var(--text-secondary)' }}>標準偏差:</span> ¥{Math.round(stats.stdDev).toLocaleString()}</div>
                        <div><span style={{ color: 'var(--text-secondary)' }}>Q1:</span> ¥{stats.q1.toLocaleString()}</div>
                        <div><span style={{ color: 'var(--text-secondary)' }}>Q3:</span> ¥{stats.q3.toLocaleString()}</div>
                        <div><span style={{ color: 'var(--text-secondary)' }}>IQR:</span> ¥{stats.iqr.toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
            
            {selectedCard.sales.length > 0 && (
              <div className="history-section">
                <div className="history-title">📋 直近の成約</div>
                <div className="history-list">
                  {selectedCard.sales.map((sale, i) => (
                    <div key={i} className="history-item">
                      <span className="history-date">{sale.date}</span>
                      <span style={{ color: 'var(--accent)' }}>{sale.condition}</span>
                      <span className="history-price">¥{(sale.price || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 仕入れ登録モーダル */}
      {showPurchaseForm && purchaseFormData && (
        <div className="modal-overlay" onClick={() => setShowPurchaseForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>📦 仕入れ登録</h2>
              <button className="modal-close" onClick={() => setShowPurchaseForm(false)}>×</button>
            </div>
            
            <div className="settings-group">
              <label>カード名</label>
              <input type="text" value={purchaseFormData.cardName} readOnly style={{ background: 'var(--bg-secondary)' }} />
            </div>
            
            <div className="settings-group">
              <label>仕入れ価格</label>
              <input type="number" value={purchaseFormData.purchasePrice} 
                onChange={e => {
                  const price = Number(e.target.value)
                  const profit = purchaseFormData.netRevenue - price
                  const roi = price > 0 ? (profit / price * 100).toFixed(1) : 0
                  setPurchaseFormData({...purchaseFormData, purchasePrice: price, profit, roi})
                }} />
            </div>
            
            <div className="settings-group">
              <label>販売予定価格</label>
              <input type="number" value={purchaseFormData.sellingPrice}
                onChange={e => {
                  const selling = Number(e.target.value)
                  const feeAmount = Math.floor(selling * (purchaseFormData.feeRate / 100))
                  const netRevenue = selling - feeAmount - purchaseFormData.shippingCost - purchaseFormData.otherCostsTotal
                  const profit = netRevenue - purchaseFormData.purchasePrice
                  const roi = purchaseFormData.purchasePrice > 0 ? (profit / purchaseFormData.purchasePrice * 100).toFixed(1) : 0
                  setPurchaseFormData({...purchaseFormData, sellingPrice: selling, feeAmount, netRevenue, profit, roi})
                }} />
            </div>
            
            <div className="settings-group">
              <label>販売プラットフォーム</label>
              <select value={purchaseFormData.platformId} onChange={e => {
                const platforms = getPlatforms(settings)
                const platform = platforms.find(p => p.id === e.target.value)
                const feeAmount = Math.floor(purchaseFormData.sellingPrice * (platform.feeRate / 100))
                const netRevenue = purchaseFormData.sellingPrice - feeAmount - purchaseFormData.shippingCost - purchaseFormData.otherCostsTotal
                const profit = netRevenue - purchaseFormData.purchasePrice
                const roi = purchaseFormData.purchasePrice > 0 ? (profit / purchaseFormData.purchasePrice * 100).toFixed(1) : 0
                setPurchaseFormData({...purchaseFormData, platformId: platform.id, platformName: platform.name, feeRate: platform.feeRate, feeAmount, netRevenue, profit, roi})
              }}>
                {getPlatforms(settings).map(p => <option key={p.id} value={p.id}>{p.name} ({p.feeRate}%)</option>)}
              </select>
            </div>
            
            <div className="settings-group">
              <label>メモ</label>
              <input type="text" value={purchaseFormData.notes} 
                onChange={e => setPurchaseFormData({...purchaseFormData, notes: e.target.value})} 
                placeholder="購入元など" />
            </div>
            
            <div className="modal-stats" style={{ marginTop: 16 }}>
              <div className="modal-stat-row"><span>手数料</span><span>¥{purchaseFormData.feeAmount.toLocaleString()}</span></div>
              <div className="modal-stat-row"><span>手取り</span><span>¥{purchaseFormData.netRevenue.toLocaleString()}</span></div>
              <div className="modal-stat-row"><span>利益</span>
                <span style={{ color: purchaseFormData.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                  ¥{purchaseFormData.profit.toLocaleString()}
                </span>
              </div>
              <div className="modal-stat-row"><span>ROI</span><span style={{ fontWeight: 700 }}>{purchaseFormData.roi}%</span></div>
            </div>
            
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={savePurchase}>
              登録する
            </button>
          </div>
        </div>
      )}

      {/* 設定モーダル */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>⚙️ 設定</h2>
              <button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
            </div>
            
            <div className="settings-group">
              <label>ワーカー（必須）</label>
              <select value={settings.workerId || ''} onChange={e => setSettings({...settings, workerId: e.target.value})}>
                <option value="">選択してください</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            
            <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0', paddingTop: 16 }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>📊 手数料設定</div>
            </div>
            
            <div className="settings-group">
              <label>スニダン手数料 (%)</label>
              <input type="number" step="0.1" value={settings.snkrdunkFee} onChange={e => setSettings({...settings, snkrdunkFee: Number(e.target.value)})} />
            </div>
            
            <div className="settings-group">
              <label>メルカリ手数料 (%)</label>
              <input type="number" step="0.1" value={settings.mercariFee} onChange={e => setSettings({...settings, mercariFee: Number(e.target.value)})} />
            </div>
            
            <div className="settings-group">
              <label>ヤフフリ手数料 (%)</label>
              <input type="number" step="0.1" value={settings.yahooFee} onChange={e => setSettings({...settings, yahooFee: Number(e.target.value)})} />
            </div>
            
            <div className="settings-group">
              <label>デフォルト販売先</label>
              <select value={settings.defaultPlatform} onChange={e => setSettings({...settings, defaultPlatform: e.target.value})}>
                <option value="snkrdunk">スニダン</option>
                <option value="mercari">メルカリ</option>
                <option value="yahoo">ヤフフリ</option>
              </select>
            </div>
            
            <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0', paddingTop: 16 }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>💰 経費設定</div>
            </div>
            
            <div className="settings-group">
              <label>送料 (円)</label>
              <input type="number" value={settings.shippingCost} onChange={e => setSettings({...settings, shippingCost: Number(e.target.value)})} />
            </div>
            
            <div className="settings-group">
              <label>その他経費 (円)</label>
              <input type="number" value={settings.otherCost} onChange={e => setSettings({...settings, otherCost: Number(e.target.value)})} />
            </div>
            
            <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0', paddingTop: 16 }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>🎯 計算設定</div>
            </div>
            
            <div className="settings-group">
              <label>目標ROI (%)</label>
              <input type="number" value={settings.targetRoi} onChange={e => setSettings({...settings, targetRoi: Number(e.target.value)})} />
            </div>
            
            <div className="settings-group">
              <label>検索マージン (%)</label>
              <input type="number" value={settings.searchMargin} onChange={e => setSettings({...settings, searchMargin: Number(e.target.value)})} />
            </div>
            
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}
              onClick={() => { saveSettings(settings); setShowSettings(false); if (cards.length > 0) fetchCards() }}>
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
