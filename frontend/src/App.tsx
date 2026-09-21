import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { archiveCard, createBook, deleteBook, fetchBookCover, getBookLexiconJob, getMe, listBooks, listCards, logout, lookupBookLexicon, moveCardToEnd, readStoredUser, startBookLexicon, updateCard, uploadBookContent } from './api';
import type { LexiconJob, User } from './api';
import LoginView from './LoginView';
import EpubReader from './EpubReader';
import { BookProcessingDetailsModal } from './BookProcessingDetailsModal';
import { isEpubFile, sha256Hex } from './bookUpload';
import type { Book, Card, CreateBookInput, UpdateCardInput } from './types';

type Section = 'books' | 'cards';
type BookFormValue = CreateBookInput & { file: File | null };

const emptyBook: BookFormValue = {
  originalName: '',
  title: '',
  author: '',
  language: 'pt-BR',
  file: null,
};

function App() {
  const [section, setSection] = useState<Section>('books');
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const [books, setBooks] = useState<Book[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showBookForm, setShowBookForm] = useState(false);
  const [bookForm, setBookForm] = useState<BookFormValue>(emptyBook);
  const [submittingBook, setSubmittingBook] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [lexiconJobs, setLexiconJobs] = useState<Record<string, LexiconJob>>({});
  const [detailsBook, setDetailsBook] = useState<Book | null>(null);

  async function loadBooks(value = search) {
    setLoading(true);
    setError('');
    try {
      setBooks(await listBooks(value));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  async function loadCards() {
    setLoading(true);
    setError('');
    try {
      setCards(await listCards());
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void getMe().then(setUser).catch(() => { logout(); setUser(null); });
  }, []);

  useEffect(() => {
    if (user) void loadBooks('');
  }, [user]);

  useEffect(() => {
    if (!user || !books.length) {
      setLexiconJobs({});
      return;
    }
    let cancelled = false;
    async function pollLexiconJobs() {
      const results = await Promise.all(books.map(async (book) => {
        try {
          return [book.id, await getBookLexiconJob(book.id)] as const;
        } catch {
          return [book.id, null] as const;
        }
      }));
      if (cancelled) return;
      setLexiconJobs((current) => {
        const next = { ...current };
        for (const [bookId, job] of results) {
          if (job) next[bookId] = job;
          else delete next[bookId];
        }
        return next;
      });
    }
    void pollLexiconJobs();
    const timer = window.setInterval(() => { void pollLexiconJobs(); }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [books, user]);

  useEffect(() => {
    if (user && section === 'cards') void loadCards();
  }, [section, user]);

  const currentCard = cards[0];
  const bookCountLabel = `${books.length} ${books.length === 1 ? 'livro' : 'livros'}`;
  const cardCountLabel = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'} na fila`;

  function handleBookProgressUpdated(updatedBook: Book) {
    setBooks((items) => items.map((item) => item.id === updatedBook.id ? updatedBook : item));
    setReadingBook((current) => current?.id === updatedBook.id ? updatedBook : current);
  }

  async function handleCreateBook(event: FormEvent) {
    event.preventDefault();
    if (submittingBook) return;
    const epub = bookForm.file;
    if (!epub) {
      setError('Selecione um arquivo EPUB.');
      return;
    }
    if (!isEpubFile(epub)) {
      setError('Selecione um arquivo com extensão .epub.');
      return;
    }

    const title = bookForm.title.trim() || epub.name.replace(/\.epub$/i, '');
    setError('');
    setNotice('');
    setSubmittingBook(true);
    let created: Book | null = null;
    try {
      created = await createBook({
        originalName: epub.name,
        fileHash: await sha256Hex(epub),
        title,
        author: bookForm.author.trim(),
        language: bookForm.language.trim() || 'pt-BR',
      });
      const uploaded = await uploadBookContent(created.id, epub);
      setBooks((items) => [uploaded, ...items]);
      setBookForm(emptyBook);
      setShowBookForm(false);
      try {
        const job = await startBookLexicon(uploaded.id);
        setLexiconJobs((current) => ({ ...current, [uploaded.id]: job }));
        setNotice('Livro adicionado e processamento do léxico iniciado.');
      } catch (cause) {
        setNotice(`Livro adicionado, mas o processamento não foi iniciado: ${messageOf(cause)}`);
      }
    } catch (cause) {
      if (created) await deleteBook(created.id).catch(() => undefined);
      setError(messageOf(cause));
    } finally {
      setSubmittingBook(false);
    }
  }

  async function handleReprocessBook(book: Book) {
    setNotice('');
    try {
      const job = await startBookLexicon(book.id, true);
      setLexiconJobs((current) => ({ ...current, [book.id]: job }));
      setNotice(job.status === 'RUNNING' ? 'Reprocessamento ja esta em andamento.' : 'Reprocessamento do lexico iniciado.');
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function handleDeleteBook(book: Book) {
    if (!window.confirm(`Remover “${book.title}” da biblioteca?`)) return;
    try {
      await deleteBook(book.id);
      setBooks((items) => items.filter((item) => item.id !== book.id));
      setLexiconJobs((current) => {
        const next = { ...current };
        delete next[book.id];
        return next;
      });
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function handleArchive() {
    if (!currentCard) return;
    try {
      await archiveCard(currentCard.id);
      setCards((items) => items.slice(1));
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function handleReviewLater() {
    if (!currentCard) return;
    try {
      await moveCardToEnd(currentCard.id);
      setCards((items) => [...items.slice(1), currentCard]);
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function handleSaveCard(input: UpdateCardInput) {
    if (!editingCard) return;
    try {
      const saved = await updateCard(editingCard.id, input);
      setCards((items) => items.map((item) => item.id === saved.id ? saved : item));
      setEditingCard(null);
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  if (!user) return <LoginView onLoggedIn={setUser} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">⌘</span><span>Leitor</span></div>
        <p className="sidebar-caption">Sua biblioteca, em qualquer tela.</p>
        <nav className="main-nav" aria-label="Navegação principal">
          <button className={section === 'books' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('books')}>
            <span>▦</span><span>Biblioteca</span><small>{bookCountLabel}</small>
          </button>
          <button className={section === 'cards' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('cards')}>
            <span>✦</span><span>Cards</span><small>{cardCountLabel}</small>
          </button>
          <button className="nav-item muted" disabled><span>↥</span><span>Backup</span><small>Em breve</small></button>
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> API local conectada</div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{section === 'books' ? 'BIBLIOTECA' : 'REVISÃO'}</p>
            <h1>{section === 'books' ? 'Livros' : 'Cards de estudo'}</h1>
          </div>
          <div className="topbar-actions">
            {section === 'books' ? (
              <button className="primary-button" onClick={() => { setError(''); setBookForm(emptyBook); setShowBookForm(true); }}><span>＋</span> Adicionar livro</button>
            ) : null}
            <button className="user-button" onClick={() => { logout(); setUser(null); }}>Sair · {user?.email}</button>
          </div>
        </header>

        {error ? <div className="error-banner" role="alert">{error}<button onClick={() => setError('')}>×</button></div> : null}
        {notice ? <div className="success-banner" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div> : null}

        {section === 'books' ? (
          <LibraryView
            books={books}
            search={search}
            loading={loading}
            onSearch={(value) => { setSearch(value); void loadBooks(value); }}
            onDelete={handleDeleteBook}
            onReprocess={handleReprocessBook}
            onDetails={(book) => setDetailsBook(book)}
            lexiconJobs={lexiconJobs}
            onOpen={(book) => setReadingBook(book)}
          />
        ) : (
          <CardsView
            card={currentCard}
            remaining={cards.length}
            loading={loading}
            onArchive={() => void handleArchive()}
            onReviewLater={() => void handleReviewLater()}
            onEdit={() => currentCard && setEditingCard(currentCard)}
          />
        )}
      </main>

      {showBookForm ? <BookForm value={bookForm} onChange={setBookForm} onSubmit={(event) => void handleCreateBook(event)} onClose={() => { if (!submittingBook) setShowBookForm(false); }} submitting={submittingBook} /> : null}
      {editingCard ? <CardEditor card={editingCard} onSave={(input) => void handleSaveCard(input)} onClose={() => setEditingCard(null)} /> : null}
      {detailsBook ? <BookProcessingDetailsModal book={detailsBook} job={lexiconJobs[detailsBook.id]} onLookup={(term) => lookupBookLexicon(detailsBook.id, term)} onClose={() => setDetailsBook(null)} /> : null}
      {readingBook ? <EpubReader book={readingBook} onClose={() => setReadingBook(null)} onProgressUpdated={handleBookProgressUpdated} onCardCreated={(card) => setCards((items) => items.some((item) => item.id === card.id) ? items : [card, ...items])} /> : null}
    </div>
  );
}

function LibraryView({ books, search, loading, onSearch, onDelete, onReprocess, onDetails, lexiconJobs, onOpen }: { books: Book[]; search: string; loading: boolean; onSearch: (value: string) => void; onDelete: (book: Book) => void; onReprocess: (book: Book) => void; onDetails: (book: Book) => void; lexiconJobs: Record<string, LexiconJob>; onOpen: (book: Book) => void }) {
  return (
    <>
      <div className="library-toolbar"><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar por título ou autor" /></label><span className="result-count">{books.length} resultados</span></div>
      {loading && books.length === 0 ? <Loading /> : books.length === 0 ? <EmptyLibrary hasSearch={Boolean(search)} /> : <div className="book-grid">{books.map((book) => <BookTile key={book.id} book={book} job={lexiconJobs[book.id]} onDelete={() => onDelete(book)} onReprocess={() => onReprocess(book)} onDetails={() => onDetails(book)} onOpen={() => onOpen(book)} />)}</div>}
    </>
  );
}

function BookTile({ book, job, onDelete, onReprocess, onDetails, onOpen }: { book: Book; job?: LexiconJob; onDelete: () => void; onReprocess: () => void; onDetails: () => void; onOpen: () => void }) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const percent = Math.round(book.progress * 100);
  const jobActive = job?.status === 'QUEUED' || job?.status === 'RUNNING';
  const lexiconPercent = Math.max(0, Math.min(100, Math.round((job?.progress ?? 0) * 100)));

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (book.coverAvailable) {
      void fetchBookCover(book.id).then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setCoverUrl(objectUrl);
      }).catch(() => undefined);
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book.id, book.coverAvailable]);

  return <article className="book-tile" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpen(); }}>
    <div className="book-cover">
      {coverUrl ? <img src={coverUrl} alt={`Capa de ${book.title}`} /> : <span>▧</span>}
      <div className="tile-menu-wrap" onClick={(event) => event.stopPropagation()}>
        <button className="tile-menu" title="Opcoes do livro" aria-label="Opcoes do livro" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>⋮</button>
        {menuOpen ? <div className="book-menu" role="menu">
          <button role="menuitem" onClick={() => { setMenuOpen(false); onDetails(); }}>Detalhes do processamento</button>
          <button role="menuitem" disabled={jobActive} onClick={() => { setMenuOpen(false); onReprocess(); }}>{jobActive ? 'Reprocessando...' : 'Reprocessar léxico'}</button>
          <button role="menuitem" onClick={() => { setMenuOpen(false); onDelete(); }}>Excluir livro</button>
        </div> : null}
      </div>
    </div>
    <div className="book-info"><h2>{book.title}</h2><p>{book.author || 'Autor desconhecido'}</p><div className="progress-line"><span style={{ width: `${percent}%` }} /></div><span className="progress-label">{percent}% lido</span><small className="book-open-hint">{book.fileAvailable ? 'Abrir livro' : 'Conteúdo pendente'}</small>{jobActive ? <div className="lexicon-status" role="status"><div className="lexicon-status-row"><strong>{lexiconPhaseLabel(job?.phase)}</strong><span>{lexiconPercent}%</span></div><div className="lexicon-progress-line"><span style={{ width: lexiconPercent + '%' }} /></div><small>{job?.processedUnits ?? 0}/{job?.totalUnits ?? 0} unidades · {job?.processedTokens ?? 0} tokens</small>{job?.message ? <small>{job.message}</small> : null}</div> : job?.status === 'FAILED' ? <div className="lexicon-status lexicon-status-error" role="alert"><strong>Falha no léxico</strong><small>{job.errorMessage || job.message || 'Não foi possível processar este livro.'}</small></div> : null}</div>
  </article>;
}

function lexiconPhaseLabel(phase?: string) {
  switch (phase) {
    case 'EXTRACTING': return 'Extraindo EPUB';
    case 'ANALYZING': return 'Analisando palavras';
    case 'ENRICHING': return 'Enriquecendo com Ollama';
    case 'COMPLETED': return 'Léxico atualizado';
    case 'FAILED': return 'Falha no processamento';
    default: return 'Preparando léxico';
  }
}

function CardsView({ card, remaining, loading, onArchive, onReviewLater, onEdit }: { card?: Card; remaining: number; loading: boolean; onArchive: () => void; onReviewLater: () => void; onEdit: () => void }) {
  const [showBack, setShowBack] = useState(false);
  useEffect(() => setShowBack(false), [card?.id]);
  if (loading && !card) return <Loading />;
  if (!card) return <section className="empty-state"><div className="empty-icon">✦</div><h2>Fila vazia</h2><p>Selecione uma palavra ou frase em um livro e transforme-a em um card.</p></section>;
  const mainText = showBack ? card.translation || 'Tradução ainda não preenchida.' : card.selectedText;
  return <section className="cards-workspace"><div className="queue-heading"><div><span className="eyebrow">PRÓXIMO CARD</span><h2>{remaining} na fila</h2></div><span className="queue-hint">← arquivar&nbsp;&nbsp; → rever depois</span></div><article className="learning-card"><div className="card-topline"><span>{showBack ? 'VERSO' : 'FRENTE'}</span><button onClick={() => setShowBack((value) => !value)} aria-label="Virar card">↕</button></div><button className="card-flip-area" onClick={() => setShowBack((value) => !value)}><strong>{mainText}</strong>{!showBack && card.pronunciation ? <em>/{card.pronunciation}/</em> : null}{!showBack && card.partOfSpeech ? <small>{card.partOfSpeech}</small> : null}{showBack && card.definition ? <p>{card.definition}</p> : null}<span>Toque para ver o {showBack ? 'texto original' : 'verso'}</span></button>{card.background ? <CardSection title="Contexto">{card.background}</CardSection> : null}{card.examples.length ? <CardSection title="Exemplos"><ul>{card.examples.map((value) => <li key={value}>{value}</li>)}</ul></CardSection> : null}{card.relatedWords.length ? <CardSection title="Relacionadas"><ul>{card.relatedWords.map((value) => <li key={value}>{value}</li>)}</ul></CardSection> : null}<div className="card-actions"><button className="ghost-button" onClick={onEdit}>Editar</button><button className="secondary-button" onClick={onReviewLater}>Rever depois</button><button className="primary-button" onClick={onArchive}>Arquivar</button></div></article></section>;
}

function CardSection({ title, children }: { title: string; children: ReactNode }) { return <div className="card-section"><h3>{title}</h3><div>{children}</div></div>; }

function BookForm({ value, onChange, onSubmit, onClose, submitting }: { value: BookFormValue; onChange: (value: BookFormValue) => void; onSubmit: (event: FormEvent) => void; onClose: () => void; submitting: boolean }) {
  return <Modal title="Adicionar livro" onClose={onClose}>
    <p className="modal-intro">Selecione um arquivo EPUB para enviar à biblioteca. O título pode ser preenchido automaticamente a partir do nome do arquivo.</p>
    <form onSubmit={onSubmit} className="form-grid">
      <label>Arquivo EPUB<input required type="file" accept=".epub,application/epub+zip" onChange={(event) => { const file = event.target.files?.[0] ?? null; onChange({ ...value, file, originalName: file?.name ?? '', title: value.title || (file ? file.name.replace(/\.epub$/i, '') : '') }); }} /></label>
      {value.file ? <small className="selected-file">Arquivo selecionado: {value.file.name}</small> : null}
      <label>Título<input value={value.title} placeholder="Título do livro" onChange={(event) => onChange({ ...value, title: event.target.value })} /></label>
      <label>Autor<input value={value.author} onChange={(event) => onChange({ ...value, author: event.target.value })} /></label>
      <label>Idioma<input value={value.language} onChange={(event) => onChange({ ...value, language: event.target.value })} /></label>
      <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={submitting}>Cancelar</button><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Enviando…' : 'Adicionar livro'}</button></div>
    </form>
  </Modal>;
}

function CardEditor({ card, onSave, onClose }: { card: Card; onSave: (input: UpdateCardInput) => void; onClose: () => void }) { const [value, setValue] = useState<UpdateCardInput>({ selectedText: card.selectedText, translation: card.translation, pronunciation: card.pronunciation, partOfSpeech: card.partOfSpeech, definition: card.definition, background: card.background, examples: card.examples, relatedWords: card.relatedWords }); const update = (key: Exclude<keyof UpdateCardInput, 'examples' | 'relatedWords'>, next: string) => setValue((current) => ({ ...current, [key]: next })); return <Modal title="Editar card" onClose={onClose}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSave(value); }}><label>Texto selecionado<textarea required value={value.selectedText} onChange={(event) => update('selectedText', event.target.value)} /></label><label>Tradução<textarea value={value.translation} onChange={(event) => update('translation', event.target.value)} /></label><div className="form-two"><label>Pronúncia<input value={value.pronunciation} onChange={(event) => update('pronunciation', event.target.value)} /></label><label>Classe gramatical<input value={value.partOfSpeech} onChange={(event) => update('partOfSpeech', event.target.value)} /></label></div><label>Definição<textarea value={value.definition} onChange={(event) => update('definition', event.target.value)} /></label><label>Contexto<textarea value={value.background} onChange={(event) => update('background', event.target.value)} /></label><div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit">Salvar alterações</button></div></form></Modal>; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button onClick={onClose} aria-label="Fechar">×</button></div>{children}</section></div>; }

function EmptyLibrary({ hasSearch }: { hasSearch: boolean }) { return <section className="empty-state"><div className="empty-icon">▧</div><h2>{hasSearch ? 'Nenhum livro encontrado' : 'Sua biblioteca está vazia'}</h2><p>{hasSearch ? 'Tente outro título ou autor.' : 'Adicione um livro para começar a leitura.'}</p></section>; }
function Loading() { return <div className="loading">Carregando…</div>; }
function messageOf(cause: unknown) { return cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.'; }

export default App;
