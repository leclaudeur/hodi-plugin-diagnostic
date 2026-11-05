import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PluginArticle } from '@hodi-app/plugin-sdk/server'
import { SHORT_TEXT, spotted } from '../server/signals.ts'

const article = (
  change: Partial<PluginArticle> = {},
  html = '<p>Un long texte.</p>',
  length = 4000
): PluginArticle => ({
  id: 'a1',
  title: 'Pluie record',
  url: 'https://alpha.example/pluie',
  sourceId: 'alpha',
  sourceName: 'Alpha',
  publishedAt: null,
  status: 'ok',
  text: { title: 'Pluie record', byline: null, contentHtml: html, textLength: length },
  ...change
})

describe('what Hodi spots alone', () => {
  it('notes a site that did not answer', () => {
    assert.deepEqual(spotted(article({ status: 'failed', text: null })), ['blocked'])
  })

  it('says nothing of an article that opens on its site', () => {
    assert.deepEqual(spotted(article({ status: 'unreadable', text: null })), [])
  })

  it('notes a text too short to be whole', () => {
    assert.deepEqual(spotted(article({}, '<p>Court.</p>', SHORT_TEXT - 1)), ['short'])
    assert.deepEqual(spotted(article({}, '<p>Long.</p>', SHORT_TEXT)), [])
  })

  it('notes the site’s leftovers in the text, not the words in a sentence', () => {
    assert.deepEqual(spotted(article({}, '<p>Texte.</p><p><strong>À lire aussi</strong> : la pluie</p>')), [
      'leftovers'
    ])
    assert.deepEqual(spotted(article({}, '<ul><li><a href="/">Accueil</a> › Belgique</li></ul>')), ['leftovers'])
    assert.deepEqual(spotted(article({}, '<p>Il faut lire aussi le rapport, dit-il, avant de partager.</p>')), [])
  })
})
