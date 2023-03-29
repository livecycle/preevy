---
sidebar_position: 2
title: "Example: Github Actions"
---

# Github Actions

In this section we'll show an example of how to run Preevy in GitHub Actions pipeline.

## Authentication

Make sure the action has [suffice permissions](/drivers/aws-lightsail#required-permissions) to AWS.
See: [Assume a rule](https://github.com/aws-actions/configure-aws-credentials#assuming-a-role)

Once configured, use the [AWS for GitHub Actions](https://github.com/marketplace/actions/configure-aws-credentials-for-github-actions) action:

```yml
- uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: [your-aws-role]
          aws-region: [your-aws-region]
```

## Running Preevy

It's a good practice to use a fixed node version, you can do it with the [Setup Node.js environment](https://github.com/marketplace/actions/setup-node-js-environment) action:

```yaml
- uses: actions/setup-node@v3
  with:
    node-version: 18
```

Next, make sure your code is checked out using the [Checkout](https://github.com/marketplace/actions/checkout) action:

```yaml
- uses: actions/checkout@v3
```

Now you can install the Preevy CLI:

```yaml
- name: Install Preevy CLI
  run: npm i -g preevy
```

Make sure you load the Preevy profile you [configured earlier](/ci/overview#how-to-run-preevy-from-the-ci), e.g.

```bash
preevy init --from "s3://preview-8450209857-ci?region=us-east-1"
```

Now run `preevy up` from the directory that contains your `docker-compose.yml` file

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
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: arn:aws:iam::8450209857:role/preevy-github-action
          aws-region: us-east-1
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - uses: actions/checkout@v3
      - name: Install Preevy CLI
        run: npm i -g preevy
      - name: Run preevy up
        id: preevy_up
        run: |
          preevy init --from "s3://preview-8450209857-ci?region=us-east-1"
          cd docker
          preevy up
```