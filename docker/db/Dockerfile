FROM postgres:17-alpine
COPY docker/db/01-papeis.sh /docker-entrypoint-initdb.d/01-papeis.sh
RUN sed -i 's/\r$//' /docker-entrypoint-initdb.d/01-papeis.sh && chmod +x /docker-entrypoint-initdb.d/01-papeis.sh
