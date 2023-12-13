import { describe, it, expect } from '@jest/globals'
import { repeat } from 'lodash-es'
import { envRandomName } from './metadata.js'

describe('metadata', () => {
  describe('envRandomName', () => {
    describe('when given accepted characters', () => {
      const createName = () => envRandomName({ envId: 'myenv12', profileId: 'myprofile13' })
      it('should generate a random name', () => {
        expect(createName()).toMatch(/^myprofile13-myenv12-[a-z0-9]{5}$/)
      })

      it('should suffix it with a random string', () => {
        const names = [createName(), createName()]
        expect(names[0]).not.toEqual(names[1])
      })
    })

    describe('when given banned characters', () => {
      const createName = () => envRandomName({ envId: '1myenv_12', profileId: '1myprofile!13' })
      it('should replace or prefix them as needed', () => {
        expect(createName()).toMatch(/^a1myprofile-13-1myenv-12-[a-z0-9]{5}$/)
      })

      it('should suffix it with a random string', () => {
        const names = [createName(), createName()]
        expect(names[0]).not.toEqual(names[1])
      })
    })

    describe('when given a too long name', () => {
      const createName = () => envRandomName({ envId: repeat('a', 100), profileId: '1myprofile' })
      it('should truncate it to the correct length', () => {
        const name = createName()
        expect(name).toHaveLength(53) // max name length with 10 chars spare
        expect(name).toMatch(/^a1myprofile-a+-[a-z0-9]{5}$/)
      })

      it('should suffix it with a random string', () => {
        const names = [createName(), createName()]
        expect(names[0]).not.toEqual(names[1])
      })
    })
  })
})
