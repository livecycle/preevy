export const BUNDLE_IDS = [
  'nano_2_0',
  'micro_2_0',
  'small_2_0',
  'medium_2_0',
  'large_2_0',
  'xlarge_2_0',
  '2xlarge_2_0',
] as const

export type BundleId = typeof BUNDLE_IDS[number]

export const bundleIdEqualOrLarger = (a: BundleId, b: BundleId) => BUNDLE_IDS.indexOf(a) >= BUNDLE_IDS.indexOf(b)

export function bundleIdFromString(s: string): BundleId
export function bundleIdFromString(s: string, opts: { throwOnError: false }): BundleId | undefined
export function bundleIdFromString(s: string, { throwOnError }: { throwOnError: boolean } = { throwOnError: true }) {
  if (!BUNDLE_IDS.includes(s as BundleId)) {
    if (throwOnError) {
      throw new Error(`Invalid bundleId: ${s}`)
    }
    return undefined
  }
  return s as BundleId
}
