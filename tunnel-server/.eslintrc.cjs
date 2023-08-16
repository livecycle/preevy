const deepMerge = require('../build_utils/deep_merge')

module.exports = deepMerge(require('../build_utils/eslintrc'), {
  rules: {
    'no-underscore-dangle': [
      'warn',
      {
        'allow': [
          '__dirname',
          '__REDUX_DEVTOOLS_EXTENSION_COMPOSE__'
        ],
        'allowAfterThis': false,
        'allowAfterSuper': false,
        'enforceInMethodNames': true,
        'allowAfterThisConstructor': false,
        'allowFunctionParams': true,
        'enforceInClassFields': false,
        'allowInArrayDestructuring': true,
        'allowInObjectDestructuring': true
      },
    ],
  }
})
