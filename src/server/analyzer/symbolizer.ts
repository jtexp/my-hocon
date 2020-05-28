import { DocumentSymbol, SymbolKind } from 'vscode-languageserver'
import { Position, TextDocument } from 'vscode-languageserver-textdocument'
import { dfs, Node, NodeSequence } from '../parser/basic'
import { ObjectField, RootValue, ValueConcatenation } from '../parser/sequencial'

function getSymbolKind(value: ValueConcatenation): SymbolKind {
  let children = value.children
  while (children.length !== 1 && children[0].type === 'substitution') {
    children = children.length !== 2 ? children[2].children : children[1].children
  }
  const firstChild = children[0]
  switch (firstChild.type) {
    case 'list-value':
    case 'unclosed-list-value':
      return SymbolKind.Array
    case 'object-value':
    case 'unclosed-object-value':
      return SymbolKind.Object
    case 'problem':
      return SymbolKind.String
    case 'primitive':
      if (typeof firstChild.parsed === 'boolean') return SymbolKind.Boolean
      if (typeof firstChild.parsed === 'number') return SymbolKind.Number
      if (firstChild.parsed === null) return SymbolKind.Null
      return SymbolKind.String
    case 'substitution':
      return SymbolKind.Variable
  }
}

export function symbolize(document: TextDocument, ast: RootValue): DocumentSymbol[] {
  const getLastPosition = (node: Node): Position => document.positionAt(node.pos + node.raw.length)
  const stack: { level: number, index: number, children: DocumentSymbol[] }[] = [{ level: -1, index: 0, children: [] }]
  for (const [node, level] of dfs(ast.body)) {
    while (stack[stack.length - 1].level >= level) stack.pop()
    if (node.type === 'object-field') {
      const key = (node as ObjectField).key
      const value = (node as ObjectField).value
      const kind: SymbolKind = getSymbolKind(value)
      let last: Node | NodeSequence = value.children[value.children.length - 1]
      while (last.raw === undefined) last = last.children[last.children.length - 1]
      const end = getLastPosition(last), selectionEnd = getLastPosition(key.children[key.children.length - 1])
      for (const path of key.children) {
        if (path.type !== 'dot') {
          const peek = stack[stack.length - 1]
          const children: DocumentSymbol[] = []
          const startPos = document.positionAt(key.children[0].pos)
          stack.push({ level, children, index: 0 })
          peek.children.push({
            name: path.type === 'problem' ? path.raw : '' + path.parsed, kind, children,
            range: { start: startPos, end }, selectionRange: { start: startPos, end: selectionEnd }
          })
        }
      }
    } else if (node.type === 'concatenation') {
      const peek = stack[stack.length - 1]
      if (peek.level !== level - 1) {
        const children: DocumentSymbol[] = []
        const value = node as ValueConcatenation
        const kind: SymbolKind = getSymbolKind(value)
        let start: Node | NodeSequence = value.children[0]
        while (start.raw === undefined) start = start.children[0]
        let last: Node | NodeSequence = value.children[value.children.length - 1]
        while (last.raw === undefined) last = last.children[last.children.length - 1]
        const startPos = document.positionAt(start.pos), endPos = getLastPosition(last)
        stack.push({ level, children, index: 0 })
        peek.children.push({
          name: '[' + peek.index++ + ']', kind, children,
          range: { start: startPos, end: endPos }, selectionRange: { start: startPos, end: endPos }
        })
      }
    }
  }
  return stack[0].children
}
