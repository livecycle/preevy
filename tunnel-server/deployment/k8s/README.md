# Deploying your own instance of the Tunnel Server

This directory contains an example deployment of the Tunnel Server on Kubernetes.

Note that this is an advanced task which requires some networking and Kubernetes know-how.

## Why

Deploying a private instance of the Tunnel Server allows for fine-grained control of:

- The URLs created for preview environments: e.g, use a custom domain.
- Geolocation of the server: Deploying the server on a network close to environments' can result better network performance.
- Security and privacy: deploy everything in your VPC, no traffic to 3rd parties.

## Requirements

- A Kubernetes cluster
- A TLS certificate for your domain
- [`kubectl`](https://kubernetes.io/docs/tasks/tools/#kubectl), [`kustomize`](https://kubectl.docs.kubernetes.io/installation/kustomize/) and `ssh-keygen` (usually installed with the OpenSSH client).

## Overview

The Tunnel Server natively listens on three ports:
- A SSH port which accepts tunneling SSH connections from environments
- A HTTP port which accepts requests from clients (browsers, etc)
- A TLS port which directs incoming connections to either the SSH server or the HTTP server according to the [SNI server name](https://en.wikipedia.org/wiki/Server_Name_Indication) and [ALPN](https://en.wikipedia.org/wiki/Application-Layer_Protocol_Negotiation) in the TLS handshake.

The connection is directed according to the following:
- If the ALPN protocol is `ssh`, the connection is directed to the SSH server.
- If the SNI servername is one of the `SSH_HOSTNAMES` (default: the hostname of the `BASE_URL`, e.g, `yourdomain.example`), the connection is directed to the SSH server.
- Otherwise, the connection is directed to the HTTP server.

| Parameter | default | overridable using env var |
| --------- | ------- | ------------------------- |
| SSH port | 2222 | `SSH_PORT` |
| HTTP port | 3000 | `PORT` |
| TLS port | 8443 | `TLS_PORT` |
| SNI servername for SSH connections | hostname of `BASE_URL` | `SSH_HOSTNAMES` (comma separated) |

In this example deployment, the TLS port is exposed using a [`LoadBalancer-type K8S Service`](https://kubernetes.io/docs/concepts/services-networking/service/#loadbalancer). Using the default configuration, we will specify the base hostname `yourdomain.example` as the `-t` flag in the Preevy CLI for tunneling SSH connections, and the resulting env URLs will have the [hostname](https://livecycle.io/blogs/preevy-proxy-service-1/) from the subdomain `*.yourdomain.example` (e.g, `my-service-my-env-abc123456.yourdomain.example`) which will be used for client requests.

## Instructions

### 1. Setup the domain and the TLS certificate

Make sure the certificate is for both the base domain and the wildcard subdomain, e.g, `yourdomain.example` and `*.yourdomain.example`.

Put the cert and key (in PEM format) in the files `tls.crt` and `tls.key`

Copy `config.env.example` to `config.env` and set your domain in the `BASE_URL` variable.

### 2. Generate a cookie secret

The cookie secret is a simple text-based secret (like a password) in a file.

```bash
LC_ALL=C tr -dc A-Za-z0-9 </dev/urandom | head -c 40 > cookie_secret
```

### 3. Generate a SSH host key

```bash
ssh-keygen -t ed25519 -N "" -f ssh_host_key
```

### 4. Generate and deploy the configuration

Review the generated configuration:

```bash
kustomize build .
```

To deploy to the K8S cluster:

```bash
kustomize build . | kubectl apply -f -
```

Make sure the two deployments `tunnel-server` and `tunnel-server-stunnel` exist and that their pods are running.

### 5. Test the SSH endpoint

This requires OpenSSH and a recent-enough OpenSSL CLI with support for the `-quiet` option.

To test the SSH endpoint (replace `$MY_DOMAIN` with your domain):

```bash
MY_DOMAIN=yourdomain.example

# NOTE: for EKS, replace .ip with .hostname below
EXTERNAL_IP=$(kubectl get service tunnel-server -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

ssh -nT -o "ProxyCommand openssl s_client -quiet -verify_quiet -servername $MY_DOMAIN -connect %h:%p" -p 443 foo@$EXTERNAL_IP hello
```

### 6. Create DNS records for the `tunnel-server` Service external IP or hostname

Create two DNS records: `*.yourdomain.example` and `yourdomain.example`, both pointing to the external IP of the `tunnel-server` service.

The address is not guaranteed to be static. According to your Kubernetes provider, there could be multiple ways to define a DNS entry for it. Here are some guides:

- Amazon AWS: [EKS](https://docs.aws.amazon.com/eks/latest/userguide/network-load-balancing.html)
- Google Cloud: [GKE](https://cloud.google.com/kubernetes-engine/docs/concepts/service-load-balancer)
- Azure: [AKS](https://learn.microsoft.com/en-us/azure/aks/load-balancer-standard)

### 7. Use your Tunnel Server instance with the Preevy CLI

The `up` and `urls` commands accept a `-t` flag which can be used to set the Tunnel Server SSH URL. Specify `ssh+tls://yourdomain.example` to use your instance.

### 8. Cleanup: Delete the deployed objects

To delete the deployed Tunnel Server and associated Kubernetes objects, run:

```bash
kustomize build . | kubectl delete -f -
```
