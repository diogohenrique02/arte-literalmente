import { Search, SlidersHorizontal, Sparkles, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Book } from '../types';
import { filterBooks, getPageRange, type CatalogFilters } from '../lib/catalog';
import { requireSupabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import BookCard from '../components/BookCard';
import Notice from '../components/Notice';
const PAGE_SIZE = 12;
export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<CatalogFilters>({ query: '', genre: '', format: '', language: '', year: '', sort: 'recent' });
  const [page, setPage] = useState(0);
  const [genres, setGenres] = useState<string[]>([]);
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = requireSupabase();
        const { data, error: queryError } = await client.from('books').select('*').eq('published', true).order('created_at', { ascending: false }).limit(500);
        if (queryError) throw queryError;
        if (!cancelled) {
          const rows = (data ?? []) as Book[]; setBooks(rows);
          setGenres([...new Set(rows.map((b) => b.genre).filter((g): g is string => Boolean(g)))].sort());
          if (user) { const { data: favs } = await client.from('favorites').select('book_id').eq('user_id', user.id); if (!cancelled) setFavoriteIds((favs ?? []).map((f) => f.book_id)); }
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível carregar o catálogo.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user]);
  const filtered = useMemo(() => filterBooks(books, filters), [books, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const range = getPageRange(page, PAGE_SIZE, filtered.length);
  const visible = filtered.slice(range.from, range.to + 1);
  const setFilter = (key: keyof CatalogFilters, value: string) => { setFilters((old) => ({ ...old, [key]: value })); setPage(0); };
  const toggleFavorite = async (book: Book) => {
    if (!user) { window.location.assign('/entrar'); return; }
    const client = requireSupabase(); const isFav = favoriteIds.includes(book.id);
    setFavoriteIds((old) => isFav ? old.filter((id) => id !== book.id) : [...old, book.id]);
    const result = isFav ? await client.from('favorites').delete().eq('user_id', user.id).eq('book_id', book.id) : await client.from('favorites').insert({ user_id: user.id, book_id: book.id });
    if (result.error) setFavoriteIds((old) => isFav ? [...old, book.id] : old.filter((id) => id !== book.id));
  };
  const featured = books[0];
  return <main>
    <section className="hero"><div className="hero-text"><div className="eyebrow"><Sparkles size={15}/> UM LUGAR PARA LER SEM PRESSA</div><h1>Histórias que<br/><em>ficam com você.</em></h1><p>Uma biblioteca para descobrir novas ideias, revisitar clássicos e encontrar sua próxima leitura favorita.</p><a href="#catalogo" className="button button-primary"><BookOpen size={18}/> Explorar biblioteca</a><div className="hero-note"><span className="hero-note-dot"/> Livros com procedência e direitos identificados</div></div>
      <div className="hero-art" aria-hidden="true"><div className="sun-disc"/><div className="art-book art-book-back"><span>O prazer<br/>da leitura</span></div><div className="art-book art-book-front"><span className="art-kicker">BIBLIOTECA<br/>DE IDEIAS</span><span className="art-title">Palavras<br/>que florescem</span><span className="art-line"/><span className="art-author">ARTE LITERALMENTE</span></div><div className="art-leaf leaf-one"/><div className="art-leaf leaf-two"/></div>
    </section>
    <section className="catalog-section" id="catalogo"><div className="section-heading"><div><div className="eyebrow">A BIBLIOTECA</div><h2>Encontre sua próxima leitura</h2><p>Obras para explorar no seu ritmo.</p></div><span className="catalog-count">{books.length} {books.length === 1 ? 'livro no catálogo' : 'livros no catálogo'}</span></div>
      <div className="catalog-tools"><label className="search-box"><Search size={19}/><input aria-label="Pesquisar livros" placeholder="Busque por título, autor ou assunto..." value={filters.query} onChange={(e) => setFilter('query', e.target.value)}/>{filters.query && <button aria-label="Limpar pesquisa" onClick={() => setFilter('query', '')}>×</button>}</label>
        <div className="filter-row"><span className="filter-label"><SlidersHorizontal size={16}/> Filtrar</span><select aria-label="Gênero" value={filters.genre} onChange={(e) => setFilter('genre', e.target.value)}><option value="">Todos os gêneros</option>{genres.map((g) => <option key={g}>{g}</option>)}</select><select aria-label="Formato" value={filters.format} onChange={(e) => setFilter('format', e.target.value)}><option value="">Todos os formatos</option><option value="epub">EPUB</option><option value="pdf">PDF</option><option value="txt">TXT</option></select><select aria-label="Ordenação" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}><option value="recent">Mais recentes</option><option value="title">Título A–Z</option><option value="author">Autor A–Z</option></select></div>
      </div>
      {featured && !filters.query && !filters.genre && !filters.format && <div className="featured-strip"><div className="featured-icon"><BookOpen size={23}/></div><div><span className="featured-label">UM BOM COMEÇO</span><strong>{featured.title}</strong><span>{featured.author}</span></div><Link to={`/livro/${featured.id}`} className="text-action">Descobrir <ChevronRight size={17}/></Link></div>}
      {error && <Notice type="error">{error} Confira a configuração do Supabase no arquivo .env.local.</Notice>}
      {loading ? <div className="loading-grid">{Array.from({length: 8}, (_, i) => <div className="skeleton-card" key={i}><div/><span/><span/></div>)}</div> : visible.length ? <><div className="book-grid">{visible.map((book) => <BookCard key={book.id} book={book} favorite={favoriteIds.includes(book.id)} onFavorite={user ? toggleFavorite : undefined}/>)}</div><div className="pagination"><span>{filtered.length} resultado(s)</span><div><button className="icon-button" aria-label="Página anterior" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={18}/></button><span className="page-indicator">{page + 1} / {pageCount}</span><button className="icon-button" aria-label="Próxima página" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}><ChevronRight size={18}/></button></div></div></> : <div className="empty-state"><div><Search size={27}/></div><h3>{error ? 'Catálogo indisponível' : 'Nenhum livro encontrado'}</h3><p>{error ? 'Configure o Supabase para carregar os livros publicados.' : 'Tente buscar por outro termo ou remover algum filtro.'}</p>{!error && <button className="button button-secondary" onClick={() => {setFilters({query:'',genre:'',format:'',language:'',year:'',sort:'recent'});setPage(0);}}>Limpar filtros</button>}</div>}
    </section>
    <section className="quote-band"><span className="quote-mark">“</span><blockquote>Um livro é um sonho que você segura nas mãos.</blockquote><span className="quote-credit">— Neil Gaiman</span></section>
  </main>;
}