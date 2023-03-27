---
sidebar_position: 2
title: Motivation
---

Preevy was designed to help development teams improve their PR workflows by providing a simple and cost-effective way to provision ephemeral environments for every Pull Request. (AKA *Preview Environments*)

Our mission at [Livecycle](https://livecycle.io) is to make the development flow more collaborative and free of back and forth communication.  
We believe that preview environments serve an integral part for accomplishing our mission, and one of our earliest challenges as a startup was to make preview environments more accessible and affordable for all teams.

To give more context, preview environments are ephemeral environments created for every Pull Request, and can be used to test, validate and review changes before merging them to the main branch.  
To some essence, they are a non-production version of the application that can be accessed by anyone with a link that is automatically attached to every pull request.

During our work, we've seen teams that implemented preview environments for frontend applications by leveraging the power of [Vercel](https://vercel.com/), [Netlify](https://www.netlify.com/) or even our [own solution](https://livecycle.io).

Yet, when it comes to deploying preview environments for a complex application with multiple services, many teams struggle to find the right solution and juggle between the different tradeoffs (fidelity, security, cost, scale, etc...) and complexities, and usually end up with either postponing/giving-up or implementing a complex (and usually costly) solution that doesn't necessarily fit in their development flow.  
To some degree, these challenges are risen from the inherit complexities and fragmentation presented in the configuration of production (or production-like) of enterprise applications. (e.g. Kubernetes configuration, IaC, scale, compliance/security, etc...)

`preevy` lowers the bar for deploying preview environments, aiming for any developer with a minimal knowledge of Docker and a cloud provider account.

In the tradeoff between fidelity and simplicity, we've chosen simplicity, and we believe that preview environments should be cheap, hackable, and accessible to everyone to provide the most value in development flows.

We've originally planned `preevy` as a side-project allowing our customers to provision preview environments on their infrastructure.
We've decided to open-source it as we are excited on the potential value that it can bring to the community and the possibility of establishing a ecosystem of standards, practices and tools around preview environments.
