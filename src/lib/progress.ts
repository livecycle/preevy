export type ProgressReporter = {
  increment: (increment: number, status?: string) => void
}

export type ProgressConsumer = {
  progress: number
  status?: string
}

export const childProgressReporter = (parent: ProgressReporter, increment: number): ProgressReporter => {
  return {
    increment: (childIncrement, status) => {
      parent.increment(childIncrement * increment, status)
    },
  }
}