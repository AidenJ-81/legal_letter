const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

app.use(express.json({ limit: '4mb' }));
app.use(express.static(__dirname));

// ── 공통: Anthropic API 단일 호출 ──
async function callAnthropic(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error));
  return data;
}

// ── 단건 수집: 웹검색 멀티턴을 서버에서 완전히 처리 ──
async function collectOne(prompt, type, model, schema, useWebSearch = true) {
  const webSearchTool = { type: 'web_search_20250305', name: 'web_search' };
  const tools = useWebSearch ? [webSearchTool, schema] : [schema];
  let messages = [{ role: 'user', content: prompt }];
  let doSearch = useWebSearch;
  const collectedUrls = [];

  // 최대 8턴 (웹검색 반복 포함)
  for (let turn = 0; turn < 8; turn++) {
    const body = {
      model: model || 'claude-sonnet-4-5',
      max_tokens: 4000,
      tools,
      tool_choice: (doSearch && turn === 0)
        ? { type: 'auto' }
        : { type: 'tool', name: schema.name },
      messages,
    };

    console.log(`[collectOne] turn=${turn} type=${type} doSearch=${doSearch}`);
    const data = await callAnthropic(body);
    const blocks = data.content || [];

    // ── submit tool 반환 → 완료 ──
    const submitBlock = blocks.find(b => b.type === 'tool_use' && b.name === schema.name);
    if (submitBlock?.input) {
      const obj = submitBlock.input;
      obj.implications  = Array.isArray(obj.implications)  ? obj.implications  : [];
      obj.compareItems  = Array.isArray(obj.compareItems)  ? obj.compareItems  : [];
      obj.summaryPoints = Array.isArray(obj.summaryPoints) ? obj.summaryPoints : [];
      obj.sourceSites   = Array.isArray(obj.sourceSites)
        ? obj.sourceSites.map(s => typeof s === 'string' ? { name: s, url: '' } : s).filter(s => s?.name)
        : [];
      // collectedUrls로 빈 url 보충
      if (collectedUrls.length) {
        obj.sourceSites = obj.sourceSites.map(site => {
          if (site.url) return site;
          const match = collectedUrls.find(u =>
            u.url.includes(site.name.replace(/\s/g, '').toLowerCase()) ||
            site.name.includes(u.name)
          );
          return match ? { ...site, url: match.url } : site;
        });
        if (!obj.sourceSites.length) obj.sourceSites = collectedUrls.slice(0, 3);
      }
      console.log(`[collectOne] 완료 turn=${turn} title=${obj.title?.substring(0,40)}`);
      return obj;
    }

    // ── 웹검색 tool_use 블록 처리 ──
    const searchBlocks = blocks.filter(b => b.type === 'tool_use' && b.name === 'web_search');
    if (searchBlocks.length) {
      messages = [...messages, { role: 'assistant', content: blocks }];
      const toolResults = searchBlocks.map(sb => {
        if (sb.input?.query) {
          console.log(`[웹검색] 쿼리: ${sb.input.query}`);
          collectedUrls.push({ name: sb.input.query, url: '' });
        }
        return {
          type: 'tool_result',
          tool_use_id: sb.id,
          content: '',
        };
      });
      messages = [...messages, { role: 'user', content: toolResults }];
      doSearch = false;
      continue;
    }

    // ── 검색도 submit도 없는 응답 → submit 강제 ──
    messages = [...messages, { role: 'assistant', content: blocks }];
    doSearch = false;
  }

  throw new Error('최대 턴 초과 — 응답을 받지 못했습니다');
}

// ── /api/collect: 키워드 배열을 받아 카테고리당 3건 수집 ──
app.post('/api/collect', async (req, res) => {
  const { prompts, type, model, schema, useWebSearch = true } = req.body;

  // 하위 호환: 단일 prompt도 허용
  const promptList = Array.isArray(prompts) ? prompts : [req.body.prompt].filter(Boolean);

  if (!promptList.length || !type || !schema) {
    return res.status(400).json({ error: { message: 'prompts(또는 prompt), type, schema 필수' } });
  }

  const TARGET = 3; // 카테고리당 목표 수집 건수

  try {
    const results = [];

    // 키워드당 최소 1건씩, 부족하면 첫 번째 키워드로 채움
    // 예) 키워드 1개 → 3번 호출 / 키워드 2개 → 각 1~2번 / 키워드 3개 → 각 1번
    const slots = distributeSlots(promptList.length, TARGET);

    for (let i = 0; i < promptList.length; i++) {
      const count = slots[i];
      for (let j = 0; j < count; j++) {
        // 두 번째 호출부터는 "이미 다룬 내용과 겹치지 말 것" 지시 추가
        const prompt = j === 0
          ? promptList[i]
          : promptList[i] + `\n\n※ 이미 수집한 항목과 다른 새로운 ${j + 1}번째 사례를 찾아 제출하세요.`;

        console.log(`[collect] type=${type} keyword=${i+1}/${promptList.length} slot=${j+1}/${count}`);
        try {
          const obj = await collectOne(prompt, type, model, schema, useWebSearch);
          results.push(obj);
        } catch (e) {
          console.error(`[collect] keyword=${i+1} slot=${j+1} 실패:`, e.message);
        }

        if (results.length >= TARGET) break;
      }
      if (results.length >= TARGET) break;
    }

    if (!results.length) {
      return res.status(500).json({ error: { message: '수집된 결과가 없습니다' } });
    }

    return res.json({ ok: true, results });

  } catch (err) {
    console.error('[collect 오류]', err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

// 키워드 수(n)에 따라 TARGET 건을 균등 분배하는 슬롯 배열 반환
// 예) n=1, TARGET=3 → [3]
//     n=2, TARGET=3 → [2, 1]
//     n=3, TARGET=3 → [1, 1, 1]
//     n=4, TARGET=3 → [1, 1, 1, 0] (3건 달성 후 나머지 0)
function distributeSlots(n, target) {
  const slots = new Array(n).fill(0);
  for (let i = 0; i < target; i++) {
    slots[i % n]++;
  }
  return slots;
}

// ── /api/messages: 단순 프록시 (RSS 요약 등 웹검색 없는 호출용) ──
app.post('/api/messages', async (req, res) => {
  try {
    const data = await callAnthropic(req.body);
    res.json(data);
  } catch (err) {
    console.error('[messages 오류]', err.message);
    res.status(500).json({ error: { type: 'server_error', message: err.message } });
  }
});

// SPA 폴백
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ 건설 법무 뉴스레터 서버 실행 중 (포트 ${PORT})`);
  console.log(`   API Key: ${ANTHROPIC_API_KEY.substring(0, 14)}...${ANTHROPIC_API_KEY.slice(-4)}`);
});
