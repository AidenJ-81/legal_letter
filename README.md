# 건설 법무 뉴스레터 (회사 공용 API 버전)

팀원이 **각자 API 키 없이** URL만 열면 바로 쓸 수 있는 버전입니다.
회사 공용 Anthropic 키는 **서버 환경변수에만** 저장되고, 브라우저(HTML/JS)에는 절대 노출되지 않습니다.

---

## 무엇이 바뀌었나

| 이전 (v1_0) | 지금 |
|---|---|
| 사용자가 직접 키 입력 → localStorage 저장 | 키 입력 화면 **없음** |
| 브라우저가 `api.anthropic.com` 직접 호출 | 브라우저는 **우리 서버 `/api/messages`** 만 호출 |
| 키가 브라우저에 노출됨 (각자 키 필요) | 키는 **서버 환경변수**에만 존재 (공용) |

기능(웹검색·요약·PPT·메일 발송)은 이전과 동일합니다.

---

## 폴더 구조

```
legal-newsletter/
├─ public/index.html     ← 앱 (키 입력 화면 제거됨)
├─ lib/anthropic-proxy.js← 중계 코어 (Express·Vercel 공용, 키 주입)
├─ server.js             ← Express 서버 (Coolify·Docker·로컬)
├─ api/messages.js       ← Vercel 서버리스 함수
├─ Dockerfile            ← Coolify 배포용
├─ vercel.json           ← Vercel 설정
├─ package.json
└─ .env.example          ← 환경변수 예시
```

> 핵심 환경변수는 단 하나: **`ANTHROPIC_API_KEY`**

---

## 로컬에서 먼저 확인하기

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start
# http://localhost:3000 접속
```

(`.env.example` 을 `.env` 로 복사해 키를 넣어도 됩니다. `.env` 는 깃에 안 올라갑니다.)

---

## 배포 방법 A — Coolify (권장: 웹검색이 길어도 타임아웃 없음)

1. 이 폴더를 GitHub 저장소에 push (`.env` 는 `.gitignore` 로 제외됨)
2. Coolify → New Resource → **Application** → 해당 저장소 선택
3. Build Pack: **Dockerfile** 선택 (이 폴더의 Dockerfile 자동 인식)
4. **Environment Variables** 에 추가:
   - `ANTHROPIC_API_KEY` = `sk-ant-...` (회사 키)
5. Port: **3000** (Dockerfile 의 EXPOSE 와 동일)
6. Deploy

Coolify 는 컨테이너가 계속 떠 있어 실행시간 제한이 없으므로, 키워드를 많이 넣어 웹검색이 오래 걸려도 안전합니다.

---

## 배포 방법 B — Vercel (가장 빠른 무설정 배포)

1. 이 폴더를 GitHub 에 push
2. Vercel → **Add New → Project** → 저장소 import
3. Framework Preset: **Other** (그대로 두면 됨)
4. **Environment Variables** 에 추가:
   - `ANTHROPIC_API_KEY` = `sk-ant-...`
5. Deploy

Vercel 이 `public/` 을 정적으로, `api/messages.js` 를 함수로 자동 배포합니다.

> ⚠ **타임아웃 주의:** 무료(Hobby) 플랜은 함수 실행시간 제한이 있습니다. 웹검색이 길어 타임아웃이 나면 `vercel.json` 의 `maxDuration` 을 늘리거나(플랜 상향 필요할 수 있음), **Coolify** 로 배포하세요.

---

## 꼭 같이 챙길 것 (키 게이트가 사라졌으므로)

키 입력 단계가 없어진 만큼, URL 을 아는 사람은 누구나 회사 API 예산을 쓸 수 있습니다. 최소한 아래는 권장합니다.

1. **접근 통제**
   - 사내망/VPN 전용으로 노출 (가장 깔끔)
   - 또는 그룹웨어/SSO 뒤에 배치
2. **비용 상한**
   - Anthropic 콘솔에서 이 앱 전용 **Workspace** 를 만들고 **월 예산(Spend limit)** 설정
   - 서버(server.js)에는 IP별 분당 30회 레이트리밋이 기본 적용되어 있음 (Coolify 등 장기 실행 서버에서 동작)
3. **키 보관**
   - 키는 **환경변수에만**. 코드·깃에 절대 넣지 마세요 (`.gitignore`, `.dockerignore` 로 `.env` 제외 처리됨)

> 추가로 "공용 비밀번호" 게이트가 필요하면 `server.js` 의 `/api/messages` 앞단에 헤더 검사 미들웨어를 한 줄 추가하면 됩니다. 필요하면 말씀 주세요.

---

## 모델 변경

화면 좌측 **🤖 모델** 드롭다운에서 선택하거나 "직접입력" 으로 모델 ID 를 넣을 수 있습니다.
`"model: not found"` 에러가 나면 최신 모델 ID 로 바꿔주세요. (모델 ID 는 서버를 거쳐 그대로 Anthropic 에 전달됩니다.)
