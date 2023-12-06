---
sidebar_position: 2
title: "Example: Github Actions + AWS"
---

# GitHub Actions

In this section we'll show an example of how to run Preevy using our GitHub Actions [preevy-up](https://github.com/marketplace/actions/preevy-up) and [preevy-down](https://github.com/marketplace/actions/preevy-down) with AWS as the VM provider.

# Preevy-Up

## Authentication

In this example Preevy will get your stored profile from AWS S3, and will deploy the repo using docker compose file to AWS Lightsail.
Make sure the action has [sufficient permissions](/drivers/aws-lightsail#required-permissions) to AWS.
See: [Assume a rule](https://github.com/aws-actions/configure-aws-credentials#assuming-a-role)

Once configured, use the [AWS for GitHub Actions](https://github.com/marketplace/actions/configure-aws-credentials-for-github-actions) action:

```yml
- uses: aws-actions/configure-aws-credentials@v2
  with:
    role-to-assume: [your-aws-role]
    aws-region: [your-aws-region]
```

## Permissions
Preevy requires the following [GitHub Actions permissions](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs):

* `contents: read`: used by Preevy to read the Docker Compose file(s)
* `pull-requests: write`: used by the Preevy GitHub plugin to write the deployed URLs on the PR

In addition, if you're using GitHub's OIDC Token endpoint to authenticate to your cloud provider (as in the below examples), `id-token: write`: is also needed.

```yaml
permissions:
  id-token: write
  contents: read
  pull-requests: write
```

## Running Preevy
Make sure your code is checked out before using the preevy up action, using the [Checkout](https://github.com/marketplace/actions/checkout) action:

```yaml
- uses: actions/checkout@v3
```

Specify the required `profile-url` input arg to load the Preevy profile you [configured earlier](/ci/overview#how-to-run-preevy-from-the-ci).

Specify paths to the Docker Compose file using the `docker-compose-yaml-paths` input arg. If more than a single file exists, a comma-separated list of paths can be specified. The defaults are `docker-compose.ya?ml` or `compose.ya?ml` in the root directory.

```yaml
- uses: livecycle/preevy-up-action@v2.0.0
  with:
    profile-url: "s3://preview-12345678-ci?region=us-east-1"
    docker-compose-yaml-paths: "./docker/docker-compose.yaml"
```

## Complete workflow example

```yml
name: Deploy Preevy environment
on:
  pull_request:
    types:
      - opened
      - synchronize
permissions:
  id-token: write
  contents: read
  pull-requests: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: arn:aws:iam::12345678:role/my-role
          aws-region: eu-west-1
      - uses: actions/checkout@v3
      - uses: livecycle/preevy-up-action@latest
        id: preevy
        with:
          profile-url: "s3://preevy-12345678-my-profile?region=eu-west-1"
          # docker-compose-yaml-paths arg will point to the `docker-compose.yml` file. if you have multiple docker compose files, you can add them as a comma seperated string like so `'docker-compose.yml,docker-compose.dev.yml'`
          docker-compose-yaml-paths: "./docker/docker-compose.yaml"
```

# Preevy-Down
Use this action to stop and delete a preview environment using the Preevy CLI when the Pull Request is merged or closed.

## Teardown the Preevy environment
Just like the preevy-up action, we need to authenticate and checkout.

```yaml
- uses: actions/checkout@v3
```

With the `profile-url` arg, load the Preevy profile you [configured earlier](/ci/overview#how-to-run-preevy-from-the-ci), with the AWS S3 permissions we granted earlier.

```yaml
- uses: livecycle/preevy-down-action@v1.1.0
  with:
    profile-url: "s3://preevy-12345678-my-profile?region=eu-west-1"
    docker-compose-yaml-paths: "./docker/docker-compose.yaml"
```
This part is a bit different from the preevy-up action,
you should pass the args as if you are passing them to the [preevy down command](/cli-reference/down),
note the `-f` before the docker-compose file path.
```yaml
```
for multiple docker files you can use `"-f ./docker/docker-compose.yaml -f ./docker/docker-compose.dev.yaml"`

```yml
name: Teardown Preevy environment
on:
  pull_request:
    types:
      - closed
permissions:
  id-token: write
  contents: read
jobs:
  teardown:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: arn:aws:iam::12345678:role/my-role
          aws-region: eu-west-1
      - uses: actions/checkout@v3
      - uses: livecycle/preevy-down-action@latest
        id: preevy
        with:
          profile-url: "s3://preevy-12345678-my-profile?region=eu-west-1"
          args: "-f ./docker/docker-compose.yaml"
```