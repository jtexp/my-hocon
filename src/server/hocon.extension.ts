import { expectEOF } from 'typescript-parsec'
import { Connection, createConnection, DocumentUri, Proposed, ProposedFeatures, ServerCapabilities, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { diagnose } from './analyzer/diagnoser'
import { format, formatRange } from './analyzer/fotmatter'
import { semanticTokensLegend, tokenize } from './analyzer/tokenizer'
import { RootValue, rootValueRule } from './parser/sequencial'
import { tokenizer } from './parser/tokenizer'

const language: [string, string] = ['en', 'us']

const astCollection: Map<DocumentUri, [RootValue, TextDocument]> = new Map()

function initializeConnection(): Connection {
  const connection = createConnection(ProposedFeatures.all)

  connection.onInitialize(params => {
    const initializationOptions = params.initializationOptions ?? {}

    console.log('[HOCON Colorizer Language Server] Options: ' + JSON.stringify(initializationOptions))

    const locale = '' + (initializationOptions.locale ?? 'en-us')

    language[0] = locale.substring(0, locale.indexOf('-')).toLowerCase()
    language[1] = locale.substring(1 + locale.indexOf('-')).toLowerCase()

    const capabilities: ServerCapabilities & Proposed.SemanticTokensServerCapabilities = {
      documentFormattingProvider: true, documentRangeFormattingProvider: true,
      semanticTokensProvider: { legend: semanticTokensLegend }
    }

    return { capabilities }
  })

  connection.onDocumentRangeFormatting(param => {
    const value = astCollection.get(param.textDocument.uri)
    return value ? formatRange(param.options, param.range, value[1], value[0]) : []
  })

  connection.onDocumentFormatting(param => {
    const value = astCollection.get(param.textDocument.uri)
    return value ? format(param.options, value[1], value[0]) : []
  })

  connection.languages.semanticTokens.on(param => {
    const value = astCollection.get(param.textDocument.uri)
    return value ? tokenize(value[1], value[0]) : { data: [] }
  })

  const documents = new TextDocuments<TextDocument>(TextDocument)

  documents.onDidChangeContent(param => {
    const uri = param.document.uri, text = param.document.getText()
    const parsed = expectEOF(rootValueRule.parse(tokenizer.parse(text)))
    const result = parsed.successful ? parsed.candidates[0]?.result : undefined
    result ? astCollection.set(uri, [result, param.document]) : astCollection.delete(uri)
    connection.sendDiagnostics({ uri, diagnostics: diagnose(param.document, language[0], result) })
  })

  documents.listen(connection)

  return connection
}

initializeConnection().listen()
