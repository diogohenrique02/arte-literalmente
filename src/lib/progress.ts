import type { BookFormat, ReadingProgress } from '../types';
const KEY = 'arte-literalmente:reading-progress';
type ProgressMap = Record<string, ReadingProgress>;
function readAll(): ProgressMap {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as ProgressMap; } catch { return {}; }
}
export function progressKey(bookId: string, userId?: string | null): string { return `${userId ?? 'guest'}:${bookId}`; }
export function readProgress(bookId: string, userId?: string | null): ReadingProgress | null {
  return readAll()[progressKey(bookId, userId)] ?? null;
}
export function saveProgress(progress: ReadingProgress, userId?: string | null): void {
  const all = readAll();
  all[progressKey(progress.book_id, userId)] = { ...progress, user_id: userId ?? undefined, updated_at: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(all));
}
export function createProgress(bookId: string, format: BookFormat, previous?: ReadingProgress | null): ReadingProgress {
  return { book_id: bookId, format, position: previous?.position ?? 0, cfi: previous?.cfi ?? null, page: previous?.page ?? 1, font_size: previous?.font_size ?? 18, theme: previous?.theme ?? 'light' };
}