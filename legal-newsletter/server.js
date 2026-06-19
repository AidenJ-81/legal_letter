'use strict';

// ─────────────────────────────────────────────────────────────
// Express 서버 — Coolify / Docker / 로컬 실행용
//   · public/index.html (앱)        → 정적 서빙
//   · POST /api/messages            → Anthropic 중계 (키는 서버에서 주입)
//   · GET  /healthz                 → 헬스체크
// 같은 출처(origin)에서 HTML 과 API 를 함께 제공하므로 CORS 설정이 필요 없습니다.
// ─────────────────────────────────────────────────────────────

const path = require('path');
const express = require('express');
const { proxyToAnthropic } = require('./lib/anthropic-proxy');

const app = express();
app.use(express.json({ limit: '6mb' })); // 웹검색 누적 메시지가 커질 수 있어 넉넉히

// ── 간단한 IP별 레이트리밋 (장기 실행 서버에서만 동작) ──
const RL_WINDOW_MS = 60 * 1000; // 1분 창
const RL_MAX = 30;              // 분당 최대 호출/ IP
const hits = new Map();
function rateLimit(req, res, next) {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = hits.get(ip) || { count: 0, reset: now + RL_WINDOW_MS };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + RL_WINDOW_MS; }
  rec.count += 1;
  hits.set(ip, rec);
  if (rec.count > RL_MAX) {
    res.status(429).json({ error: { type: 'rate_limited', message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' } });
    return;
  }
  next();
}

// 헬스체크 (로드밸런서 / Coolify)
app.get('/healthz', (_req, res) => res.json({ ok: true, key: !!process.env.ANTHROPIC_API_KEY }));

// Anthropic 중계
app.post('/api/messages', rateLimit, async (req, res) => {
  const { status, body } = await proxyToAnthropic(req.body || {});
  res.status(status).json(body);
});

// 정적 파일 (public/index.html 등)
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[법무레터] 서버 실행 중 → http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠  ANTHROPIC_API_KEY 환경변수가 없습니다. /api/messages 호출이 실패합니다.');
  }
});
