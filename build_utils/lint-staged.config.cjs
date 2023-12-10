module.exports = {
  '**/*.ts?(x)': () => ['eslint --cache --fix', 'tsc --noEmit'],
}
