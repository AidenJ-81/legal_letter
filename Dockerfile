'use strict';

// ─────────────────────────────────────────────────────────────
// Vercel 서버리스 함수 — /api/messages 로 매핑됨
// (public/index.html 은 Vercel 이 자동으로 루트(/)에 정적 서빙)
// Vercel 은 application/json 본문을 req.body 로 자동 파싱합니다.
// ─────────────────────────────────────────────────────────────

const { proxyToAnthropic } = require('../lib/anthropic-proxy');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { type: 'method_not_allowed', message: 'POST 요청만 허용됩니다.' } });
    return;
  }
  const { status, body } = await proxyToAnthropic(req.body || {});
  res.status(status).json(body);
};
