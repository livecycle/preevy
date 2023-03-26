
# Tunnel Server

`preevy` uses a tunnel server to expose the preview environments services to the end user.
By default, the CLI uses a public tunnel server hosted on `livecycle.run`, but this configuration can be override using the `--tunnel-server` flag.
The tunnel server can be self hosted and a Docker/OCI image is publicly available on `ghcr.io/livecycle/preevy/tunnel-server`

The tunnel server itself is a node.js server responsible for creating tunnels for http services using SSH.
The server accept ssh connections in port 2222, http traffic on port 3000.
Assuming the tunnel server is running on `tunnel-server-host`, creating a tunnel for a http service running on port 5000 is as simple as running:
```bash
ssh -I {some_rsa_key} -R /my-tunnel:localhost:5000 tunnel-server-host hello
```
The expected output of this command will be something like:
```
{"clientId":"5rwpwhy5","tunnels":{"/test":"http://my-tunnel-5rwpwhy5.tunnel-server-host:3000/"}}
```
A tunnel from `http://my-tunnel-5rwpwhy5.tunnel-server-host:3000->http://localhost:5000` was created, and can be accessed by anyone who knows the URL (assuming the tunnel server is public).

## Security

For connecting to tunneling server, you must use ssh private-key based authentication.
Urls for tunnels are derived from the public key of the client (referred as clientId):
`{tunnel_name}-{clientId}.{tunnel-server}`.

`preevy` support connecting to a tunnel server over TLS which wrap the ssh connection, for these cases the tunnel server need to use an external service for TLS termination (e.g. nginx/haproxy/traefik).

## Observability
The tunnel server expose operational metrics on port 8888 that can be scraped by Prometheus or similar observability tool.