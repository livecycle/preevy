export type RequiredProperties<T, K extends keyof T> = T & Required<Pick<T, K>>
export function hasPropertyDefined<T, K extends keyof T>(object: T, propertyName: K)
  : object is T & Required<Pick<T, K>> {
  return object[propertyName] !== undefined
}
