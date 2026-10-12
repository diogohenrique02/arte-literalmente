import { useEffect, useState, type FormEvent } from 'react';
import {
  BookPlus, Upload, FileSpreadsheet, Trash2, Save,
  Eye, EyeOff, CheckCircle, XCircle, ClipboardList, ExternalLink,
} from 'lucide-react';
import type { Book, BookFormat, RightsStatus } from '../types';
import { FORMAT_LABELS, RIGHTS_LABELS } from '../types';
import { requireSupabase } from '../lib/supabase';
import { validateBookInput, isBookFormat } from '../lib/catalog';
import Notice from '../components/Notice';

type Submission = {
  id: string;
  user_id: string;
  title: string;
  author: string;
  description: string;
  format: 'epub' | 'pdf';
  file_path: string;
  cover_path: string | null;
  rights_status: string;
  rights_confirmed: boolean;
  status: string;
  review_note: string | null;
  created_at: string;
};

type BookRequest = {
  id: string;
  title: string;
  author: string;
  email: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

const empty = {
  title: '',
  author: '',
  description: '',
  genre: '',
  publication_year: '',
  language: 'pt-BR',
  publisher: '',
  source_url: '',
  rights_status: 'pending_review' as RightsStatus,
  format: 'epub' as BookFormat,
  allow_download: false,
  published: false,
};

const rightsOptions = [
  { value: 'public_domain', label: 'Domínio público verificado' },
  { value: 'open_license', label: 'Licença aberta verificada' },
  { value: 'permission_granted', label: 'Autorização de publicação verificada' },
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
}

export default function Admin() {
  const [books, setBooks] = useState<Book[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [verifiedRights, setVerifiedRights] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const load = async () => {
    const db = requireSupabase();

    const [bookResult, submissionResult, requestResult] = await Promise.all([
      db.from('books').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('book_submissions').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('book_requests').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    if (bookResult.error) throw bookResult.error;
    if (submissionResult.error) throw submissionResult.error;
    if (requestResult.error) throw requestResult.error;

    setBooks((bookResult.data ?? []) as Book[]);
    setSubmissions((submissionResult.data ?? []) as Submission[]);
    setRequests((requestResult.data ?? []) as BookRequest[]);
  };

  useEffect(() => {
    void load().catch((err) => setError(errorMessage(err)));
  }, []);

  const change = <K extends keyof typeof empty>(
    key: K,
    value: (typeof empty)[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const errors = validateBookInput({
      ...form,
      publication_year: form.publication_year ? Number(form.publication_year) : null,
    });

    if (errors.length) {
      setError(errors.join(' '));
      return;
    }

    if (!file) {
      setError('Selecione o arquivo real do livro.');
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();

    if (!isBookFormat(extension ?? '') || extension !== form.format) {
      setError('O arquivo precisa corresponder ao formato selecionado.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('O arquivo excede o limite de 50 MB.');
      return;
    }

    setBusy(true);
    let uploadedPath: string | null = null;
    let uploadedCoverPath: string | null = null;

    try {
      const db = requireSupabase();
      const { data: { user } } = await db.auth.getUser();
      if (!user) throw new Error('Sua sessão expirou. Entre novamente.');

      const id = crypto.randomUUID();
      uploadedPath = `${user.id}/${id}.${extension}`;

      const { error: fileError } = await db.storage
        .from('book-files')
        .upload(uploadedPath, file, {
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        });

      if (fileError) throw fileError;

      if (cover) {
        const coverExtension = cover.name.split('.').pop()?.toLowerCase() || 'jpg';
        uploadedCoverPath = `${user.id}/${id}.${coverExtension}`;

        const { error: coverError } = await db.storage
          .from('book-covers')
          .upload(uploadedCoverPath, cover, {
            upsert: false,
            contentType: cover.type,
          });

        if (coverError) throw coverError;
      }

      const { error: insertError } = await db.from('books').insert({
        id,
        ...form,
        publication_year: form.publication_year ? Number(form.publication_year) : null,
        file_path: uploadedPath,
        cover_path: uploadedCoverPath,
        created_by: user.id,
        tags: [],
        updated_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      setMessage('Livro cadastrado com sucesso.');
      setForm(empty);
      setFile(null);
      setCover(null);
      const input = document.getElementById('book-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await load();
      uploadedPath = null;
      uploadedCoverPath = null;
    } catch (err) {
      if (uploadedPath) {
        await requireSupabase().storage.from('book-files').remove([uploadedPath]);
      }
      if (uploadedCoverPath) {
        await requireSupabase().storage.from('book-covers').remove([uploadedCoverPath]);
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async (book: Book) => {
    setError('');
    setMessage('');
    try {
      const { error: updateError } = await requireSupabase()
        .from('books')
        .update({ published: !book.published, updated_at: new Date().toISOString() })
        .eq('id', book.id);

      if (updateError) throw updateError;
      setMessage(book.published ? 'Livro despublicado.' : 'Livro publicado.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (book: Book) => {
    if (!window.confirm(`Excluir "${book.title}"? Essa ação não pode ser desfeita.`)) return;

    setError('');
    setMessage('');

    try {
      const db = requireSupabase();
      const { error: deleteError } = await db.from('books').delete().eq('id', book.id);
      if (deleteError) throw deleteError;

      if (book.file_path) {
        const { error: storageError } = await db.storage.from('book-files').remove([book.file_path]);
        if (storageError) setError(`Registro excluído, mas não foi possível remover o arquivo: ${storageError.message}`);
      }

      if (book.cover_path) {
        await db.storage.from('book-covers').remove([book.cover_path]);
      }

      setMessage('Livro excluído do catálogo.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const openSubmissionFile = async (submission: Submission) => {
    setError('');
    try {
      const { data, error: signedError } = await requireSupabase()
        .storage.from('book-submissions')
        .createSignedUrl(submission.file_path, 300);

      if (signedError) throw signedError;
      if (!data?.signedUrl) throw new Error('Não foi possível criar o link temporário.');

      setPreviewUrls((current) => ({ ...current, [submission.id]: data.signedUrl }));
    } catch (err) {
      setError(`Não foi possível abrir o arquivo: ${errorMessage(err)}`);
    }
  };

  const reviewSubmission = async (submission: Submission, approve: boolean) => {
    setError('');
    setMessage('');

    const sourceUrl = (sources[submission.id] ?? '').trim();
    const note = (reviewNotes[submission.id] ?? '').trim();
    const rights = verifiedRights[submission.id] ?? '';

    if (approve) {
      if (!sourceUrl) {
        setError(`Informe a fonte original de "${submission.title}" antes de aprovar.`);
        return;
      }

      try {
        const parsedUrl = new URL(sourceUrl);
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
          throw new Error('Use uma URL HTTP ou HTTPS válida.');
        }
      } catch {
        setError('Informe uma URL válida para a fonte original.');
        return;
      }

      if (!rightsOptions.some((option) => option.value === rights)) {
        setError('Selecione a situação dos direitos que você verificou.');
        return;
      }

      if (!window.confirm(
        `Confirma que verificou a fonte e os direitos de "${submission.title}" e que a obra pode ser distribuída?`,
      )) return;
    } else if (!note) {
      setError('Informe uma justificativa para rejeitar o envio.');
      return;
    } else if (!window.confirm(`Rejeitar o envio "${submission.title}"?`)) {
      return;
    }

    setWorkingId(submission.id);

    const db = requireSupabase();
    let destinationPath: string | null = null;
    let createdBookId: string | null = null;

    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) throw new Error('Sua sessão expirou. Entre novamente.');

      if (approve) {
        const { data: blob, error: downloadError } = await db.storage
          .from('book-submissions')
          .download(submission.file_path);

        if (downloadError) throw downloadError;
        if (!blob) throw new Error('O arquivo enviado não foi encontrado.');
        if (blob.size > 50 * 1024 * 1024) {
          throw new Error('O arquivo excede o limite de 50 MB do catálogo.');
        }

        const id = crypto.randomUUID();
        destinationPath = `${user.id}/${id}.${submission.format}`;

        const { error: copyError } = await db.storage
          .from('book-files')
          .upload(destinationPath, blob, {
            upsert: false,
            contentType: submission.format === 'pdf'
              ? 'application/pdf'
              : 'application/epub+zip',
          });

        if (copyError) throw copyError;

        const rightsMap: Record<string, RightsStatus> = {
          public_domain: 'public_domain_verified',
          open_license: 'open_license',
          permission_granted: 'permission_documented',
        };

        const { data: insertedBook, error: insertError } = await db
          .from('books')
          .insert({
            id,
            title: submission.title,
            author: submission.author,
            description: submission.description,
            format: submission.format,
            file_path: destinationPath,
            cover_path: null,
            source_url: sourceUrl,
            rights_status: rightsMap[rights],
            published: false,
            allow_download: false,
            created_by: user.id,
            tags: [],
            genre: null,
            publication_year: null,
            language: 'pt-BR',
            publisher: null,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        createdBookId = insertedBook.id;
      }

      const { error: reviewError } = await db
        .from('book_submissions')
        .update({
          status: approve ? 'approved' : 'rejected',
          rights_status: approve ? rights : submission.rights_status,
          review_note: note || (approve ? 'Direitos e fonte verificados pelo administrador.' : null),
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', submission.id)
        .eq('status', 'pending');

      if (reviewError) throw reviewError;

      if (approve && createdBookId) {
        const { error: publishError } = await db
          .from('books')
          .update({ published: true, updated_at: new Date().toISOString() })
          .eq('id', createdBookId);

        if (publishError) {
          throw new Error(
            `O envio foi revisado, mas o livro ficou como rascunho. Publique-o pela lista do catálogo. Detalhe: ${publishError.message}`,
          );
        }
      }

      setMessage(approve
        ? `“${submission.title}” aprovado e publicado.`
        : `Envio de “${submission.title}” rejeitado.`);

      await load();
    } catch (err) {
      if (createdBookId) {
        await db.from('books').delete().eq('id', createdBookId);
      }
      if (destinationPath) {
        await db.storage.from('book-files').remove([destinationPath]);
      }
      setError(errorMessage(err));
    } finally {
      setWorkingId('');
    }
  };

  const updateRequest = async (
    request: BookRequest,
    status: 'pending' | 'in_progress' | 'fulfilled' | 'rejected',
  ) => {
    setError('');
    setMessage('');
    setWorkingId(request.id);

    try {
      const { data: { user } } = await requireSupabase().auth.getUser();
      if (!user) throw new Error('Sua sessão expirou. Entre novamente.');

      const { error: updateError } = await requireSupabase()
        .from('book_requests')
        .update({
          status,
          admin_note: (requestNotes[request.id] ?? '').trim() || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      const labels: Record<string, string> = {
        pending: 'Pendente',
        in_progress: 'Em análise',
        fulfilled: 'Atendido',
        rejected: 'Rejeitado',
      };

      setMessage(`Solicitação de "${request.title}" atualizada: ${labels[status]}.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorkingId('');
    }
  };

  const parseCsv = async (selectedFile: File) => {
    const text = await selectedFile.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    if (!lines.length) {
      setCsvRows([]);
      return;
    }

    const headers = lines[0].split(',').map((value) => value.trim());
    const rows = lines.slice(1).map((line) =>
      Object.fromEntries(line.split(',').map((value, index) => [headers[index], value.trim()])),
    );

    setCsvRows(rows);
  };

  const importCsv = async () => {
    setError('');
    setMessage('');

    const invalid = csvRows.filter((row) =>
      !row.title || !row.author || !row.source_url || !row.rights_status ||
      row.rights_status === 'pending_review' || !isBookFormat(row.format ?? ''),
    );

    if (invalid.length) {
      setError(`${invalid.length} linha(s) sem campos obrigatórios ou com formato/direitos inválidos. Nenhum registro foi importado.`);
      return;
    }

    setBusy(true);

    try {
      const db = requireSupabase();
      const { data: { user } } = await db.auth.getUser();
      if (!user) throw new Error('Sessão expirada.');

      const payload = csvRows.map((row) => ({
        title: row.title,
        author: row.author,
        source_url: row.source_url,
        rights_status: row.rights_status,
        format: row.format,
        description: row.description || null,
        genre: row.genre || null,
        language: row.language || 'pt-BR',
        publication_year: row.publication_year ? Number(row.publication_year) : null,
        published: false,
        allow_download: false,
        created_by: user.id,
        tags: [],
      }));

      const { error: insertError } = await db.from('books').insert(payload);
      if (insertError) throw insertError;

      setMessage(`${payload.length} metadado(s) importado(s) como rascunho. Arquivos e capas não foram criados.`);
      setCsvRows([]);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const pendingSubmissions = submissions.filter((submission) => submission.status === 'pending');

  const requestStatusLabels: Record<string, string> = {
    pending: 'Pendente',
    in_progress: 'Em análise',
    fulfilled: 'Atendido',
    rejected: 'Rejeitado',
  };

  return (
    <main className="page-shell admin-page">
      <div className="eyebrow">GESTÃO DA BIBLIOTECA</div>
      <h1>Painel administrativo</h1>
      <p>Cadastre obras com fontes identificadas e revise a situação dos direitos antes de publicar.</p>

      {error && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}

      <section className="admin-panel">
        <h2><ClipboardList size={21} /> Revisar livros enviados <span>{pendingSubmissions.length} pendente(s)</span></h2>
        <p>Os arquivos abaixo ficam privados até a revisão. Verifique a licença ou autorização em uma fonte confiável antes de aprovar.</p>

        {pendingSubmissions.length === 0 && <p>Nenhum envio pendente.</p>}

        {pendingSubmissions.map((submission) => (
          <article className="admin-panel" key={submission.id} style={{ marginTop: '1rem' }}>
            <h3>{submission.title}</h3>
            <p><strong>Autor:</strong> {submission.author} · <strong>Formato:</strong> {submission.format.toUpperCase()}</p>
            <p><strong>Enviado em:</strong> {new Date(submission.created_at).toLocaleString('pt-BR')}</p>
            <p><strong>Direitos declarados:</strong> {submission.rights_status}</p>
            <p><strong>Declaração confirmada pelo usuário:</strong> {submission.rights_confirmed ? 'Sim' : 'Não'}</p>
            <p>{submission.description}</p>

            <button
              className="button button-primary"
              type="button"
              onClick={() => void openSubmissionFile(submission)}
            >
              <ExternalLink size={17} /> Gerar link privado temporário
            </button>

            {previewUrls[submission.id] && (
              <p>
                <a href={previewUrls[submission.id]} target="_blank" rel="noreferrer">
                  Abrir arquivo (link expira em 5 minutos)
                </a>
              </p>
            )}

            <label>
              Fonte original verificada (URL) *
              <input
                type="url"
                required
                placeholder="https://..."
                value={sources[submission.id] ?? ''}
                onChange={(event) => setSources((current) => ({
                  ...current, [submission.id]: event.target.value,
                }))}
              />
            </label>

            <label>
              Direitos autorais verificados *
              <select
                value={verifiedRights[submission.id] ?? ''}
                onChange={(event) => setVerifiedRights((current) => ({
                  ...current, [submission.id]: event.target.value,
                }))}
              >
                <option value="">Selecione após verificar</option>
                {rightsOptions.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label>
              Observação da revisão
              <textarea
                rows={2}
                maxLength={2000}
                value={reviewNotes[submission.id] ?? ''}
                onChange={(event) => setReviewNotes((current) => ({
                  ...current, [submission.id]: event.target.value,
                }))}
                placeholder="Observações para o histórico da revisão"
              />
            </label>

            <div className="form-two">
              <button
                className="button button-primary"
                type="button"
                disabled={workingId === submission.id}
                onClick={() => void reviewSubmission(submission, true)}
              >
                <CheckCircle size={17} /> {workingId === submission.id ? 'Processando…' : 'Verificar e aprovar'}
              </button>
              <button
                className="button"
                type="button"
                disabled={workingId === submission.id}
                onClick={() => void reviewSubmission(submission, false)}
              >
                <XCircle size={17} /> Rejeitar envio
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="admin-panel">
        <h2><ClipboardList size={21} /> Solicitações de livros <span>{requests.filter((request) => request.status === 'pending').length} pendente(s)</span></h2>

        {requests.length === 0 && <p>Nenhuma solicitação recebida.</p>}

        {requests.map((request) => (
          <article className="admin-book-row" key={request.id} style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ flex: '1 1 240px' }}>
              <strong>{request.title}</strong>
              <span>Autor: {request.author}</span>
              <span>{request.email ? `Contato: ${request.email}` : 'Sem e-mail informado'}</span>
              <span>Enviada em {new Date(request.created_at).toLocaleDateString('pt-BR')}</span>
              <span>Status: {requestStatusLabels[request.status] ?? request.status}</span>
              {request.admin_note && <span>Observação atual: {request.admin_note}</span>}
            </div>

            <div style={{ flex: '1 1 260px' }}>
              <label>
                Observação administrativa
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={requestNotes[request.id] ?? request.admin_note ?? ''}
                  onChange={(event) => setRequestNotes((current) => ({
                    ...current, [request.id]: event.target.value,
                  }))}
                  placeholder="Ex.: em busca da obra"
                />
              </label>
              <label>
                Atualizar status
                <select
                  value={request.status}
                  disabled={workingId === request.id}
                  onChange={(event) => {
                    const value = event.target.value as
                      | 'pending' | 'in_progress' | 'fulfilled' | 'rejected';
                    void updateRequest(request, value);
                  }}
                >
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em análise</option>
                  <option value="fulfilled">Atendido</option>
                  <option value="rejected">Rejeitado</option>
                </select>
              </label>
            </div>
          </article>
        ))}
      </section>

      <div className="admin-layout">
        <section className="admin-panel">
          <h2><BookPlus size={21} /> Cadastrar livro</h2>

          <form className="admin-form" onSubmit={upload}>
            <label>Título *<input required maxLength={200} value={form.title} onChange={(event) => change('title', event.target.value)} /></label>
            <label>Autor *<input required maxLength={200} value={form.author} onChange={(event) => change('author', event.target.value)} /></label>
            <label>Sinopse<textarea rows={3} value={form.description} onChange={(event) => change('description', event.target.value)} /></label>

            <div className="form-two">
              <label>Gênero<input value={form.genre} onChange={(event) => change('genre', event.target.value)} /></label>
              <label>Ano<input type="number" min="0" max="2100" value={form.publication_year} onChange={(event) => change('publication_year', event.target.value)} /></label>
            </div>

            <div className="form-two">
              <label>Idioma<input value={form.language} onChange={(event) => change('language', event.target.value)} /></label>
              <label>Editora<input value={form.publisher} onChange={(event) => change('publisher', event.target.value)} /></label>
            </div>

            <label>Fonte original (URL) *<input type="url" required placeholder="https://" value={form.source_url} onChange={(event) => change('source_url', event.target.value)} /></label>
            <label>Situação dos direitos *<select value={form.rights_status} onChange={(event) => change('rights_status', event.target.value as RightsStatus)}>{Object.entries(RIGHTS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>Formato do arquivo *<select value={form.format} onChange={(event) => change('format', event.target.value as BookFormat)}>{Object.entries(FORMAT_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>

            <label className="file-input-label"><Upload size={17} /> Arquivo do livro *<input id="book-file" type="file" required accept={`.${form.format}`} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><small>{file ? file.name : `Selecione um arquivo .${form.format} (máx. 50 MB)`}</small></label>
            <label className="file-input-label"><Upload size={17} /> Capa (opcional)<input type="file" accept="image/*" onChange={(event) => setCover(event.target.files?.[0] ?? null)} /><small>{cover?.name ?? 'JPG, PNG ou WebP'}</small></label>
            <label className="checkbox-label"><input type="checkbox" checked={form.allow_download} onChange={(event) => change('allow_download', event.target.checked)} /> Permitir download</label>
            <label className="checkbox-label"><input type="checkbox" checked={form.published} onChange={(event) => change('published', event.target.checked)} /> Publicar imediatamente</label>

            <button className="button button-primary" disabled={busy}><Save size={17} />{busy ? 'Salvando…' : 'Cadastrar livro'}</button>
          </form>
        </section>

        <section className="admin-panel">
          <h2><FileSpreadsheet size={21} /> Importar metadados CSV</h2>
          <p>Importa somente metadados, sempre como rascunhos sem download. Use cabeçalhos: title, author, source_url, rights_status, format, description, genre, language, publication_year.</p>
          <label className="file-input-label"><Upload size={17} /> Selecionar CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void parseCsv(selected); }} /></label>

          {csvRows.length > 0 && (
            <>
              <p>{csvRows.length} linha(s) para pré-visualizar</p>
              <div className="csv-preview">
                {csvRows.slice(0, 5).map((row, index) => (
                  <div key={index}><strong>{row.title || '(sem título)'}</strong><span>{row.author || '(sem autor)'} · {row.format || 'formato ausente'}</span></div>
                ))}
              </div>
              <button className="button button-primary" onClick={() => void importCsv()} disabled={busy}><FileSpreadsheet size={17} /> Validar e importar rascunhos</button>
            </>
          )}
        </section>
      </div>

      <section className="admin-panel admin-books">
        <h2>Catálogo cadastrado <span>{books.length}</span></h2>

        {books.length ? books.map((book) => (
          <div className="admin-book-row" key={book.id}>
            <div>
              <strong>{book.title}</strong>
              <span>{book.author} · {FORMAT_LABELS[book.format]}</span>
            </div>
            <span className={`status-pill ${book.published ? 'status-published' : ''}`}>{book.published ? 'Publicado' : 'Rascunho'}</span>
            <button className="icon-button" onClick={() => void togglePublished(book)} aria-label={book.published ? 'Despublicar livro' : 'Publicar livro'}>{book.published ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            <button className="icon-button danger-icon" onClick={() => void remove(book)} aria-label="Excluir livro"><Trash2 size={17} /></button>
          </div>
        )) : <p>Nenhum livro cadastrado.</p>}
      </section>
    </main>
  );
}

