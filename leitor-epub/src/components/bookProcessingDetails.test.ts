import type { LexiconJob } from '@/types/lexicon';
import { describeLexiconJob } from './bookProcessingDetails';

describe('detalhes do processamento lexical', () => {
  it('apresenta o resumo de um job concluído para o modal', () => {
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

    expect(describeLexiconJob(job)).toEqual({
      statusLabel: 'Concluído',
      phaseLabel: 'Concluído',
      progressLabel: '45 de 45 unidades',
      tokensLabel: '44.128 tokens processados',
      lexemesLabel: '4.233 léxicos',
      message: 'Léxico preparado com sucesso.',
      errorMessage: 'Nenhum erro registrado',
    });
  });
});
