FROM node:24-alpine AS base
WORKDIR /app

FROM base AS production
COPY out /app/
CMD [ "node", "/app/index.mjs" ]
