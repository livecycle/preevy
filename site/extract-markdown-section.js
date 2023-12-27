const { inspect } = require('util')
const { resolve } = require('path')
const regex = /{@import +([^ ]+)( +(.+))?} *$/;

const findText = e => {
  if (!e) return undefined
  if (e.type === 'text') return e.value
  return findText(e.children?.[0])
}

const extractSection = (nodes, section) => {
  if (section === undefined) {
    return nodes
  }

  const pred = typeof section === 'string' ? (t => t === section) : (t => t.test(section))
  const startIndex = nodes.findIndex(n => n.type === 'heading' && pred(findText(n)))
  if (startIndex === -1) {
    throw new Error(`Cannot find section ${section} in: ${inspect(nodes.find(n => n.type === 'heading').map(findText))}`)
  }

  const endIndex = nodes.findIndex((n, i) => i > startIndex && n.type === 'heading' && n.depth <= nodes[startIndex].depth)
  return nodes.slice(startIndex + 1, endIndex !== -1 ? endIndex : undefined)
}

const parseImportSection = (s) => {
  const m = /^\/(.+)\//.exec(s)
  if (!m) {
    return s
  }
  return new RegExp(m[1])
}

async function asyncFlatMap(ast, fn) {
  async function transform(node, index, parent) {
    if (node.children) {
      var out = []
      for (var i = 0, n = node.children.length; i < n; i++) {
        var xs = await transform(node.children[i], i, node)
        if (xs?.length) {
          for (var j = 0, m = xs.length; j < m; j++) {
            out.push(xs[j])
          }
        }
      }
      node.children = out
    }

    const fnResult = await fn(node, index, parent)
    return fnResult
  }

  const result = (await transform(ast, 0, null))[0]
  return result
}

module.exports = function importPlugin() {
  return async function transformer(tree, file) {
    const { remark } = await import('remark')
    const { read } = await import('to-vfile')
    return await asyncFlatMap(tree, async node => {
      if (node.type !== 'paragraph') return [node]
      const matches = node.children?.[0].value?.match(regex)
      if (!matches) {
        return [node]
      }
      const [, filePath, , section] = matches

      const fileAbsPath = resolve(file.dirname, filePath);

      const vFile = await read(fileAbsPath, 'utf-8').catch(e => {
        throw new Error(
          `Unable to locate @import file in path: ${fileAbsPath}: ${e.message}`,
          { cause: e },
        );
      })

      const processor = remark()
      processor.use(importPlugin)

      try {
        let ast = processor.parse(vFile)
        if (section) {
          ast.children = extractSection(ast.children, parseImportSection(section))
        }
        const result = (await processor.run(ast, vFile)).children
        return result
      } catch (e) {
        throw new Error(
          `Unable to parse @import file in ${file}: import: ${fileAbsPath}: ${e.message}`,
          { cause: e }
        );
      }
    })
  };
};
