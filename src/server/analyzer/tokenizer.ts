import { Proposed } from 'vscode-languageclient'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { dfs, Primitive } from '../parser/basic'
import { RootValue } from '../parser/sequencial'

enum SemanticTokenTypes {
  VARIABLE, COMMENT, STRING, OPERATOR
}

const tokenTypes: string[] = Object.values(SemanticTokenTypes).filter(i => typeof i === 'string').map(i => (i as string).toLowerCase())

export const semanticTokensLegend = { tokenTypes, tokenModifiers: [] }

export function tokenize(document: TextDocument, ast: RootValue): Proposed.SemanticTokens {
  const data: number[] = [], rootBody = ast.body
  let parent: [string, number] = [rootBody.type, 0], oldLine = 0, oldCharacter = 0
  for (const [node, index] of dfs(rootBody)) {
    if (node.raw === undefined) {
      parent = [node.type, index]
    } else {
      const parentType = parent[1] < index ? parent[0] : undefined
      const { line, character } = document.positionAt(node.pos), length = node.raw.length
      const deltaLine = line - oldLine, deltaCharacter = deltaLine > 0 ? character : character - oldCharacter
      switch (node.type) {
        case 'comment':
          data.push(deltaLine, deltaCharacter, length, SemanticTokenTypes.COMMENT, 0)
          oldLine = line, oldCharacter = character
          break
        case 'dot':
        case 'comma':
        case 'equals':
        case 'plus-equals':
        case 'colon':
          data.push(deltaLine, deltaCharacter, length, SemanticTokenTypes.OPERATOR, 0)
          oldLine = line, oldCharacter = character
          break
        case 'open-path-curly':
        case 'open-curly':
        case 'close-curly':
        case 'open-square':
        case 'close-square':
          data.push(deltaLine, deltaCharacter, length, SemanticTokenTypes.OPERATOR, 0)
          oldLine = line, oldCharacter = character
          break
        case 'primitive':
          if (parentType === 'substitution-path') {
            data.push(deltaLine, deltaCharacter, length, SemanticTokenTypes.VARIABLE, 0)
            oldLine = line, oldCharacter = character
          } else if (typeof (node as Primitive).parsed === 'string') {
            data.push(deltaLine, deltaCharacter, length, SemanticTokenTypes.STRING, 0)
            oldLine = line, oldCharacter = character
          }
          break
        case 'problem':
          if (parentType === 'substitution-path') {
            data.push(deltaLine, deltaCharacter, length, SemanticTokenTypes.VARIABLE, 0)
            oldLine = line, oldCharacter = character
          } else {
            data.push(deltaLine, deltaCharacter, length, SemanticTokenTypes.STRING, 0)
            oldLine = line, oldCharacter = character
          }
          break
        case 'include-prefix':
        case 'whitespace':
        case 'new-line':
        // DO NOTHING HERE
      }
    }
  }
  return { data }
}
