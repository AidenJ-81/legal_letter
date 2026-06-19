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

// ── /api/collect: 웹검색 멀티턴을 서버에서 완전히 처리 ──
app.post('/api/collect', async (req, res) => {
  const { prompt, type, model, schema, useWebSearch = true } = req.body;

  if (!prompt || !type || !schema) {
    return res.status(400).json({ error: { message: 'prompt, type, schema 필수' } });
  }

  const webSearchTool = { type: 'web_search_20250305', name: 'web_search' };
  const tools = useWebSearch ? [webSearchTool, schema] : [schema];
  let messages = [{ role: 'user', content: prompt }];
  let doSearch = useWebSearch;
  const collectedUrls = [];

  try {
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

      console.log(`[collect] turn=${turn} type=${type} doSearch=${doSearch}`);
      const data = await callAnthropic(body);
      const blocks = data.content || [];

      // ── submit tool 반환 → 완료 ──
      const submitBlock = blocks.find(b => b.type === 'tool_use' && b.name === schema.name);
      if (submitBlock?.input) {
        const obj = submitBlock.input;
        obj.implications   = Array.isArray(obj.implications)   ? obj.implications   : [];
        obj.compareItems   = Array.isArray(obj.compareItems)   ? obj.compareItems   : [];
        obj.summaryPoints  = Array.isArray(obj.summaryPoints)  ? obj.summaryPoints  : [];
        obj.sourceSites    = Array.isArray(obj.sourceSites)
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
        console.log(`[collect] 완료 turn=${turn} title=${obj.title?.substring(0,40)}`);
        return res.json({ ok: true, result: obj });
      }

      // ── 웹검색 tool_use 블록 처리 ──
      const searchBlocks = blocks.filter(b => b.type === 'tool_use' && b.name === 'web_search');

      if (searchBlocks.length) {
        // web_search는 server-side tool: API가 검색을 실행하고 결과를 다음 응답에 포함시킴
        // → assistant 메시지로 추가 후, tool_result는 빈 content로 응답
        messages = [...messages, { role: 'assistant', content: blocks }];
        const toolResults = searchBlocks.map(sb => {
          if (sb.input?.query) {
            console.log(`[웹검색] 쿼리: ${sb.input.query}`);
            collectedUrls.push({ name: sb.input.query, url: '' });
          }
          return {
            type: 'tool_result',
            tool_use_id: sb.id,
            content: '',  // server-side tool: 빈 content로 넘기면 API가 결과를 채움
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

    return res.status(500).json({ error: { message: '최대 턴 초과 — 응답을 받지 못했습니다' } });

  } catch (err) {
    console.error('[collect 오류]', err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

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
