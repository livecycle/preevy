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

Preevy will generate the following environment variable which will contain the generated preview environment URL:

`PREEVY_BASE_URI_SERVICE_NAME_3000`

## Problem

In development environments, it's common for frontend applications to communicate with backend services using exposed ports.

Service to service communication within containers can be handled using Docker Compose's built-in feature, where services can access other containers using the service name as a hostname [Docker Networking](https://docs.docker.com/compose/networking/).

However, this method is not applicable to code executed in the browser, which creates difficulties for frontend applications when connecting to backend services through exposed ports. The tunneling URL needs to be substituted, but it cannot be determined at build time.
## Solution

Preevy offers a simple solution for this problem by exposing the tunneling URL as an environment variable at Compose *build time*. Environment variables can be [interpolated](https://docs.docker.com/compose/compose-file/12-interpolation/) in the Compose file.

The environment variable is named after the service name + port, with the prefix `PREEVY_BASE_URI`. For example, if the service name is `frontend` and is exposed on port 4000, the environment variable will be `PREEVY_BASE_URI_FRONTEND_4000`.

If the service is exposed on multiple ports, the environment variable will be created for each port.

*Note about service name normalization*: Non-alphanumeric characters in service names are replaced by `_` (underscore) in the `PREEVY_BASE_URI` environment variable. E.g, the environment variable for service `my-service` at port 80 will be `PREEVY_BASE_URI_MY_SERVICE_80`.

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
          - API_URL=http://localhost:9006
     my-backend:
          ...
          ports:
          - 9006:3000
```

In this example, the frontend service is configured to communicate with the API service on port 9005. This works well in development, but when using Preevy, the port is not known in advance. To solve this, we can use the `PREEVY_BASE_URI` environment variable:

```yaml
services:
     api:
          ...
          ports:
           - 9005:3000
     my-frontend:
          environment:
          - API_URL=${PREEVY_BASE_URI_MY_BACKEND_9006:-http://localhost:9006}
     my-backend:
          ...
          ports:
           - 9006:3000
```

To keep things working normally in local development, where the `PREEVY_BASE_URI` variables are not defined, a [default value](https://docs.docker.com/compose/compose-file/12-interpolation/) of `http://localhost:9006` is given.
