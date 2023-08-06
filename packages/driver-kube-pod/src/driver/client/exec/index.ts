import { Writable } from 'stream'
import * as k8s from '@kubernetes/client-node'
import { Logger } from '@preevy/core'
import { ProcessOutputBuffers } from '@preevy/common'
import { BaseExecOpts } from './common'
import apiExec from './api'
import kubectlExec from './kubectl'

export { BaseExecOpts } from './common'

export default (
  { kubeconfigLocation, kubeConfig, namespace, log }: {
    kubeconfigLocation?: string
    namespace: string
    kubeConfig: k8s.KubeConfig
    log: Logger },
) => {
  const kExec = kubectlExec({ kubeconfigLocation, namespace, context: kubeConfig.getCurrentContext() })
  const aExec = apiExec({ namespace, k8sExec: new k8s.Exec(kubeConfig), log })
  function exec(opts: BaseExecOpts & { stdout: Writable; stderr: Writable }): Promise<{ code: number }>
  function exec(opts: BaseExecOpts): Promise<{ code: number; output: ProcessOutputBuffers }>
  function exec(
    opts: BaseExecOpts & { stdout?: Writable; stderr?: Writable },
  ): Promise<{ code: number; output?: ProcessOutputBuffers }> {
    return (opts.stdin ? kExec : aExec)(opts)
  }

  return exec
}
