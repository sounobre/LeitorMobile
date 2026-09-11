import type { LexiconJob } from './api';

export type LexiconJobDetails = {
  statusLabel: string;
  phaseLabel: string;
  progressLabel: string;
  tokensLabel: string;
  lexemesLabel: string;
  message: string;
  errorMessage: string;
};

const numberFormat = new Intl.NumberFormat('pt-BR');

export function describeLexiconJob(job: LexiconJob | null | undefined): LexiconJobDetails {
  if (!job) {
    return {
      statusLabel: 'Sem processamento',
      phaseLabel: 'Aguardando início',
      progressLabel: 'Nenhum processamento iniciado',
      tokensLabel: '—',
      lexemesLabel: '—',
      message: 'Ainda não há um processamento registrado para este livro.',
      errorMessage: 'Nenhum erro registrado',
    };
  }

  return {
    statusLabel: statusLabel(job.status),
    phaseLabel: phaseLabel(job.phase),
    progressLabel: `${job.processedUnits} de ${job.totalUnits} unidades`,
    tokensLabel: `${numberFormat.format(job.processedTokens)} tokens processados`,
    lexemesLabel: `${numberFormat.format(job.totalLexemes)} léxicos`,
    message: job.message || 'Sem mensagem adicional.',
    errorMessage: job.errorMessage || 'Nenhum erro registrado',
  };
}

function statusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case 'COMPLETED': return 'Concluído';
    case 'RUNNING': return 'Em andamento';
    case 'QUEUED': return 'Na fila';
    case 'FAILED': return 'Falhou';
    default: return status || 'Desconhecido';
  }
}

function phaseLabel(phase: string): string {
  switch (phase.toUpperCase()) {
    case 'COMPLETED': return 'Concluído';
    case 'EXTRACTING': return 'Extraindo EPUB';
    case 'ANALYZING': return 'Analisando texto';
    case 'ENRICHING': return 'Enriquecendo léxico';
    case 'QUEUED': return 'Aguardando início';
    default: return phase || 'Preparando léxico';
  }
}
