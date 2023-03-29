---
title: Tunnel Server
sidebar_position: 4
---

# Tunnel Server

Preevy uses a tunnel server to expose the preview environments services to the end user.
By default, the CLI uses a public tunnel server hosted on `livecycle.run`, but this configuration can be overridden using the [`--tunnel-server`](cli-reference#preevy-up-service) flag.
The tunnel server can be self hosted and a Docker/OCI image is publicly available on `ghcr.io/livecycle/preevy/tunnel-server`

The tunnel server itself is a node.js server responsible for creating tunnels for http services using SSH.
The server accepts SSH connections on port 2222 and HTTP traffic on port 3000.
Assuming the tunnel server is running on `tunnel-server-host`, creating a tunnel for an HTTP service running on port 5000 is as simple as running:

```bash
ssh -I {some_rsa_key} -R /my-tunnel:localhost:5000 tunnel-server-host hello
```

The expected output of this command will be something like:

```json
{
  "clientId": "5rwpwhy5",
  "tunnels": { "/test": "http://my-tunnel-5rwpwhy5.tunnel-server-host:3000/" }
}
```

A tunnel from `http://my-tunnel-5rwpwhy5.tunnel-server-host:3000->http://localhost:5000` was created, and can be accessed by anyone who has the URL (assuming the tunnel server is public).

## Security

To connect to the tunnel server, you must use SSH private-key based authentication.
Urls for tunnels are derived from the public key of the client (referred as `clientId`):
`http://{tunnel_name}-{clientId}.{tunnel-server}`.

Preevy supports connecting to a tunnel server over TLS which wraps the SSH connection. For these cases, the tunnel server needs to use an external service for TLS termination (e.g. [NGINX](https://www.nginx.com/), [HAProxy](https://www.haproxy.org/), [Traefik](https://traefik.io/)).

## Observability

The tunnel server expose operational metrics on port 8888 that can be scraped by [Prometheus](https://prometheus.io/) or similar observability tool.
