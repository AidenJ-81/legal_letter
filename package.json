# 건설 법무 뉴스레터 — Coolify / Docker 배포용
FROM node:20-slim

WORKDIR /app

# 의존성 먼저 설치 (레이어 캐시 활용)
COPY package*.json ./
RUN npm install --omit=dev

# 앱 소스 (서버리스 전용 파일은 제외)
COPY server.js ./
COPY lib ./lib
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
