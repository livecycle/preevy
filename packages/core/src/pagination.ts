export type Page<T> = {
  items: T[]
  nextPageToken?: string
}

export const paginationIterator = <
  T,
  P extends Page<T>,
>(fetch: (continueToken?: string) => Promise<P>): AsyncIterableIterator<T> => {
  let currentResponsePromise = fetch()
  let currentPageIter: Iterator<T> | null = null

  const next = async (): Promise<IteratorResult<T>> => {
    const currentResponse = await currentResponsePromise
    if (!currentPageIter) {
      currentPageIter = currentResponse.items[Symbol.iterator]()
    }

    const currentNext = currentPageIter.next()

    if (!currentNext.done || !(currentResponse.nextPageToken)) {
      return currentNext
    }

    currentPageIter = null
    currentResponsePromise = fetch(currentResponse.nextPageToken)
    return await next()
  }

  const iterator = ({ next, [Symbol.asyncIterator]: () => iterator })

  return iterator
}
