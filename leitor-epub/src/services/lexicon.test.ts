import type { LexiconEntry } from '@/types/lexicon';
import { cardFieldsFromLexicon, lexiconLookupTerm } from './lexicon';

describe('dados lexicais para cards', () => {
  it('usa a tradução do primeiro sentido quando a entrada não tem tradução própria', () => {
    const entry: LexiconEntry = {
      id: 'entry-during',
      bookId: 'book-1',
      lemma: 'during',
      partOfSpeech: 'preposition',
      wordForms: [],
      definition: 'Throughout the duration of.',
      translationPtBr: '',
      ipa: '/ˈdjʊrɪŋ/',
      cefr: 'B1',
      bookFrequency: 1,
      firstSentenceId: null,
      resolutionStatus: 'RESOLVED',
      pedagogicalRelevance: 'OPTIONAL',
      senses: [{
        id: 'sense-during-1',
        senseKey: 'during-1',
        definition: 'Throughout the duration of.',
        translationPtBr: 'durante',
      }],
      updatedAt: '2026-09-11T00:00:00.000Z',
    };

    expect(cardFieldsFromLexicon(entry)).toEqual({
      translation: 'durante',
      pronunciation: '/ˈdjʊrɪŋ/',
      partOfSpeech: 'preposition',
      definition: 'Throughout the duration of.',
    });
  });

  it('preserva uma seleção com várias palavras para procurar uma expressão exata', () => {
    expect(lexiconLookupTerm('  the contented husband  ')).toBe('the contented husband');
  });
});
