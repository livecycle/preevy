import { describe, it, expect, beforeEach } from '@jest/globals'
import pinoPretty from 'pino-pretty'
import { Logger, pino } from 'pino'
import { ActiveTunnel, ActiveTunnelStore, TransactionDescriptor, inMemoryActiveTunnelStore } from '.'

describe('inMemoryActiveTunnelStore', () => {
  let store: ActiveTunnelStore
  let log: Logger

  beforeEach(() => {
    log = pino({ level: 'debug' }, pinoPretty())
    store = inMemoryActiveTunnelStore({ log })
  })

  describe('when setting a new key', () => {
    let desc: TransactionDescriptor
    let val: ActiveTunnel
    beforeEach(async () => {
      val = { publicKeyThumbprint: 'pk1' } as ActiveTunnel
      desc = await store.set('foo', val)
    })

    it('returns a descriptor', async () => {
      expect(desc).toBeDefined()
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
      beforeEach(async () => {
        gotVal = await store.get('foo')
      })

      it('returns the value', () => {
        expect(gotVal).toBe(val)
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
      beforeEach(async () => {
        await store.delete('bar')
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
      beforeEach(async () => {
        await store.delete('foo')
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
      beforeEach(async () => {
        await store.delete('foo', desc)
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
      beforeEach(async () => {
        await store.delete('foo', { txId: -1 })
      })

      describe('when getting the key', () => {
        let gotVal: ActiveTunnel | undefined
        beforeEach(async () => {
          gotVal = await store.get('foo')
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
  })
})
