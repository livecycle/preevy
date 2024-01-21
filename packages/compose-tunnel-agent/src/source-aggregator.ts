export const sourceAggregator = <T extends {}>(extractKey: (o: T) => PropertyKey) => {
  const sourcesToObjects = new Map<PropertyKey, T[]>()
  return (source: PropertyKey, objects: T[]): T[] => {
    sourcesToObjects.set(source, objects)
    const allObjects = [...sourcesToObjects.values()]
      .flatMap(sourceObjects => sourceObjects.map(obj => [extractKey(obj), obj] as const))
    const uniqueObjects = [...new Map(allObjects).values()]
    return uniqueObjects
  }
}
