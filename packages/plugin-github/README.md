# GitHub integration plugin

The `@preevy/plugin-github` plugin adds GitHub integration to [Preevy](https://github.com/livecycle/preevy).

This plugin is bundled with Preevy and enabled by default. To disable it, see [below](#disabling-the-plugin).

## GitHub PR comment for your environment

![Demo comment](https://github.com/livecycle/preevy/blob/main/packages/plugin-github/demo.png?raw=true)

### Automatic PR comment at `up` and `down`

Comment generation is done as part of the `up` and `down` core commands.

Preevy will post the comment if a GitHub PR and a GitHub token are detected in the context (e.g, when running in a GitHub Action or other [supported CI provider](#configuration-from-the-ci-provider-context)) or specified explicitly. See the [Configuration section](#configuration) for details.

### Manual PR comment using the `github` commands

This plugin adds the following commands:

`github pr comment`: Creates a GitHub PR comment for an existing Preevy environment. If the comment exists, it is updated with the current set of URLs.

`github pr uncomment`: Updates the GitHub PR comment to state that the Preevy environment has been deleted.

Run `preevy github pr comment --help` for details.

## GitHub Docker build cache

Specify `--github-add-build-cache` at the `up` command to add [GitHub cache](https://docs.docker.com/build/ci/github-actions/cache/#github-cache) to your build directives.

This will add the following directives to all services with a `build` section:

```yaml
  cache_to: type=gha,scope=<project>/<service>,mode=max
  cache_from: type=gha,scope=<project>/<service>
```

## Configuration

At runtime, the plugin will attempt to detect the configuration it needs from environment variables and the git context. Options can be overridden using CLI flags and the Docker Compose file.

| | Environment variable | Flag | Config section | Other sources |
|---|------|------|-----|----|
| GitHub token | `GITHUB_TOKEN` | `--github-token` | `token` |
| Repo (owner/reponame) | `GITHUB_REPOSITORY` | `--github-repo` | `repo` | git context (if `detect` is not `false`) |
| PR number | `GITHUB_REF` (format: `refs/pull/<number>`) | `--github-pull-request` | `pullRequest` | |
| Comment template | | `--github-pr-comment-template-file` | `commentTemplate` |  |

### Configuration from the CI provider context

The plugin can automatically detect its configuration when running in a CI provider supported by `@preevy/core`:

* [GitHub Actions](https://github.com/livecycle/preevy/tree/main/packages/core/src/ci-providers/github-actions.ts)
* [GitLab Actions](https://github.com/livecycle/preevy/tree/main/packages/core/src/ci-providers/gitlab.ts)
* [Circle CI](https://github.com/livecycle/preevy/tree/main/packages/core/src/ci-providers/circle.ts)
* [Travis CI](https://github.com/livecycle/preevy/tree/main/packages/core/src/ci-providers/travis.ts)
* [Azure Pipelines](https://github.com/livecycle/preevy/tree/main/packages/core/src/ci-providers/azure-pipelines.ts)

To disable auto-detection, specify `detect: false` at the plugin configuration in the Docker Compose file.

### Configuration from the Docker Compose file

Add the plugin to the `plugins` section of the `x-preevy` element in your Docker Compose file:

```yaml
services:
  ...
x-preevy:
  plugins:
    - module: '@preevy/plugin-github'
    # detect: false
    # disabled: true
    # commentTemplate: see below
    # pullRequest: PR number
    # token: GitHub token
    # repo: GitHub repo (owner/reponame)
```

### Configuration from CLI flags

The following flags can be specified at the Preevy CLI:

<table>
  <tr>
    <th>Command</th>
    <th>Flag</th>
    <th>Description</th>
  </tr>
  <tr>
    <td rowspan="5"><code>up</code>, <code>down</code></td>
    <td><code>--github-token=&lt;token&gt;</code></td>
    <td>GitHub token</td>
  </tr>
  <tr>
    <td><code>--github-repo=&lt;owner&gt;/&lt;repo&gt;</code></td>
    <td>GitHub repository</td>
  </tr>
  <tr>
    <td><code>--github-pull-request=&lt;number&gt;</code></td>
    <td>GitHub PR number</td>
  </tr>
  <tr>
    <td><code>--github-comment-template-file=&lt;path&gt;</code></td>
    <td>Path to a <a href="#comment-template">nunjucks comment template</a></td>
  </tr>
  <tr>
    <td><code>--github-pr-comment-enabled=&lt;auto|no|always&gt;</code></td>
    <td>Whether to enable posting/updating a comment on the GitHub PR</td>
  </tr>
  <tr>
    <td rowspan="5"><code>github pr comment</code>, <code>github pr uncomment</code></td>
    <td><code>--token=&lt;token&gt;</code></td>
    <td>GitHub token</td>
  </tr>
  <tr>
    <td><code>--repo=&lt;owner&gt;/&lt;repo&gt;</code></td>
    <td>GitHub repository</td>
  </tr>
  <tr>
    <td><code>--pull-request=&lt;number&gt;</code></td>
    <td>GitHub PR number</td>
  </tr>
  <tr>
    <td><code>--comment-template-file=&lt;path&gt;</code></td>
    <td>Path to a <a href="#comment-template">nunjucks comment template</a></td>
  </tr>
</table>

### PR comment template

The generated PR comment can be customized by specifying a template in your Docker Compose file, or in a separate file (see above). The template is rendered by [`nunjucks`](https://mozilla.github.io/nunjucks/templating.html) and receives a context containing a `urls` property which is one of the following:

* `undefined`: The environment is being deleted, or the `uncomment` command has been invoked.
* Otherwise, the result of the [preevy `urls` command](https://github.com/livecycle/preevy/blob/main/packages/cli/README.md#preevy-urls-service-port): an array of `{ service: string; port: number; url: string; project: string }`

Here is an example of a configuration file containing a customized template:

```yaml
x-preevy:
  plugins:
  - module: '@preevy/plugin-github'
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

## Disabling the plugin

### Disabling the plugin completely (will remove all the GitHub integration)

Any of the following will disable the plugin:

- Specify `disabled: true` at the plugin configuration in the Docker Compose file
- Set the `PREEVY_DISABLE_PLUGINS` environment variable to `@preevy/plugin-github`. If multiple plugins need to be disabled, specify a comma-separated list of modules.
- Add the flag `--disable-plugin=@preevy/plugin-github`

### Disabling the GitHub PR comment

Automatic commenting on the GitHub PR can be disabled by, setting the environment variable `PREEVY_GITHUB_PR_COMMENT_ENABLED=0` or specifying the flag `--github-pr-comment-enabled=no` at the `up` and `down` commands.

