const { isArray, mergeWith, cloneDeep } = require('lodash')

const customizer = (objValue, srcValue) => {
  if (isArray(srcValue) && isArray(objValue)) {
    return objValue.concat(srcValue)
  }
}

module.exports = (object, ...sources) => mergeWith(cloneDeep(object), ...sources, customizer)
