# 건설 법무 뉴스레터 (팀 공용 API 버전)

팀원이 각자 API 키 없이 URL만 열면 바로 쓸 수 있는 버전입니다.  
회사 공용 Anthropic 키는 **Coolify 환경변수**에만 저장되고, 브라우저(HTML/JS)에는 절대 노출되지 않습니다.

---

## 폴더 구조

```
/ (루트)
├── Dockerfile          ← Coolify 배포 진입점
├── package.json
├── server.js           ← Express 프록시 서버 (API Key 보유)
├── .env.example        ← 환경변수 예시 (실제 .env는 Git에 올리지 마세요)
├── .gitignore
└── public/
    └── index.html      ← 앱 본체 (API Key 입력 화면 제거됨)
```

---

## Coolify 배포 방법

### 1. Coolify에서 새 서비스 생성
- **Source**: GitHub 저장소 연결 (`AidenJ-81/legal_letter`)
- **Build Pack**: `Dockerfile` 선택
- **Branch**: `main`
- **Root Directory**: `/` (루트)

### 2. 환경변수 등록
Coolify > 해당 서비스 > **Environment Variables** 탭:

| 변수명 | 값 |
|--------|-----|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` |
| `PORT` | `3000` (자동 감지, 생략 가능) |

### 3. 배포
- **Deploy** 버튼 클릭 → 자동 빌드 & 실행

---

## 무엇이 바뀌었나

| 이전 (v1_0) | 지금 |
|---|---|
| 사용자가 직접 키 입력 → localStorage 저장 | 키 입력 화면 없음 |
| 브라우저가 `api.anthropic.com` 직접 호출 | 브라우저는 우리 서버 `/api/messages` 만 호출 |
| 키가 브라우저에 노출됨 | 키는 **서버 환경변수**에만 존재 (공용) |

기능(웹검색·요약·PPT·이메일 발송)은 이전과 동일합니다.

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
# → http://localhost:3000 접속
```
