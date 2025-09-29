---
title: "Service discovery"
sidebar_position: 3
---

## tl;dr

For any exposed port in your compose configurations:

```yaml
services:
     service_name:
          ...
          ports: 3000:80
```

Preevy will generate the following environment variables which will contain information about the generated preview environment:

```bash
PREEVY_BASE_URI_SERVICE_NAME_3000=https://service-name-3000-envid-clientid.livecycle.run/
PREEVY_HOST_SERVICE_NAME_3000=service-name-3000-envid-clientid.livecycle.run
PREEVY_ENV_ID=envid
```

## Problem

In development environments, it's common for frontend applications to communicate with backend services using exposed ports.

Service-to-service communication within containers can be handled using Docker Compose's built-in feature, where services can access other containers using the service name as a hostname [Docker Networking](https://docs.docker.com/compose/networking/).

However, this method does not apply to code executed in the browser, which creates difficulties for frontend applications when connecting to backend services through exposed ports. The tunneling URL needs to be substituted, but it cannot be determined at build time.
## Solution

Preevy offers a simple solution for this problem by exposing tunneling information as environment variables at Compose *build time*. Environment variables can be [interpolated](https://docs.docker.com/compose/compose-file/12-interpolation/) in the Compose file.

Preevy provides the following environment variables:

- **`PREEVY_BASE_URI_{SERVICE}_{PORT}`**: The complete URL including protocol and trailing slash (e.g., `https://service-3000-envid-clientid.livecycle.run/`)
- **`PREEVY_HOST_{SERVICE}_{PORT}`**: Just the hostname without protocol or trailing slash (e.g., `service-3000-envid-clientid.livecycle.run`)
- **`PREEVY_ENV_ID`**: The environment ID (e.g., `envid`)

The service-specific environment variables are named after the service name + port. For example, if the service name is `frontend` and is exposed on port 4000, the environment variables will be `PREEVY_BASE_URI_FRONTEND_4000` and `PREEVY_HOST_FRONTEND_4000`.

If the service is exposed on multiple ports, environment variables will be created for each port.

*Note about service name normalization*: Non-alphanumeric characters in service names are replaced by `_` (underscore) in the environment variable names. E.g, the environment variables for service `my-service` at port 80 will be `PREEVY_BASE_URI_MY_SERVICE_80` and `PREEVY_HOST_MY_SERVICE_80`.

## Example

Consider the following common setup:

```yaml
services:
     api:
           ...
           ports:
           - 9005:3000
     my-frontend:
          environment:
          - API_URL=http://localhost:9006/
     my-backend:
          ...
          ports:
          - 9006:3000
```

In this example, the frontend service is configured to communicate with the API service on port 9005. This works well in development, but when using Preevy, the port is not known in advance. To solve this, we can use the Preevy environment variables:

```yaml
services:
     api:
          ...
          ports:
           - 9005:3000
     my-frontend:
          environment:
          - API_URL=${PREEVY_BASE_URI_MY_BACKEND_9006:-http://localhost:9006/}
          # Or use just the hostname:
          - API_HOST=${PREEVY_HOST_MY_BACKEND_9006:-localhost:9006}
          # Or use the environment ID to build your own URL:
          - ENV_ID=${PREEVY_ENV_ID:-local}
     my-backend:
          ...
          ports:
           - 9006:3000
```

To keep things working normally in local development, where the Preevy variables are not defined, [default values](https://docs.docker.com/compose/compose-file/12-interpolation/) are provided.
