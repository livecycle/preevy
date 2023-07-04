import * as k8s from '@kubernetes/client-node'

// expose the protected method `specUriPath` in a type-safe way
class KubernetesObjectApiExtended extends k8s.KubernetesObjectApi {
  public objectKindUrl(s: k8s.KubernetesObject) {
    return this.specUriPath(s, 'create')
  }

  public objectInstanceUrl(s: k8s.KubernetesObject) {
    return this.specUriPath(s, 'read')
  }
}

const objectKindUrl = (
  client: k8s.KubernetesObjectApi,
) => KubernetesObjectApiExtended.prototype.objectKindUrl.bind(client)

export default objectKindUrl
