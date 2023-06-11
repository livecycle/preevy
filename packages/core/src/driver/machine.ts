export type PartialMachine = {
  providerId: string
  error: string
}

export type MachineBase = {
  providerId: string
  locationDescription: string
}

export const isPartialMachine = (m: MachineBase | PartialMachine): m is PartialMachine => 'error' in m

export type SpecDiffItem = {
  name: string
  old: string
  new: string
}
