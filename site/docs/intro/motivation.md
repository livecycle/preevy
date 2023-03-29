---
sidebar_position: 2
title: Motivation
---

# Motivation

Preevy was designed to help development teams improve their code-review workflows by providing a simple and cost-effective way to provision ephemeral environments for every branch. AKA:  _**Preview Environments**_.
Preview environments can be used to test, validate and review changes made in a branch, before merging them.
They are a non-production version of the application, that can be accessed by anyone with a link that is usually attached to every pull/merge request.

Our mission at [Livecycle](https://livecycle.io) is to make the development workflow more collaborative and free of back and forth communication.
We believe that **preview environments** serve an integral part for accomplishing our mission, and one of our earliest challenges as a startup was to make preview environments more accessible and affordable for all teams.

As we grew Livecycle, we've seen teams implement preview environments for frontend applications by leveraging the power of [Vercel](https://vercel.com/docs/concepts/deployments/preview-deployments), [Netlify](https://docs.netlify.com/site-deploys/deploy-previews/) or even our [own solution](https://docs.livecycle.io/getting-started/livecycle-pipelines/).

Yet, when it comes to deploying preview environments for a complex application with multiple services, many teams struggle to find the right solution and juggle between the different complexities and tradeoffs (fidelity, security, cost, scale, etc...). If they don't postpone the effort altogether, they often compromise on a complex, costly solution that isn't tailored to their needs.

Many of the challenges in setting up complex preview environments are related to the inherent complexities and configuration fragmentation of production (or production-like) environments of enterprise applications. (e.g. Kubernetes configuration, [IaC](https://en.wikipedia.org/wiki/Infrastructure_as_code), scale, compliance/security, etc...).

Preevy lowers the bar for deploying preview environments, aiming for any developer with a minimal knowledge of Docker and a cloud provider account.

In the tradeoff between fidelity and simplicity, we chose simplicity. We believe that for preview environment to fulfill their potential impact on development flows, they should be cheap, hackable, and accessible to everyone.

Originally, we planned Preevy as a side-project to let our customers provision preview environments on their infrastructure.
We decided to open-source it, since we are excited about the potential value it can bring to the community and the possibility of establishing an ecosystem of standards, practices and tools around preview environments.
