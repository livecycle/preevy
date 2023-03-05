const deep_merge = require('../../build_utils/deep_merge.js')

module.exports = deep_merge(
  require('../../.eslintrc.js'),
  {
    rules: {
      'no-console': [0]
    },
  },
)
