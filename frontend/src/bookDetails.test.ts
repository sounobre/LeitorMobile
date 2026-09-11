import type { LexiconJob } from './api';
import { describeLexiconJob } from './bookDetails';

const job: LexiconJob = {
  id: 'job-1',
  bookId: 'book-1',
  status: 'COMPLETED',
  progress: 1,
  processedUnits: 45,
  totalUnits: 45,
  processedTokens: 44128,
  totalLexemes: 4233,
  phase: 'COMPLETED',
  message: 'Léxico preparado com sucesso.',
  errorMessage: null,
};

const details = describeLexiconJob(job);
if (details.statusLabel !== 'Concluído'
  || details.phaseLabel !== 'Concluído'
  || details.progressLabel !== '45 de 45 unidades'
  || details.tokensLabel !== '44.128 tokens processados'
  || details.lexemesLabel !== '4.233 léxicos'
  || details.errorMessage !== 'Nenhum erro registrado') {
  throw new Error('O resumo do job concluído não está no formato esperado.');
}

export {};
