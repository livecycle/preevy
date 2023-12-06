---
title: Contribute to Preevy Open Source
sidebar_position: 8
---

# Setting up a local dev environment

## Prerequisite: build the `compose-tunnel-agent` package

Build the `common` package:

```bash
cd packages/common/
yarn && yarn build
```

Then, build the `compose-tunnel-agent` package:

```bash
cd packages/compose-tunnel-agent/
yarn && yarn build
```


## Choose whether to build a local Tunnel Server or use a publicly available one

Preevy uses a [tunnel server](https://github.com/livecycle/preevy/tree/main/tunnel-server) to expose the deployed docker-compose services to the internet. You can read more about how it works [here](https://livecycle.io/blogs/preevy-proxy-service-1/) and [here](https://livecycle.io/blogs/preevy-proxy-service-2/).

There are 2 options to develop preevy locally:

1. [Using the public livecycle.run tunnel server](#option-1---using-the-public-livecyclerun-tunnel-server) - *Recommended for most use cases*
2. [Run the tunnel server locally](#option-2---run-the-tunnel-server-locally)


## Option 1 - Using the public livecycle.run Tunnel Server


This option is simpler and using the the deployed Tunnel Server under livecycle.run. Use this if you're only interested in testing and developing the CLI or the Compose Tunnel Agent

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


## Option 2 - Run the Tunnel Server locally

Use this option if you'd like to test and develop the Preevy Local Tunnel. 

### 1. Generate SSH key pair

inside the ***tunnel-server*** folder, run:

```bash
mkdir ssh # if does not exist
ssh-keygen -t rsa -f ssh/ssh_host_key
```

### 2. Build and run the Tunnel Server

inside the ***tunnel-server*** folder, run:

```bash
BASE_URL=http://localhost:8030 docker compose -f docker-compose.yml -f docker-compose.override.yml up --build
```

### 3. Expose the service's SSH endpoint

Now we want to expose the tunnel service to the internet, so the machines running in the cloud could access it. In this example we'll be using [ngrok](https://ngrok.com/) to achieve that:

```bash
ngrok tcp 2223
```

The generated URL should look something like `tcp://9.tcp.eu.ngrok.io:12856`  
Export the part without `tcp://` to a variable (we'll use it in the next step):

```bash
export NGROK_HOST=9.tcp.eu.ngrok.io:12856
```

### 4. Run the CLI

Wherever you would normally run the `preevy` command, simply replace it with: 

```bash
# replace /path/to/ with your local path to preevy
/path/to/preevy/packages/cli/bin/dev {{ command }}
``` 

In the case of the `preevy up`, add the ` -t ssh://$NGROK_HOST` flag:

```bash
# replace /path/to/ with your local path to preevy
# replace ngrok-host:ngrok-port with the host and port you received for the `ngrok` command
/path/to/preevy/packages/cli/bin/dev up -t ssh://$NGROK_HOST
```
