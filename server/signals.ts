import type { PluginArticle } from '@hodi-app/plugin-sdk/server'
import type { Spotted } from './issues.ts'

// Below this many characters, a reader text is most likely cut: a news article rarely is that short.
export const SHORT_TEXT = 1200

// Short blocks that are the site's furniture, not the article: "Lire aussi", a breadcrumb, a share bar.
const LEFTOVER =
  /^(?:[àa] lire aussi|lire aussi|lire également|voir aussi|sur le même sujet|publicité|advertisement|partager|share|read more|related|newsletter|abonnez-vous|inscrivez-vous|accueil\s*[>›»/])/i

// The text of the article's short blocks, without their tags.
const shortBlocks = (html: string) =>
  [...html.matchAll(/<(p|li|h[2-6]|figcaption|span|a)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(match =>
      (match[2] ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|\s+/g, ' ')
        .trim()
    )
    .filter(text => text.length > 0 && text.length <= 80)

// What Hodi can tell alone from an article it just read. An article that opens on its site (no reader text and no
// error) says nothing: Hodi cannot tell a source without a reader from a page it could not read.
export const spotted = (article: PluginArticle): Spotted[] => {
  if (article.status === 'failed') return ['blocked']
  if (article.status !== 'ok' || !article.text) return []
  const issues: Spotted[] = []
  if (article.text.textLength < SHORT_TEXT) issues.push('short')
  if (shortBlocks(article.text.contentHtml).some(text => LEFTOVER.test(text))) issues.push('leftovers')
  return issues
}
