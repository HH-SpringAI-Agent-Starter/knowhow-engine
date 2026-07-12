/**
 * Know-how Engine — 多域决策流引擎入口
 * 
 * 启动: node src/index.js
 * 默认端口: 3080
 * 路径前缀: /api/v1/...
 * 健康检查: /health
 * 
 * MCP 模式: 也暴露 MCP Tool (chain_query) 协议
 * 当前模式由 MODE 环境变量控制: 'http' (默认) | 'mcp' | 'both'
 */

const express = require('express');
const path = require('path');
const { loadChains } = require('./lib/chain-loader');

const app = express();
const PORT = process.env.PORT || 3080;
const MODE = process.env.MODE || 'http';

// Middleware
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Bootstrap: 加载链数据
const chainsDir = path.join(process.cwd(), 'knowledge', 'chains');
console.log(`[knowhow-engine] loading chains from: ${chainsDir}`);

// 如果模块内没有，尝试从 workspace 根目录加载
let loaded;
try {
  loaded = loadChains(chainsDir);
} catch (e) {
  console.warn(`[knowhow-engine] fallback to default path: ${e.message}`);
  loaded = loadChains();
}

// ========================================
// HTTP REST 模式
// ========================================
if (MODE === 'http' || MODE === 'both') {
  const v1Routes = require('./routes/v1');
  
  // 挂载 REST API
  app.use('/api/v1', v1Routes);
  app.use('/v1', v1Routes);  // 兼容无前缀
  
  // 独立健康检查
  app.get('/health', (req, res) => {
    const count = require('./lib/chain-loader').getChains().length;
    res.json({ status: 'ok', version: '1.0.0', chains_loaded: count, engine: 'knowhow-engine' });
  });

  console.log(`[knowhow-engine] REST API ready at /api/v1/`);
}

// ========================================
// MCP Tool 模式 (stdio)
// ========================================
if (MODE === 'mcp' || MODE === 'both') {
  const { getToolDefinition, executeAction } = require('./lib/mcp-adapter');

  // MCP Tool 端点 (HTTP 方式, 兼容 sse)
  app.post('/api/mcp/tool/chain_query', (req, res) => {
    const { action, params } = req.body;
    if (!action) return res.status(400).json({ error: 'action required' });
    
    const result = executeAction(action, params);
    res.json(result);
  });

  // STDIO MCP 模式 (通过 --mcp-stdio 标志启动)
  if (process.argv.includes('--mcp-stdio')) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
      try {
        const { id, action, params } = JSON.parse(line);
        const result = executeAction(action, params);
        process.stdout.write(JSON.stringify({ id, result }) + '\n');
      } catch (e) {
        process.stderr.write(`error: ${e.message}\n`);
      }
    });
    console.log('[knowhow-engine] MCP stdio mode ready');
  }
}

// ========================================
// Web UI (静态)
// ========================================
const webDir = path.join(process.cwd(), 'public');
try {
  if (require('fs').existsSync(webDir)) {
    app.use(express.static(webDir));
    console.log(`[knowhow-engine] serving static from: ${webDir}`);
  }
} catch (e) { /* no public dir */ }

// ========================================
// 启动
// ========================================
app.listen(PORT, () => {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Know-how Engine v1.0.0`);
  console.log(`  Mode: ${MODE}`);
  console.log(`  REST: http://localhost:${PORT}/api/v1/`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Chains loaded: ${loaded.chains.length}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
