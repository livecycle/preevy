import { MachineStatusCommand } from '@preevy/common'

export const machineStatusNodeExporterCommand: MachineStatusCommand = {
  contentType: 'application/vnd.prom2json',
  recipe: {
    type: 'docker',
    command: ['http://localhost:9100/metrics'],
    image: 'prom/prom2json',
    network: 'host',
    tty: false,
  },
} as const
