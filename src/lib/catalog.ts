import type { Book, BookFormat } from '../types';

export interface CatalogFilters { query?: string; genre?: string; format?: string; language?: string; year?: string; sort?: string; }
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
export function filterBooks(books: Book[], filters: CatalogFilters): Book[] {
  const q = normalizeText(filters.query ?? '');
  return books.filter((book) => {
    const searchable = normalizeText(`${book.title} ${book.author} ${book.description ?? ''} ${book.genre ?? ''}`);
    return (!q || searchable.includes(q))
      && (!filters.genre || book.genre === filters.genre)
      && (!filters.format || book.format === filters.format)
      && (!filters.language || book.language === filters.language)
      && (!filters.year || String(book.publication_year ?? '') === filters.year);
  }).sort((a, b) => {
    switch (filters.sort) {
      case 'title': return a.title.localeCompare(b.title, 'pt-BR');
      case 'author': return a.author.localeCompare(b.author, 'pt-BR');
      default: return b.created_at.localeCompare(a.created_at);
    }
  });
}
export function isBookFormat(value: string): value is BookFormat {
  return value === 'epub' || value === 'pdf' || value === 'txt';
}
export function getPageRange(page: number, pageSize: number, total: number): { from: number; to: number } {
  const safePage = Math.max(0, Math.floor(page));
  return { from: safePage * pageSize, to: Math.min(safePage * pageSize + pageSize - 1, Math.max(0, total - 1)) };
}
export function validateBookInput(input: Partial<Book>): string[] {
  const errors: string[] = [];
  if (!input.title?.trim()) errors.push('Informe o título.');
  if (!input.author?.trim()) errors.push('Informe o autor.');
  if (!input.format || !isBookFormat(input.format)) errors.push('Selecione um formato válido (EPUB, PDF ou TXT).');
  if (!input.source_url?.trim()) errors.push('Informe a fonte de procedência.');
  if (!input.rights_status || input.rights_status === 'pending_review') errors.push('Confirme a situação dos direitos antes de publicar.');
  if (input.source_url && !/^https?:\/\//i.test(input.source_url)) errors.push('A fonte deve ser uma URL HTTP ou HTTPS.');
  return errors;
}