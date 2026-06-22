FROM node:20-alpine

WORKDIR /app

# No external dependencies — pure Node stdlib. Copy app in.
COPY server.js ./
COPY public ./public

# Persistent leaderboard lives here (mount a volume to keep it across restarts)
ENV DATA_DIR=/app/data
ENV PORT=8080
RUN mkdir -p /app/data

EXPOSE 8080

# Optional: set an admin token to enable POST /api/reset?token=...
# ENV ADMIN_TOKEN=changeme

CMD ["node", "server.js"]
