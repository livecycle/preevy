import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import pinoPretty from 'pino-pretty'
import { Level, Logger, pino } from 'pino'
import { nextTick } from 'process'
import { ActiveTunnel, ActiveTunnelStore, inMemoryActiveTunnelStore } from './index.js'
import { EntryWatcher, TransactionDescriptor } from '../memory-store.js'

describe('inMemoryActiveTunnelStore', () => {
  let store: ActiveTunnelStore
  let log: Logger<Level>

  beforeEach(() => {
    log = pino(
      { level: 'silent' },

      // @ts-ignore
      pinoPretty(),
    )
    store = inMemoryActiveTunnelStore({ log })
  })

  describe('when setting a new key', () => {
    let tx: TransactionDescriptor
    let val: ActiveTunnel
    let watcher: EntryWatcher
    beforeEach(async () => {
      val = { publicKeyThumbprint: 'pk1' } as ActiveTunnel
      const setResult = await store.set('foo', val)
      tx = setResult.tx
      watcher = setResult.watcher
    })

    it('returns a descriptor', async () => {
      expect(tx).toBeDefined()
    })

    it('returns a watcher', async () => {
      expect(watcher).toBeDefined()
    })

    describe('when getting a non-existant key', () => {
      it('returns undefined', async () => {
        expect(await store.get('bar')).toBeUndefined()
      })
    })

    describe('when getting a non-existing value by thumbprint', () => {
      let gotValAr: readonly ActiveTunnel[] | undefined
      beforeEach(async () => {
        gotValAr = await store.getByPkThumbprint('pk2')
      })

      it('returns undefined', () => {
        expect(gotValAr).toBeUndefined()
      })
    })

    describe('when getting the key', () => {
      let gotVal: ActiveTunnel | undefined
      let gotWatcher: EntryWatcher | undefined
      beforeEach(async () => {
        const getResult = await store.get('foo')
        gotVal = getResult?.value
        gotWatcher = getResult?.watcher
      })

      it('returns the value', () => {
        expect(gotVal).toBe(val)
      })

      it('returns a watcher', () => {
        expect(gotWatcher).toBeDefined()
      })
    })

    describe('when getting an existing value by thumbprint', () => {
      let gotValAr: readonly ActiveTunnel[] | undefined
      beforeEach(async () => {
        gotValAr = await store.getByPkThumbprint('pk1')
      })

      it('returns the value', () => {
        expect(gotValAr).toHaveLength(1)
        expect(gotValAr).toContain(val)
      })
    })

    describe('when deleting a non-existant value', () => {
      let deleteResult: boolean
      beforeEach(async () => {
        deleteResult = await store.delete('bar')
      })

      it('returns false', () => {
        expect(deleteResult).toBe(false)
      })

      describe('when getting a non-existing value by thumbprint', () => {
        let gotValAr: readonly ActiveTunnel[] | undefined
        beforeEach(async () => {
          gotValAr = await store.getByPkThumbprint('pk2')
        })

        it('returns undefined', () => {
          expect(gotValAr).toBeUndefined()
        })
      })

      describe('when getting an existing value by thumbprint', () => {
        let gotValAr: readonly ActiveTunnel[] | undefined
        beforeEach(async () => {
          gotValAr = await store.getByPkThumbprint('pk1')
        })

        it('returns the value', () => {
          expect(gotValAr).toHaveLength(1)
          expect(gotValAr).toContain(val)
        })
      })
    })

    describe('when deleting an existing value without a tx arg', () => {
      let deleteResult: boolean
      beforeEach(async () => {
        deleteResult = await store.delete('foo')
      })

      it('returns true', () => {
        expect(deleteResult).toBe(true)
      })

      describe('when getting the deleted key', () => {
        it('returns undefined', async () => {
          expect(await store.get('foo')).toBeUndefined()
        })
      })

      describe('when getting a the deleted value by thumbprint', () => {
        let gotValAr: readonly ActiveTunnel[] | undefined
        beforeEach(async () => {
          gotValAr = await store.getByPkThumbprint('pk1')
        })

        it('returns undefined', () => {
          expect(gotValAr).toBeUndefined()
        })
      })
    })

    describe('when deleting an existing value with a correct tx arg', () => {
      let deleteResult: boolean
      beforeEach(async () => {
        deleteResult = await store.delete('foo', tx)
      })

      it('returns true', () => {
        expect(deleteResult).toBe(true)
      })

      describe('when getting the deleted key', () => {
        it('returns undefined', async () => {
          expect(await store.get('foo')).toBeUndefined()
        })
      })

      describe('when getting a the deleted value by thumbprint', () => {
        let gotValAr: readonly ActiveTunnel[] | undefined
        beforeEach(async () => {
          gotValAr = await store.getByPkThumbprint('pk1')
        })

        it('returns undefined', () => {
          expect(gotValAr).toBeUndefined()
        })
      })
    })

    describe('when deleting an existing value with an incorrect tx arg', () => {
      let deleteResult: boolean
      beforeEach(async () => {
        deleteResult = await store.delete('foo', { txId: -1 })
      })

      it('returns false', () => {
        expect(deleteResult).toBe(false)
      })

      describe('when getting the key', () => {
        let gotVal: ActiveTunnel | undefined
        beforeEach(async () => {
          gotVal = (await store.get('foo'))?.value
        })

        it('returns the value', () => {
          expect(gotVal).toBe(val)
        })
      })

      describe('when getting the value by thumbprint', () => {
        let gotValAr: readonly ActiveTunnel[] | undefined
        beforeEach(async () => {
          gotValAr = await store.getByPkThumbprint('pk1')
        })

        it('returns the value', () => {
          expect(gotValAr).toHaveLength(1)
          expect(gotValAr).toContain(val)
        })
      })
    })

    describe('when watching an item', () => {
      let deleteListener: jest.Mock<() => void>
      beforeEach(() => {
        deleteListener = jest.fn<() => void>()
        watcher.once('delete', deleteListener)
      })

      describe('when deleting the item', () => {
        beforeEach(async () => {
          await store.delete('foo')
          await new Promise(nextTick)
        })

        it('calls the delete listener on the next tick', () => {
          expect(deleteListener).toHaveBeenCalled()
        })
      })

      describe('when another item is in the store', () => {
        beforeEach(async () => {
          await store.set('bar', { publicKeyThumbprint: 'pk2' } as ActiveTunnel)
        })

        describe('when deleting the other item', () => {
          beforeEach(async () => {
            await store.delete('bar')
            await new Promise(nextTick)
          })

          it("does not call the first item's delete listener on the next tick", () => {
            expect(deleteListener).not.toHaveBeenCalled()
          })
        })
      })
    })
  })
})
