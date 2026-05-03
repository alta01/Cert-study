FROM nginx:alpine

WORKDIR /usr/share/nginx/html

# Copy app files
COPY . .

# Remove files that have no business being served
RUN rm -rf .git .env* scripts/ node_modules/ \
    data/exams/aws-saa-c03/domains \
    data/schemas

# Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint injects OLLAMA_BASE at runtime — no rebuild needed
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Default: local Ollama on the host (overridden in docker-compose / K8s)
ENV OLLAMA_BASE=http://localhost:11434

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
