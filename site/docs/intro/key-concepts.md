---
sidebar_position: 4
title: Key Concepts
---

# Key Concepts for Using Preevy

Here are some key concepts and terminology that you should be familiar with as you begin using Preevy and referencing this documentation:

- **Preview Environments** - Stand-alone, temporary environments that are used to share how code changes manifest themselves in an app or service. These environments are inexpensive, easy to integrate, customizable, and accessible for both technical and non-technical users. Preevy is a tool used to help developers easily create these environments without deep DevOps knowledge. These environments can also be referred to as "ephemeral environments". 

- **Deploy Runtimes** - These are the places that you can use to build and deploy preview environments with Preevy. Examples of supported Deploy Runtimes include: AWS Lightsail, Google Cloud Platform, Microsoft Azure and Kubernetes

- **The Dashboard** - Each Livecycle user can access the Livecycle Dashboard when logging into their Livecycle account in a browser. Using the Dashboard, you can invite teammates to existing preview environments to review and provide feedback. Each team member can see the open projects assigned to them and review the latest changes in their browser.

- **The Livecycle Extension** - The Livecycle Docker Extension is a Docker for Desktop Extension available in the Docker Extension Marketplacr. The Livecycle Extension enables you to share your local containers with so you can get feedback much earlier in the development workflow, without the hassle of staging environments or CI builds. The Livecycle Extension embeds a standalone version of the Preevy CLI, which provides all the network and collaboration capabilities. The extension creates a Preevy profile which can also be used to provision ephemeral environments.