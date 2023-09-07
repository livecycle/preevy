/* eslint-disable @typescript-eslint/no-explicit-any */
import yaml, { DocumentOptions, ParseOptions, SchemaOptions, ToJSOptions } from 'yaml'

type Reviver = (this: any, key: string, value: any) => any
type Options = ParseOptions & DocumentOptions & SchemaOptions & ToJSOptions

export function tryParseYaml(src: string, options?: Options): any
export function tryParseYaml(src: string, reviver: Reviver, options?: Options): any
export function tryParseYaml(src: string, ...rest: unknown[]) {
  try {
    return yaml.parse(src, ...rest as any[])
  } catch (e) {
    return undefined
  }
}
