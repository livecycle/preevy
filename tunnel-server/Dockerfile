FROM node:18-alpine as base
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn --mount=type=cache,id=livecycle/preview-proxy/npm-cache,target=/usr/local/share/.cache/yarn/v6
EXPOSE 3000 2222

FROM base as build
COPY . /app
RUN yarn clean && yarn build

FROM node:18-alpine as production
WORKDIR /app
EXPOSE 3000 2222
LABEL org.opencontainers.image.source=https://github.com/livecycle/preevy
LABEL org.opencontainers.image.description="Preevy Tunnel Server"
COPY --from=build /app/package.json ./
COPY --from=build /app/dist /app/dist/
CMD [ "yarn", "start" ]
