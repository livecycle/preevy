---
title: Livecycle Docker Extension
---

# Livecycle Docker Extension 🐳

## Overview

The Livecycle Docker Extension enables you to share your local development environment with your team, so you can get feedback much earlier in the development workflow, without the hassle of staging environments or CI builds.

## Key Features

- Instant, secure tunneling to frontend and backend services
- Share HTTPS links so teammates can quickly access and review your web UI and backend services at runtime.
- Public and private access controls
- Integration with external identity providers for secure access
- Integrated debugging tools that include log inspection, shell, and container inpsection
- Integration with the [OSS Preevy CLI tool](https://github.com/livecycle/preevy) that can be used for publishing ephemeral environments on your cloud provider or any Kubernetes cluster

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop)


### Steps

1. **Installing the extension**

   Navigate to this [link](https://open.docker.com/extensions/marketplace?extensionId=livecycle/docker-extension) or search for "Livecycle" in the Docker Desktop Extensions Marketplace. Click the "Install" button to install the extension.

   ![Livecycle Docker Extension](docker-ext-1.png)

2. **Setting up a Livecycle account**

   Once you have installed the extension and opened it, you will be greeted with a login screen. You can choose to log in with your GitHub account or Google account. If you previously used Livecycle and created an organization, you can log in with your Livecycle account.

   ![Livecycle Docker Extension](docker-ext-2.png)

3. **Getting shareable URLs**
   
   As soon as you log in, you will be able to see a list of running docker compose applications and all the services that are running in them. To get a public shareable URL for every service, turn on the toggle next to the compose application name. After that, you will be prompted to choose the access level. 

   ![Livecycle Docker Extension](docker-ext-3.png)

   You can choose between public and private access. If you choose public access, you will get a public URL that you can share with anyone. If you choose private access, you will get a private URL that you can share with your team members. Then click on the "Share" button to get the shareable URL.

   ![Livecycle Docker Extension](docker-ext-4.png)

4. **Accessing the shared URL**

   Once you have shared the URL with your team members, they can access the URL in their browser. They will be able to see the application running in their browser.

   ![Livecycle Docker Extension](docker-ext-5.png)

5. **Accessing Livecycle dashboard**

   You can also access the Livecycle dashboard to see the logs and debug your application. Click on the "Open Link" button to open the Livecycle dashboard. On the dashboard, you can see all the running applications and services. You can also see the public and private URLs for each service.

   ![Livecycle Docker Extension](docker-ext-6.png)

6. **Debugging, inspecting, and logging**

   Once you have opened the Livecycle dashboard, you can see all the environments/apps that are running. Click on the name of the environment for which you want to see the logs, terminal, etc. You can view the logs, terminal, and container inspection for each service.

   ![Livecycle Docker Extension](docker-ext-7.png)

That's it! You have successfully installed the Livecycle Docker Extension and shared your local development environment with your team.

## FAQ

<details>
  <summary>What is the difference between the Livecycle Docker Extension and ngrok?</summary>
  <p>
    The main difference is the collaboration aspect. Livecycle allows you to share your local development environment with your team, so you can get feedback much earlier in the development workflow.
  </p>
</details>


<details>
  <summary>Which frameworks and languages does Livecycle support?</summary>
  <p>
    Livecycle is agnostic to specific language or framework. It works with any language or framework that can be run in a Docker container.
  </p>
</details>

<details>
  <summary>Is Livecycle Docker Extension secure?</summary>
  <p>
    Yes, Livecycle Docker Extension is secure. It uses a private tunnel to expose your local development environment to the internet. You can also add access controls to restrict access to your environment. In addition, Livecycle Docker Extension supports HTTPS and SSL termination.
  </p>
</details>

<details>
  <summary>How do I get started with Livecycle Docker Extension?</summary>
  <p>
    You can get started with the Livecycle Docker Extension by following the steps in the <a href="#getting-started">Getting Started</a> section.
  </p>
</details>

<details>
  <summary>What makes the Livecycle Docker Extension different from other tools?</summary>
  <p>
    Support provisioning to your cloud provider or k8s cluster -> In that context we are not bound to abilities like tunnel or ngrok as we allow the environment to be available and accessible regardless of your local setup. We also support your CI pipeline- showing that it can be added to your GH actions for example while also add comments to your GH.
  </p>
</details>

<details>
  <summary>How do I get support for the Livecycle Docker Extension?</summary>
  <p>
    Join the <a href="https://community.livecycle.io">Livecycle Community</a> on Slack to get support for the Livecycle Docker Extension.
  </p>
</details>
