'use strict';

// ─────────────────────────────────────────────────────────────
// 건설 법무 뉴스레터 — Anthropic 중계 코어 (프레임워크 비종속)
//
// API 키는 오직 process.env.ANTHROPIC_API_KEY 에서만 읽습니다.
// 이 값은 브라우저(클라이언트)로 절대 전달되지 않습니다.
// Express(server.js) 와 Vercel(api/messages.js) 가 이 함수를 함께 사용합니다.
// ─────────────────────────────────────────────────────────────

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS_CAP = 8000; // 비용 폭주 방지: 클라이언트가 더 큰 값을 보내도 여기서 잘림

/**
 * 브라우저가 보낸 /v1/messages 요청 본문을 받아 Anthropic 으로 중계합니다.
 * @param {object} requestBody - 클라이언트가 보낸 요청 본문 (model, messages, tools, ...)
 * @returns {Promise<{status:number, body:object}>}
 */
async function proxyToAnthropic(requestBody) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // 1) 서버에 키가 없는 경우 (배포 환경변수 누락)
  if (!apiKey) {
    return {
      status: 500,
      body: {
        error: {
          type: 'config_error',
          message: '서버에 ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. 배포 환경(Vercel/Coolify)의 환경변수를 확인하세요.',
        },
      },
    };
  }

  // 2) 최소한의 요청 유효성 검사
  if (!requestBody || typeof requestBody !== 'object' || !Array.isArray(requestBody.messages)) {
    return {
      status: 400,
      body: { error: { type: 'invalid_request', message: '요청 본문에 messages 배열이 필요합니다.' } },
    };
  }

  // 3) 방어적 복사 + max_tokens 상한 적용
  const body = { ...requestBody };
  if (typeof body.max_tokens === 'number') {
    body.max_tokens = Math.min(body.max_tokens, MAX_TOKENS_CAP);
  } else {
    body.max_tokens = 4000;
  }

  // 4) Anthropic 으로 중계 (키는 여기서만 붙음)
  let upstream;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      status: 502,
      body: {
        error: {
          type: 'upstream_error',
          message: 'Anthropic 서버 연결 실패: ' + (err && err.message ? err.message : String(err)),
        },
      },
    };
  }

  // 5) 응답을 그대로 클라이언트로 (상태코드 보존 → "model: not found" 등 에러 메시지가 화면에 전달됨)
  const text = await upstream.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = {
      error: { type: 'parse_error', message: 'Anthropic 응답 파싱 실패', raw: String(text).slice(0, 500) },
    };
  }

  return { status: upstream.status, body: data };
}

module.exports = { proxyToAnthropic, MAX_TOKENS_CAP };
