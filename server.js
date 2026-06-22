const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'scores.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BOARD = 15; // how many rows to return

// ---- ensure data dir + file ----
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

function readScores() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}
function writeScores(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

// Keep best score per name; sort by score desc, then earliest time.
function topBoard(list) {
  const best = {};
  for (const r of list) {
    if (!best[r.name] || r.score > best[r.name].score) best[r.name] = r;
  }
  return Object.values(best)
    .sort((a, b) => b.score - a.score || a.ts - b.ts)
    .slice(0, MAX_BOARD)
    .map(r => ({ name: r.name, score: r.score }));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // --- API: get leaderboard ---
  if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
    return sendJSON(res, 200, { top: topBoard(readScores()) });
  }

  // --- API: submit score ---
  if (req.method === 'POST' && url.pathname === '/api/score') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
    req.on('end', () => {
      try {
        const { name, score } = JSON.parse(body || '{}');
        const cleanName = String(name || '').trim().slice(0, 20);
        const cleanScore = Math.max(0, Math.min(99, parseInt(score, 10) || 0));
        if (!cleanName) return sendJSON(res, 400, { error: 'name required' });
        const list = readScores();
        list.push({ name: cleanName, score: cleanScore, ts: Date.now() });
        writeScores(list);
        return sendJSON(res, 200, { ok: true, top: topBoard(list) });
      } catch {
        return sendJSON(res, 400, { error: 'bad request' });
      }
    });
    return;
  }

  // --- API: admin reset (optional, protect with token) ---
  if (req.method === 'POST' && url.pathname === '/api/reset') {
    const token = url.searchParams.get('token');
    if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) {
      writeScores([]);
      return sendJSON(res, 200, { ok: true, message: 'leaderboard cleared' });
    }
    return sendJSON(res, 403, { error: 'forbidden' });
  }

  // --- static files ---
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(PUBLIC_DIR, filePath);
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`xCloud Penalty Shootout running on http://0.0.0.0:${PORT}`);
  console.log(`Leaderboard data: ${DATA_FILE}`);
});
