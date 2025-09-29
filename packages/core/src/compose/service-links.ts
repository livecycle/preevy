export const serviceLinkEnvVars = (
  expectedServiceUrls: { name: string; port: number; url: string }[],
  envId?: string,
): Record<string, string> => {
  const baseUriVars = Object.fromEntries(
    expectedServiceUrls
      .map(({ name, port, url }) => [`PREEVY_BASE_URI_${name.replace(/[^a-zA-Z0-9_]/g, '_')}_${port}`.toUpperCase(), url])
  )

  const hostVars = Object.fromEntries(
    expectedServiceUrls
      .map(({ name, port, url }) => {
        try {
          const hostname = new URL(url).hostname
          return [`PREEVY_HOST_${name.replace(/[^a-zA-Z0-9_]/g, '_')}_${port}`.toUpperCase(), hostname]
        } catch (e) {
          // If URL parsing fails, fallback to empty string
          return [`PREEVY_HOST_${name.replace(/[^a-zA-Z0-9_]/g, '_')}_${port}`.toUpperCase(), '']
        }
      })
  )

  const envIdVars: Record<string, string> = envId ? { PREEVY_ENV_ID: envId } : {}

  return { ...baseUriVars, ...hostVars, ...envIdVars }
}
