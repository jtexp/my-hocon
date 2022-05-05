import { FormattingOptions, TextEdit } from 'vscode-languageserver'
import { TextDocument, Range } from 'vscode-languageserver-textdocument'
import { dfs } from '../parser/basic'
import { MultilineSpace, RootValue } from '../parser/sequential'

interface Addition {
  newText: string,
  start: number
}

interface Deletion {
  oldText: string,
  start: number
}

export function format(options: FormattingOptions, document: TextDocument, ast: RootValue): TextEdit[] {
  const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t'
  const additions: Map<number, Addition[]> = new Map(), deletions: Deletion[] = []
  const commentRegexp = /^(?:#|\/\/)(?!!)((?:[\u00a0\u2007\u202f\ufeff]|[^\n\S])*)/ // shebang
  const stack: { level: number, indent: string, isHead: boolean, prevSpaces?: Addition }[] = []
  for (const [node, level] of dfs(ast.isWrapped ? ast : ast.body)) {
    while ((stack[stack.length - 1]?.level ?? -1) >= level) stack.pop()
    const lastIndex = stack.length - 1, peek = stack[lastIndex]
    if (level - 1 === peek?.level) {
      if (node.type === 'multiline-space') for (const space of (node as MultilineSpace).children) {
        const accumulatedIndent = ''.concat(...stack.map((elem, index) => index === lastIndex ? '' : elem.indent))
        if (space.type === 'new-line') {
          if (peek.prevSpaces !== undefined) peek.prevSpaces.newText = accumulatedIndent + peek.indent
          const start = space.pos + space.raw.length, add = { start, newText: accumulatedIndent }
          additions.get(start)?.push(add) ?? additions.set(start, [add])
          peek.indent = level > 1 ? indent : ''
          peek.prevSpaces = add
          peek.isHead = true
        } else if (space.type === 'comment') {
          const arr = commentRegexp.exec(space.raw)
          if (arr !== null) {
            if (arr[1].length > 0) {
              const del = { start: space.pos + arr[0].length - arr[1].length, oldText: arr[1] }
              deletions.push(del)
            }
            const start = space.pos + arr[0].length, add = { start, newText: ' ' }
            additions.get(start)?.push(add) ?? additions.set(start, [add])
          }
          if (!peek.isHead) {
            const start = space.pos, add = { start, newText: ' ' }
            additions.get(start)?.push(add) ?? additions.set(start, [add])
          }
          peek.isHead = false
        } else {
          const del = { start: space.pos, oldText: space.raw }
          deletions.push(del)
        }
      } else {
        if (node.type !== 'comma' && node.type !== 'colon') {
          let firstChildNode = node
          if (!peek.isHead) {
            while (firstChildNode.raw === undefined) firstChildNode = firstChildNode.children[0]
            const start = firstChildNode.pos, add = { start, newText: ' ' }
            additions.get(start)?.push(add) ?? additions.set(start, [add])
          }
        }
        peek.isHead = false
      }
    }
    if (['root-value', 'object-body', 'list-body', 'object-field'].indexOf(node.type) > 0) {
      stack.push({ level, indent: '', isHead: true })
    }
  }
  const edits: TextEdit[] = []
  for (const { start, oldText } of deletions) {
    const end = start + oldText.length
    const startTexts = additions.get(start) ?? [], endTexts = additions.get(end) ?? []
    const newText = ''.concat(...startTexts.map(add => add.newText), ...endTexts.map(add => add.newText))
    if (newText !== oldText) {
      const pos2 = document.positionAt(end)
      const pos1 = document.positionAt(start)
      edits.push({ range: {start: pos1, end: pos2}, newText})
    }
    additions.delete(end)
    additions.delete(start)
  }
  for (const list of additions.values()) {
    for (const { start, newText } of list) {
      if (newText.length > 0) {
        const pos = document.positionAt(start)
        edits.push({ range: {start: pos, end: pos}, newText})
      }
    }
  }
  return edits
}

export function formatRange(options: FormattingOptions, range: Range, document: TextDocument, ast: RootValue): TextEdit[] {
  const rangeStart = document.offsetAt(range.start), rangeEnd = document.offsetAt(range.end)
  return format(options, document, ast).filter(edit => {
    const editStart = document.offsetAt(edit.range.start), editEnd = document.offsetAt(edit.range.end)
    return editStart >= rangeStart && editEnd <= rangeEnd
  }) // FIXME: bad implementation
}
