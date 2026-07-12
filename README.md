# Know-how Engine

**多域决策流引擎 / Domain-agnostic Decision Flow Engine**

> Data → Knowledge → Know-how → Workflow → Agent → SaaS

## 架构

```
src/
├── index.js              # Express 入口，HTTP REST + MCP Tool
├── routes/
│   └── v1.js             # REST API v1: /api/v1/chains, /api/v1/match, etc.
└── lib/
    ├── chain-loader.js   # 加载/缓存/搜索 Chain JSON
    ├── match-engine.js   # 信号匹配引擎（涨价/供给/政策/需求→链）
    ├── ticker-resolver.js# 标的名片解析（T1-T4 四层）
    ├── conduction-engine.js# 传导路径推理 + 时间线预测
    └── mcp-adapter.js    # MCP Tool 协议适配
knowledge/chains/          # Chain JSON 数据（当前 17 条）
```

## 快速启动

```bash
pnpm install
pnpm start   # → http://localhost:3080
```

## REST API

### 链列表
```
GET /api/v1/chains
GET /api/v1/chains?category=AI/半导体
```

### 单条链
```
GET /api/v1/chains/:chainId
GET /api/v1/chains/:chainId/conduction
GET /api/v1/chains/:chainId/tickers
```

### 信号匹配
```
POST /api/v1/match
{ "type": "price_up", "pct": 50 }
{ "type": "supply_shock", "keyword": "钨" }
```

### 搜索
```
GET /api/v1/search?q=超节点
GET /api/v1/tickers/search?q=兴发
```

### 统计
```
GET /api/v1/stats
```

## MCP Tool

| Action | Params | 说明 |
|--------|--------|------|
| list | ?category | 列出所有链 |
| get | chain_id | 获取单条链 |
| search | query | 搜索 |
| match | signal | 匹配信号到链 |
| tickers | chain_id | 获取标的 |
| tsymbol | query | 跨链搜索标的 |
| conduction | chain_id | 传导路径 |
| timeline | chain_id, step | 时间线预测 |
| stats | — | 统计 |

## 多域扩展

当前以金融链为主（17条），架构支持添加任意域：
- `knowledge/chains/agriculture/` — 农业专家决策流
- `knowledge/chains/enterprise/` — 企业流程决策流
- `knowledge/chains/sales/` — 农资销售决策流

每个域有自己的 JSON，引擎不变。

## 部署

```bash
# Cloud Run
docker build -t knowhow-engine .
gcloud run deploy knowhow-engine --image knowhow-engine --port 3080
```
