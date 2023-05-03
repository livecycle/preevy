---
title: Contributing
sidebar_position: 9
---

# Setting up a local dev environment

start by building the `compose-tunnel-agent` package by running 

```bash
yarn build
```

## Local tunnel server

1. run tunnel server locally using docker-compose  
2. use `ngrok` or `localtunnel` to expose the service, so that the remote VM can connect to it 
3. [optional] with tls
    1. generate certificate for the TLS handshake
    2. put it inside a file named `...`
    3. run the CLI with the `-c` flag to let preevy familiarize with the certificate's server name
4. run the CLI using the `-t` flag to provide the tunnel url


## livecycle.run

Alternatively you can develop the CLI locally while using the deployed tunnel server under livecycle.run by setting the environment variable `NODE_ENV` to `production` like so:

```bash
NODE_ENV=production /path/to/preevy/packages/cli/bin/run
```
