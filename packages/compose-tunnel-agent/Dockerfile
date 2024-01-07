FROM node:18-alpine as base
WORKDIR /app

FROM base as production
COPY out /app/
CMD [ "node", "--enable-source-maps", "/app/index.mjs" ]
