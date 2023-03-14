import { mapKeys } from 'lodash'

export const removeDriverPrefix = <T extends {}>(
  driverName: string,
  flags: Record<string, unknown>,
) => mapKeys(flags, (_, key) => key.replace(`${driverName}-`, '')) as unknown as T
