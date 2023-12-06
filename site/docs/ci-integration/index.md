---
title: Integrating Preevy with your CI
parent: /ci-integration
---

## **Automatically create preview environments from your CI Workflow**

Preevy is designed to be easily run in CI workflows, such as [GH Actions](https://github.com/features/actions), [Circle CI](https://circleci.com/) and others. This automatically creates shareable preview environments for every upcoming pull request and code change.

By sharing [profiles](https://preevy.dev/intro/under-the-hood#profile-configuration), Preevy is able to easily deploy to the same VM when new code is pushed to some branch.
