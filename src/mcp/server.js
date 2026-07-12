/**
 * MCP Server (SSE) for Know-how Engine
 * 
 * Implements MCP SSE transport protocol:
 *   GET /mcp/sse     → SSE connection stream
 *   POST /mcp/message → JSON-RPC message endpoint
 * 
 * Supports one tool: chain_query (10 actions)
 */

const { getToolDefinition, executeAction } = require('../lib/mcp-adapter');

class McpServer {
  constructor() {
    this.sessions = new Map();  // sessionId → { emitter, info }
    this.serverInfo = {
      name: 'knowhow-engine',
      version: '1.0.0',
      description: 'Know-how Library Engine — 多域决策流引擎'
    };
  }

  /**
   * JSON-RPC 2.0 error helper
   */
  jsonRpcError(id, code, message, data = null) {
    const err = { jsonrpc: '2.0', error: { code, message } };
    if (data) err.error.data = data;
    if (id !== undefined) err.id = id;
    return err;
  }

  jsonRpcResult(id, result) {
    return { jsonrpc: '2.0', id, result };
  }

  jsonRpcNotification(method, params) {
    return { jsonrpc: '2.0', method, params };
  }

  /**
   * Handle SSE connect
   */
  handleSseConnect(req, res) {
    const sessionId = req.query.sessionId || 
      Math.random().toString(36).substring(2, 15) + 
      Math.random().toString(36).substring(2, 15);

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    });

    // Send endpoint event (where to POST JSON-RPC messages)
    const endpointUrl = `/mcp/message?sessionId=${sessionId}`;
    res.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);

    // Store session
    this.sessions.set(sessionId, {
      emitter: res,
      info: {},
      connectedAt: Date.now()
    });

    console.log(`[MCP] Session ${sessionId} connected`);

    // Handle client disconnect
    req.on('close', () => {
      console.log(`[MCP] Session ${sessionId} disconnected`);
      this.sessions.delete(sessionId);
    });

    // Keep-alive
    const keepAlive = setInterval(() => {
      try { res.write(':\n\n'); } catch (e) { clearInterval(keepAlive); }
    }, 30000);

    req.on('close', () => clearInterval(keepAlive));
  }

  /**
   * Handle JSON-RPC message from client
   */
  async handleMessage(req, res) {
    const sessionId = req.query.sessionId || '';
    const session = this.sessions.get(sessionId);

    if (!session) {
      return res.status(404).json(this.jsonRpcError(null, -32000, 'Session not found'));
    }

    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
      return res.status(400).json(this.jsonRpcError(null, -32700, 'Parse error'));
    }

    const { jsonrpc, id, method, params } = body;

    if (jsonrpc !== '2.0') {
      return res.status(400).json(this.jsonRpcError(id, -32600, 'Invalid Request: must be JSON-RPC 2.0'));
    }

    // Process method
    try {
      let result;
      switch (method) {
        case 'initialize': {
          const protocolVersion = params?.protocolVersion || '2025-03-26';
          const capabilities = { tools: {} };
          result = {
            protocolVersion,
            capabilities,
            serverInfo: this.serverInfo
          };
          session.info = { protocolVersion, capabilities: params?.capabilities || {} };
          break;
        }

        case 'tools/list': {
          const toolDef = getToolDefinition();
          result = {
            tools: [{
              name: toolDef.name,
              description: toolDef.description,
              inputSchema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: {
                    type: 'string',
                    description: 'Action to execute',
                    enum: toolDef.actions.map(a => a.name)
                  },
                  chain_id: { type: 'string', description: 'Chain ID (for get/tickers/conduction/timeline)' },
                  query: { type: 'string', description: 'Search query (for search/tsymbol)' },
                  signal: {
                    type: 'object',
                    description: 'Signal object (for match): { type: "price_up"|"supply_shock"|"policy"|"demand_boom", pct?: number, description?: string }'
                  },
                  category: { type: 'string', description: 'Category filter (for list)' },
                  step: { type: 'number', description: 'Target step (for timeline)' }
                }
              }
            }]
          };
          break;
        }

        case 'tools/call': {
          const toolResult = executeAction(params?.arguments?.action, params?.arguments || {});
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify(toolResult, null, 2)
            }],
            isError: !!toolResult.error
          };
          break;
        }

        case 'notifications/initialized': {
          // Acknowledge, no response needed
          return res.json({ jsonrpc: '2.0', id, result: {} });
        }

        default:
          return res.status(400).json(this.jsonRpcError(id, -32601, `Method not found: ${method}`));
      }

      // Send response
      return res.json(this.jsonRpcResult(id, result));

    } catch (err) {
      console.error(`[MCP] Error handling ${method}:`, err.message);
      return res.status(500).json(this.jsonRpcError(id, -32603, `Internal error: ${err.message}`));
    }
  }

  /**
   * Send notification to a session via SSE
   */
  sendNotification(sessionId, method, params) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    try {
      const msg = this.jsonRpcNotification(method, params);
      session.emitter.write(`event: message\ndata: ${JSON.stringify(msg)}\n\n`);
      return true;
    } catch (e) {
      this.sessions.delete(sessionId);
      return false;
    }
  }
}

module.exports = McpServer;
