---
title: "Private Services"
sidebar_position: 1
---

## Problem

There may be instances where you need to expose a service or an environment that shouldn't be accessible to anyone with the preview URL and requires an additional layer of authentication.

## Solution

Preevy supports the addition of an HTTP authentication layer to services by adding the `preevy.access=private` label to the service in your compose file.

```yaml
services:
     frontend:
           ...
     admin:
           labels:
           - preevy.access=private
           ...
```

To generate credentials for the service, run the `preevy urls --include-access-credentials` command. This command will generate a username and password in the following format, using HTTP basic authentication: `https://x-preevy-profile-key:password@<service-preview-url>`

The password will be valid for 60 days. If needed, you can regenerate the password by running the command again.

### Implementation Details

When Preevy's tunneling service identifies a service marked as private, it adds a layer of [HTTP basic authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication) to that service.
Requests to that service will be required to include a JWT token, which is signed using the profile's tunneling private key.
The JWT can be passed as the password when using Basic Authentication.
Future implementations will allow the use of bearer tokens, cookie-based sessions, and external authentication providers.

### Limitations

Because the current implementation relies on HTTP basic authentication via the `Authorization` HTTP header, it has a few limitations:

- Backend services that depend on the `Authorization` header may break, because this header is already used for Preevy's authentication.
- WebSockets do not support the `Authorization` header, so they will not work.

Both of these limitations will be addressed when the tunneling service begins to support cookie-based authentication/sessions.