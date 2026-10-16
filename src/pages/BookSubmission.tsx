import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import Notice from '../components/Notice';
import { requireSupabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function BookSubmission() {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<'epub' | 'pdf'>('epub');
  const [rightsStatus, setRightsStatus] = useState<
    'public_domain' | 'open_license' | 'permission_granted' | 'pending_review'
  >('pending_review');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess(false);

    if (!user) {
      setError('Entre na sua conta para enviar um livro.');
      return;
    }

    if (!file) {
      setError('Selecione um arquivo EPUB ou PDF.');
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension !== format) {
      setError('O formato selecionado precisa corresponder ao arquivo.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('O arquivo ultrapassa o limite de 50 MB.');
      return;
    }

    if (!rightsConfirmed) {
      setError('Confirme a declaração sobre os direitos da obra.');
      return;
    }

    setBusy(true);

    let uploadedPath: string | null = null;

    try {
      const db = requireSupabase();
      const id = crypto.randomUUID();
      uploadedPath = `${user.id}/${id}.${format}`;

      const { error: uploadError } = await db.storage
        .from('book-submissions')
        .upload(uploadedPath, file, {
          upsert: false,
          contentType:
            format === 'pdf' ? 'application/pdf' : 'application/epub+zip',
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await db
        .from('book_submissions')
        .insert({
          user_id: user.id,
          title: title.trim(),
          author: author.trim(),
          description: description.trim(),
          format,
          file_path: uploadedPath,
          rights_status: 'pending_review',
          rights_confirmed: rightsConfirmed,
          status: 'pending',
        });

      if (insertError) throw insertError;

      setTitle('');
      setAuthor('');
      setDescription('');
      setFormat('epub');
      setRightsStatus('pending_review');
      setRightsConfirmed(false);
      setFile(null);

      const input = document.getElementById(
        'submission-file',
      ) as HTMLInputElement | null;

      if (input) input.value = '';

      setSuccess(true);
      uploadedPath = null;
    } catch (err) {
      if (uploadedPath) {
        await requireSupabase()
          .storage.from('book-submissions')
          .remove([uploadedPath]);
      }

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar o livro.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <Link to="/" className="back-link">
        <ArrowLeft size={17} /> Voltar à biblioteca
      </Link>

      <section
        className="admin-panel"
        style={{ maxWidth: 720, margin: '2rem auto' }}
      >
        <div className="eyebrow">CONTRIBUA COM A BIBLIOTECA</div>
        <h1>Enviar um livro</h1>

        <p>
          Envie uma obra para análise. O arquivo permanecerá privado
          enquanto a equipe avalia a submissão e os direitos de publicação.
        </p>

        {error && <Notice type="error">{error}</Notice>}

        {success && (
          <Notice type="success">
            Livro enviado para análise! Ele não será publicado
            automaticamente.
          </Notice>
        )}

        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            Título do livro *
            <input
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label>
            Autor *
            <input
              required
              maxLength={200}
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
            />
          </label>

          <label>
            Descrição *
            <textarea
              required
              rows={4}
              maxLength={5000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label>
            Formato do arquivo *
            <select
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as 'epub' | 'pdf')
              }
            >
              <option value="epub">EPUB</option>
              <option value="pdf">PDF</option>
            </select>
          </label>

          <label>
            Situação dos direitos autorais *
            <select
              value={rightsStatus}
              onChange={(event) =>
                setRightsStatus(
                  event.target.value as
                    | 'public_domain'
                    | 'open_license'
                    | 'permission_granted'
                    | 'pending_review',
                )
              }
            >
              <option value="pending_review">
                Não sei / precisa ser verificado
              </option>
              <option value="public_domain">
                Domínio público
              </option>
              <option value="open_license">
                Licença aberta
              </option>
              <option value="permission_granted">
                Tenho autorização de publicação
              </option>
            </select>
          </label>

          <label className="file-input-label">
            <Upload size={17} /> Arquivo do livro *
            <input
              id="submission-file"
              type="file"
              required
              accept=".epub,.pdf,application/pdf,application/epub+zip"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);

                const ext = selected?.name
                  .split('.')
                  .pop()
                  ?.toLowerCase();

                if (ext === 'epub' || ext === 'pdf') {
                  setFormat(ext);
                }
              }}
            />
            <small>
              {file ? file.name : 'EPUB ou PDF, máximo de 50 MB'}
            </small>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={rightsConfirmed}
              onChange={(event) =>
                setRightsConfirmed(event.target.checked)
              }
              required
            />
            Declaro que as informações fornecidas são verdadeiras e
            compreendo que o envio não garante autorização para publicação.
          </label>

          <button
            className="button button-primary"
            disabled={busy}
            type="submit"
          >
            <Upload size={17} />
            {busy ? 'Enviando…' : 'Enviar para análise'}
          </button>
        </form>
      </section>
    </main>
  );
}

