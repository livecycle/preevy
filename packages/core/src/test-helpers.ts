import { jest } from '@jest/globals'

export const mockFunction = <T extends (...args: never[]) => unknown>(impl?: T): jest.MockedFunction<T> => (
  jest.fn(impl) as unknown as jest.MockedFunction<T>
)

export type MockFunctions<T extends {}> = {
  [k in keyof T]: T[k] extends (...args: never[]) => unknown
    ? jest.MockedFunction<T[k]>
    : T[k] extends {} ? MockFunctions<T[k]> : T[k]
}
