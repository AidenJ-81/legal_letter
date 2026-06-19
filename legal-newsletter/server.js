'use strict';

const express = require('express');
const app = express();

app.use(express.json());

// ✅ 기본 접속 확인 (이게 핵심)
app.get('/', (req, res) => {
  res.send('Server OK');
});

// ✅ 헬스 체크
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

// ✅ 서버 실행 (외부 접속 허용 필수)
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
