---
title: Livecycle Docker Extension
sidebar_position: 11
---

# Livecycle Docker Extension 🐳

## Overview

The Livecycle Docker Extension enables you to share your local development environment with your team, so you can get feedback much earlier in the development workflow, without the hassle of staging environments or CI builds.
The Livecycle Docker extension embeds a standalone version of the Preevy CLI, which provides all the network and collaboration capabilities. The extension creates a Preevy profile which can also be used to provision ephemeral environments.  

## Key Features

- Simple Docker for desktop UI
- Instant sharing of running applications/services:
  - Share HTTPS links so teammates can quickly access and review your web UI and backend services at runtime.
  - Instant, secure tunneling to frontend and backend services with [public or private access](https://preevy.dev/recipes/private-services). Access to private services can be restricted to your teammates' Google or GitHub accounts.
- Tools to debug your environment - log inspection, shell, and container inspection.
- Provision remote ephemeral environments using the Preevy CLI.

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) 4.10 or higher.

### Steps

1. **Installing the extension**

   Navigate to this [link](https://open.docker.com/extensions/marketplace?extensionId=livecycle/docker-extension) or search for "Livecycle" in the Docker Desktop Extensions Marketplace. Click the "Install" button to install the extension.

   ![Livecycle Docker Extension](https://github.com/livecycle/preevy/assets/51878265/e1960b89-0a9a-4641-8748-3e775555aa65)

2. **Setting up a Livecycle account**

   Once you have installed the extension and opened it, you will be greeted with a login screen. You can choose to log in with your GitHub account or Google account. If you previously used Livecycle and created an organization, you can log in with your Livecycle account.

   ![Livecycle Docker Extension](https://github.com/livecycle/preevy/assets/51878265/8f996b07-797f-4633-b11e-bfcf902b17ab)

3. **Getting shareable URLs**
   
   As soon as you log in, you will be able to see a list of running docker compose applications and all the services that are running in them. To get a public shareable URL for every service, turn on the toggle next to the compose application name. After that, you will be prompted to choose the access level. 

   ![Livecycle Docker Extension](https://github.com/livecycle/preevy/assets/51878265/54044c48-d204-4320-9f9d-b885e8294df2)

   You can choose to between Local and Cloud. The local option will create a tunnel to your local machine, and the cloud option will put your application to the cloud and create a tunnel to it. You can choose depending on your use case. For example, if you want the environment to stay for few amount of time, you can choose the local option. If you want the environment to stay for a longer time, and team can access it over few days, you can choose the cloud option.

   In this flow we will choose the local option, click [here](#Share-to-the-cloud) to learn more about the cloud option. After that, you will be prompted to choose the access level. You can choose between public and private access. If you choose public access, you will get a public URL that you can share with anyone. If you choose private access, you will get a private URL that requires authentication and can only be used by your organization members. Then click on the "Share" button to get the shareable URL.

   ![Livecycle Docker Extension](https://github.com/livecycle/preevy/assets/51878265/0cd6bd7a-2608-4253-b1b0-e0e6eca496dd)

4. **Accessing the shared URL**

   URLs created by the extension are consistent, shareable, and can be used by a browser or any other http client.
   Using these URLs, your team members will be able to see and interact with your local version of the app as long as the tunnel is open and your workstation is running.  
   Private environments require adding team members to your organization, and upon access, your team members will be prompted to authenticate.
   
   ![Livecycle Docker Extension](https://github.com/livecycle/preevy/assets/51878265/cc2d9c8f-35cd-4d71-a61b-0a4041786bec)

5. **Accessing Livecycle dashboard**

   You can also access the Livecycle dashboard to see the logs and debug your application. Click on the "Open Link" button to open the Livecycle dashboard. On the dashboard, you can see all the running applications and services.
   The Livecycle dashboard requires authentication and organization membership, similar to private environments/services 

   ![Livecycle Docker Extension](https://github.com/livecycle/preevy/assets/51878265/c94b28d6-debc-471b-9621-82c73dbc79fe)

6. **Debugging, inspecting, and logging**

   Once you have opened the Livecycle dashboard, you can see all the environments/apps that are running. Click on the name of the environment for which you want to see the logs, terminal, etc. You can view the logs, terminal, and container inspection for each service.

   ![Livecycle Docker Extension](https://github.com/livecycle/preevy/assets/51878265/04e00790-beaf-4f22-bd6e-ca7f497f5aaa)

That's it! You have successfully installed the Livecycle Docker Extension and shared your local development environment with your team.

## Share to the cloud

With the Livecycle Docker Extension, you can we can make your local environment accessible to your team members even when your machine is offline. This is done by putting your application to the cloud and creating a tunnel to it. This is useful when you want to share your environment with your team members for a longer period of time.


## FAQ

<details>
  <summary>What is the difference between the Livecycle Docker Extension and Ngrok?</summary>

  The Livecycle Docker Extension is integrated with Docker and provides a smoother experience for Docker users.
  Consistent URLs, private environments, organizations, and Google/Github authentication are supported out of the box.
  The Livecycle dashboard provides debugging capabilities that include log inspection, shell access, and container inspection.
  Lastly, integration with the Preevy CLI allows you to create preview environments for Pull Requests - remote ephemeral environments that can be used when your development machine is offline.
</details>

<details>
  <summary>Which frameworks and languages does Livecycle support?</summary>

  Livecycle is language and framework agnostic. It works with anything that runs in a Docker container.
</details>

<details>
  <summary>What security features does the Livecycle Docker extension offer?</summary>

  The Livecycle Docker Extension uses a secure <a href="https://livecycle.io/blogs/preevy-proxy-service-2/" target="_blank">SSH tunnel</a> to expose your local development environment using Livecycle's tunnel server, which is only accessible using HTTPS.

  You can enable private URLs to restrict access to your environment.
</details>

<details>
  <summary>How do I get started with the Livecycle Docker Extension?</summary>

  You can get started with the Livecycle Docker Extension by following the steps in the Getting Started section of this document.
</details>

<details>
  <summary>What makes the Livecycle Docker Extension different from other tools?</summary>

  Livecycle Docker extension is integrated with the Preevy CLI and the Livecycle managed service.
  Using the Preevy CLI, you can provision remote ephemeral environments that can be used in addition to sharing local environments.
  This functionality can also be used in your CI pipeline to provision preview environments for Pull Requests.
  The Livecycle managed service adds additional layers of management, collaboration, review, and debugging on top of shared environments.
</details>

<details>
  <summary>Is using the Livecycle Docker Extension free?</summary>

  Yes, the Livecycle Docker Extension is free to use.
</details>

<details>
  <summary>Does Livecycle have my access to my/company data or code?</summary>

  No, Livecycle does not have access to your data or code. We just do tunneling. The building and running of your code is done on your machine or cloud.
</details>

<details>
  <summary>How do I get support for the Livecycle Docker Extension?</summary>

  Join the <a href="https://community.livecycle.io" target="_blank">Livecycle Community</a> on Slack to get support for the Livecycle Docker Extension.
</details>