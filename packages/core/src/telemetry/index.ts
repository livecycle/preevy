import { TelemetryEmitter, nullTelemetryEmitter } from './emitter.js'

let staticEmitter: TelemetryEmitter = nullTelemetryEmitter

export const registerEmitter = (emitter: TelemetryEmitter) => { staticEmitter = emitter }
export const telemetryEmitter = (): TelemetryEmitter => staticEmitter

export { telemetryEmitter as createTelemetryEmitter, nullTelemetryEmitter, TelemetryEmitter } from './emitter.js'
export { wireProcessExit } from './process-exit.js'
export { memoizedMachineId as machineId } from './machine-id.js'
