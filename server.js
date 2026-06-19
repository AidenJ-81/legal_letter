const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
  console.error('   Coolify > 환경변수에서 ANTHROPIC_API_KEY를 등록하세요.');
  process.exit(1);
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

// ── Anthropic API 프록시 ──
app.post('/api/messages', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    console.error('[프록시 오류]', err);
    res.status(500).json({ error: { type: 'server_error', message: '서버 내부 오류: ' + err.message } });
  }
});

// SPA 폴백 — 모든 GET 요청은 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ 건설 법무 뉴스레터 서버 실행 중 (포트 ${PORT})`);
  console.log(`   API Key: ${ANTHROPIC_API_KEY.substring(0, 14)}...${ANTHROPIC_API_KEY.slice(-4)}`);
});
