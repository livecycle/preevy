export type ImageRegistry = { registry: string; singleName?: string }

export type BuildSpec = ({ registry?: ImageRegistry; load: true } | { registry: ImageRegistry; load: boolean }) & {
  cacheFromRegistry?: boolean
  noCache?: boolean
  builder?: string
}

const ecrRegex = /^(?<registry>[0-9]+\.dkr\.ecr\.[^.]+\.*\.amazonaws\.com)\/(?<singleName>.+)/

export const parseRegistry = (
  { registry, singleName }: { registry: string; singleName: undefined | string | false },
): ImageRegistry => {
  if (singleName === undefined) {
    const match = ecrRegex.exec(registry)
    if (match) {
      return { registry: match.groups?.registry as string, singleName: match.groups?.singleName as string }
    }
  }
  return { registry, singleName: typeof singleName === 'string' ? singleName : undefined }
}
