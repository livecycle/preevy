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
  ImageReference, Resource,
  VirtualMachine,
  VirtualMachineImageResource,
} from '@azure/arm-compute'
import { StorageManagementClient } from '@azure/arm-storage'

export const getTags = (profileId: string, envId: string) => ({
  profile: profileId,
  envId,
  client: 'preevy',
})
export async function createResourceGroup(
  resourceGroupName: string,
  location: string,
  tags: Resource['tags'],
  resourceClient: ResourceManagementClient
) {
  const groupParameters = {
    location,
    tags,
  }
  return resourceClient.resourceGroups.createOrUpdate(
    resourceGroupName,
    groupParameters
  )
}

export async function createStorageAccount(
  storageAccountName: string,
  location: string,
  resourceGroupName: string,
  tags: Resource['tags'],
  storageClient: StorageManagementClient,
  storageAccountType = 'Standard_LRS',
) {
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

export async function createVnet(
  tags: Resource['tags'],
  vnetName: string,
  location: string,
  subnetName: string,
  resourceGroupName: string,
  networkClient: NetworkManagementClient
) {
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

export async function createSecurityGroup(
  tags: Resource['tags'],
  vnetName: string,
  securityRuleName: string,
  resourceGroupName: string,
  nsgName: string,
  location: string,
  networkClient: NetworkManagementClient
) {
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

export async function getSubnetInfo(
  subnetName: string,
  resourceGroupName: string,
  vnetName: string,
  networkClient: NetworkManagementClient
) {
  return networkClient.subnets.get(
    resourceGroupName,
    vnetName,
    subnetName
  )
}

export async function createPublicIP(
  tags: Resource['tags'],
  publicIPName: string,
  location: string,
  resourceGroupName: string,
  domainNameLabel: string,
  networkClient: NetworkManagementClient
) {
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

export async function createNIC(
  tags: Resource['tags'],
  subnetInfo: Subnet,
  publicIPInfo: PublicIPAddress,
  networkInterfaceName: string,
  location: string,
  ipConfigName: string,
  resourceGroupName: string,
  nsg: NetworkSecurityGroup,
  networkClient: NetworkManagementClient
) {
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

export async function findVMImage(location: string, imageRef: ImageReference, computeClient: ComputeManagementClient) {
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

export async function getNICInfo(
  resourceGroupName: string,
  networkInterfaceName: string,
  networkClient: NetworkManagementClient
) {
  return networkClient.networkInterfaces.get(
    resourceGroupName,
    networkInterfaceName
  )
}

export async function createVirtualMachine(tags: Resource['tags'], nicId: string, imageRef: ImageReference, osDiskName: string, vmName: string, location: string, resourceGroupName: string, computeClient: ComputeManagementClient, sshPublicKey: string, networkSecurityGroupId: string, vmSize = 'Standard_B2s', adminUsername = 'preevy') {
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
