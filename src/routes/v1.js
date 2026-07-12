/**
 * REST API Routes — 暴露 Know-how Engine 为 HTTP 服务
 * 兼容 chains.com/v1/ 路径
 */

const express = require('express');
const router = express.Router();

const { getChains, getChain, searchChains, reloadChains } = require('../lib/chain-loader');
const { matchChains, getMatchStats } = require('../lib/match-engine');
const { getTickers, searchTickers } = require('../lib/ticker-resolver');
const { getConductionView, predictTimeline } = require('../lib/conduction-engine');

// ========================================
// Chains
// ========================================

/** GET /v1/chains — 列出所有链 */
router.get('/chains', (req, res) => {
  const chains = getChains();
  const category = req.query.category;
  const filtered = category ? chains.filter(c => c.category === category || c.domain === category) : chains;
  res.json({
    count: filtered.length,
    total: chains.length,
    chains: filtered.map(c => ({
      chain_id: c.chain_id,
      name: c.name,
      category: c.category,
      domain: c.domain || c.category,
      confidence_weight: c.confidence_weight,
      version: c.version
    }))
  });
});

/** GET /v1/chains/:chainId — 单条链详情 */
router.get('/chains/:chainId', (req, res) => {
  const chain = getChain(req.params.chainId);
  if (!chain) return res.status(404).json({ error: 'chain not found' });
  res.json(chain);
});

/** GET /v1/chains/:chainId/conduction — 传导路径 */
router.get('/chains/:chainId/conduction', (req, res) => {
  const view = getConductionView(req.params.chainId);
  if (!view) return res.status(404).json({ error: 'chain not found' });
  res.json(view);
});

/** GET /v1/chains/:chainId/tickers — 标的列表 */
router.get('/chains/:chainId/tickers', (req, res) => {
  const tiers = req.query.tiers ? req.query.tiers.split(',') : undefined;
  const tags = req.query.tags ? req.query.tags.split(',') : undefined;
  const result = getTickers(req.params.chainId, { tiers, tags });
  if (!result.tickers.length) return res.status(404).json({ error: 'chain not found or no tickers' });
  res.json(result);
});

/** GET /v1/chains/:chainId/timeline — 时间线预测 */
router.get('/chains/:chainId/timeline', (req, res) => {
  const step = parseInt(req.query.step) || 0;
  const result = predictTimeline(req.params.chainId, step);
  if (!result) return res.status(404).json({ error: 'chain not found or step out of range' });
  res.json(result);
});

// ========================================
// Search & Match
// ========================================

/** GET /v1/search — 搜索链 */
router.get('/search', (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'query param q required' });
  const results = searchChains(query);
  res.json({ count: results.length, results });
});

/** POST /v1/match — 匹配信号到链 */
router.post('/match', (req, res) => {
  const signal = req.body;
  if (!signal || !signal.type) return res.status(400).json({ error: 'signal with type required' });
  const results = matchChains(signal);
  res.json({ count: results.length, results });
});

/** GET /v1/tickers/search — 跨链搜索标的 */
router.get('/tickers/search', (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'query param q required' });
  const results = searchTickers(query);
  res.json({ count: results.length, results });
});

// ========================================
// System
// ========================================

/** GET /v1/stats — 统计 */
router.get('/stats', (req, res) => {
  res.json(getMatchStats());
});

/** POST /v1/reload — 重载链数据 */
router.post('/reload', (req, res) => {
  const result = reloadChains();
  res.json({ loaded: result.chains.length, chains: result.chains.map(c => c.chain_id) });
});

/** GET /health — 健康检查 */
router.get('/health', (req, res) => {
  const chains = getChains();
  res.json({
    status: 'ok',
    version: '1.0.0',
    chains_loaded: chains.length,
    engine: 'knowhow-engine'
  });
});

module.exports = router;
