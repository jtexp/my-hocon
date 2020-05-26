import { expectEOF } from 'typescript-parsec'
import { Connection, createConnection, Diagnostic, DiagnosticSeverity, DocumentUri, FormattingOptions, ProposedFeatures, Range, TextDocumentIdentifier, TextDocuments, TextEdit } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Node, NodeSequence } from './parser/basic'
import { Problem, ProblemCollection } from './parser/problem'
import { MultilineSpace, RootValue, rootValueRule } from './parser/sequencial'
import { tokenizer } from './parser/tokenizer'

const language: [string, string] = ['en', 'us']

const astCollection: Map<DocumentUri, [RootValue, TextDocument]> = new Map()

function* dfs(nodes: NodeSequence): Iterable<[Node | NodeSequence, number]> {
  const stack = [nodes.children[Symbol.iterator]()]
  yield [nodes, stack.length - 1]
  while (stack.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const iterator = stack.pop()!, next = iterator.next()
    if (!next.done) {
      stack.push(iterator)
      yield [next.value, stack.length]
      if (next.value.raw === undefined) {
        stack.push(next.value.children[Symbol.iterator]())
      }
    }
  }
}

function refresh(connection: Connection, document: TextDocument): void {
  const text = document.getText(), tokens = tokenizer.parse(text), parsed = expectEOF(rootValueRule.parse(tokens))

  const result: RootValue | undefined = (parsed.successful ? parsed.candidates : [])[0]?.result

  const diagnostics: Diagnostic[] = []

  if (result === undefined) {
    astCollection.delete(document.uri)
    const code = 'error/unrecognized-document'
    const start = document.positionAt(0), end = document.positionAt(text.length)
    const messageCollection = ProblemCollection['UNRECOGNIZED_DOCUMENT'] as { [key: string]: string }
    const message = messageCollection[language[0]] ?? messageCollection['en'] ?? 'UNRECOGNIZED_DOCUMENT'
    diagnostics.push({ range: { start, end }, source: 'hocon', code, message, severity: DiagnosticSeverity.Error })
  } else {
    astCollection.set(document.uri, [result, document])
    for (const [node] of dfs(result)) {
      if (node.type === 'problem') {
        const problem = node as Problem
        const start = document.positionAt(problem.pos)
        const end = document.positionAt(problem.pos + problem.raw.length)
        const code = 'error/' + problem.error.toLowerCase().replace('_', '-')
        const messageCollection = ProblemCollection[problem.error] as { [key: string]: string }
        const message = messageCollection[language[0]] ?? messageCollection['en'] ?? problem.error
        diagnostics.push({ range: { start, end }, source: 'hocon', code, message, severity: DiagnosticSeverity.Error })
      }
    }
  }

  connection.sendDiagnostics({ uri: document.uri, diagnostics })
}

function formatRange(connection: Connection, options: FormattingOptions, range: Range, document: TextDocumentIdentifier): TextEdit[] {
  const edits: TextEdit[] = [], ast = astCollection.get(document.uri)
  console.log(connection, options, range, ast) // TODO
  return edits
}

function format(connection: Connection, options: FormattingOptions, identifier: TextDocumentIdentifier): TextEdit[] {
  const edits: TextEdit[] = [], astWithDocument = astCollection.get(identifier.uri)
  if (astWithDocument !== undefined) {
    const [ast, document] = astWithDocument
    const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t'
    const commentRegexp = /^(#|\/\/)(?!!)([\u00a0\u2007\u202f\ufeff]|[^\n\S])*/ // shebang
    const stack: { level: number, indent: string, isHead: boolean, prevNewLineEdit?: TextEdit }[] = []
    for (const [node, level] of dfs(ast.isWrapped ? ast : ast.body)) {
      while ((stack[stack.length - 1]?.level ?? -1) >= level) stack.pop()
      const lastIndex = stack.length - 1, peek = stack[lastIndex]
      if (level - 1 === peek?.level) {
        const newAccumulatedIndent = ''.concat(...stack.map(elem => elem.indent))
        const accumulatedIndent = ''.concat(...stack.map((elem, index) => index === lastIndex ? '' : elem.indent))
        if (node.type === 'multiline-space') for (const space of (node as MultilineSpace).children) {
          if (space.type === 'new-line') {
            if (peek.prevNewLineEdit !== undefined) peek.prevNewLineEdit.newText = newAccumulatedIndent
            const start = document.positionAt(space.pos + space.raw.length), end = start
            const edit = { range: { start, end }, newText: accumulatedIndent }
            peek.indent = level > 1 ? indent : ''
            peek.prevNewLineEdit = edit
            peek.isHead = true
            edits.push(edit)
          } else if (space.type === 'comment') {
            const start = document.positionAt(space.pos), end = document.positionAt(space.pos + space.raw.length)
            const newText: string = space.raw.replace(commentRegexp, peek.isHead ? peek.indent + '$1 ' : ' $1 ')
            edits.push({ range: { start, end }, newText })
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
  }
  return edits
}

function initializeConnection(): Connection {
  const connection = createConnection(ProposedFeatures.all)

  connection.onInitialize(params => {
    const initializationOptions = params.initializationOptions ?? {}

    console.log('[HOCON Colorizer Language Server] Options: ' + JSON.stringify(initializationOptions))

    const locale = '' + (initializationOptions.locale ?? 'en-us')

    language[0] = locale.substring(0, locale.indexOf('-')).toLowerCase()
    language[1] = locale.substring(1 + locale.indexOf('-')).toLowerCase()

    return ({ capabilities: { documentFormattingProvider: true, documentRangeFormattingProvider: true } })
  })

  connection.onDocumentRangeFormatting(param => formatRange(connection, param.options, param.range, param.textDocument))

  connection.onDocumentFormatting(param => format(connection, param.options, param.textDocument))

  const documents = new TextDocuments<TextDocument>(TextDocument)

  documents.onDidChangeContent(param => refresh(connection, param.document))

  documents.listen(connection)

  return connection
}

initializeConnection().listen()
