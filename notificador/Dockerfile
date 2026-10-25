FROM node:20-alpine
WORKDIR /app
COPY package.json index.mjs smtp.mjs ./
USER node
CMD ["node", "index.mjs"]
