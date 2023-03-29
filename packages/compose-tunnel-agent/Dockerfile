FROM node:18-alpine as base
WORKDIR /app

FROM base as build
COPY package.json yarn.lock /app/
RUN yarn --mount=type=cache,id=livecycle/compose-tunnel-agent/npm-cache,target=/usr/local/share/.cache/yarn/v6
COPY . /app
EXPOSE 3000

FROM build as test
CMD ["yarn", "test"]

FROM build as development
CMD [ "yarn", "dev" ]

FROM base as production
COPY package.json /app/
COPY dist /app/dist/
CMD [ "yarn", "-s", "start" ]
