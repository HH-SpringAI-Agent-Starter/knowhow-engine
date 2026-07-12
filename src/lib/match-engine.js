/**
 * Match Engine — 触发条件匹配引擎
 * 核心: 给定一个"信号"（涨价/政策/事件），找到最匹配的链
 * Domain-agnostic: 任何链 JSON 的 trigger_conditions 都支持
 */

const { getChains } = require('./chain-loader');

/**
 * 触发条件评分结构
 * @typedef {Object} MatchResult
 * @property {string} chain_id
 * @property {string} name
 * @property {number} score — 0-100 匹配度
 * @property {number} confidence_weight — 原始权重
 * @property {Array<string>} matched_triggers — 匹配的触发条件
 * @property {string} bottleneck — 瓶颈环节
 */

/**
 * 输入信号
 * @typedef {Object} Signal
 * @property {string} type — 'price_up' | 'supply_shock' | 'policy' | 'demand_boom' | 'event'
 * @property {number} [pct] — 涨价幅度 (price_up)
 * @property {string} [keyword] — 关键词匹配
 * @property {string} [description] — 事件描述
 */

/**
 * 匹配信号到所有链
 * @param {Signal} signal
 * @returns {MatchResult[]} 按 score 降序排列
 */
function matchChains(signal) {
  const chains = getChains();
  const results = [];

  for (const chain of chains) {
    const match = evaluateChain(chain, signal);
    if (match.score > 0) results.push(match);
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * 单链单信号匹配
 */
function evaluateChain(chain, signal) {
  const triggers = chain.trigger_conditions || {};
  const matched = [];
  let score = 0;

  switch (signal.type) {
    case 'price_up':
      // 兼容多种字段名: price_up_pct_1m, price_up_pct_30d, price_up_pct
      const priceField = ['price_up_pct_1m', 'price_up_pct_30d', 'price_up_pct']
        .find(f => triggers[f] !== undefined && triggers[f] !== null);
      if (priceField) {
        const threshold = typeof triggers[priceField] === 'number'
          ? triggers[priceField]
          : parseFloat(triggers[priceField]);
        if (!isNaN(threshold) && signal.pct >= threshold) {
          matched.push(`涨价 ${signal.pct}% ≥ 阈值 ${threshold}%`);
          score += 40;
        } else if (!isNaN(threshold) && signal.pct >= threshold * 0.5) {
          matched.push(`涨价 ${signal.pct}% 接近阈值 ${threshold}%（半程）`);
          score += 15;
        }
      }
      break;

    case 'supply_shock':
      if (triggers.supply_shock) {
        matched.push(`供给冲击: ${triggers.supply_shock}`);
        score += 35;
      }
      if (triggers.supply_direction && triggers.supply_direction.includes('收缩')) {
        score += 10;
      }
      break;

    case 'policy':
      if (triggers.policy_catalyst) {
        const p = triggers.policy_catalyst.toLowerCase();
        const desc = (signal.description || '').toLowerCase();
        if (p.includes(desc) || desc.includes(p) || signal.keyword && p.includes(signal.keyword)) {
          matched.push(`政策: ${triggers.policy_catalyst}`);
          score += 25;
        }
      }
      break;

    case 'demand_boom':
      if (triggers.demand_boost) {
        const d = triggers.demand_boost.toLowerCase();
        const desc = (signal.description || '').toLowerCase();
        if (d.includes(desc) || desc.includes(d) || signal.keyword && d.includes(signal.keyword)) {
          matched.push(`需求爆发: ${triggers.demand_boost}`);
          score += 30;
        }
      }
      break;

    case 'event':
      // 全字段匹配
      if (signal.keyword) {
        const kw = signal.keyword.toLowerCase();
        const searchable = [
          chain.name,
          chain.chain_id,
          ...(chain.normalized_tags || []),
          triggers.policy_catalyst || '',
          triggers.demand_boost || '',
          triggers.other || ''
        ].join(' ').toLowerCase();
        if (searchable.includes(kw)) {
          matched.push(`事件关键词: ${kw}`);
          score += 20;
        }
      }
      break;
  }

  // 额外加分: 关键词命中 bottleneck
  if (chain.bottleneck_analysis) {
    const bottleneckText = typeof chain.bottleneck_analysis === 'string'
      ? chain.bottleneck_analysis
      : (chain.bottleneck_analysis.bottleneck_link || chain.bottleneck_analysis.bottleneck_sector || '');
    if (signal.keyword && bottleneckText.toLowerCase().includes(signal.keyword.toLowerCase())) {
      score += 15;
      matched.push('瓶颈环节命中');
    }
  }

  // 如果 other 条件匹配
  if (triggers.other) {
    const desc = (signal.description || '').toLowerCase();
    const other = triggers.other.toLowerCase();
    if (other.includes(desc) || desc.includes(other) || signal.keyword && other.includes(signal.keyword)) {
      matched.push(`其他: ${triggers.other}`);
      score += 10;
    }
  }

  // 置信度权重调整
  const weight = chain.confidence_weight || 50;
  score = Math.round(score * (weight / 50));

  // 瓶颈等级加分
  let bottleneck = '';
  if (chain.bottleneck_analysis) {
    const ba = chain.bottleneck_analysis;
    if (typeof ba === 'object' && ba.bottleneck_link) {
      bottleneck = ba.bottleneck_link;
      if (ba.pricing_power_level === 'A') score = Math.round(score * 1.3);
      else if (ba.pricing_power_level === 'B') score = Math.round(score * 1.15);
    }
  }

  return {
    chain_id: chain.chain_id,
    name: chain.name,
    category: chain.category || '',
    score: Math.min(score, 100),
    confidence_weight: weight,
    matched_triggers: matched,
    bottleneck,
    chain // 原始数据也返回供详细查询
  };
}

/**
 * 统计
 */
function getMatchStats() {
  const chains = getChains();
  return {
    total_chains: chains.length,
    by_category: chains.reduce((acc, c) => {
      const cat = c.category || 'uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {}),
    avg_confidence: Math.round(chains.reduce((s, c) => s + (c.confidence_weight || 50), 0) / chains.length)
  };
}

module.exports = { matchChains, getMatchStats };
