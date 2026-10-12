import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus, Moon, Sun, LoaderCircle, BookOpen } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import ePub, { type Book as EpubBook, type Rendition } from 'epubjs';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Book, ReadingProgress } from '../types';
import { createProgress, readProgress, saveProgress } from '../lib/progress';
import { requireSupabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import Notice from '../components/Notice';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
type ReaderLocation = { fileUrl?: string };
export default function Reader() {
  const { id } = useParams(); const location = useLocation(); const navState = location.state as ReaderLocation | null; const { user } = useAuth();
  const [book, setBook] = useState<Book | null>(null); const [fileUrl, setFileUrl] = useState(navState?.fileUrl ?? ''); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [fontSize, setFontSize] = useState(18); const [theme, setTheme] = useState<'light'|'dark'>('light'); const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(0); const [progress, setProgress] = useState(0); const [busy, setBusy] = useState(false);
  const epubHost = useRef<HTMLDivElement>(null); const txtHost = useRef<HTMLDivElement>(null); const canvasHost = useRef<HTMLDivElement>(null); const epubBook = useRef<EpubBook | null>(null); const rendition = useRef<Rendition | null>(null); const pdfDoc = useRef<pdfjsLib.PDFDocumentProxy | null>(null); const renderTask = useRef<pdfjsLib.RenderTask | null>(null); const operation = useRef(0); const saved = useRef<ReadingProgress | null>(null);
  const format = book?.format;
  const persist = useCallback((patch: Partial<ReadingProgress>) => { if (!book) return; const base = saved.current ?? createProgress(book.id, book.format, readProgress(book.id, user?.id)); const next = { ...base, ...patch, book_id: book.id, format: book.format, font_size: fontSize, theme }; saved.current = next; saveProgress(next, user?.id); setProgress(next.position); if (user) { const db = requireSupabase(); void db.from('reading_progress').upsert({ user_id: user.id, book_id: book.id, format: book.format, position: next.position, cfi: next.cfi ?? null, page: next.page ?? null, font_size: next.font_size, theme: next.theme, updated_at: new Date().toISOString() }, { onConflict: 'user_id,book_id' }); } }, [book, user, fontSize, theme]);
  useEffect(() => { let alive = true; (async () => { try { const db = requireSupabase(); const { data, error: e } = await db.from('books').select('*').eq('id', id).eq('published', true).single(); if (e) throw e; if (!alive) return; const item = data as Book; setBook(item); const local = readProgress(item.id, user?.id); saved.current = local ?? createProgress(item.id, item.format); setFontSize(local?.font_size ?? 18); setTheme(local?.theme ?? 'light'); setPage(local?.page ?? 1); setProgress(local?.position ?? 0); if (!navState?.fileUrl) { if (!item.file_path) throw new Error('Este livro não possui um arquivo disponível.'); const { data: signed, error: signError } = await db.storage.from('book-files').createSignedUrl(item.file_path, 120); if (signError) throw signError; if (alive) setFileUrl(signed.signedUrl); } } catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Não foi possível abrir o livro.'); } finally { if (alive) setLoading(false); } })(); return () => { alive = false; }; }, [id, user?.id]);
  useEffect(() => {
    if (!book || !fileUrl || !format) return;
    let cancelled = false; const op = ++operation.current;
    const cleanup = () => { try { rendition.current?.destroy(); } catch {} rendition.current = null; try { epubBook.current?.destroy(); } catch {} epubBook.current = null; try { renderTask.current?.cancel(); } catch {} renderTask.current = null; try { pdfDoc.current?.destroy(); } catch {} pdfDoc.current = null; };
    const init = async () => {
      try {
        if (format === 'epub' && epubHost.current) {
          const epub = ePub(fileUrl); epubBook.current = epub;
          const rend = epub.renderTo(epubHost.current, { width: '100%', height: '100%', flow: 'paginated', spread: 'none', manager: 'default' }); rendition.current = rend;
          rend.themes.default({ body: { color: theme === 'dark' ? '#eee9df' : '#292923', background: theme === 'dark' ? '#1e211f' : '#fbf9f4', 'font-family': 'Georgia, serif', 'line-height': '1.8', padding: '1rem 1.5rem' } });
          rend.themes.fontSize(`${fontSize}px`);
          await epub.ready; if (cancelled || op !== operation.current) return;
          await rend.display(saved.current?.cfi || undefined);
          rend.on('relocated', (loc: any) => { if (cancelled || op !== operation.current) return; const pct = loc.start.percentage ?? 0; setProgress(pct); saved.current = { ...(saved.current ?? createProgress(book.id, 'epub')), position: pct, cfi: loc.start.cfi, font_size: fontSize, theme }; saveProgress(saved.current, user?.id); });
        } else if (format === 'pdf') {
          const task = pdfjsLib.getDocument(fileUrl); const doc = await task.promise; if (cancelled || op !== operation.current) { await doc.destroy(); return; } pdfDoc.current = doc; setTotalPages(doc.numPages); const target = Math.min(Math.max(1, saved.current?.page ?? 1), doc.numPages); setPage(target); await renderPdfPage(doc, target, op, cancelled);
        } else if (format === 'txt') {
          const response = await fetch(fileUrl); if (!response.ok) throw new Error(`Não foi possível carregar o texto (HTTP ${response.status}).`); const text = await response.text(); if (cancelled || op !== operation.current) return;
          const pre = document.createElement('pre'); pre.className = 'txt-content'; pre.textContent = text; pre.style.fontSize = `${fontSize}px`; pre.style.color = theme === 'dark' ? '#eee9df' : '#292923'; pre.style.background = theme === 'dark' ? '#1e211f' : '#fbf9f4'; txtHost.current?.replaceChildren(pre); if (txtHost.current) txtHost.current.scrollTop = saved.current?.position ?? 0;
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao renderizar o livro.'); }
    };
    void init();
    return () => { cancelled = true; cleanup(); };
  }, [book?.id, fileUrl, format]);
  const renderPdfPage = async (doc: pdfjsLib.PDFDocumentProxy, nextPage: number, op: number, cancelled = false) => {
    if (!canvasHost.current || cancelled) return;
    try { renderTask.current?.cancel(); } catch {}
    setBusy(true); setError('');
    try {
      const pdfPage = await doc.getPage(nextPage); if (op !== operation.current || cancelled) return;
      const host = canvasHost.current; const base = pdfPage.getViewport({ scale: 1 }); const scale = Math.min((host.clientWidth - 24) / base.width, 1.8); const viewport = pdfPage.getViewport({ scale: Math.max(0.25, scale) });
      const canvas = document.createElement('canvas'); canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height); canvas.setAttribute('aria-label', `Página ${nextPage} de ${doc.numPages}`);
      const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível preparar a área de leitura PDF.');
      const task = pdfPage.render({ canvasContext: context, viewport }); renderTask.current = task; await task.promise;
      if (op === operation.current && !cancelled) { host.replaceChildren(canvas); setPage(nextPage); setTotalPages(doc.numPages); persist({ page: nextPage, position: nextPage / doc.numPages }); }
    } catch (e) { if (!(e instanceof Error && e.name === 'RenderingCancelledException') && !cancelled) setError(e instanceof Error ? e.message : 'Erro ao renderizar página PDF.'); }
    finally { if (op === operation.current && !cancelled) setBusy(false); }
  };
  useEffect(() => { if (!book || !format) return; if (format === 'epub' && rendition.current) { const cfi = saved.current?.cfi; rendition.current.themes.fontSize(`${fontSize}px`); if (cfi) void rendition.current.display(cfi); persist({ font_size: fontSize }); } else if (format === 'txt') { const pre = txtHost.current?.querySelector('pre'); if (pre) pre.style.fontSize = `${fontSize}px`; persist({ font_size: fontSize, position: txtHost.current?.scrollTop ?? 0 }); } }, [fontSize]);
  useEffect(() => { if (!book) return; if (format === 'epub' && rendition.current) { rendition.current.themes.default({ body: { color: theme === 'dark' ? '#eee9df' : '#292923', background: theme === 'dark' ? '#1e211f' : '#fbf9f4', 'font-family': 'Georgia, serif', 'line-height': '1.8' } }); } if (format === 'txt') { const pre = txtHost.current?.querySelector('pre'); if (pre) { pre.style.color = theme === 'dark' ? '#eee9df' : '#292923'; pre.style.background = theme === 'dark' ? '#1e211f' : '#fbf9f4'; } } persist({ theme }); }, [theme]);
  useEffect(() => { const host = canvasHost.current; if (!host || format !== 'pdf') return; const observer = new ResizeObserver(() => { const doc = pdfDoc.current; if (doc) void renderPdfPage(doc, page, operation.current); }); observer.observe(host); return () => observer.disconnect(); }, [format, page]);
  const navigatePdf = (delta: number) => { const doc = pdfDoc.current; if (doc && !busy) void renderPdfPage(doc, Math.min(doc.numPages, Math.max(1, page + delta)), operation.current); };
  const navigateEpub = async (delta: number) => { if (!rendition.current || busy) return; setBusy(true); try { await (delta < 0 ? rendition.current.prev() : rendition.current.next()); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível mudar de página.'); } finally { setBusy(false); } };
  const changeFont = (delta: number) => setFontSize((s) => Math.min(32, Math.max(12, s + delta)));
  const onTxtScroll = () => { if (txtHost.current) { const host = txtHost.current; const max = Math.max(1, host.scrollHeight - host.clientHeight); const ratio = host.scrollTop / max; setProgress(ratio); persist({ position: host.scrollTop }); } };
  return <main className={`reader-page reader-${theme}`}><header className="reader-toolbar"><Link to={book ? `/livro/${book.id}` : '/'} className="reader-back" aria-label="Fechar leitor"><ArrowLeft size={19}/><span>Biblioteca</span></Link><div className="reader-book-title"><BookOpen size={17}/><span>{book?.title ?? 'Leitor'}</span></div><div className="reader-controls"><div className="font-controls"><button className="icon-button" aria-label="Diminuir fonte" onClick={() => changeFont(-1)} disabled={fontSize <= 12}><Minus size={17}/></button><span>{fontSize}px</span><button className="icon-button" aria-label="Aumentar fonte" onClick={() => changeFont(1)} disabled={fontSize >= 32}><Plus size={17}/></button></div><button className="icon-button" onClick={() => setTheme((t) => t === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}>{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button></div></header>
    <div className="reader-workspace">{loading ? <div className="reader-status"><LoaderCircle className="spin" size={26}/><p>Preparando sua leitura…</p></div> : error && !book ? <div className="reader-status"><Notice type="error">{error}</Notice><Link to="/" className="button button-secondary">Voltar</Link></div> : <>{error && <div className="reader-error"><Notice type="error">{error}</Notice></div>}<div className={`reader-document reader-document-${format}`}><div ref={epubHost} className="epub-host" style={{display: format === 'epub' ? 'block' : 'none'}}/><div ref={canvasHost} className="pdf-host" style={{display: format === 'pdf' ? 'flex' : 'none'}}/><div ref={txtHost} className="txt-host" style={{display: format === 'txt' ? 'block' : 'none'}} onScroll={onTxtScroll}/></div></>}</div>
    <footer className="reader-footer"><div className="progress-info"><span>{format === 'pdf' ? `Página ${page} de ${totalPages || '…'}` : format === 'epub' ? 'Progresso da leitura' : 'Posição de leitura'}</span><div className="progress-track"><span style={{width: `${format === 'pdf' && totalPages ? page / totalPages * 100 : Math.min(100, Math.max(0, progress * 100))}%`}}/></div><small>{Math.round(format === 'pdf' && totalPages ? page / totalPages * 100 : progress * 100)}%</small></div>{format !== 'txt' && <div className="reader-page-controls"><button className="button button-secondary" onClick={() => format === 'pdf' ? navigatePdf(-1) : void navigateEpub(-1)} disabled={busy || (format === 'pdf' && page <= 1)}><ChevronLeft size={17}/> Anterior</button><button className="button button-secondary" onClick={() => format === 'pdf' ? navigatePdf(1) : void navigateEpub(1)} disabled={busy || (format === 'pdf' && page >= totalPages)}>Próxima <ChevronRight size={17}/></button></div>}</footer>
  </main>;
}
