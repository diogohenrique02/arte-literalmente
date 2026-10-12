import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import Notice from '../components/Notice';
import { requireSupabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function BookRequest() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess(false);

    if (!title.trim() || !author.trim()) {
      setError('Preencha o título e o nome do autor.');
      return;
    }

    setBusy(true);

    try {
      const db = requireSupabase();
      const { error: insertError } = await db
        .from('book_requests')
        .insert({
          title: title.trim(),
          author: author.trim(),
          email: email.trim() || null,
          user_id: user?.id ?? null,
          status: 'pending',
        });

      if (insertError) throw insertError;

      setTitle('');
      setAuthor('');
      setEmail('');
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar sua solicitação.'
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

      <section className="admin-panel" style={{ maxWidth: 680, margin: '2rem auto' }}>
        <div className="eyebrow">PARTICIPE DA BIBLIOTECA</div>
        <h1>Solicitar um livro</h1>
        <p>
          Não encontrou uma obra no catálogo? Envie sua sugestão.
          Nossa equipe poderá avaliar a possibilidade de incluí-la.
        </p>

        {error && <Notice type="error">{error}</Notice>}
        {success && (
          <Notice type="success">
            Solicitação enviada! Obrigado por ajudar a ampliar a biblioteca.
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
              placeholder="Nome da obra"
            />
          </label>

          <label>
            Autor *
            <input
              required
              maxLength={200}
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="Nome do autor"
            />
          </label>

          <label>
            E-mail para contato (opcional)
            <input
              type="email"
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
            />
          </label>

          <button className="button button-primary" disabled={busy}>
            <Send size={17} />
            {busy ? 'Enviando…' : 'Enviar solicitação'}
          </button>
        </form>
      </section>
    </main>
  );
}
