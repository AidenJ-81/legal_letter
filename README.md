# 건설 법무 뉴스레터

팀원이 URL만 열면 바로 쓸 수 있는 건설 법무 AI 뉴스레터 생성기입니다.  
Anthropic API 키는 **Coolify 환경변수**에만 저장되며, 브라우저에는 절대 노출되지 않습니다.

---

## 주요 기능

- **AI 자동 수집**: 판례 · 법령개정 · 기사 키워드 선택 → Claude 웹검색으로 자동 요약
- **카테고리당 3건 고정**: 키워드가 1~3개이든 항상 판례 3건 · 법령 3건 · 기사 3건 수집
- **PPT 출력**: 수집된 항목을 브라우저에서 바로 PowerPoint로 다운로드
- **수신자 관리**: 이메일 수신자 저장 및 뉴스레터 발송 준비

---

## 파일 구조

```
/
├── Dockerfile        ← Coolify 빌드 진입점
├── package.json
├── server.js         ← Express 프록시 서버 (API Key 보유)
├── index.html        ← 앱 본체
├── .env.example      ← 환경변수 예시
└── .gitignore
```

---

## Coolify 배포 방법

### 1. GitHub 저장소 연결
Coolify → New Resource → **Public/Private Git Repository**  
- **Repository URL**: `https://github.com/{계정}/{저장소명}`
- **Branch**: `main`
- **Build Pack**: `Dockerfile`
- **Root Directory**: `/` (기본값 유지)

### 2. 환경변수 등록
Coolify → 해당 서비스 → **Environment Variables** 탭:

| 변수명 | 값 |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` |
| `PORT` | `3000` (생략 가능, 자동 감지) |

> ⚠️ `.env` 파일은 Git에 올리지 마세요. 키는 반드시 Coolify 환경변수에만 등록하세요.

### 3. 배포
**Deploy** 버튼 클릭 → 자동 빌드 & 실행  
이후 코드를 `git push`하면 Coolify가 자동으로 재배포합니다.

---

## 로컬 테스트

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에 실제 ANTHROPIC_API_KEY 입력

# 서버 실행
npm start
# → http://localhost:3000
```

---

## 보안 구조

| 항목 | 내용 |
|---|---|
| API Key 위치 | 서버 환경변수 전용 (브라우저 미노출) |
| 브라우저 호출 | `/api/collect`, `/api/messages` (자체 서버) |
| 외부 API 호출 | 서버 → `api.anthropic.com` (직접) |
