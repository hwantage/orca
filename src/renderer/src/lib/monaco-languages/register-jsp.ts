import type * as Monaco from 'monaco-editor'

type MonacoModule = typeof Monaco

export const jspMonarchLanguage: Monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.jsp',
  ignoreCase: true,
  brackets: [
    { open: '{', close: '}', token: 'delimiter.curly' },
    { open: '[', close: ']', token: 'delimiter.square' },
    { open: '(', close: ')', token: 'delimiter.parenthesis' }
  ],
  tokenizer: {
    root: [
      [/<%--/, 'comment', '@jspComment'],
      [/<%(?:@|=|!)?/, 'keyword', '@jspScriptletOpen'],
      [/\$\{/, 'delimiter.curly', '@elExpression'],
      [/<script(?=\s|>)/, 'tag', '@scriptOpen'],
      [/<style(?=\s|>)/, 'tag', '@styleOpen'],
      [/<\/([a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+)/, 'tag.custom', '@tagCustomClose'],
      [/<([a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+)/, 'tag.custom', '@tagCustom'],
      [/<\/([a-zA-Z][a-zA-Z0-9_-]*)/, 'tag', '@tagClose'],
      [/<([a-zA-Z][a-zA-Z0-9_-]*)/, 'tag', '@tagOpen'],
      [/<!--/, 'comment', '@htmlComment'],
      [/[^<%$]+/, '']
    ],
    htmlComment: [
      [/-->/, 'comment', '@pop'],
      [/[^-]+/, 'comment'],
      [/./, 'comment']
    ],
    jspComment: [
      [/--%>/, 'comment', '@pop'],
      [/[^-]+/, 'comment'],
      [/./, 'comment']
    ],
    tagCustom: [
      [/\/>/, 'tag.custom', '@pop'],
      [/>/, 'tag.custom', '@pop'],
      [/\$\{/, 'delimiter.curly', '@elExpression'],
      [/<%(?:@|=|!)?/, 'keyword', '@jspScriptletOpen'],
      { include: '@tagAttributes' }
    ],
    tagCustomClose: [
      [/>/, 'tag.custom', '@pop'],
      [/\s+/, 'white']
    ],
    tagOpen: [
      [/\/>/, 'tag', '@pop'],
      [/>/, 'tag', '@pop'],
      [/\$\{/, 'delimiter.curly', '@elExpression'],
      [/<%(?:@|=|!)?/, 'keyword', '@jspScriptletOpen'],
      { include: '@tagAttributes' }
    ],
    tagClose: [
      [/>/, 'tag', '@pop'],
      [/\s+/, 'white']
    ],
    tagAttributes: [
      [/[a-zA-Z0-9_-]+/, 'attribute.name'],
      [/=/, 'delimiter'],
      [/"/, 'attribute.value', '@stringDouble'],
      [/'/, 'attribute.value', '@stringSingle'],
      [/\s+/, 'white']
    ],
    stringDouble: [
      [/"/, 'attribute.value', '@pop'],
      [/\$\{/, 'delimiter.curly', '@elExpression'],
      [/<%(?:@|=|!)?/, 'keyword', '@jspScriptletOpen'],
      [/[^"\\$%]+/, 'attribute.value'],
      [/[$%]/, 'attribute.value']
    ],
    stringSingle: [
      [/'/, 'attribute.value', '@pop'],
      [/\$\{/, 'delimiter.curly', '@elExpression'],
      [/<%(?:@|=|!)?/, 'keyword', '@jspScriptletOpen'],
      [/[^'\\$%]+/, 'attribute.value'],
      [/[$%]/, 'attribute.value']
    ],
    jspScriptletOpen: [
      [/%>/, 'keyword', '@pop'],
      [/\/\/.*/, 'comment'],
      [/\/\*/, 'comment', '@javaComment'],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string'],
      [/\b(true|false|null)\b/, 'constant.language'],
      [
        /\b(if|else|for|while|do|switch|case|default|break|continue|return|try|catch|finally|throw|new|import|package)\b/,
        'keyword'
      ],
      [/\b(int|long|short|byte|float|double|boolean|char|void|String|Object)\b/, 'type'],
      [/<=|>=|==|!=|&&|\|\||<<|>>|>>>|[-+*/%&|^<>=!]/, 'operator'],
      [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
      [/[0-9]+/, 'number'],
      [/\s+/, 'white']
    ],
    javaComment: [
      [/\*\//, 'comment', '@pop'],
      [/[^*]+/, 'comment'],
      [/./, 'comment']
    ],
    elExpression: [
      [/\}/, 'delimiter.curly', '@pop'],
      [/\b(and|or|not|eq|ne|gt|lt|ge|le|empty|instanceof)\b/, 'keyword.operator'],
      [/<=|>=|==|!=|&&|\|\||[-+*/%<>=!]/, 'keyword.operator'],
      [/\b(true|false|null)\b/, 'constant.language'],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string'],
      [/[a-zA-Z_][a-zA-Z0-9_.]*/, 'variable'],
      [/[0-9]+/, 'number'],
      [/\s+/, 'white']
    ],
    scriptOpen: [
      [/\/>/, 'tag', '@pop'],
      [/>/, { token: 'tag', switchTo: '@scriptBody', nextEmbedded: 'javascript' }],
      { include: '@tagAttributes' }
    ],
    scriptBody: [[/<\/script\s*>/, { token: 'tag', next: '@pop', nextEmbedded: '@pop' }]],
    styleOpen: [
      [/\/>/, 'tag', '@pop'],
      [/>/, { token: 'tag', switchTo: '@styleBody', nextEmbedded: 'css' }],
      { include: '@tagAttributes' }
    ],
    styleBody: [[/<\/style\s*>/, { token: 'tag', next: '@pop', nextEmbedded: '@pop' }]]
  }
}

export const jspLanguageConfiguration: Monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['<%--', '--%>']
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')']
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' }
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' }
  ],
  folding: {
    markers: {
      start: new RegExp('^\\s*<!--\\s*#region\\b.*-->'),
      end: new RegExp('^\\s*<!--\\s*#endregion\\b.*-->')
    }
  }
}

export function registerJspLanguage(monaco: MonacoModule): void {
  const jspAlreadyRegistered = monaco.languages
    .getLanguages()
    .some((language) => language.id === 'jsp')
  if (jspAlreadyRegistered) {
    return
  }

  monaco.languages.register({
    id: 'jsp',
    extensions: ['.jsp', '.jspf'],
    aliases: ['JSP', 'jsp', 'JavaServer Pages']
  })
  monaco.languages.setMonarchTokensProvider('jsp', jspMonarchLanguage)
  monaco.languages.setLanguageConfiguration('jsp', jspLanguageConfiguration)
}
