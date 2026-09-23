import { parseReaderBridgeEvent } from './readerBridge';

describe('contrato da ponte do leitor', () => {
  it('aceita eventos discriminados válidos', () => {
    expect(parseReaderBridgeEvent(JSON.stringify({
      type: 'Relocated',
      cfi: 'epubcfi(/6/2!/4/1:0)',
      progress: 0.42,
    }))).toEqual({
      type: 'Relocated',
      cfi: 'epubcfi(/6/2!/4/1:0)',
      progress: 0.42,
    });
  });

  it.each([
    { type: 'Unknown' },
    { type: 'Relocated', cfi: '', progress: 2 },
    { type: 'SelectionChanged', cfiRange: 'cfi', text: '' },
  ])('rejeita mensagens malformadas %#', (event) => {
    expect(() => parseReaderBridgeEvent(event)).toThrow();
  });
});

describe('eventos adicionais da ponte do leitor', () => {
  it('aceita cada tipo de evento sustentado pelo schema', () => {
    expect(parseReaderBridgeEvent({ type: 'ReaderReady', totalLocations: 12 })).toEqual({
      type: 'ReaderReady',
      totalLocations: 12,
    });
    expect(parseReaderBridgeEvent({
      type: 'Relocated',
      cfi: 'epubcfi(/6/2)',
      progress: 1,
      chapterTitle: 'Capítulo 1',
    })).toEqual({
      type: 'Relocated',
      cfi: 'epubcfi(/6/2)',
      progress: 1,
      chapterTitle: 'Capítulo 1',
    });
    expect(parseReaderBridgeEvent(JSON.stringify({
      type: 'SelectionChanged',
      cfiRange: 'epubcfi(/6/2!/4/1:0,/4/1:8)',
      text: 'trecho selecionado',
    }))).toEqual({
      type: 'SelectionChanged',
      cfiRange: 'epubcfi(/6/2!/4/1:0,/4/1:8)',
      text: 'trecho selecionado',
    });
    expect(parseReaderBridgeEvent({
      type: 'SearchResults',
      query: 'termo',
      results: [{ cfi: 'epubcfi(/6/2)', excerpt: 'trecho', chapterTitle: 'Capítulo 1' }],
    })).toEqual({
      type: 'SearchResults',
      query: 'termo',
      results: [{ cfi: 'epubcfi(/6/2)', excerpt: 'trecho', chapterTitle: 'Capítulo 1' }],
    });
    expect(parseReaderBridgeEvent({ type: 'ExternalLinkRequested', url: 'https://example.test/book' }))
      .toEqual({ type: 'ExternalLinkRequested', url: 'https://example.test/book' });
    expect(parseReaderBridgeEvent({ type: 'ReaderError', code: 'LOAD_FAILED', message: 'Falha ao abrir' }))
      .toEqual({ type: 'ReaderError', code: 'LOAD_FAILED', message: 'Falha ao abrir' });
  });

  it.each([
    ['JSON malformado', '{"type":"Relocated"'],
    ['Relocated sem CFI', { type: 'Relocated', cfi: '', progress: 0.5 }],
    ['Relocated abaixo de zero', { type: 'Relocated', cfi: 'cfi', progress: -0.1 }],
    ['Relocated acima de um', { type: 'Relocated', cfi: 'cfi', progress: 1.1 }],
    ['SelectionChanged sem CFI', { type: 'SelectionChanged', cfiRange: '', text: 'texto' }],
    ['SelectionChanged sem texto', { type: 'SelectionChanged', cfiRange: 'cfi', text: '' }],
    ['resultado sem CFI', { type: 'SearchResults', query: 'q', results: [{ cfi: '', excerpt: '', chapterTitle: '' }] }],
    ['URL externa inválida', { type: 'ExternalLinkRequested', url: 'não é URL' }],
    ['ReaderError sem código', { type: 'ReaderError', code: '', message: 'falha' }],
    ['ReaderError sem mensagem', { type: 'ReaderError', code: 'ERR', message: '' }],
  ])('rejeita %s', (_label, event) => {
    expect(() => parseReaderBridgeEvent(event)).toThrow();
  });
});
