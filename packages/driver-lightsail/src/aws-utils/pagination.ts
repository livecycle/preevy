import { paginationIterator as coreIter, extractDefined } from '@preevy/core'

export type HasNextPageToken = {
  nextPageToken?: string
}

export const paginationIterator = <
  T,
  K extends string,
  P extends HasNextPageToken & { [Prop in K]?: T[] }
>(
  fetch: (pageToken?: string) => Promise<P>,
  key: K,
): AsyncIterableIterator<T> => coreIter(async token => {
  const r = await fetch(token)
  return {
    items: extractDefined(r, key),
    nextPageToken: r.nextPageToken,
  }
})
