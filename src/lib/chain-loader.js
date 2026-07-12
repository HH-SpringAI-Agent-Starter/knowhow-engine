/**
 * Chain Loader — 加载、缓存、验证 Chain JSON
 * Domain-agnostic: 任何符合 schema 的链 JSON 都能加载
 */

const fs = require('fs');
const path = require('path');

let chainCache = null;
let chainMap = {};

/**
 * 从 knowledge/chains/ 加载所有链 JSON
 * @param {string} [chainsDir] — 可选，默认 ./knowledge/chains
 * @returns {{chains: Array, map: Object}}
 */
function loadChains(chainsDir) {
  const dir = chainsDir || path.join(process.cwd(), 'knowledge', 'chains');
  
  if (!fs.existsSync(dir)) {
    console.warn(`[chain-loader] chains directory not found: ${dir}`);
    return { chains: [], map: {} };
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'chain_schema.json');
  const chains = [];
  const map = {};
  let errors = 0;

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      const chain = JSON.parse(raw);
      if (!chain.chain_id) {
        console.warn(`[chain-loader] skip ${file}: missing chain_id`);
        errors++;
        continue;
      }
      chains.push(chain);
      map[chain.chain_id] = chain;
    } catch (e) {
      console.warn(`[chain-loader] error loading ${file}: ${e.message}`);
      errors++;
    }
  }

  console.log(`[chain-loader] loaded ${chains.length} chains (${errors} errors)`);
  chainCache = chains;
  chainMap = map;
  return { chains, map };
}

/**
 * 获取缓存的链列表
 */
function getChains() {
  if (!chainCache) loadChains();
  return chainCache;
}

/**
 * 按 chain_id 获取单条链
 */
function getChain(chainId) {
  if (!chainCache) loadChains();
  return chainMap[chainId] || null;
}

/**
 * 按领域/分类筛选
 */
function getChainsByDomain(domain) {
  return getChains().filter(c => c.domain === domain || c.category === domain);
}

/**
 * 按标签搜索
 */
function searchChains(query) {
  const q = query.toLowerCase();
  return getChains().filter(c => {
    const tags = c.normalized_tags || [];
    return tags.some(t => t.toLowerCase().includes(q)) ||
           c.name.toLowerCase().includes(q) ||
           c.chain_id.toLowerCase().includes(q);
  });
}

/**
 * 刷新缓存
 */
function reloadChains() {
  chainCache = null;
  chainMap = {};
  return loadChains();
}

module.exports = { loadChains, getChains, getChain, getChainsByDomain, searchChains, reloadChains };
