---
title: "Environment Variables"
sidebar_position: 4
---

## Overview

Preevy fully supports Docker Compose environment variable features, allowing you to pass configuration and secrets to your preview environments in multiple ways. This guide covers all the methods available for managing environment variables in your Preevy preview environments.

## Setting environment variables in Compose files

The most common way to set environment variables is directly in your `docker-compose.yml` or `compose.yml` files using standard Docker Compose syntax:

```yaml
services:
  web:
    image: node:18
    environment:
      # Assign a fixed value
      - NODE_ENV=production
      
      # Load value from host environment variable
      - DATABASE_URL=${DATABASE_URL}
      
      # Pass variable directly from host (if it exists)
      - API_KEY
      
      # Use default value if host variable is not set
      - PORT=${PORT:-3000}
      - DEBUG=${DEBUG:-false}
```

## Using .env files

Docker Compose supports loading environment variables from `.env` files, and Preevy fully supports this feature:

### Single .env file

```yaml
services:
  web:
    env_file:
      - .env
```

### Multiple .env files

```yaml
services:
  web:
    env_file:
      - .env              # Base environment variables
      - .env.override     # Override specific values
      - ${ENV_NAME}.env   # Environment-specific (e.g., dev.env, prod.env)
```

### Example .env file

```bash
# .env
NODE_ENV=production
DATABASE_URL=postgres://user:password@localhost:5432/myapp
API_SECRET=your-secret-key-here
DEBUG=true
```

## Passing environment variables from the host

When running `preevy up`, environment variables from your local machine (or CI environment) are automatically available for Docker Compose interpolation.

### From your terminal

```bash
# Set environment variables and run Preevy
export DATABASE_URL=postgres://user:pass@host:5432/db
export API_KEY=your-secret-key
export NODE_ENV=production

preevy up
```

### In your CI environment

Environment variables set in your CI environment are automatically passed through:

#### GitHub Actions

```yaml
name: Deploy Preevy environment

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: livecycle/preevy-up-action@v2.4.0
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          API_KEY: ${{ secrets.API_KEY }}
          NODE_ENV: production
```

#### Other CI systems

Most CI systems allow you to set environment variables that will be available to Preevy:

```bash
# Environment variables are automatically available
preevy up
```

## Environment-specific configurations

You can create different configurations for different environments:

### Using environment-specific .env files

```yaml
services:
  web:
    env_file:
      - .env.${ENVIRONMENT:-development}
```

Then set the `ENVIRONMENT` variable:

```bash
# For staging
export ENVIRONMENT=staging
preevy up

# For production
export ENVIRONMENT=production
preevy up
```

### Using conditional values in Compose files

```yaml
services:
  web:
    environment:
      - NODE_ENV=${NODE_ENV:-development}
      - LOG_LEVEL=${LOG_LEVEL:-info}
      - DATABASE_URL=${DATABASE_URL:-sqlite://localhost/dev.db}
  
  database:
    image: ${DB_IMAGE:-postgres:13}
    environment:
      - POSTGRES_DB=${POSTGRES_DB:-myapp_dev}
      - POSTGRES_USER=${POSTGRES_USER:-dev_user}
```

## Best practices

### 1. Use default values for development

Always provide sensible defaults for local development:

```yaml
environment:
  - API_URL=${API_URL:-http://localhost:3000}
  - DATABASE_URL=${DATABASE_URL:-sqlite://localhost/dev.db}
```

### 2. Keep secrets out of compose files

Never hardcode secrets in your compose files. Always use environment variables:

```yaml
# ❌ Don't do this
environment:
  - API_SECRET=hardcoded-secret

# ✅ Do this
environment:
  - API_SECRET=${API_SECRET}
```

### 3. Document required environment variables

Create a `.env.example` file to document required variables:

```bash
# .env.example
DATABASE_URL=postgres://user:password@host:5432/database
API_SECRET=your-secret-key-here
NODE_ENV=development
DEBUG=false
```

### 4. Use environment-specific configurations

For different environments, use different approaches:

```yaml
# Development: use .env file with defaults
env_file:
  - .env

# Staging/Production: use host environment variables
environment:
  - DATABASE_URL=${DATABASE_URL}
  - API_SECRET=${API_SECRET}
```

## Troubleshooting

### Environment variables not being interpolated

If environment variables aren't being substituted, check:

1. **Variable naming**: Environment variable names are case-sensitive
2. **Syntax**: Use `${VARIABLE_NAME}` or `${VARIABLE_NAME:-default}`
3. **Quoting**: Avoid quotes around variable references in YAML

```yaml
# ❌ Incorrect
environment:
  - "DATABASE_URL='${DATABASE_URL}'"

# ✅ Correct
environment:
  - DATABASE_URL=${DATABASE_URL}
```

### Variables not available in containers

If environment variables are set in your compose file but not available in containers:

1. Check your service definition syntax
2. Ensure the compose file is valid YAML
3. Verify environment variables are set in your host environment

### Debugging environment variables

Use `docker-compose config` to see the resolved configuration:

```bash
# See the resolved compose configuration with interpolated variables
export NODE_ENV=production
docker-compose config
```

## Advanced usage

### Using environment variables in build context

Environment variables can also be used during the build process:

```yaml
services:
  web:
    build:
      context: .
      args:
        - NODE_ENV=${NODE_ENV:-production}
        - BUILD_VERSION=${BUILD_VERSION}
```

### Dynamic service configuration

```yaml
services:
  web:
    image: ${WEB_IMAGE:-node:18}
    ports:
      - "${WEB_PORT:-3000}:3000"
    environment:
      - NODE_ENV=${NODE_ENV:-development}
      - PORT=3000
```

For more information about Docker Compose environment variable features, see the [official Docker Compose documentation](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/).