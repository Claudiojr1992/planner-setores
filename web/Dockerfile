# A interface já vem compilada em web/dist (rode "npm install && npm run build" após alterar o código).
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-config.sh /docker-entrypoint.d/40-planner-config.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-planner-config.sh /etc/nginx/conf.d/default.conf && chmod +x /docker-entrypoint.d/40-planner-config.sh
COPY dist/ /usr/share/nginx/html/
