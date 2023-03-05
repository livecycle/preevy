import retry from 'p-retry';
import { Logger } from "../../../log";
import { MachineDriver, scripts } from "../../machine";
import { nodeSshClient, SshClient } from "../../ssh/client";
import { NamedSshKeyPair } from "../../ssh/keypair";
import { TunnelOpts } from "../../ssh/url";
import { PersistentState } from "../../state";
import { scriptExecuter } from "./scripts";

const ensureMachine = async ({
  machineDriver,
  envId,
  state,
  log,
}: {
  machineDriver: MachineDriver,
  envId: string,
  state: PersistentState,
  log: Logger,
}) => {
  const getFirstExistingKeyPair = async () => {
    for await (const keyPairName of machineDriver.listKeyPairs()) {
      const keyPair = await state.sshKeys.read(keyPairName)
      if (keyPair) {
        return Object.assign(keyPair, { name: keyPairName })
      }
    }
    return undefined
  }

  const createAndWriteKeyPair = async (): Promise<NamedSshKeyPair> => {
    log.info(`Creating key pair`)
    const keyPair = await machineDriver.createKeyPair({ envId })
    await state.sshKeys.write(keyPair.name, keyPair)
    return keyPair
  }

  const existingMachine = await machineDriver.getMachine({ envId })

  if (existingMachine) {
    const keyPair = await state.sshKeys.read(existingMachine.sshKeyName)
    if (keyPair) {
      return { machine: existingMachine, keyPair, installed: true }
    }

    log.info(`No matching key pair found for ${existingMachine.sshKeyName}, recreating machine`)
    machineDriver.removeMachine(existingMachine.providerId)
  }

  log.info(`Fetching key pair`)
  const keyPair = (await getFirstExistingKeyPair()) || (await createAndWriteKeyPair())
  log.info(`Creating machine`)
  const machine = await machineDriver.createMachine({ envId, keyPairName: keyPair.name })

  return { machine, keyPair, installed: machine.fromSnapshot }
}

export const ensureCustomizedMachine = async ({
  machineDriver,
  envId,
  state,
  log,
}: {
  machineDriver: MachineDriver,
  envId: string,
  state: PersistentState,
  log: Logger,
}) => {
  const { machine, keyPair, installed } = await ensureMachine({ machineDriver, envId, state, log })

  const sshClient = await retry(() => nodeSshClient({
    host: machine.publicIPAddress,
    username: machine.sshUsername,
    privateKey: keyPair.privateKey.toString('utf-8'),
    log,
  }), { minTimeout: 2000, maxTimeout: 5000, retries: 10 })

  try {
    const execScript = scriptExecuter({ sshClient, log })

    if (!installed) {
      log.debug('Executing machine scripts')
      for (const script of scripts.CUSTOMIZE_BARE_MACHINE) {
        await execScript(script)
      }
      log.info('Creating snapshot')
      await machineDriver.ensureMachineSnapshot({ providerId: machine.providerId, envId })
    }

    log.debug('Executing instance-specific scripts')

    for (const script of scripts.INSTANCE_SPECIFIC) {
      await execScript(script)
    }
  } catch(e) {
    sshClient.dispose()
    throw e
  }

  return { machine, keyPair, sshClient }
}
