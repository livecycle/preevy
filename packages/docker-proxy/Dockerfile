FROM node:18-alpine as base
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn --mount=type=cache,id=livecycle/docker-proxy/npm-cache,target=/usr/local/share/.cache/yarn/v6
COPY . /app
EXPOSE 3000

FROM base as test
CMD ["yarn", "test"]

FROM base as development
CMD [ "yarn", "dev" ]

FROM base as bundle
CMD [ "yarn", "-s", "start" ]

FROM base as production
CMD [ "yarn", "-s", "start" ]
