module.exports = {
  '**/*.ts?(x)': () => ['eslint --cache --fix --max-warnings=0', 'tsc --noEmit'],
}
