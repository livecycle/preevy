---
title: Tunnel Server
sidebar_position: 4
---

# Tunnel Server

Preevy uses a tunnel server to expose the preview environment services to the end user.
By default, the CLI uses a public tunnel server hosted on `livecycle.run`, but this configuration can be overridden using the [`--tunnel-server`](cli-reference#preevy-up-service) flag.
The tunnel server can be self hosted and a Docker/OCI image is publicly available on `ghcr.io/livecycle/preevy/tunnel-server`

The tunnel server is a Node.js server responsible for creating tunnels for HTTP services using SSH.

The server accepts SSH connections on port 2222 and HTTP traffic on port 3000. It can also accept TLS connections (for both SSH and HTTPS) on port 8443. All ports are configurable using environment variables.

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

A tunnel from `http://my-tunnel-5rwpwhy5.tunnel-server-host:3000` to `http://localhost:5000` was created and can be accessed by anyone who has the URL (assuming the tunnel server is public).

## Security

To connect to the tunnel server, you must use SSH private-key-based authentication.
Urls for tunnels are derived from the public key of the client (referred to as `clientId`):
`http://{tunnel_name}-{clientId}.{tunnel-server}`.

The tunnel server supports connections over TLS which enable HTTPS and SSH over TLS. For this, a TLS certificate is required.

## Self hosting the tunnel server

The tunnel server can be self-hosted. Use cases for self hosting include private networks, custom domain names and reducing network latency by deploying the tunnel server geographically closer to the deployment machines.

See [guide](https://github.com/livecycle/preevy/tree/main/tunnel-server/deployment/k8s).

## Observability

The tunnel server exposes operational metrics on port 8888 that can be scraped by [Prometheus](https://prometheus.io/) or a similar observability tool.
