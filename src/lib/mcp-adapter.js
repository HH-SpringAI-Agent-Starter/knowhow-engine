/**
 * MCP Tool Adapter — 将引擎能力暴露为 MCP Tool JSON
 * 兼容 spring-ai-mcp-enterprise 的 McpToolExecutor 接口
 */

const { getChains, getChain, searchChains, getChainsByDomain, loadChains } = require('./chain-loader');
const { matchChains, getMatchStats } = require('./match-engine');
const { getTickers, searchTickers } = require('./ticker-resolver');
const { getConductionView, predictTimeline } = require('./conduction-engine');

/**
 * MCP Tool 描述（符合 spring-ai-mcp-enterprise 的 ToolDefinition 格式）
 */
function getToolDefinition() {
  return {
    name: 'chain_query',
    description: 'Know-how Library Engine: query causal chains, match signals, resolve tickers',
    version: '1.0.0',
    actions: [
      { name: 'list', description: 'List all chains with optional category filter' },
      { name: 'get', description: 'Get a specific chain by chain_id' },
      { name: 'search', description: 'Search chains by keyword in name/tags' },
      { name: 'match', description: 'Match signal (price_up/supply_shock/policy/demand_boom) to chains' },
      { name: 'tickers', description: 'Get tickers for a chain' },
      { name: 'tsymbol', description: 'Search tickers across all chains by keyword' },
      { name: 'conduction', description: 'Get full conduction path for a chain' },
      { name: 'timeline', description: 'Predict timeline to a conduction step' },
      { name: 'stats', description: 'Engine statistics' },
      { name: 'reload', description: 'Reload chains from disk' }
    ]
  };
}

/**
 * 执行 MCP Tool action
 */
function executeAction(action, params = {}) {
  switch (action) {
    case 'list': {
      const chains = getChains();
      const filtered = params.category ? getChainsByDomain(params.category) : chains;
      return { count: filtered.length, chains: filtered.map(c => ({
        chain_id: c.chain_id,
        name: c.name,
        category: c.category,
        domain: c.domain,
        confidence_weight: c.confidence_weight,
        updated_at: c.updated_at || null
      }))};
    }

    case 'get': {
      if (!params.chain_id) return { error: 'chain_id required' };
      const chain = getChain(params.chain_id);
      return chain || { error: `chain ${params.chain_id} not found` };
    }

    case 'search': {
      if (!params.query) return { error: 'query required' };
      const results = searchChains(params.query);
      return { count: results.length, results: results.map(c => ({
        chain_id: c.chain_id,
        name: c.name,
        category: c.category
      }))};
    }

    case 'match': {
      if (!params.signal) return { error: 'signal required (type + pct/keyword)' };
      const signal = typeof params.signal === 'string' ? JSON.parse(params.signal) : params.signal;
      const results = matchChains(signal);
      return { count: results.length, results: results.map(r => ({
        chain_id: r.chain_id,
        name: r.name,
        score: r.score,
        confidence_weight: r.confidence_weight,
        matched_triggers: r.matched_triggers,
        bottleneck: r.bottleneck
      }))};
    }

    case 'tickers': {
      if (!params.chain_id) return { error: 'chain_id required' };
      return getTickers(params.chain_id, params.filters || {});
    }

    case 'tsymbol': {
      if (!params.query) return { error: 'query required' };
      const results = searchTickers(params.query);
      return { count: results.length, results };
    }

    case 'conduction': {
      if (!params.chain_id) return { error: 'chain_id required' };
      return getConductionView(params.chain_id);
    }

    case 'timeline': {
      if (!params.chain_id || !params.step) return { error: 'chain_id and step required' };
      return predictTimeline(params.chain_id, params.step);
    }

    case 'stats': {
      return getMatchStats();
    }

    case 'reload': {
      const result = loadChains();
      return { loaded: result.chains.length, chains: result.chains.map(c => c.chain_id) };
    }

    default:
      return { error: `unknown action: ${action}` };
  }
}

module.exports = { getToolDefinition, executeAction };
