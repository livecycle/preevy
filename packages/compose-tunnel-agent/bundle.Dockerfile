FROM node:18-alpine as base
WORKDIR /app
# yarn.lock is not packed in npm (no matter the files policy)
# https://docs.npmjs.com/cli/v9/configuring-npm/package-json#files
# tried: npm pack --dry-run
# npm shrinkwrap can work as alternative, but it doesn't work with workspaces
COPY package.json .
RUN yarn --production --mount=type=cache,id=livecycle/compose-tunnel-agent/npm-cache,target=/usr/local/share/.cache/yarn/v6
COPY . /app
EXPOSE 3000
CMD [ "yarn", "-s", "start" ]