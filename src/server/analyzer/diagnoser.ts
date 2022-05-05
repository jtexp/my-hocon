import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { dfs } from '../parser/basic'
import { Problem, ProblemCollection } from '../parser/problem'
import { RootValue } from '../parser/sequential'

export function diagnose(document: TextDocument, langCode: string, result?: RootValue): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  if (result === undefined) {
    const code = 'error/unrecognized-document'
    const start = document.positionAt(0), end = document.positionAt(document.getText().length)
    const messageCollection = ProblemCollection['UNRECOGNIZED_DOCUMENT'] as { [key: string]: string }
    const message = messageCollection[langCode] ?? messageCollection['en'] ?? 'UNRECOGNIZED_DOCUMENT'
    diagnostics.push({ range: { start, end }, source: 'hocon', code, message, severity: DiagnosticSeverity.Error })
  } else {
    for (const [node] of dfs(result)) {
      if (node.type === 'problem') {
        const problem = node as Problem
        const start = document.positionAt(problem.pos)
        const end = document.positionAt(problem.pos + problem.raw.length)
        const code = 'error/' + problem.error.toLowerCase().replace('_', '-')
        const messageCollection = ProblemCollection[problem.error] as { [key: string]: string }
        const message = messageCollection[langCode] ?? messageCollection['en'] ?? problem.error
        diagnostics.push({ range: { start, end }, source: 'hocon', code, message, severity: DiagnosticSeverity.Error })
      }
    }
  }
  return diagnostics
}
