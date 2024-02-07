export const errorToJson = (e: unknown) => {
  if (!(e instanceof Error)) {
    return e
  }
  return {
    ...e,
    name: e.name,
    class: e.constructor.name,
    message: e.message,
    stack: e.stack,
  }
}
