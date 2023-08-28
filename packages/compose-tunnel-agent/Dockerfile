FROM node:18-alpine as base
WORKDIR /app

FROM base as production
COPY out /app/
CMD [ "node", "/app/index.js" ]
