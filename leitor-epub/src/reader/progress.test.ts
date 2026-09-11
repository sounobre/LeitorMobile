import { locationForProgress, normalizeReaderProgress } from './progress';

describe('progresso do leitor', () => {
  const locations = ['início', 'um quarto', 'metade', 'fim'];

  it('converte progresso em uma localização estável', () => {
    expect(locationForProgress(locations, 0)).toBe('início');
    expect(locationForProgress(locations, 0.5)).toBe('metade');
    expect(locationForProgress(locations, 1)).toBe('fim');
  });

  it('limita valores inválidos e trata uma lista vazia', () => {
    expect(locationForProgress(locations, -4)).toBe('início');
    expect(locationForProgress(locations, 4)).toBe('fim');
    expect(locationForProgress(locations, Number.NaN)).toBe('início');
    expect(locationForProgress([], 0.5)).toBeNull();
  });

  it('converte porcentagens legadas para a escala de 0 a 1', () => {
    expect(normalizeReaderProgress(5)).toBe(0.05);
    expect(normalizeReaderProgress(0.5)).toBe(0.5);
    expect(normalizeReaderProgress(140)).toBe(1);
  });
});
