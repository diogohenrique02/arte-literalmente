import { ArrowUpRight, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Book } from '../types';
import { FORMAT_LABELS } from '../types';
import BookCover from './BookCover';
export default function BookCard({ book, favorite = false, onFavorite }: { book: Book; favorite?: boolean; onFavorite?: (book: Book) => void }) {
  return <article className="book-card"><Link className="book-card-cover-link" to={`/livro/${book.id}`} aria-label={`Ver detalhes de ${book.title}`}><BookCover path={book.cover_path} title={book.title}/><span className="format-pill">{FORMAT_LABELS[book.format]}</span></Link>
    <div className="book-card-info"><div className="book-card-meta">{book.genre || 'Literatura'}{book.publication_year ? ` · ${book.publication_year}` : ''}</div><Link to={`/livro/${book.id}`} className="book-title">{book.title}</Link><p className="book-author">{book.author}</p>
      <div className="book-card-actions"><Link to={`/livro/${book.id}`} className="text-action">Conhecer livro <ArrowUpRight size={15}/></Link>{onFavorite && <button className={`favorite-button ${favorite ? 'is-favorite' : ''}`} onClick={() => onFavorite(book)} aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}><Heart size={17} fill={favorite ? 'currentColor' : 'none'}/></button>}</div>
    </div>
  </article>;
}
