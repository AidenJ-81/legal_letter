'use strict';

const path = require('path');
const express = require('express');

// (API 프록시 부분 필요 없으면 아래 줄은 제거 가능)
let proxyToAnthropic;
try {
  ({ proxyToAnthropic } = require('./lib/anthropic-proxy'));
} catch (e) {
  proxyToAnthropic = null;
}

const app = express();
app.use(express.json({ limit: '6mb' }));

// ✅ 레이트 리밋
const RL_WINDOW_MS = 60 * 1000;
const RL_MAX = 30;
const hits = new Map();

function rateLimit(req, res, next) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';

  const now = Date.now();
  const rec = hits.get(ip) || { count: 0, reset: now + RL_WINDOW_MS };

  if (now > rec.reset) {
    rec.count = 0;
    rec.reset = now + RL_WINDOW_MS;
  }

  rec.count += 1;
  hits.set(ip, rec);

  if (rec.count > RL_MAX) {
    return res.status(429).json({
      error: {
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    });
  }

  next();
}

// ✅ 헬스 체크 (중요)
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

// ✅ 기본 루트 (중요 ⭐)
app.get('/', (req, res) => {
  res.send('Server OK');
});

// ✅ API (나중 사용)
if (proxyToAnthropic) {
  app.post('/api/messages', rateLimit, async (req, res) => {
    const { status, body } = await proxyToAnthropic(req.body || {});
    res.status(status).json(body);
  });
}

// ✅ 정적 파일 (index.html)
app.use(express.static(path.join(__dirname, 'public')));

// ✅ 포트 & 외부접속 (핵심 ⭐⭐⭐)
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 서버 실행: http://0.0.0.0:${PORT}`);
});
// force rebuild
