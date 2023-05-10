---
title: Local Development
sidebar_position: 9
---

# Setting up a local dev environment

## Prerequisite: build the `compose-tunnel-agent` package

The remote VM that runs the preview environment uses a Docker container for tunneling the exposed services to the Tunnel Server.  
For that to work, we need to build the `compose-tunnel-agent` package. Run:

```bash
cd packages/compose-tunnel-agent/
yarn && yarn build
```

Additionally build the `common` package:

```bash
cd packages/common/
yarn && yarn build
```

## Choose whether to build a local Tunnel Server or use a publicly available one

Preevy uses a [tunnel server](https://github.com/livecycle/preevy/tree/main/tunnel-server) to expose the deployed docker-compose services to the web. You can read more about how it works [here](https://livecycle.io/blogs/preevy-proxy-service-1/) and [here](https://livecycle.io/blogs/preevy-proxy-service-2/).

There are 2 options to develop preevy locally:

1. [Using the public livecycle.run tunnel server](#option-1---using-the-public-livecyclerun-tunnel-server) - *Recommended for most use cases*
2. [Run the tunnel server locally](#option-2---run-the-tunnel-server-locally)


## Option 1 - Using the public livecycle.run tunnel server


This option is simpler and using the the deployed tunnel server under livecycle.run. Use this if you're only interested in testing and developing the CLI or the Compose Tunnel Agent

Wherever you would normally run the `preevy` command, simply replace it with: 

```bash
# replace /path/to/ with your local path to preevy
/path/to/preevy/packages/cli/bin/dev {{ command }}
``` 

In the case of the `preevy up`, add the `-t ssh+tls://livecycle.run` flag:

```bash
# replace /path/to/ with your local path to preevy
/path/to/preevy/packages/cli/bin/dev up -t ssh+tls://livecycle.run
``` 


## Option 2 - Run the tunnel server locally

Use this option if you'd like to test and develop the Preevy Local Tunnel. 

### 1. Generate keys and certificates

inside the ***tunnel-server*** folder, run:

```bash
mkdir ssh # if does not exist
ssh-keygen -t rsa -f ssh/ssh_host_key
```

### 2. Build and run the tunnel server


```bash
BASE_URL=http://localhost:8030 docker compose -f docker-compose.yml -f docker-compose.override.yml up --build
```

### 3. Expose the service's TCP connection

Now we want to expose the tunnel service to the web. In this example we'll be using [ngrok](https://ngrok.com/) to achieve that:

```bash
ngrok tcp 8044
```

### 4. Run the CLI

replace `ngrok-host:ngrok-port` with the values received from the previous step and `{{ command }}` with any preevy command.  
Now, Wherever you would normally run the `preevy` command, simply replace it with: 

```bash
# replace /path/to/ with your local path to preevy
~/path/to/preevy/packages/cli/bin/dev up -t ssh://ngrok-host:ngrok-port
```

For example, to run the [`up`](cli-reference#preevy-up-service) command:

```bash
# replace /path/to/ with your local path to preevy
~/path/to/preevy/packages/cli/bin/dev up -f ./docker/docker-compose.yaml -t ssh://ngrok-host:ngrok-port
```




