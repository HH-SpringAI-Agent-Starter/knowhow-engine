/**
 * Ticker Resolver — 标的名片处理
 * 处理四层标的: T1核心 / T2供需缺口 / T3全链 / T4催化
 */

const { getChain } = require('./chain-loader');

/**
 * 获取单条链的所有标的
 * @param {string} chainId
 * @param {Object} [filters] — 可选筛选 {tags: ['系统推荐'], tiers: ['T1','T2']}
 * @returns {Array}
 */
function getTickers(chainId, filters = {}) {
  const chain = getChain(chainId);
  if (!chain) return { chain_id: chainId, name: 'unknown', tickers: [] };

  const mapping = chain.ticker_mapping || {};
  // 兼容旧格式: ticker_mapping 可能是对象 {T1: [...], T2: [...]}
  // 也可能是 {tiers: {T1: [...], T2: [...], T3: [...], T4: [...], all: [...]}}
  const tiers = mapping.tiers || mapping;
  
  let all = [];
  if (Array.isArray(mapping.tickers)) {
    all = mapping.tickers; // 扁平格式
  } else if (Array.isArray(mapping)) {
    all = mapping; // 直接数组
  } else {
    // v2.0 嵌套格式: T1_core_bottleneck.stocks / T2_supply_demand_beneficiary.stocks
    const tierKeys = Object.keys(tiers).filter(k => /^T[1-4]/i.test(k) || /^T[1-4]_/.test(k));
    if (tierKeys.length > 0) {
      for (const key of tierKeys) {
        const tierLabel = 'T' + key.match(/[1-4]/)[0];
        const group = tiers[key];
        const stocks = group.stocks || group.tickers || group;
        if (Array.isArray(stocks)) {
          const labeled = stocks.map(t => ({ ...t, tier: tierLabel, tier_group: key }));
          all = all.concat(labeled);
        }
      }
    } else if (tiers.tiers) {
      // v3: { tiers: { T1: [...], T2: [...] } }
      const tierOrder = ['T1', 'T2', 'T3', 'T4'];
      for (const tier of tierOrder) {
        if (tiers.tiers[tier]) {
          const labeled = tiers.tiers[tier].map(t => ({ ...t, tier }));
          all = all.concat(labeled);
        }
      }
    }
    if (tiers.all) {
      all = tiers.all;
    }
  }

  // 筛选
  if (filters.tiers && filters.tiers.length > 0) {
    all = all.filter(t => filters.tiers.includes(t.tier));
  }
  if (filters.tags && filters.tags.length > 0) {
    all = all.filter(t => {
      const tags = t.tags || [];
      return filters.tags.some(ft => tags.includes(ft));
    });
  }

  return { chain_id: chainId, name: chain.name, tickers: all };
}

/**
 * 搜索跨链标的
 */
function searchTickers(keyword) {
  const { getChains } = require('./chain-loader');
  const chains = getChains();
  const results = [];
  const kw = keyword.toLowerCase();

  for (const chain of chains) {
    const mapping = chain.ticker_mapping || {};
    // 先展平所有 ticker
    const flatTickers = [];
    if (Array.isArray(mapping.tickers)) {
      mapping.tickers.forEach(t => flatTickers.push({ ...t, tier: t.tier || '' }));
    } else if (Array.isArray(mapping)) {
      mapping.forEach(t => flatTickers.push({ ...t, tier: t.tier || '' }));
    } else {
      const tierKeys = Object.keys(mapping).filter(k => /^T[1-4]/i.test(k));
      for (const key of tierKeys) {
        const tierLabel = 'T' + key.match(/[1-4]/)[0];
        const group = mapping[key];
        const stocks = group.stocks || group.tickers || group;
        if (Array.isArray(stocks)) {
          stocks.forEach(t => flatTickers.push({ ...t, tier: tierLabel }));
        }
      }
    }

    for (const t of flatTickers) {
      const matchName = (t.name || '').toLowerCase().includes(kw);
      const matchCode = (t.code || '').includes(kw);
      const matchReason = (t.reason || t.logic || '').toLowerCase().includes(kw);
      if (matchName || matchCode || matchReason) {
        results.push({
          chain_id: chain.chain_id,
          chain_name: chain.name,
          ...t
        });
      }
    }
  }

  return results;
}

module.exports = { getTickers, searchTickers };
