import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookProcessingDetailsModal } from '../src/BookProcessingDetailsModal';
import type { LexiconEntry, LexiconJob } from '../src/api';
import type { Book } from '../src/types';

const book: Book = {
  id: 'test-029-book',
  fileHash: 'test-029-hash',
  originalName: 'test-029-lexicon.epub',
  title: 'TEST-029 Lexical Modal',
  author: 'Synthetic Author',
  language: 'en',
  coverUri: null,
  description: '',
  publisher: '',
  importedAt: '2026-01-01T00:00:00Z',
  lastOpenedAt: null,
  lastCfi: null,
  progress: 0,
  fileAvailable: true,
  coverAvailable: false,
};

const job: LexiconJob = {
  id: 'test-029-job',
  bookId: book.id,
  status: 'COMPLETED',
  progress: 1,
  processedUnits: 1,
  totalUnits: 1,
  processedTokens: 7,
  totalLexemes: 1,
  phase: 'COMPLETED',
  message: 'Synthetic lexical fixture ready.',
  errorMessage: null,
};

const senseEntry: LexiconEntry = {
  lemma: 'dragon',
  partOfSpeech: 'noun',
  wordForms: ['dragon'],
  definition: '',
  translationPtBr: '',
  ipa: '/ˈdræɡən/',
  cefr: 'A2',
  bookFrequency: 7,
  firstSentenceId: null,
  resolutionStatus: 'RESOLVED_LOCAL',
  pedagogicalRelevance: null,
  senses: [{
    id: 'test-029-sense',
    senseKey: 'dragon.n.01',
    definition: 'definition from sense',
    translationPtBr: 'tradução por sentido',
  }],
};

const optionalEntry = {
  lemma: 'mystery',
  partOfSpeech: null,
  senses: [],
} as unknown as LexiconEntry;

function Harness() {
  const fixture = new URLSearchParams(window.location.search).get('fixture');
  const [lookupCalls, setLookupCalls] = useState<string[]>([]);
  const [closed, setClosed] = useState(false);

  return (
    <>
      <output data-testid="lookup-calls">{lookupCalls.join('|')}</output>
      <output data-testid="close-state">{closed ? 'closed' : 'open'}</output>
      <BookProcessingDetailsModal
        book={book}
        job={job}
        onLookup={async (term) => {
          setLookupCalls((previous) => [...previous, term]);
          return fixture === 'optional' ? optionalEntry : senseEntry;
        }}
        onClose={() => setClosed(true)}
      />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
