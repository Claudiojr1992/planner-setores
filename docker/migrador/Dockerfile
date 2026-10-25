FROM postgres:17-alpine
COPY docker/migrador/aplicar.sh /aplicar.sh
COPY supabase/migrations/ /migrations/
RUN sed -i 's/\r$//' /aplicar.sh /migrations/*.sql && chmod +x /aplicar.sh
ENTRYPOINT ["/bin/sh", "/aplicar.sh"]
