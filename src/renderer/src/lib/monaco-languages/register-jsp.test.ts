import { describe, expect, it, vi } from 'vitest'
import { jspLanguageConfiguration, jspMonarchLanguage, registerJspLanguage } from './register-jsp'

type RuleEntry = [RegExp, string | object, string?] | { include: string }

function findMatchingRule(
  stateName: string,
  text: string
): { rule: RuleEntry; match: RegExpExecArray } | null {
  const rules = jspMonarchLanguage.tokenizer[stateName] as RuleEntry[]
  if (!rules) {
    return null
  }

  for (const rule of rules) {
    if ('include' in rule) {
      continue
    }
    const [regex] = rule
    const match = regex.exec(text)
    if (match && match.index === 0) {
      return { rule, match }
    }
  }
  return null
}

describe('registerJspLanguage', () => {
  describe('registration', () => {
    it('registers the jsp language, Monarch tokenizer, and configuration once', () => {
      const languages: { id: string }[] = [{ id: 'html' }]
      const register = vi.fn((entry: { id: string }) => {
        languages.push({ id: entry.id })
      })
      const setMonarchTokensProvider = vi.fn()
      const setLanguageConfiguration = vi.fn()
      const getLanguages = vi.fn(() => languages)
      const monacoMock = {
        languages: {
          register,
          setMonarchTokensProvider,
          setLanguageConfiguration,
          getLanguages
        }
      }

      registerJspLanguage(monacoMock as never)
      registerJspLanguage(monacoMock as never)

      expect(register).toHaveBeenCalledTimes(1)
      expect(register).toHaveBeenCalledWith({
        id: 'jsp',
        extensions: ['.jsp', '.jspf'],
        aliases: ['JSP', 'jsp', 'JavaServer Pages']
      })
      expect(setMonarchTokensProvider).toHaveBeenCalledTimes(1)
      expect(setMonarchTokensProvider).toHaveBeenCalledWith('jsp', jspMonarchLanguage)
      expect(setLanguageConfiguration).toHaveBeenCalledTimes(1)
      expect(setLanguageConfiguration).toHaveBeenCalledWith('jsp', jspLanguageConfiguration)
    })
  })

  describe('bracket and auto-closing configuration', () => {
    it('excludes angle brackets (<, >) from brackets, autoClosingPairs, and surroundingPairs', () => {
      expect(jspLanguageConfiguration.brackets).toEqual([
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
      ])
      expect(jspMonarchLanguage.brackets).toEqual([
        { open: '{', close: '}', token: 'delimiter.curly' },
        { open: '[', close: ']', token: 'delimiter.square' },
        { open: '(', close: ')', token: 'delimiter.parenthesis' }
      ])

      const autoClosingOpenChars = jspLanguageConfiguration.autoClosingPairs?.map(
        (pair) => pair.open
      )
      expect(autoClosingOpenChars).not.toContain('<')

      const surroundingOpenChars = jspLanguageConfiguration.surroundingPairs?.map(
        (pair) => pair.open
      )
      expect(surroundingOpenChars).not.toContain('<')
    })
  })

  describe('tokenizer rules and token actions', () => {
    it('matches JSTL / Custom tags like <c:if> and </c:if> with tag.custom token', () => {
      const openResult = findMatchingRule('root', '<c:if')
      expect(openResult).not.toBeNull()
      expect(openResult?.rule[1]).toBe('tag.custom')
      expect(openResult?.rule[2]).toBe('@tagCustom')

      const closeResult = findMatchingRule('root', '</c:if>')
      expect(closeResult).not.toBeNull()
      expect(closeResult?.rule[1]).toBe('tag.custom')
      expect(closeResult?.rule[2]).toBe('@tagCustomClose')
    })

    it('tokenizes comparison operators (<, >, <=, >=, ==, !=) in jspScriptletOpen as operator', () => {
      const scriptletRules = ['<', '>', '<=', '>=', '==', '!=', '&&', '||']
      for (const op of scriptletRules) {
        const result = findMatchingRule('jspScriptletOpen', op)
        expect(result).not.toBeNull()
        expect(result?.rule[1]).toBe('operator')
      }
    })

    it('tokenizes comparison and logical operators in elExpression as keyword.operator', () => {
      const elOps = ['<=', '>=', '==', '!=', '&&', '||', '<', '>']
      for (const op of elOps) {
        const result = findMatchingRule('elExpression', op)
        expect(result).not.toBeNull()
        expect(result?.rule[1]).toBe('keyword.operator')
      }

      const elKeywords = [
        'and',
        'or',
        'not',
        'eq',
        'ne',
        'gt',
        'lt',
        'ge',
        'le',
        'empty',
        'instanceof'
      ]
      for (const kw of elKeywords) {
        const result = findMatchingRule('elExpression', kw)
        expect(result).not.toBeNull()
        expect(result?.rule[1]).toBe('keyword.operator')
      }
    })

    it('configures embedded javascript for <script> and css for <style> tags', () => {
      const scriptOpenResult = findMatchingRule('root', '<script>')
      expect(scriptOpenResult).not.toBeNull()
      expect(scriptOpenResult?.rule[1]).toBe('tag')
      expect(scriptOpenResult?.rule[2]).toBe('@scriptOpen')

      const scriptBodyResult = findMatchingRule('scriptBody', '</script>')
      expect(scriptBodyResult).not.toBeNull()
      expect(scriptBodyResult?.rule[1]).toEqual({
        token: 'tag',
        next: '@pop',
        nextEmbedded: '@pop'
      })

      const styleOpenResult = findMatchingRule('root', '<style>')
      expect(styleOpenResult).not.toBeNull()
      expect(styleOpenResult?.rule[1]).toBe('tag')
      expect(styleOpenResult?.rule[2]).toBe('@styleOpen')

      const styleBodyResult = findMatchingRule('styleBody', '</style>')
      expect(styleBodyResult).not.toBeNull()
      expect(styleBodyResult?.rule[1]).toEqual({
        token: 'tag',
        next: '@pop',
        nextEmbedded: '@pop'
      })
    })

    it('matches JSP comments <%-- --%> and HTML comments <!-- -->', () => {
      const jspCommentOpen = findMatchingRule('root', '<%--')
      expect(jspCommentOpen).not.toBeNull()
      expect(jspCommentOpen?.rule[1]).toBe('comment')
      expect(jspCommentOpen?.rule[2]).toBe('@jspComment')

      const htmlCommentOpen = findMatchingRule('root', '<!--')
      expect(htmlCommentOpen).not.toBeNull()
      expect(htmlCommentOpen?.rule[1]).toBe('comment')
      expect(htmlCommentOpen?.rule[2]).toBe('@htmlComment')
    })

    it('tokenizes tag attributes, string values, and embedded EL in double/single quotes', () => {
      const attrName = findMatchingRule('tagAttributes', 'test')
      expect(attrName?.rule[1]).toBe('attribute.name')

      const doubleQuoteOpen = findMatchingRule('tagAttributes', '"')
      expect(doubleQuoteOpen?.rule[1]).toBe('attribute.value')
      expect(doubleQuoteOpen?.rule[2]).toBe('@stringDouble')

      const elInString = findMatchingRule('stringDouble', '${')
      expect(elInString?.rule[1]).toBe('delimiter.curly')
      expect(elInString?.rule[2]).toBe('@elExpression')
    })
  })
})
