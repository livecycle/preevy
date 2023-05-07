---
title: "Service discovery using environment variables"
sidebar_position: 1
date: "2023-05-07"
---

## Problem

In development environments, it's common for frontend applications to communicate with backend services using exposed ports. While Preevy handles service-service communication well with compose service discovery, it can be challenging when frontend applications need to connect to backend services via exposed ports. The tunneling URL must be replaced, but it's not known in advance.

## Solution

Preevy offers a simple solution for this problem by exposing the tunneling URL as an environment variable. The environment variable is named after the service name + port, with the prefix `PREEVY_BASE_URI`. For example, if the service name is `frontend` and is exposed on port 4000, the environment variable will be `PREEVY_BASE_URI_FRONTEND_4000`.

If the service is exposed on multiple ports, the environment variable will be created for each port.

## Example

Consider the following common setup:

```yaml
services:
     api:
           ...
           ports:
           - 9005:3000
     frontend:
          environment:
          - API_URL=http://localhost:9006
     backend:
          ...
          ports:
          - 9006:3000
```

In this example, the frontend application is configured to communicate with the API service on port 9005. This works well in development, but when using Preevy, the port is not known in advance. To solve this, we can use the `PREEVY_BASE_URI` environment variable:

```yaml
services:
     api:
           ...
           ports:
           - 9005:3000
     frontend:
          environment:
          - API_URL=${PREEVY_BASE_URI_BACKEND_9006-:http://localhost:9006}
```
