import { Octokit } from 'octokit'
import { FlatTunnel } from '@preevy/core'
import nunjacks from 'nunjucks'

const markdownMarker = (envId: string) => `<!-- preevy-env-id: ${envId} -->`

export const defaultCommentTemplate = `{% if urls %}[Preevy](https://preevy.dev) has created a preview environment for this PR.

Here's how to access it:

| Service | Port | URL |
|---------|------|-----|
{% for url in urls %}| {{ url.service }} | {{ url.port }} | {{ url.url }} |
{% endfor %}
{% else %}The [Preevy](https://preevy.dev) preview environment for this PR has been deleted.
{% endif %}
`

const findPreevyCommentId = async (
  { octokit }: { octokit: Octokit },
  { repo: { owner, repo }, issue, envId }: {
    repo: { owner: string; repo: string }
    issue: number
    envId: string
  },
) => {
  const marker = markdownMarker(envId)
  for await (const { data } of octokit.paginate.iterator(octokit.rest.issues.listComments, {
    owner, repo, issue_number: issue, per_page: 100,
  })) {
    for (const comment of data) {
      if (comment.body?.includes(marker)) {
        return comment.id
      }
    }
  }

  return undefined
}

export type Content = { urls: FlatTunnel[] } | 'deleted'

const formatPreevyComment = (envId: string, content: Content, template: string) => [
  markdownMarker(envId),
  nunjacks.renderString(template, { urls: content === 'deleted' ? undefined : content.urls }),
].join('\n')

export const upsertPreevyComment = async (
  { octokit }: { octokit: Octokit },
  { repo: { owner, repo }, envId, pullRequest, content, commentTemplate }: {
    repo: { owner: string; repo: string }
    envId: string
    pullRequest: number
    commentTemplate: string
    content: Content
  },
) => {
  const args = {
    issue_number: pullRequest,
    owner,
    repo,
    body: formatPreevyComment(envId, content, commentTemplate),
  }

  const commentId = await findPreevyCommentId({ octokit }, { repo: { owner, repo }, issue: pullRequest, envId })

  if (!commentId) {
    await octokit.rest.issues.createComment(args)
  } else {
    await octokit.rest.issues.updateComment({ comment_id: commentId, ...args })
  }

  return commentId
}
