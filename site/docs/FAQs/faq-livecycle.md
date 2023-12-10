---
title: FAQ - Dashboard
sidebar_position: 15.2
---

## Common questions about using The Livecycle Dashboard

<details>
  <summary>What is the difference between the Livecycle Docker Extension and Ngrok?</summary>
  
  The Livecycle Docker Extension is integrated with Docker, and provides a smoother experience for Docker users.  
  Consistent URLs, private environments, organizations and Google/Github authentication are supported out of the box.  
  Livecycle dashboard provides debugging capabilities that includes log inspection, shell access, and container inspection.  
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
  The Livecycle managed service adds additional layers of management, collaboration, review and debugging on top of shared environments.  
</details>

<details>
  <summary>How do I get support for the Livecycle Docker Extension?</summary>
  
  Join the <a href="https://community.livecycle.io" target="_blank">Livecycle Community</a> on Slack to get support for the Livecycle Docker Extension.
</details>
