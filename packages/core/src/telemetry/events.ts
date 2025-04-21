export type TelemetryProperties = Record<string, unknown>

type BaseEvent<T extends string> = {
  event: T
  timestamp: Date
  distinct_id: string
}

export type AliasEvent = BaseEvent<'$create_alias'> & {
  properties: TelemetryProperties & {
    distinct_id: string
    alias: string
  }
}

export type IdentifyEvent<
  PersonProperties extends TelemetryProperties = TelemetryProperties,
  EventProperties extends TelemetryProperties = TelemetryProperties
> = BaseEvent<'$identify'> & {
  '$set': PersonProperties
  properties: EventProperties
}

export type CaptureEvent<
  T extends string,
  P extends TelemetryProperties = TelemetryProperties
> = BaseEvent<T> & {
  properties: P
}

export type TelemetryEvent = CaptureEvent<string> | IdentifyEvent | AliasEvent

export const serializableEvent = (event: TelemetryEvent) => ({
  ...event,
  timestamp: new Date(event.timestamp).toISOString(),
})
