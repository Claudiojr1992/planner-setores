FROM node:20-alpine
WORKDIR /app
COPY package.json index.mjs ./
RUN mkdir -p /data && chown node /data
USER node
ENV PASTA_ARQUIVOS=/data PORTA=5000
EXPOSE 5000
CMD ["node", "index.mjs"]
