import { describe, expect, it } from 'vitest';
import { filterBooks, getPageRange, isBookFormat, normalizeText, validateBookInput } from '../src/lib/catalog';
import type { Book } from '../src/types';
const book = (overrides: Partial<Book> = {}): Book => ({ id:'1', title:'A Árvore', author:'João Silva', description:null, cover_path:null, file_path:null, format:'epub', genre:'Romance', tags:[], publication_year:1920, language:'pt-BR', publisher:null, source_url:'https://example.org', rights_status:'public_domain_verified', published:true, allow_download:false, created_at:'2024-01-01T00:00:00Z', updated_at:'2024-01-01T00:00:00Z', ...overrides });
describe('catálogo', () => {
  it('normaliza acentos e caixa', () => expect(normalizeText(' ÁRVORE ')).toBe('arvore'));
  it('filtra por título/autor sem diferenciar acentos', () => expect(filterBooks([book()], { query:'joao' })).toHaveLength(1));
  it('filtra por formato e gênero', () => expect(filterBooks([book(), book({id:'2',format:'pdf',genre:'História'})], {format:'pdf',genre:'História'})).toHaveLength(1));
  it('ordena título alfabeticamente', () => expect(filterBooks([book({title:'Zebra'}),book({id:'2',title:'Abelha'})],{sort:'title'}).map(b=>b.title)).toEqual(['Abelha','Zebra']));
  it('calcula paginação sem exceder o total', () => expect(getPageRange(2,10,25)).toEqual({from:20,to:24}));
  it('aceita apenas formatos implementados', () => { expect(isBookFormat('pdf')).toBe(true); expect(isBookFormat('mobi')).toBe(false); });
  it('exige procedência e direitos revisados', () => { expect(validateBookInput({title:'T',author:'A',format:'txt',source_url:'https://example.org',rights_status:'pending_review'})).toContain('Confirme a situação dos direitos antes de publicar.'); });
});