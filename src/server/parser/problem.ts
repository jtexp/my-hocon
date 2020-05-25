import { Node } from "./basic"

export const ProblemCollection = {
  UNRECOGNIZED_VALUE: {
    zh: '无法解析为合法值（含有“$"{}[]:=,+#`^?!@*&\\”的字符串需要使用双引号括起来）。',
    en: 'Cannot be parsed as a legal value (a string containing "$"{}[]:=,+#`^?!@*&\\" should be double quoted).'
  },
  UNRECOGNIZED_INCLUSION_PATH: {
    zh: '无法解析为合法的引用路径，合法的引用路径应由祼字符串或被括号包围的字符串组成，其中字符串应使用双引号括起来。',
    en: 'Cannot be parsed as a legal inclusion path, which should be a double quoted string or wrapped by parentheses.'
  },
  UNRECOGNIZED_INCLUSION_PARENTHESES: {
    zh: '无法解析为合法的引用路径，合法的引用路径应使用“url()”、“file()”、“classpath()”、或“required()”括起来（如果括号存在的话）。',
    en: 'Cannot be parsed as a legal inclusion path, whose wrapped parentheses (if they exist) should be "url()", "file()", "classpath()", or "required()".'
  },
  DUPLICATE_REQUIRED_IN_INCLUSION: {
    zh: '在引用路径中，“required()”不应出现两次。',
    en: '"required()" cannot be used twice in an inclusion path.'
  },
  DUPLICATE_PARENTHESES_IN_INCLUSION: {
    zh: '在引用路径中，“url()”、“file()”、“classpath()”只能用于将祼字符串括起来。',
    en: '"url()", "file()", or "classpath()" should only be used for wrapping double quoted strings.'
  },
  UNRECOGNIZED_PATH_EXPRESSION: {
    zh: '路径表达式应由合法字符串构成（含有“$"{}[]:=,+#`^?!@*&\\”的字符串需要使用双引号括起来）。',
    en: 'A path expression should be made up by legal strings (a string containing "$"{}[]:=,+#`^?!@*&\\" should be double quoted).'
  },
  WHITESPACE_IN_PATH_EXPRESSION: {
    zh: '路径表达式中的空白字符必须使用双引号括起来。',
    en: 'The whitespace in a path expression should be double quoted.'
  },
  MULTILINE_STRING_IN_PATH_EXPRESSION: {
    zh: '路径表达式中不允许使用多行字符串。',
    en: 'Multiline strings are not allowed in the path expression.'
  },
  PATH_EXPRESSION_SEPARATOR_AT_THE_END: {
    zh: '分隔符（小数点）不能出现在路径表达式的结尾。',
    en: 'Separaters (dots) is not allowed at the end of a path expression.'
  },
  PATH_EXPRESSION_SEPARATOR_AT_THE_BEGINNING: {
    zh: '分隔符（小数点）不能出现在路径表达式的开头。',
    en: 'Separaters (dots) is not allowed at the beginning of a path expression.'
  },
  PATH_EXPRESSION_SEPARATOR_USED_CONSECUTIVELY: {
    zh: '分隔符（小数点）不能在路径表达式中连续出现。',
    en: 'Separaters (dots) cannot be used consecutively in a path expression.'
  },
  EMPTY_PATH_IN_SUBSTITUTION: {
    zh: '引用中的路径表达式不能为空。',
    en: 'The path expression in an substitution cannot be empty.'
  },
  UNMATCHED_BRACE_IN_SUBSTITUTION: {
    zh: '引用中的路径表达式必须使用匹配的花括号（像“${expression}”或“${?expression}”）括起来。',
    en: 'The path expression in an substitution should be wrapped by matching curly braces (like "${expression}" or "${expression}").'
  },
  INVALID_OBJECT_CONCATENATION: {
    zh: '对象只能和其他对象（或代表对象的引用）值连结。',
    en: 'Objects should only be concatenated with objects (or substitutions which represent objects).'
  },
  INVALID_LIST_CONCATENATION: {
    zh: '数组只能和其他数组（或代表数组的引用）值连结。',
    en: 'Arrays should only be concatenated with arrays (or substitutions which represent arrays).'
  },
  INVALID_PRIMITIVE_CONCATENATION: {
    zh: '字符串（布尔值、数字、和空值会自动转换到字符串）只能和其他字符串（或引用）值连结。',
    en: 'String (booleans, numbers, and nulls will be converted to strings automatically) should only be concatenated with strings (or substitutions).'
  },
  VALUE_SEPARATOR_AT_THE_BEGINNING: {
    zh: '分隔符（逗号）不能出现在对象或数组的开头。',
    en: 'Separaters (dots) is not allowed at the beginning of an array or an object.'
  },
  VALUE_SEPARATOR_USED_CONSECUTIVELY: {
    zh: '分隔符（逗号）不能在对象或数组中连续出现。',
    en: 'Separaters (comma) cannot be used consecutively in arrays and objects.'
  },
  UNRECOGNIZED_OBJECT_FIELD: {
    zh: '无法解析为对象的合法键值对，键值对必须包含键（由路径表达式组成）和值，有时也需要包含分隔符（“:”、“=”、或“+=”）。',
    en: 'Cannot be parsed as a legal object field, which should contain a key (made up by path expression), a value, and a separator (":", "=", or "+=") if required.'
  },
  UNCLOSED_BRACE: {
    zh: '该花括号需要一个与之匹配的花括号（但并未找到）。',
    en: 'There should be a matching curly brace (but not found).'
  },
  UNCLOSED_BRACKET: {
    zh: '该方括号需要一个与之匹配的方括号（但并未找到）。',
    en: 'There should be a matching square bracket (but not found).'
  },
  UNRECOGNIZED_DOCUMENT: {
    zh: '无法识别的文档（这是一个 BUG，请联系 HOCON Colorizer 的作者并附上文档全文）。',
    en: 'Unrecognized document (THIS IS A BUG, please contact the author of HOCON Colorizer and attach the full text of the document).'
  }
}

export interface Problem extends Node {
  type: 'problem',
  error: keyof typeof ProblemCollection
}
