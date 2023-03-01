FROM node:18-alpine as base
RUN apk add openssh openssl
WORKDIR /app
COPY dist package.json yarn.lock ./
RUN yarn --mount=type=cache,id=livecycle/docker-proxy/npm-cache,target=/usr/local/share/.cache/yarn/v6
EXPOSE 3000
CMD [ "node", "./index.js" ]
