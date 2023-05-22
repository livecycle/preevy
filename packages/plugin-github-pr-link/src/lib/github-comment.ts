import { Octokit } from 'octokit'
import { FlatTunnel } from '@preevy/core'

const markdownMarker = (envId: string) => `<!-- preevy-env-id: ${envId} -->`

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

type Status = { urls: FlatTunnel[] } | 'deleted'

const formatPreevyCommentWithUrls = (envId: string, urls: FlatTunnel[]) => `
${markdownMarker(envId)}
[Preevy](https://preevy.dev) has created a preview environment for this PR.

Here's how to access it:

| Service | Port | URL |
|---------|------|-----|
${urls.map(({ service, port, url }) => `| ${service} | ${port} | ${url} |`).join('\n')}
`

const formatPreevyCommentDeleted = (envId: string) => `
${markdownMarker(envId)}
The [Preevy](https://preevy.dev) preview environment for this PR has been deleted.
`

const formatPreevyComment = (envId: string, status: Status) => (
  status === 'deleted'
    ? formatPreevyCommentDeleted(envId)
    : formatPreevyCommentWithUrls(envId, status.urls)
)

export const upsertPreevyComment = async (
  { octokit }: { octokit: Octokit },
  { repo: { owner, repo }, envId, pullRequest, status }: {
    repo: { owner: string; repo: string }
    envId: string
    pullRequest: number
    status: Status
  },
) => {
  const args = {
    issue_number: pullRequest,
    owner,
    repo,
    body: formatPreevyComment(envId, status),
  }

  const commentId = await findPreevyCommentId({ octokit }, { repo: { owner, repo }, issue: pullRequest, envId })

  if (!commentId) {
    await octokit.rest.issues.createComment(args)
  } else {
    await octokit.rest.issues.updateComment({ comment_id: commentId, ...args })
  }

  return commentId
}
