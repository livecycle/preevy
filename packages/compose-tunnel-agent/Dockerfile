FROM node:18-alpine as base
WORKDIR /app

FROM base as production
COPY package.json /app/
COPY out /app/out/
CMD [ "yarn", "-s", "start" ]
