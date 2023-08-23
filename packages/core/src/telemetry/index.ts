import { TelemetryEmitter, nullTelemetryEmitter } from './emitter'

let staticEmitter: TelemetryEmitter = nullTelemetryEmitter

export const registerEmitter = (emitter: TelemetryEmitter) => { staticEmitter = emitter }
export const telemetryEmitter = (): TelemetryEmitter => staticEmitter

export { telemetryEmitter as createTelemetryEmitter, nullTelemetryEmitter, TelemetryEmitter } from './emitter'
export { wireProcessExit } from './process-exit'
export { memoizedMachineId as machineId } from './machine-id'