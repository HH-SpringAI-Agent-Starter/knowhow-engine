FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
ENV MODE=both
EXPOSE 3080
CMD ["node", "src/index.js"]
