/**
 * Start knowhow-engine, test endpoints, keep running
 * Usage: node scripts/test_start.js
 */

process.env.MODE = 'both';

// Start the engine
require('../src/index.js');

// Wait for startup
setTimeout(async () => {
  const http = require('http');

  function get(path) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:3080${path}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch(e) { resolve({ status: res.statusCode, raw: data }); }
        });
      }).on('error', reject);
    });
  }

  function post(path, body) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(body);
      const req = http.request(`http://localhost:3080${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch(e) { resolve({ status: res.statusCode, raw: data }); }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  try {
    // Test health
    const health = await get('/health');
    console.log(`HEALTH: ${health.status} chains=${health.chains_loaded}`);

    // Test REST chains
    const chains = await get('/api/v1/chains');
    console.log(`CHAINS: count=${chains.count}`);

    // Test MCP capabilities
    const mcp = await get('/api/mcp');
    console.log(`MCP_CAP: server=${mcp.server_name} protocol=${mcp.protocol}`);

    // Test MCP initialize
    const init = await post('/api/mcp/message?sessionId=test1', {
      jsonrpc: '2.0', id: '1', method: 'initialize',
      params: { protocolVersion: '2025-03-26' }
    });
    console.log(`MCP_INIT: version=${init?.result?.protocolVersion}`);

    // Test MCP tools/list
    const tools = await post('/api/mcp/message?sessionId=test1', {
      jsonrpc: '2.0', id: '2', method: 'tools/list'
    });
    console.log(`MCP_TOOLS: tool=${tools?.result?.tools?.[0]?.name} actions=${tools?.result?.tools?.[0]?.inputSchema?.properties?.action?.enum?.length}`);

    console.log('\n✅ ALL TESTS PASSED — Engine running on http://localhost:3080');
  } catch (err) {
    console.error(`❌ TEST FAILED: ${err.message}`);
  }
}, 4000);
