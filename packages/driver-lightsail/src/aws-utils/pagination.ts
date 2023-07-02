import { extractDefined } from './nulls'

export type HasNextPageToken = {
  nextPageToken?: string
}

export const paginationIterator = <
  T,
  K extends string,
  P extends HasNextPageToken & { [Prop in K]?: T[] },
>(
    fetch: (pageToken?: string) => Promise<P>,
    key: K,
  ): AsyncIterableIterator<T> => {
  let currentResponsePromise = fetch()
  let currentPageIter: Iterator<T> | null = null

  const next = async (): Promise<IteratorResult<T>> => {
    const currentResponse = await currentResponsePromise
    if (!currentPageIter) {
      currentPageIter = extractDefined(currentResponse, key)[Symbol.iterator]()
    }

    const currentNext = currentPageIter.next()

    if (!currentNext.done || !currentResponse.nextPageToken) {
      return currentNext
    }

    currentPageIter = null
    currentResponsePromise = fetch(currentResponse.nextPageToken)
    return await next()
  }

  const iterator = ({ next, [Symbol.asyncIterator]: () => iterator })

  return iterator
}
