import { defaults } from 'lodash'
import url from 'node:url'

export const parseQueryParams = <
T extends Record<string, unknown>
>(requestUrl: string, defaultValues: Partial<T> = {}) => {
  const { search } = url.parse(requestUrl)
  const queryParams = new URLSearchParams(search || '')
  return { search: queryParams, obj: defaults(Object.fromEntries(queryParams), defaultValues) }
}

export const queryParamBoolean = (v: string | boolean | undefined, defaultValue = false): boolean => {
  if (typeof v === 'boolean') {
    return v
  }
  if (typeof v === 'undefined' || v === '') {
    return defaultValue
  }
  return v === '1' || v.toLowerCase() === 'true'
}
