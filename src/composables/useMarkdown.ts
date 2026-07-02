import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

/**
 * Markdown渲染composable
 * 配置markdown-it，支持代码高亮highlight.js，链接打开新窗口
 */
export function useMarkdown() {
  // 创建markdown-it实例
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    // 代码高亮配置
    highlight(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`
        } catch (__) {}
      }
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
    }
  })

  // 链接在新窗口打开
  const defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

  md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
    const aIndex = tokens[idx].attrIndex('target')
    const relIndex = tokens[idx].attrIndex('rel')

    if (aIndex < 0) {
      tokens[idx].attrPush(['target', '_blank'])
    } else {
      tokens[idx].attrs![aIndex][1] = '_blank'
    }

    if (relIndex < 0) {
      tokens[idx].attrPush(['rel', 'noopener noreferrer'])
    } else {
      tokens[idx].attrs![relIndex][1] = 'noopener noreferrer'
    }

    return defaultRender(tokens, idx, options, env, self)
  }

  /**
   * 渲染Markdown为HTML
   */
  const render = (markdown: string): string => {
    if (!markdown) return ''
    return md.render(markdown)
  }

  return {
    render,
    md
  }
}
