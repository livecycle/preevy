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
- A TLS certificate for your domain
- `kubectl` and `kustomize`

## Overview

The Tunnel Server natively listens on three ports:
- A SSH port which accepts tunneling SSH connections from environments
- A HTTP port which accepts requests from clients (browsers, etc)
- A TLS port which directs incoming connections to either the SSH server or the HTTP server according to the [SNI server name](https://en.wikipedia.org/wiki/Server_Name_Indication).

The `SSH_HOSTNAMES` env var determines which hostnames are directed to the SSH server and the rest are directed to the HTTP server. If the env var is not specified, the hostname of the `BASE_URL` is used.

In this deployment scheme, the TLS port is exposed using a [`LoadBalancer-type K8S Service`](https://kubernetes.io/docs/concepts/services-networking/service/#loadbalancer). The base hostname `yourdomain.example` is used for tunneling SSH connections and any hostname on the subdomain `*.yourdomain.example` will be used for client requests.

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

The `up` and `urls` commands accept a `-t` flag which can be used to set the Tunnel Server URL. Specify `ssh+tls://yourdomain.example` to use your instance.

### 8. Cleanup: Delete the deployed objects

To delete the deployed Tunnel Server and associated Kubernetes objects, run:

```bash
kustomize build . | kubectl delete -f -
```
