type RootObjectDetailsError = {
  code: string
  message: string
}
type RootObjectDetails = {
  error: RootObjectDetailsError
}

export type AzureErrorResponse = {
  details: RootObjectDetails
  name: string
  code: string
  statusCode: number
  message: string
}
