import { Proposed } from 'vscode-languageclient'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { toDebugOutput } from '../parser/basic'
import { RootValue } from '../parser/sequencial'

export const semanticTokensLegend = { tokenTypes: [], tokenModifiers: [] }

export function tokenize(document: TextDocument, ast: RootValue): Proposed.SemanticTokens {
  console.log(document, toDebugOutput(ast))
  return { data: [] } // TODO
}
