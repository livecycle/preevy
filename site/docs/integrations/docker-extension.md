---
title: Livecycle Docker Extension
---

# Livecycle Docker Extension 🐳

## Overview

The Livecycle Docker Extension enables you to share your local development environment with your team, so you can get feedback much earlier in the development workflow, without the hassle of staging environments or CI builds.
Livecycle extension embed a standalone version of Preevy CLI that is used to provide all the network and collaboration capabilities. The profile created by Preevy can also be used to provision ephemeral environments.  

## Key Features

- Simple Docker for desktop UI
- Instant sharing of running applications/services:
  - Preevy based HTTPS -> SSH Tunneling
  - Share HTTPS links so teammates can quickly access and review your web UI and backen
    services at runtime.
  - [Public and private access](https://preevy.dev/recipes/private-services)
  - Instant, secure tunneling to frontend and backend services
- Livecycle Integration:
  - Secure access to environments based on Google/Github identity providers 
  - Environment debugging tools - log inspection, shell, and container inpsection
- Can be used together with Preevy CLI to provision remote ephemeral environments

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

   You can choose between public and private access. If you choose public access, you will get a public URL that you can share with anyone. If you choose private access, you will get a private URL that require authentication and can only by used by your organization mebers. Then click on the "Share" button to get the shareable URL.

   ![Livecycle Docker Extension](docker-ext-4.png)

4. **Accessing the shared URL**

   URLs created by the extension are consistent, shareable and can be use by a browser or any other http client.
   Using these URLs, your team members will be able to see and interact with your local version of the app as long as the tunnel is open your workstation is running.  
   Private environments require adding team members to your organization, and upon access, your team members will be prompted to authenticate.
   
   ![Livecycle Docker Extension](docker-ext-5.png)

5. **Accessing Livecycle dashboard**

   You can also access the Livecycle dashboard to see the logs and debug your application. Click on the "Open Link" button to open the Livecycle dashboard. On the dashboard, you can see all the running applications and services.
   The Livecycle dashboard requires authentication and organization membership, similiarly to private environments/services 

   ![Livecycle Docker Extension](docker-ext-6.png)

6. **Debugging, inspecting, and logging**

   Once you have opened the Livecycle dashboard, you can see all the environments/apps that are running. Click on the name of the environment for which you want to see the logs, terminal, etc. You can view the logs, terminal, and container inspection for each service.

   ![Livecycle Docker Extension](docker-ext-7.png)

That's it! You have successfully installed the Livecycle Docker Extension and shared your local development environment with your team.

## FAQ

<details>
  <summary>What is the difference between the Livecycle Docker Extension and Ngrok?</summary>
  
  Livecycle Docker extesnion is integrated with Docker, and provides a smoother experience for Docker users.  
  Consistent URLs, private environments, organizations and Google/Github authentication are supported out of the box.  
  Livecycle dashboard provides debugging capabilites that includes log inspection, shell access, and container inspection.  
  Lastly, the integration with Preevy allow you to create remote ephemeral environments that can be used when your workstation is offline or futher in your SDLC (preview environments for Pull Requests).  
</details>

<details>
  <summary>Which frameworks and languages does Livecycle support?</summary>
  
  Livecycle is agnostic to specific language or framework. It works with any language or framework that can be run in a Docker container.
</details>

<details>
  <summary>What security features does the Livecycle Docker extension offer?</summary>
  
  The Livecycle Docker Extension uses a secure [SSH tunnel](https://livecycle.io/blogs/preevy-proxy-service-2/) to expose your local development environment using Livecycle's tunnel server, which is only accessible using HTTPS.  
  You can enable private URLs to restrict access to your environment.
</details>

<details>
  <summary>How do I get started with the Livecycle Docker Extension?</summary>
  
  You can get started with the Livecycle Docker Extension by following the steps in the [Getting Started](#getting-started) section.
</details>

<details>
  <summary>What makes the Livecycle Docker Extension different from other tools?</summary>
  
  Livecycle Docker extension is integrated with Preevy CLI and Livecylce services.
  Using the CLI, you can provision remote ephemeral environments that can be used in addtion to sharing local environments.  
  This functionality can also be used in the CI to provision ephemeral environment for Pull Requests.  
  Livecycle adds additonal layers of management, collaboration, review and debugging on top of shared environments.  
</details>

<details>
  <summary>How do I get support for the Livecycle Docker Extension?</summary>
  
  Join the [Livecycle Community](https://community.livecycle.io) on Slack to get support for the Livecycle Docker Extension.
</details>
