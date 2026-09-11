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
