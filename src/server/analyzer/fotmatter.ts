import { FormattingOptions, Range, TextEdit } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { dfs, toDebugOutput } from '../parser/basic'
import { MultilineSpace, RootValue } from '../parser/sequencial'

export function formatRange(options: FormattingOptions, range: Range, document: TextDocument, ast: RootValue): TextEdit[] {
  console.log(options, range, document, toDebugOutput(ast)) // TODO
  return []
}

export function format(options: FormattingOptions, document: TextDocument, ast: RootValue): TextEdit[] {
  const edits: TextEdit[] = []
  const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t'
  const commentRegexp = /^(#|\/\/)(?!!)([\u00a0\u2007\u202f\ufeff]|[^\n\S])*/ // shebang
  const stack: { level: number, indent: string, isHead: boolean, prevSpaces?: TextEdit }[] = []
  for (const [node, level] of dfs(ast.isWrapped ? ast : ast.body)) {
    while ((stack[stack.length - 1]?.level ?? -1) >= level) stack.pop()
    const lastIndex = stack.length - 1, peek = stack[lastIndex]
    if (level - 1 === peek?.level) {
      if (node.type === 'multiline-space') for (const space of (node as MultilineSpace).children) {
        const accumulatedIndent = ''.concat(...stack.map((elem, index) => index === lastIndex ? '' : elem.indent))
        if (space.type === 'new-line') {
          if (peek.prevSpaces !== undefined) peek.prevSpaces.newText = ''.concat(...stack.map(elem => elem.indent))
          const start = document.positionAt(space.pos + space.raw.length), end = start
          const edit = { range: { start, end }, newText: accumulatedIndent }
          peek.indent = level > 1 ? indent : ''
          peek.prevSpaces = edit
          peek.isHead = true
          edits.push(edit)
        } else if (space.type === 'comment') {
          const start = document.positionAt(space.pos), end = document.positionAt(space.pos + space.raw.length)
          const newText: string = space.raw.replace(commentRegexp, peek.isHead ? '$1 ' : ' $1 ')
          edits.push({ range: { start, end }, newText })
          peek.isHead = false
        } else {
          const start = document.positionAt(space.pos), end = document.positionAt(space.pos + space.raw.length)
          edits.push({ range: { start, end }, newText: '' })
        }
      } else {
        if (node.type !== 'comma' && node.type !== 'colon') {
          let firstChildNode = node
          if (!peek.isHead) {
            while (firstChildNode.raw === undefined) firstChildNode = firstChildNode.children[0]
            const start = document.positionAt(firstChildNode.pos), end = start
            edits.push({ range: { start, end }, newText: ' ' })
          }
        }
        peek.isHead = false
      }
    }
    if (['root-value', 'object-body', 'list-body', 'object-field'].indexOf(node.type) > 0) {
      stack.push({ level, indent: '', isHead: true })
    }
  }
  return edits
}
