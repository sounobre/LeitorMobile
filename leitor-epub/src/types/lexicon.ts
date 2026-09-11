export type LexiconSense = {
  id: string;
  senseKey: string;
  definition: string;
  translationPtBr: string;
};

export type LexiconEntry = {
  id: string;
  bookId: string;
  lemma: string;
  partOfSpeech: string;
  wordForms: string[];
  definition: string;
  translationPtBr: string;
  ipa: string;
  cefr: string;
  bookFrequency: number;
  firstSentenceId: string | null;
  resolutionStatus: string;
  pedagogicalRelevance: string;
  senses: LexiconSense[];
  updatedAt: string;
};

export type LexiconJob = {
  id: string;
  bookId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  progress: number;
  processedUnits: number;
  totalUnits: number;
  processedTokens: number;
  totalLexemes: number;
  phase: string;
  message: string | null;
  errorMessage: string | null;
};
