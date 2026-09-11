import { useEffect, useState } from 'react';
import type { Book } from './types';
import type { LexiconEntry, LexiconJob } from './api';
import { describeLexiconJob } from './bookDetails';

type DetailedLexiconEntry = LexiconEntry & {
  definition?: string;
  translationPtBr?: string;
  ipa?: string;
  cefr?: string;
  bookFrequency?: number;
  resolutionStatus?: string;
  senses: Array<LexiconEntry['senses'][number] & { translationPtBr?: string }>;
};

type Props = {
  book: Book;
  job?: LexiconJob;
  onLookup(term: string): Promise<LexiconEntry | null>;
  onClose(): void;
};

export function BookProcessingDetailsModal({ book, job, onLookup, onClose }: Props) {
  const details = describeLexiconJob(job);
  const [term, setTerm] = useState('');
  const [entry, setEntry] = useState<DetailedLexiconEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');

  useEffect(() => {
    setTerm('');
    setEntry(null);
    setLookupMessage('');
  }, [book.id]);

  async function handleLookup() {
    const query = term.trim();
    if (!query || loading) return;
    setLoading(true);
    setLookupMessage('');
    try {
      setEntry(await onLookup(query) as DetailedLexiconEntry | null);
      if (!entry) setLookupMessage('');
    } catch (cause) {
      setEntry(null);
      setLookupMessage(cause instanceof Error ? cause.message : 'Não foi possível consultar o termo.');
    } finally {
      setLoading(false);
    }
  }

  const statusClass = job?.status === 'FAILED' ? 'is-error' : job?.status === 'COMPLETED' ? 'is-success' : 'is-progress';
  const progress = job ? Math.max(0, Math.min(1, job.progress || (job.totalUnits ? job.processedUnits / job.totalUnits : 0))) : 0;
  const currentEntry = entry;
  const entryDefinition = currentEntry?.definition || currentEntry?.senses[0]?.definition || '';
  const entryTranslation = currentEntry?.translationPtBr || currentEntry?.senses[0]?.translationPtBr || '';
  const entryFrequency = currentEntry?.bookFrequency ?? 0;
  const entryStatus = currentEntry?.resolutionStatus || (entryDefinition ? 'RESOLVED_LOCAL' : 'UNRESOLVED');

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal processing-details-modal" role="dialog" aria-modal="true" aria-label={`Detalhes do processamento de ${book.title}`}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">DETALHES DO LIVRO</span>
            <h2>{book.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar detalhes">×</button>
        </div>
        <p className="modal-intro">{book.author || 'Autor desconhecido'} · acompanhe a saúde do léxico e confira termos preparados.</p>

        <div className="details-status-head">
          <span className={`details-status-chip ${statusClass}`}>{details.statusLabel}</span>
          <span className="details-phase">{details.phaseLabel}</span>
        </div>

        <div className="details-panel">
          <div className="details-panel-heading"><h3>Resumo do processamento</h3><span>{Math.round(progress * 100)}%</span></div>
          <div className="details-progress-line"><span style={{ width: `${progress * 100}%` }} /></div>
          <div className="details-metrics">
            <Metric label="Unidades" value={details.progressLabel} />
            <Metric label="Tokens" value={details.tokensLabel} />
            <Metric label="Léxicos" value={details.lexemesLabel} />
            <Metric label="Fase atual" value={details.phaseLabel} />
          </div>
          <p className="details-message">{details.message}</p>
          <p className={job?.errorMessage ? 'details-error' : 'details-muted'}>{details.errorMessage}</p>
        </div>

        <div className="details-panel details-api-panel">
          <div className="details-panel-heading"><h3>Status da API</h3><span>snapshot atual</span></div>
          <pre>{`status: ${job?.status || '—'}\nphase: ${job?.phase || '—'}\nprocessedUnits: ${job?.processedUnits ?? '—'}\ntotalUnits: ${job?.totalUnits ?? '—'}\nerrorMessage: ${job?.errorMessage || 'null'}`}</pre>
        </div>

        <div className="details-lookup">
          <div className="details-section-heading">
            <div><span className="eyebrow">CONFERÊNCIA</span><h3>Consultar termo do léxico</h3></div>
            <span className="details-lookup-method">GET /lexicon/lookup</span>
          </div>
          <p className="details-muted">Digite um termo como <code>kelsier</code> para conferir a definição, tradução e resolução que chegaram ao front.</p>
          <div className="details-lookup-form">
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void handleLookup(); }}
              placeholder="Ex.: kelsier"
              aria-label="Termo para consultar"
              autoCapitalize="none"
            />
            <button className="secondary-button" onClick={() => void handleLookup()} disabled={!term.trim() || loading}>
              {loading ? 'Consultando…' : 'Consultar'}
            </button>
          </div>
          <p className="details-endpoint">/api/books/{book.id}/lexicon/lookup?term={encodeURIComponent(term.trim() || '...')}</p>

          {lookupMessage ? <p className="details-error" role="alert">{lookupMessage}</p> : null}
          {currentEntry ? (
            <div className="details-entry" aria-live="polite">
              <div className="details-entry-heading">
                <div><strong>{currentEntry.lemma}</strong><span>{currentEntry.partOfSpeech || 'Classe não informada'} · {entryFrequency} ocorrências</span></div>
                <span className={`details-status-chip ${entryStatus === 'UNRESOLVED' ? 'is-error' : 'is-success'}`}>{entryStatus}</span>
              </div>
              <EntryRow label="Definição" value={entryDefinition || 'Sem definição disponível.'} />
              <EntryRow label="Tradução" value={entryTranslation || 'Sem tradução disponível.'} />
              <EntryRow label="IPA" value={currentEntry.ipa || '—'} />
              <EntryRow label="CEFR" value={currentEntry.cefr || '—'} />
              <span className="details-muted">{currentEntry.senses.length} sentido(s) catalogado(s)</span>
            </div>
          ) : term.trim() && !loading && !lookupMessage ? <p className="details-muted">Nenhum resultado encontrado para “{term.trim()}”.</p> : null}
        </div>

        <div className="modal-actions"><button className="ghost-button" onClick={onClose}>Fechar</button></div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="details-metric"><span>{label}</span><strong>{value}</strong></div>; }
function EntryRow({ label, value }: { label: string; value: string }) { return <div className="details-entry-row"><span>{label}</span><p>{value}</p></div>; }
