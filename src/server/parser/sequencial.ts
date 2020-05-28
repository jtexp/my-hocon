// eslint-disable-next-line @typescript-eslint/camelcase
import { alt, apply, opt_sc, ParserOutput, rep_sc, rule, seq } from 'typescript-parsec'
import { Comment, commentParser, NodeSequence, Primitive, primitiveParser, primitiveProblemParser, toRaw, WhiteSpace, whiteSpaceParser } from './basic'
import { CloseCurly, closeCurlyParser, CloseSquare, closeSquareParser, OpenCurly, openCurlyParser, OpenSquare, openSquareParser } from './delimiter'
import { Inclusion, inclusionParser } from './inclusion'
import { Problem } from './problem'
import { Colon, colonParser, Comma, commaParser, Equals, equalsParser, NewLine, newLineParser, PlusEquals, plusEqualsParser } from './separater'
import { Substitution, substitutionParser, SubstitutionPath, substitutionPathParser } from './substitution'
import { TokenParser, TokenRule, TokenType } from './tokenizer'

type Value = ListValue | UnclosedListValue | ObjectValue | UnclosedObjectValue | Substitution | Primitive | Problem

export interface MultilineSpace extends NodeSequence {
  type: 'multiline-space',
  children: (WhiteSpace | Comment | NewLine)[]
}

export interface ValueConcatenation extends NodeSequence {
  type: 'concatenation',
  children: [Value, WhiteSpace, ValueConcatenation] | [Value, ValueConcatenation] | [Value]
}

export interface ObjectField extends NodeSequence {
  type: 'object-field',
  key: SubstitutionPath,
  value: ValueConcatenation,
  children: (SubstitutionPath | ValueConcatenation | MultilineSpace | Colon | Equals | PlusEquals)[]
}

export interface ListBody extends NodeSequence {
  type: 'list-body',
  values: ValueConcatenation[],
  children: (ValueConcatenation | MultilineSpace | Comma)[]
}

export interface ObjectBody extends NodeSequence {
  type: 'object-body',
  fields: (ObjectField | Inclusion | ValueConcatenation)[],
  children: (ObjectField | Inclusion | ValueConcatenation | MultilineSpace | Comma)[]
}

export interface RootValue extends NodeSequence {
  type: 'root-value',
  isWrapped: boolean,
  body: ListBody | ObjectBody,
  children: (MultilineSpace | Problem | OpenSquare | CloseSquare | OpenCurly | CloseCurly | ListBody | ObjectBody)[]
}

export interface ListValue extends NodeSequence {
  type: 'list-value',
  body: ListBody,
  children: [OpenSquare | Problem, ListBody, CloseSquare]
}

export interface ObjectValue extends NodeSequence {
  type: 'object-value',
  body: ObjectBody,
  children: [OpenCurly | Problem, ObjectBody, CloseCurly]
}

export interface UnclosedListValue extends NodeSequence {
  type: 'unclosed-list-value',
  body: ListBody,
  children: [Problem, ListBody]
}

export interface UnclosedObjectValue extends NodeSequence {
  type: 'unclosed-object-value',
  body: ObjectBody,
  children: [Problem, ObjectBody]
}

function first<T>(value: TokenParser<T>): TokenParser<T> {
  return {
    parse(token): ParserOutput<TokenType, T> {
      const result = value.parse(token)
      if (result.successful) {
        const candidates = result.candidates
        candidates.length = Math.min(1, candidates.length)
      }
      return result
    }
  }
}

function checked(value: TokenParser<ValueConcatenation>): TokenParser<ValueConcatenation> {
  return apply(value, token => {
    let current: ValueConcatenation | undefined = token
    let type: ('primitive' | 'list-value' | 'object-value' | 'substitution') = 'substitution'
    while (current !== undefined) {
      const head: Value = current.children[0]
      switch (head.type) {
        case 'unclosed-object-value':
        case 'object-value':
          if (type === 'substitution') {
            type = 'object-value'
          } else if (head.type === 'object-value' && type !== 'object-value') {
            const error = 'INVALID_OBJECT_CONCATENATION'
            head.children[0] = { type: 'problem', pos: head.children[0].pos, raw: head.children[0].raw, error }
          }
          break
        case 'unclosed-list-value':
        case 'list-value':
          if (type === 'substitution') {
            type = 'list-value'
          } else if (head.type === 'list-value' && type !== 'list-value') {
            const error = 'INVALID_LIST_CONCATENATION'
            head.children[0] = { type: 'problem', pos: head.children[0].pos, raw: head.children[0].raw, error }
          }
          break
        case 'primitive':
        case 'problem':
          if (type === 'substitution') {
            type = 'primitive'
          } else if (head.type === 'primitive' && type !== 'primitive') {
            const error = 'INVALID_PRIMITIVE_CONCATENATION'
            current.children[0] = { type: 'problem', pos: head.pos, raw: head.raw, error }
          }
          break
        case 'substitution':
        // DO NOTHING HERE
      }
      current = current.children.length === 3 ? current.children[2] : current.children[1]
    }
    return token
  })
}

function concatenation(value: TokenParser<Value>): TokenParser<ValueConcatenation> {
  return apply(seq(seq(value, rep_sc(value)), rep_sc(seq(whiteSpaceParser, value, rep_sc(value)))), token => {
    const [[head, tail1], tail2] = token, result: ValueConcatenation = { type: 'concatenation', children: [head] }
    let currentChildren: unknown[] = result.children // YES I KNOW IT IS UNSAFE
    for (const value of tail1) {
      const elem: ValueConcatenation = { type: 'concatenation', children: [value] }
      currentChildren.push(elem) // without space
      currentChildren = elem.children
    }
    for (const [space, value, tail3] of tail2) {
      const elem: ValueConcatenation = { type: 'concatenation', children: [value] }
      currentChildren.push(space, elem) // with space
      currentChildren = elem.children
      for (const value of tail3) {
        const elem: ValueConcatenation = { type: 'concatenation', children: [value] }
        currentChildren.push(elem) // with space
        currentChildren = elem.children
      }
    }
    return result
  })
}

function wrappedSequence<T>(value: TokenParser<T>, space: TokenParser<MultilineSpace | undefined>): TokenParser<[(T | ValueConcatenation)[], (T | MultilineSpace | ValueConcatenation | Comma)[]]> {
  const leftCommaParser: TokenParser<[true, Comma]> = apply(commaParser, token => [true, token])
  const rightValueParser: TokenParser<[false, T]> = apply(first(value), token => [false, token])
  return apply(seq(space, rep_sc(seq(alt(leftCommaParser, rightValueParser), space))), token => {
    const [head, tail] = token
    const values: (T | ValueConcatenation)[] = []
    const children: (T | MultilineSpace | ValueConcatenation | Comma)[] = head !== undefined ? [head] : []
    let isDuplicate = true
    for (const [elem, space] of tail) {
      const wrappedSpace = space !== undefined ? [space] : []
      if (!elem[0]) {
        children.push(elem[1], ...wrappedSpace)
        values.push(elem[1])
        isDuplicate = false
      } else if (!isDuplicate) {
        children.push(elem[1], ...wrappedSpace)
        isDuplicate = true
      } else {
        const { pos, raw } = elem[1], error = values.length > 0 ? 'VALUE_SEPARATOR_USED_CONSECUTIVELY' : 'VALUE_SEPARATOR_AT_THE_BEGINNING'
        const value: ValueConcatenation = { type: 'concatenation', children: [{ type: 'problem', error, pos, raw }] }
        children.push(value, ...wrappedSpace)
        values.push(value)
      }
    }
    return [values, children]
  })
}

export const rootValueRule: TokenRule<RootValue> = rule()

export const listValueRule: TokenRule<ListValue | UnclosedListValue> = rule()

export const objectValueRule: TokenRule<ObjectValue | UnclosedObjectValue> = rule()

export const optSpaceParser: TokenParser<MultilineSpace | undefined> = apply(rep_sc(alt(whiteSpaceParser, commentParser, newLineParser)), token => {
  return token.length > 0 ? { type: 'multiline-space', children: token } : undefined
})

export const valueInListParser: TokenParser<Value> = alt(listValueRule, objectValueRule, substitutionParser, primitiveParser, primitiveProblemParser, apply(alt(colonParser, equalsParser, plusEqualsParser, closeCurlyParser), token => {
  return { type: 'problem', pos: token.pos, raw: token.raw, error: 'UNRECOGNIZED_VALUE' }
}))

export const valueInObjectParser: TokenParser<Value> = alt(listValueRule, objectValueRule, substitutionParser, primitiveParser, primitiveProblemParser, apply(alt(colonParser, equalsParser, plusEqualsParser, closeSquareParser), token => {
  return { type: 'problem', pos: token.pos, raw: token.raw, error: 'UNRECOGNIZED_VALUE' }
}))

export const valueInRootFieldsParser: TokenParser<Value> = alt(listValueRule, objectValueRule, substitutionParser, primitiveParser, primitiveProblemParser, apply(alt(colonParser, equalsParser, plusEqualsParser, closeCurlyParser, closeSquareParser), token => {
  return { type: 'problem', pos: token.pos, raw: token.raw, error: 'UNRECOGNIZED_VALUE' }
}))

export const listBodyElementParser: TokenParser<ValueConcatenation> = checked(concatenation(valueInListParser))

export const objectValueConcatenationParser: TokenParser<ValueConcatenation> = checked(concatenation(valueInObjectParser))

export const rootFieldsConcatenationParser: TokenParser<ValueConcatenation> = checked(concatenation(valueInRootFieldsParser))

export const objectChildrenObjectFieldParser: TokenParser<ObjectField> = apply(seq(substitutionPathParser, optSpaceParser, objectValueRule), token => {
  const [head, space, tail] = token, value: ValueConcatenation = { type: 'concatenation', children: [tail] }
  const children = space !== undefined ? [head, space, value] : [head, value]
  return { type: 'object-field', key: token[0], value, children }
})

export const objectFieldParser: TokenParser<ObjectField> = apply(seq(substitutionPathParser, optSpaceParser, alt(colonParser, equalsParser, plusEqualsParser), optSpaceParser, objectValueConcatenationParser), token => {
  const [head, space1, separater, space2, tail] = token
  const wrappedSpace1 = space1 !== undefined ? [space1] : [], wrappedSpace2 = space2 !== undefined ? [space2] : []
  return { type: 'object-field', key: head, value: tail, children: [head, ...wrappedSpace1, separater, ...wrappedSpace2, tail] }
})

export const objectBodyElementParser: TokenParser<ObjectField | Inclusion | ValueConcatenation> = alt(inclusionParser, objectChildrenObjectFieldParser, objectFieldParser, apply(objectValueConcatenationParser, token => {
  const head = token.children[0]
  switch (head.type) {
    case 'unclosed-object-value':
    case 'unclosed-list-value':
    case 'object-value':
    case 'list-value':
      head.children[0] = { type: 'problem', error: 'UNRECOGNIZED_OBJECT_FIELD', pos: head.children[0].pos, raw: head.children[0].raw }
      break
    case 'substitution':
      token.children[0] = { type: 'problem', error: 'UNRECOGNIZED_OBJECT_FIELD', pos: head.children[0].pos, raw: toRaw(head) }
      break
    case 'primitive':
    case 'problem':
      token.children[0] = { type: 'problem', error: 'UNRECOGNIZED_OBJECT_FIELD', pos: head.pos, raw: head.raw }
      break
  }
  return token
}))

export const rootFieldsElementParser: TokenParser<ObjectField | Inclusion | ValueConcatenation> = alt(inclusionParser, objectChildrenObjectFieldParser, objectFieldParser, apply(rootFieldsConcatenationParser, token => {
  const head = token.children[0]
  switch (head.type) {
    case 'unclosed-object-value':
    case 'unclosed-list-value':
    case 'object-value':
    case 'list-value':
      head.children[0] = { type: 'problem', error: 'UNRECOGNIZED_OBJECT_FIELD', pos: head.children[0].pos, raw: head.children[0].raw }
      break
    case 'substitution':
      token.children[0] = { type: 'problem', error: 'UNRECOGNIZED_OBJECT_FIELD', pos: head.children[0].pos, raw: toRaw(head) }
      break
    case 'primitive':
    case 'problem':
      token.children[0] = { type: 'problem', error: 'UNRECOGNIZED_OBJECT_FIELD', pos: head.pos, raw: head.raw }
      break
  }
  return token
}))

export const rootValueParser: TokenParser<RootValue> = apply(seq(optSpaceParser, alt(listValueRule, objectValueRule), optSpaceParser), token => {
  const [space1, main, space2] = token
  const wrappedSpace1 = space1 !== undefined ? [space1] : []
  const wrappedSpace2 = space2 !== undefined ? [space2] : []
  const children = [...wrappedSpace1, ...main.children, ...wrappedSpace2]
  return { type: 'root-value', isWrapped: true, body: main.children[1], children }
})

export const rootFieldsParser: TokenParser<RootValue> = apply(wrappedSequence(rootFieldsElementParser, optSpaceParser), token => {
  const [fields, children] = token
  const objectBody: ObjectBody = { type: 'object-body', fields, children }
  return { type: 'root-value', isWrapped: false, body: objectBody, children: [objectBody] }
})

rootValueRule.setPattern(alt(rootValueParser, rootFieldsParser))

listValueRule.setPattern(apply(seq(openSquareParser, wrappedSequence(listBodyElementParser, optSpaceParser), opt_sc(closeSquareParser)), token => {
  const [open, [values, children], close] = token, listBody: ListBody = { type: 'list-body', values, children }
  if (close === undefined) {
    const problem: Problem = { type: 'problem', pos: open.pos, raw: open.raw, error: 'UNCLOSED_BRACE' }
    return { type: 'unclosed-list-value', body: listBody, children: [problem, listBody] }
  }
  return { type: 'list-value', body: listBody, children: [open, listBody, close] }
}))

objectValueRule.setPattern(apply(seq(openCurlyParser, wrappedSequence(objectBodyElementParser, optSpaceParser), opt_sc(closeCurlyParser)), token => {
  const [open, [fields, children], close] = token, objectBody: ObjectBody = { type: 'object-body', fields, children }
  if (close === undefined) {
    const problem: Problem = { type: 'problem', pos: open.pos, raw: open.raw, error: 'UNCLOSED_BRACKET' }
    return { type: 'unclosed-object-value', body: objectBody, children: [problem, objectBody] }
  }
  return { type: 'object-value', body: objectBody, children: [open, objectBody, close] }
}))
