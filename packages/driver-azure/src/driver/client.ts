import { ComputeManagementClient, ImageReference, VirtualMachine } from '@azure/arm-compute'
import { NetworkManagementClient, Subnet } from '@azure/arm-network'
import { GenericResource, ResourceGroup, ResourceManagementClient } from '@azure/arm-resources'
import { StorageManagementClient } from '@azure/arm-storage'
import { DefaultAzureCredential } from '@azure/identity'
import { randomBytes } from 'crypto'
import { asyncFilter, asyncFirst, asyncFlatMap, asyncMap } from 'iter-tools-es'
import {
  AzureCustomTags,
  createNIC,
  createPublicIP,
  createResourceGroup,
  createSecurityGroup,
  createStorageAccount,
  createVirtualMachine,
  createVnet,
  extractResourceGroupNameFromId,
  extractResourceNameFromId,
  findVMImage,
  getIpAddresses,
} from './vm-creation-utils'

// Uncomment to see Azure logs (import @azure/logger)
// setLogLevel('info')
export class AzureResourceNotFound extends Error {
  statusCode = 404
  constructor(message: string) {
    super(`AzureResourceNotFound ${message}`)
    Object.setPrototypeOf(this, AzureResourceNotFound.prototype)
  }

  getErrorMessage() {
    return `Could not find resource: ${this.message}`
  }
}

export const REGIONS = [
  'eastus',
  'eastus2',
  'southcentralus',
  'westus2',
  'westus3',
  'australiaeast',
  'southeastasia',
  'northeurope',
  'swedencentral',
  'uksouth',
  'westeurope',
  'centralus',
  'southafricanorth',
  'centralindia',
  'eastasia',
  'japaneast',
  'koreacentral',
  'canadacentral',
  'francecentral',
  'germanywestcentral',
  'norwayeast',
  'polandcentral',
  'switzerlandnorth',
  'uaenorth',
  'brazilsouth',
  'centraluseuap',
  'eastus2euap',
  'qatarcentral',
]

type VMInstance = {
  vm: VirtualMachine
  publicIPAddress: string
}

export const nameGenerator = (alias: string) => (name: string, prefix = 'preevy') => `${`${prefix}${name}${alias}`.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')
  .substring(0, 16)}${randomBytes(16)
  .toString('hex')
  .substring(0, 8)}`

export const getTags = (profileId: string, envId: string) => ({
  [AzureCustomTags.PROFILE_ID]: profileId,
  [AzureCustomTags.ENV_ID]: envId,
})

export const client = ({
  region,
  subscriptionId,
  profileId,
}: {
  region: string
  subscriptionId: string
  profileId: string
}) => {
  const credentials = new DefaultAzureCredential()
  const resourceClient = new ResourceManagementClient(
    credentials,
    subscriptionId
  )
  const computeClient = new ComputeManagementClient(credentials, subscriptionId)
  const storageClient = new StorageManagementClient(credentials, subscriptionId)
  const networkClient = new NetworkManagementClient(credentials, subscriptionId)
  return {
    deleteResourcesResourceGroup: async (resourceGroupName: string, wait: boolean) => {
      if (wait) {
        await resourceClient.resourceGroups.beginDeleteAndWait(resourceGroupName, {
          forceDeletionTypes: 'Microsoft.Compute/virtualMachines,Microsoft.Compute/virtualMachineScaleSets',
        })
      }
      await resourceClient.resourceGroups.beginDelete(resourceGroupName, {
        forceDeletionTypes: 'Microsoft.Compute/virtualMachines,Microsoft.Compute/virtualMachineScaleSets',
      })
    },
    listResourceGroups: (): AsyncIterableIterator<ResourceGroup> => {
      const filter = `tagName eq '${AzureCustomTags.PROFILE_ID}' and tagValue eq '${profileId}'`
      return resourceClient.resourceGroups.list({ filter })
    },
    listResource: (): AsyncIterableIterator<GenericResource> => {
      const filter = `tagName eq '${AzureCustomTags.PROFILE_ID}' and tagValue eq '${profileId}'`
      return resourceClient.resources.list({ filter })
    },
    listInstances: (): AsyncIterableIterator<VMInstance> => {
      const filter = `tagName eq '${AzureCustomTags.PROFILE_ID}' and tagValue eq '${profileId}'`
      const resourceGroups = resourceClient.resourceGroups.list({ filter })
      const vms = asyncFlatMap(
        rg => computeClient.virtualMachines.list(rg.name as string),
        resourceGroups
      )
      return asyncMap(
        async vm => (
          { vm, ...(await getIpAddresses(networkClient, vm)) }),
        asyncFilter<VirtualMachine>(({ tags, provisioningState }) =>
          tags?.[AzureCustomTags.PROFILE_ID] === profileId && provisioningState !== 'Deleting', vms)
      )
    },
    getInstanceByRg: async (resourceGroup: string) => await asyncFirst(
      asyncFilter(x => x.provisioningState !== 'Deleting', computeClient.virtualMachines.list(resourceGroup))
    )
      .then(async vm => {
        if (vm) {
          const addresses = await getIpAddresses(networkClient, vm)
          return { vm, ...addresses }
        }
        return undefined
      }),
    getInstance: async (envId: string): Promise<VMInstance> => {
      const filter = `tagName eq '${AzureCustomTags.ENV_ID}' and tagValue eq '${envId}'`
      const vmResource = await asyncFirst(asyncFilter(x => x.type === 'Microsoft.Compute/virtualMachines', resourceClient.resources.list({ filter })))
      if (!vmResource?.id) {
        throw new AzureResourceNotFound(`envId: ${envId}`)
      }
      const name = extractResourceNameFromId(vmResource.id)
      const resourceGroupName = extractResourceGroupNameFromId(vmResource.id)
      const vm = await computeClient.virtualMachines.get(resourceGroupName, name)
      if (vm.provisioningState === 'Deleting') {
        throw new AzureResourceNotFound(`current vm instance for envId: ${envId} is deleting`)
      }
      const addresses = await getIpAddresses(networkClient, vm)
      return { vm, ...addresses }
    },
    createVMInstance: async ({
      imageRef,
      sshPublicKey,
      vmSize,
      envId,
    }: {
      sshPublicKey: string
      imageRef: ImageReference
      vmSize: string
      envId: string

    }): Promise<VMInstance> => {
      const availableVmSize = await asyncFirst(
        asyncFilter(size => size.name === vmSize, computeClient.virtualMachineSizes.list(region))
      )
      if (!availableVmSize) {
        throw new Error(`Size ${vmSize} isn't supported for location ${region}`)
      }
      const generateId = nameGenerator(envId)
      const vmName = generateId('vm')
      const resourceGroupName = generateId('rg')
      const storageAccountName = generateId('storage')
      const vnetName = generateId('vet')
      const subnetName = generateId('subnet')
      const publicIPName = generateId('pip')
      const networkInterfaceName = generateId('nic')
      const ipConfigName = generateId('ipc')
      const domainNameLabel = generateId('domain')
      const osDiskName = generateId('osdisk')
      const nsgName = generateId('nsg')
      const securityRuleName = generateId('sr')
      const tags = getTags(profileId, envId)

      void await createResourceGroup(resourceGroupName, region, tags, resourceClient)
      void await createStorageAccount(
        storageAccountName,
        region,
        resourceGroupName,
        tags,
        storageClient
      )
      const vnetInfo = await createVnet(
        tags,
        vnetName,
        region,
        subnetName,
        resourceGroupName,
        networkClient
      )
      const securityGroup = await createSecurityGroup(
        tags,
        vnetName,
        securityRuleName,
        resourceGroupName,
        nsgName,
        region,
        networkClient
      )
      const publicIPInfo = await createPublicIP(
        tags,
        publicIPName,
        region,
        resourceGroupName,
        domainNameLabel,
        networkClient
      )
      const nic = await createNIC(
        tags,
        vnetInfo.subnets?.find(s => s.name === subnetName) as Subnet,
        publicIPInfo,
        networkInterfaceName,
        region,
        ipConfigName,
        resourceGroupName,
        securityGroup,
        networkClient
      )
      const vmImageInfo = await findVMImage(region, imageRef, computeClient)

      if (!nic.id || !vmImageInfo?.name || !publicIPInfo.name) {
        throw new Error(`Could not create vm, missing properties, nic id: ${nic.id} , image name: ${vmImageInfo?.name}, public IP name: ${publicIPInfo.name}`)
      }
      const vm = await createVirtualMachine(tags, nic.id, {
        ...imageRef,
        version: vmImageInfo.name,
      }, osDiskName, vmName, region, resourceGroupName, computeClient, sshPublicKey, securityGroup.id as string, vmSize)
      const publicIPAddress = await networkClient.publicIPAddresses.get(resourceGroupName, publicIPInfo.name)
      if (!publicIPAddress.ipAddress) {
        throw new Error('Could not get public ip address')
      }
      return {
        vm,
        publicIPAddress: publicIPAddress.ipAddress,
      }
    },
  }
}

export type Client = ReturnType<typeof client>
