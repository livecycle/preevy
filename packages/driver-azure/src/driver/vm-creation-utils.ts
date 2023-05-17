import {
  NetworkInterface,
  NetworkManagementClient,
  NetworkSecurityGroup,
  PublicIPAddress,
  SecurityRule,
  Subnet,
  VirtualNetwork,
} from '@azure/arm-network'
import { ResourceManagementClient } from '@azure/arm-resources'
import {
  ComputeManagementClient,
  ImageReference,
  Resource,
  VirtualMachine,
  VirtualMachineImageResource,
} from '@azure/arm-compute'
import { StorageManagementClient } from '@azure/arm-storage'

export const getTags = (profileId: string, envId: string) => ({
  profile: profileId,
  envId,
  client: 'preevy',
})
export const createResourceGroup = async (
  resourceGroupName: string,
  location: string,
  tags: Resource['tags'],
  resourceClient: ResourceManagementClient
) => {
  const groupParameters = {
    location,
    tags,
  }
  return resourceClient.resourceGroups.createOrUpdate(
    resourceGroupName,
    groupParameters
  )
}

export const createStorageAccount = async (
  storageAccountName: string,
  location: string,
  resourceGroupName: string,
  tags: Resource['tags'],
  storageClient: StorageManagementClient,
  storageAccountType = 'Standard_LRS',
) => {
  const createParameters = {
    location,
    sku: {
      name: storageAccountType,
    },
    kind: 'Storage',
    tags,
  }
  return storageClient.storageAccounts.beginCreateAndWait(
    resourceGroupName,
    storageAccountName,
    createParameters
  )
}

export const createVnet = async (
  tags: Resource['tags'],
  vnetName: string,
  location: string,
  subnetName: string,
  resourceGroupName: string,
  networkClient: NetworkManagementClient
) => {
  const vnetParameters: VirtualNetwork = {
    tags,
    location,
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16'],
    },
    subnets: [{
      name: subnetName,
      addressPrefix: '10.0.0.0/24',
    }],
  }
  return networkClient.virtualNetworks.beginCreateOrUpdateAndWait(
    resourceGroupName,
    vnetName,
    vnetParameters
  )
}

export const createSecurityGroup = async (
  tags: Resource['tags'],
  vnetName: string,
  securityRuleName: string,
  resourceGroupName: string,
  nsgName: string,
  location: string,
  networkClient: NetworkManagementClient
) => {
  const securityRuleParameters: SecurityRule = {
    protocol: 'tcp',
    sourcePortRange: '*',
    destinationPortRange: '22',
    sourceAddressPrefix: '*',
    destinationAddressPrefix: '*',
    access: 'Allow',
    priority: 300,
    direction: 'Inbound',
    name: securityRuleName,
  }

  return networkClient.networkSecurityGroups.beginCreateOrUpdateAndWait(resourceGroupName, nsgName, {
    location,
    tags,
    securityRules: [securityRuleParameters],
  })
}

export const createPublicIP = async (
  tags: Resource['tags'],
  publicIPName: string,
  location: string,
  resourceGroupName: string,
  domainNameLabel: string,
  networkClient: NetworkManagementClient
) => {
  const publicIPParameters: PublicIPAddress = {
    location,
    publicIPAllocationMethod: 'Dynamic',
    dnsSettings: {
      domainNameLabel,
    },
    tags,
  }
  return networkClient.publicIPAddresses.beginCreateOrUpdateAndWait(
    resourceGroupName,
    publicIPName,
    publicIPParameters
  )
}

export const createNIC = async (
  tags: Resource['tags'],
  subnetInfo: Subnet,
  publicIPInfo: PublicIPAddress,
  networkInterfaceName: string,
  location: string,
  ipConfigName: string,
  resourceGroupName: string,
  nsg: NetworkSecurityGroup,
  networkClient: NetworkManagementClient
) => {
  const nicParameters: NetworkInterface = {
    location,
    ipConfigurations: [
      {
        name: ipConfigName,
        privateIPAllocationMethod: 'Dynamic',
        subnet: subnetInfo,
        publicIPAddress: publicIPInfo,
      },
    ],
    tags,
    networkSecurityGroup: nsg,
  }
  return networkClient.networkInterfaces.beginCreateOrUpdateAndWait(
    resourceGroupName,
    networkInterfaceName,
    nicParameters
  )
}

export const findVMImage = async (
  location: string,
  imageRef: ImageReference,
  computeClient: ComputeManagementClient
) => {
  if (!imageRef.sku || !imageRef.offer || !imageRef.publisher) {
    throw new Error('Missing required image reference parameters')
  }
  return computeClient.virtualMachineImages.list(
    location,
    imageRef.publisher,
    imageRef.offer,
    imageRef.sku
  )
    .then((images: Array<VirtualMachineImageResource>) => images.find(x => x.name))
}

export const getNicInfo = async (
  resourceGroupName: string,
  networkInterfaceName: string,
  networkClient: NetworkManagementClient
) => networkClient.networkInterfaces.get(
  resourceGroupName,
  networkInterfaceName
)

export const createVirtualMachine = async (tags: Resource['tags'], nicId: string, imageRef: ImageReference, osDiskName: string, vmName: string, location: string, resourceGroupName: string, computeClient: ComputeManagementClient, sshPublicKey: string, networkSecurityGroupId: string, vmSize = 'Standard_B2s', adminUsername = 'preevy') => {
  const vmParameters: VirtualMachine = {
    location,
    tags: { ...tags, preevyVm: resourceGroupName },
    osProfile: {
      computerName: vmName,
      adminUsername,
      linuxConfiguration: {
        ssh: {
          publicKeys: [
            {
              path: `/home/${adminUsername}/.ssh/authorized_keys`,
              keyData: sshPublicKey,
            },
          ],
        },
      },
    },
    hardwareProfile: {
      vmSize,
    },
    storageProfile: {
      imageReference: imageRef,
      osDisk: {
        name: osDiskName,
        caching: 'None',
        createOption: 'fromImage',
        diskSizeGB: 32,
        managedDisk: {
          storageAccountType: 'StandardSSD_LRS',
        },
      },
    },
    networkProfile: {
      networkInterfaces: [
        {
          id: nicId,
          primary: true,
        },
      ],
    },
  }
  return computeClient.virtualMachines.beginCreateOrUpdateAndWait(
    resourceGroupName,
    vmName,
    vmParameters
  )
}
export const getVmName = (envId: string) => `vm${envId.replace(/[^a-zA-Z0-9]/g, '')}}`
export const getResourceGroupName = (envId: string) => `preevy-${envId}`
export const extractResourceNameFromId = (rId: string) => {
  const name = rId.split('/')
    .at(-1)
  if (!name) {
    throw new Error(`Could not extract resource name from id ${rId}`)
  }
  return name
}
export const extractResourceGroupNameFromId = (rId: string) => {
  const resourceGroupName = rId.split('/')[4]
  if (!resourceGroupName) {
    throw new Error(`Could not extract resource group name from id ${rId}`)
  }
  return rId.split('/')[4]
}
export const getIpAddresses = async (networkClient: NetworkManagementClient, vm: VirtualMachine) => {
  if (!vm.id || !vm.networkProfile?.networkInterfaces?.[0].id) {
    throw new Error('Network interface configuration not found')
  }
  const resourceGroupName = extractResourceGroupNameFromId(vm.id)
  const nicName = extractResourceNameFromId(vm.networkProfile.networkInterfaces[0].id)
  const nic = await getNicInfo(resourceGroupName, nicName, networkClient)
  if (!nic.ipConfigurations?.[0].publicIPAddress?.id) {
    throw new Error('publicIPAddress configuration not found')
  }
  const publicIPName = nic.ipConfigurations[0].publicIPAddress.id.split('/')
    .at(-1) as string
  const publicIPAddress = await networkClient.publicIPAddresses.get(resourceGroupName, publicIPName)
  if (!publicIPAddress.ipAddress || !nic.ipConfigurations?.[0].privateIPAddress) {
    throw new Error('ipAddress not found')
  }
  return {
    privateIPAddress: nic.ipConfigurations[0].privateIPAddress,
    publicIPAddress: publicIPAddress.ipAddress,
  }
}
