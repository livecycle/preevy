import { Relationship } from "@oclif/core/lib/interfaces/parser";
import { mapKeys } from "lodash";

export const driverRelationship = <Name extends string>(forDriver: Name): Relationship => ({
  type: 'all' as const,
  flags: [{ name: 'driver', when: async ({ driver }: Record<string, unknown>) => driver === forDriver }],
})

export const removeDriverPrefix = <T extends {}>(
  driverName: string,
  flags: Record<string, unknown>,
) => mapKeys(flags, (_, key) => key.replace(`${driverName}-`, '')) as unknown as T

