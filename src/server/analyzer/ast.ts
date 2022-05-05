import { DocumentSymbol, SymbolKind } from 'vscode-languageserver'
import { Range, Position, TextDocument } from 'vscode-languageserver-textdocument'
import { dfs, Node, NodeSequence, toDebugOutput } from '../parser/basic'
import { ObjectField, RootValue, ValueConcatenation } from '../parser/sequential'
//import { Range, Position } from 'vscode' 

function getRawValue(value: ValueConcatenation): string {
  let children = value.children
  while (children.length !== 1 && children[0].type === 'substitution') {
    children = children.length !== 2 ? children[2].children : children[1].children
  }

  if (!children[0].raw) {
    return ""}
  else {
  return children[0].raw}
}

export class DocumentAst {

	name: string;
	detail: string;
	value: string;
	range: Range;
	selectionRange: Range;
	children: DocumentAst[];

	constructor(name: string, detail: string, value: string, range: Range, selectionRange: Range) {
		this.name = name;
		this.detail = detail;
		this.value = value;
		this.range = range;
		this.selectionRange = selectionRange;
		this.children = [];


	}
}


export function getAst(document: TextDocument, ast: RootValue): DocumentAst[] {


  console.log(ast)
  console.log(toDebugOutput(ast))

  console.error("hello4")

  const getLastPosition = (node: Node): Position => document.positionAt(node.pos + node.raw.length)
  const stack: { level: number, index: number, children: DocumentAst[] }[] = [{ level: -1, index: 0, children: [] }]
  for (const [node, level] of dfs(ast.body)) {
    while (stack[stack.length - 1].level >= level) stack.pop()
    
    if (node.type === 'object-field') {
      const key = (node as ObjectField).key
      const value = (node as ObjectField).value

      let last: Node | NodeSequence = value.children[value.children.length - 1]
      while (last.raw === undefined) last = last.children[last.children.length - 1]
      const end = getLastPosition(last), selectionEnd = getLastPosition(key.children[key.children.length - 1])
      for (const path of key.children) {
        if (path.type !== 'dot') {
          const peek = stack[stack.length - 1]
          const children: DocumentAst[] = []
          const hello: string = getRawValue(value)
          const startPos = document.positionAt(key.children[0].pos)
          stack.push({ level, children, index: 0 })
          peek.children.push({
            name: path.type === 'problem' ? path.raw : '' + path.parsed, detail: "yes", value: hello, children,
            range: { start: startPos, end }, selectionRange: { start: startPos, end: selectionEnd }
          })
        }
      }
    } else if (node.type === 'concatenation') {
      const peek = stack[stack.length - 1]
      if (peek.level !== level - 1) {
        const children: DocumentAst[] = []
        const value = node as ValueConcatenation
        const hello: string = getRawValue(value)

        let start: Node | NodeSequence = value.children[0]
        while (start.raw === undefined) start = start.children[0]
        let last: Node | NodeSequence = value.children[value.children.length - 1]
        while (last.raw === undefined) last = last.children[last.children.length - 1]
        const startPos = document.positionAt(start.pos), endPos = getLastPosition(last)
        stack.push({ level, children, index: 0 })
        peek.children.push({
          name: '[' + peek.index++ + ']', detail: "yes", value: hello,  children,
          range: { start: startPos, end: endPos}, selectionRange: { start: startPos, end: endPos }
        })
      }
    }
  }
  return stack[0].children
}
