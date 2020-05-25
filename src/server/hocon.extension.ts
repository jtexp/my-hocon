import { expectEOF } from 'typescript-parsec'
import { Connection, createConnection, Diagnostic, DiagnosticSeverity, DocumentUri, FormattingOptions, ProposedFeatures, Range, TextDocumentIdentifier, TextDocuments, TextEdit } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Node, NodeSequence } from './parser/basic'
import { Problem, ProblemCollection } from './parser/problem'
import { RootValue, rootValueRule } from './parser/sequencial'
import { tokenizer } from './parser/tokenizer'

const language: [string, string] = ['en', 'us']

const astCollection: Map<DocumentUri, RootValue> = new Map()

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
    astCollection.set(document.uri, result)
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

function format(connection: Connection, options: FormattingOptions, document: TextDocumentIdentifier): TextEdit[] {
  const edits: TextEdit[] = [], ast = astCollection.get(document.uri)
  console.log(connection, options, ast) // TODO
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
