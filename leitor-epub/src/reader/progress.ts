export function normalizeReaderProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  const normalized = progress > 1 ? progress / 100 : progress;
  return Math.max(0, Math.min(1, normalized));
}

export function locationForProgress(locations: readonly string[], progress: number): string | null {
  if (locations.length === 0) return null;
  const bounded = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return locations[Math.round(bounded * (locations.length - 1))] ?? null;
}
