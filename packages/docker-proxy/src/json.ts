export const tryParseJson = (...args: Parameters<typeof JSON.parse>) => {
  try { 
    return JSON.parse(...args) 
  } catch(e) {
    return undefined 
  }
}
