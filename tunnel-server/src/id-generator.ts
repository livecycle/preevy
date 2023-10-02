export const idGenerator = () => {
  let nextId = 0
  return {
    next: () => {
      const result = nextId
      nextId += 1
      return result
    },
  }
}
