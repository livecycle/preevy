import { paginationIterator as coreIter } from '@preevy/core'

export type Page<T> = {
  body: {
    items: T[]
    metadata?: { _continue?: string }
  }
}

export const paginationIterator = <
  T,
  P extends Page<T> = Page<T>,
>(fetch: (continueToken?: string) => Promise<P>): AsyncIterableIterator<T> => coreIter(async token => {
    const r = await fetch(token)
    return {
      items: r.body.items,
      // eslint-disable-next-line no-underscore-dangle
      nextPageToken: r.body.metadata?._continue,
    }
  })
