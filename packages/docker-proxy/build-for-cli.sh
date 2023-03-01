#!/bin/bash

set -eou pipefail

yarn build

rm -rf dist-for-cli && mkdir dist-for-cli
cp -R dist yarn.lock package.json docker-compose.yml dist-for-cli
cp Dockerfile.for-cli dist-for-cli/Dockerfile
