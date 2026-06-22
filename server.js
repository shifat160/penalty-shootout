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

// Keep best score per player (keyed by email when present, else name);
// sort by score desc, then earliest time.
function topBoard(list) {
  const best = {};
  for (const r of list) {
    const key = (r.email && String(r.email).toLowerCase()) || r.name;
    if (!key) continue;
    if (!best[key] || r.score > best[key].score) best[key] = r;
  }
  return Object.values(best)
    .sort((a, b) => b.score - a.score || a.ts - b.ts)
    .slice(0, MAX_BOARD)
    .map(r => ({ name: r.name, country: r.country || '', flag: r.flag || '', score: r.score }));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
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
        const { name, email, country, flag, score } = JSON.parse(body || '{}');
        const cleanName = String(name || '').trim().slice(0, 20);
        const cleanEmail = String(email || '').trim().slice(0, 60);
        const cleanCountry = String(country || '').trim().slice(0, 40);
        const cleanFlag = String(flag || '').trim().slice(0, 8);
        const cleanScore = Math.max(0, Math.min(99, parseInt(score, 10) || 0));
        if (!cleanName) return sendJSON(res, 400, { error: 'name required' });
        const list = readScores();
        list.push({
          name: cleanName, email: cleanEmail, country: cleanCountry,
          flag: cleanFlag, score: cleanScore, ts: Date.now(),
        });
        writeScores(list);
        return sendJSON(res, 200, { ok: true, top: topBoard(list) });
      } catch {
        return sendJSON(res, 400, { error: 'bad request' });
      }
    });
    return;
  }

  // --- API: admin reset (protect with token) ---
  if (req.method === 'POST' && url.pathname === '/api/reset') {
    const token = url.searchParams.get('token');
    if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) {
      writeScores([]);
      return sendJSON(res, 200, { ok: true, message: 'leaderboard cleared' });
    }
    return sendJSON(res, 403, { error: 'forbidden' });
  }

  // --- API: export all entries as CSV (lead capture, protect with token) ---
  if (req.method === 'GET' && url.pathname === '/api/export') {
    const token = url.searchParams.get('token');
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      return sendJSON(res, 403, { error: 'forbidden' });
    }
    const list = readScores();
    const header = ['name', 'email', 'country', 'score', 'timestamp'];
    const lines = [header.join(',')];
    for (const r of list) {
      lines.push([
        csvCell(r.name), csvCell(r.email), csvCell(r.country),
        csvCell(r.score), csvCell(new Date(r.ts || 0).toISOString()),
      ].join(','));
    }
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="penalty-leads.csv"',
    });
    return res.end(lines.join('\n'));
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
