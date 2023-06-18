export const replaceHostname = (
  url: URL | string,
  hostname: string,
) => Object.assign(new URL(url.toString()), { hostname })
