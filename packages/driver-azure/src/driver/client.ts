import { ComputeManagementClient, ImageReference, VirtualMachine } from '@azure/arm-compute'
import { NetworkManagementClient, Subnet } from '@azure/arm-network'
import { ResourceManagementClient } from '@azure/arm-resources'
import { StorageManagementClient } from '@azure/arm-storage'
import { DefaultAzureCredential } from '@azure/identity'
import { randomBytes } from 'crypto'
import { asyncFilter, asyncMap } from 'iter-tools-es'
import {
  createNIC,
  createPublicIP,
  createResourceGroup,
  createSecurityGroup,
  createStorageAccount,
  createVirtualMachine,
  createVnet, extractResourceGroupNameFromId,
  findVMImage,
  getIpAddresses,
  getResourceGroupName,
  getTags,
  getVmName,
} from './vm-creation-utils'

// Uncomment to see Azure logs (import @azure/logger)
// setLogLevel('info')

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
  privateIPAddress: string
  vm: VirtualMachine
  publicIPAddress: string
}

export const nameGenerator = (alias: string) => (name: string, prefix = 'preevy') => `${`${prefix}${alias.replace(/[^a-zA-Z0-9]/g, '')}${name}`.toLowerCase()
  .substring(0, 16)}${randomBytes(16)
  .toString('hex')
  .substring(0, 8)}`

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
    deleteInstance: async (vmId: string, wait: boolean) => {
      const resourceGroupName = extractResourceGroupNameFromId(vmId)
      if (wait) {
        await resourceClient.resourceGroups.beginDeleteAndWait(resourceGroupName, {
          forceDeletionTypes: 'Microsoft.Compute/virtualMachines,Microsoft.Compute/virtualMachineScaleSets',
        })
      }
      await resourceClient.resourceGroups.beginDelete(resourceGroupName, {
        forceDeletionTypes: 'Microsoft.Compute/virtualMachines,Microsoft.Compute/virtualMachineScaleSets',
      })
    },
    listInstances: (): AsyncIterableIterator<VMInstance> =>
      asyncMap(
        async vm => (
          { vm, ...(await getIpAddresses(networkClient, vm)) }),
        asyncFilter<VirtualMachine>(({ tags }) =>
          tags?.profile === profileId, computeClient.virtualMachines.listAll())
      ),

    getInstance: async (envId: string): Promise<VMInstance> => {
      const name = getVmName(envId)
      const resourceGroupName = getResourceGroupName(envId)
      const vm = await computeClient.virtualMachines.get(resourceGroupName, name)
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
      const generateId = nameGenerator(envId)
      const vmName = getVmName(envId)
      const resourceGroupName = getResourceGroupName(envId)
      const storageAccountName = generateId('storage')
      const vnetName = generateId('vet')
      const subnetName = generateId('subnet')
      const publicIPName = generateId('pip')
      const networkInterfaceName = generateId('nic')
      const ipConfigName = generateId('ipc')
      const domainNameLabel = generateId('domain')
      const osDiskName = generateId('osdisk')
      const nsgName = generateId('networksecuritygroup')
      const securityRuleName = generateId('securityrule')
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

      if (!nic.id || !vmImageInfo?.name || !publicIPInfo.name || !nic.ipConfigurations?.[0].privateIPAddress) {
        throw new Error('Could not create vm, missing properties')
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
        privateIPAddress: nic.ipConfigurations[0].privateIPAddress,
        publicIPAddress: publicIPAddress.ipAddress,
      }
    },
  }
}
