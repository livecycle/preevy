# GitHub Pull Request link

This plugin allows showing the Preevy environment URLs in a GitHub PR comment. The comment is added/updated at the `up` command and deleted in the `down` command.

![Demo comment](./demo.png)

## Configuration

Add the plugin to the `plugins` section of the `x-preevy` element in your Docker Compose file:

```yaml
services:
  ...
x-preevy:
  plugins:
    - module: '@preevy/plugin-github-pr-link'
    # detect: false
    # disabled: true
    # commentTemplate: see below
    # pullRequest: PR number
    # token: GitHub token
    # repo: GitHub repo (owner/reponame)
```

At runtime, the plugin will attempt to detect the configuration it needs from environment variables and the git context. Flags can be specified in the `up` and `down` commands to override the behaviour.

| | Environment variable | Flag | Config section | Other sources |
|---|------|------|-----|----|
| GitHub token | `GITHUB_TOKEN` | `--github-pr-link-token` | `token` |
| Repo (owner/reponame) | `GITHUB_REPOSITORY` | `--github-pr-link-repo` | `commentTemplate` | git context (if `detect` is not `false`) |
| PR number | `GITHUB_REF` | `--github-pr-link-pull-request` | `pullRequest` | |
| Comment template | | `--github-pr-link-comment-template-file` | `commentTemplate` |  |

### Comment template

The generated PR comment can be customized by specifying a template (see above table). The template is rendered by [`nunjucks`](https://mozilla.github.io/nunjucks/templating.html) and receives a context containing a `urls` property which is one of the following:

* `undefined`: The environment is being deleted, or the `unlink` command has been invoked.
* Otherwise, the result of the [preevy `urls` command](../cli/README.md#preevy-urls-service-port): an array of `{ service: string; port: number; url: string; project: string }`

Here is an example of a configuration file containing a customized template:

```yaml
x-preevy:
  plugins:
  - module: '@preevy/plugin-github-pr-link'
    commentTemplate: |
      {% if urls %}[Preevy](https://preevy.dev) has created a preview environment for this PR.

      Here is how to access it:

      | Service | Port | URL |
      |---------|------|-----|
      {% for url in urls %}| {{ url.service }} | {{ url.port }} | {{ url.url }} |
      {% endfor %}
      {% else %}The [Preevy](https://preevy.dev) preview environment for this PR has been deleted.
      {% endif %}
```

## CI providers

The plugin can auto detect its configuration from the CI providers supported by `@preevy/core`:

* [GitHub Actions](../core/src/ci-providers/github-actions.ts)
* [GitLab Actions](../core/src/ci-providers/gitlab.ts)
* [Circle CI](../core/src/ci-providers/circle.ts)
* [Travis CI](../core/src/ci-providers/travis.ts)
* [Azure Pipelines](../core/src/ci-providers/azure-pipelines.ts)

To disable auto-detection, specify `detect: false` at the plugin configuration in the Docker Compose file.

## Commands

This plugin adds the following commands:

`github-pr link`: Creates the comment from an existing Preevy environment

`github-pr unlink`: Deletes the comment from a Preevy environment.

The commands accept a similar set of flags as described above. Run `preevy github-pr link --help` for details.


## Disabling the plugin

The plugin can be disabled by specifying `disabled: true` at the plugin configuration in the Docker Compose file, adding the environment variable `PREEVY_GITHUB_LINK=0` or specifying the flag `--github-pr-link-enabled=no` in the `up` and `down` commands.

