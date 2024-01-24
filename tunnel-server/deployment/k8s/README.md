# Deploying your own instance of the Tunnel Server

This directory contains an example deployment of the Tunnel Server on Kubernetes.

Note that this is an advanced task which requires some networking and Kubernetes know-how.

## Why

Deploying a private instance of the Tunnel Server allows for fine-grained control of:

- The URLs created for preview environments: e.g, use a custom domain.
- Geolocation of the server: reduced distance to environments can result better network performance.
- Security and privacy: deploy everything in your VPC, no traffic to 3rd parties.

## Requirements

- A Kubernetes cluster
- An ingress solution to make K8S Services accesible from your network (e.g, Traefik). In this example, we'll use your cloud provider's load balancer.
- A TLS certificate for your domain
- `kubectl` and `kustomize`

## Overview

The Tunnel Server natively listens on two ports:
- A SSH port which accepts tunneling SSH connections from environments
- A HTTP port which accepts requests from clients (browsers, etc)

In this deployment scheme, both ports are wrapped with TLS using [`stunnel`](https://www.stunnel.org/). Both HTTP and SSH connections are accepted on a [single port](https://vadosware.io/post/stuffing-both-ssh-and-https-on-port-443-with-stunnel-ssh-and-traefik/) and routed using [`sslh`](https://github.com/yrutschle/sslh/) to the tunnel server ports.

The `stunnel` port is then exposed using a [`LoadBalancer-type K8S Service`](https://kubernetes.io/docs/concepts/services-networking/service/#loadbalancer).

## Instructions

### 1. Setup the domain and the TLS certificate

Make sure the certificate is for a wildcard subdomain, e.g, `*.yourdomain.example`

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

EXTERNAL_IP=$(kubectl get service tunnel-server-tls -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

ssh -nT -o "ProxyCommand openssl s_client -quiet -verify_quiet -servername $MY_DOMAIN -connect %h:%p" -p 443 foo@$EXTERNAL_IP hello
```

### 6. Create DNS records for the `tunnel-server` Service external IP

Create two DNS records: `*.yourdomain.example` and `yourdomain.example`, both pointing to the external IP of the `tunnel-server` service.

The address is not guaranteed to be static. According to your Kubernetes provider, there could be multiple ways to define a DNS entry for it. Here are some guides:

- Amazon AWS: [EKS](https://docs.aws.amazon.com/eks/latest/userguide/network-load-balancing.html)
- Google Cloud: [GKE](https://cloud.google.com/kubernetes-engine/docs/concepts/service-load-balancer)
- Azure: [AKS](https://learn.microsoft.com/en-us/azure/aks/load-balancer-standard)

Another approach would be to use a 3rd-party ingress solution like [Traefik](https://doc.traefik.io/traefik/user-guides/crd-acme/).

## Using your Tunnel Server instance with the Preevy CLI

The `up` and `urls` commands accept a `-t` flag which can be used to set the Tunnel Server URL. Specify `ssh+tls://yourdomain.example` to use your instance.
