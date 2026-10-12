import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Notice from '../components/Notice';
import Home from '../pages/Home';
import BookDetails from '../pages/BookDetails';
import Auth from '../pages/Auth';
import Reader from '../pages/Reader';
import Account from '../pages/Account';
import Admin from '../pages/Admin';
import Privacy from '../pages/Privacy';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';
function Protected({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, loading, isAdmin } = useAuth(); const location = useLocation();
  if (loading) return <main className="page-shell"><p>Verificando sessão…</p></main>;
  if (!user) return <Navigate to="/entrar" state={{ from: location.pathname }} replace />;
  if (admin && !isAdmin) return <main className="page-shell"><Notice type="error">Esta área é restrita a administradores autorizados.</Notice></main>;
  return children;
}
function Shell() {
  const [theme, setTheme] = useState<'light'|'dark'>(() => (localStorage.getItem('arte-literalmente:theme') as 'light'|'dark') || 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('arte-literalmente:theme', theme); }, [theme]);
  const location = useLocation();
  const isReader = location.pathname.startsWith('/ler/');
  return <div className="app-shell">{!isReader && <Header theme={theme} onToggleTheme={() => setTheme((t) => t === 'light' ? 'dark' : 'light')}/>}
    {!isSupabaseConfigured && !isReader && <div className="config-banner"><Notice>O Supabase ainda não está configurado. A interface está pronta, mas o catálogo, as contas e os arquivos precisam das variáveis do arquivo .env.local.</Notice></div>}
    <Routes><Route path="/" element={<Home/>}/><Route path="/livro/:id" element={<BookDetails/>}/><Route path="/ler/:id" element={<Reader/>}/><Route path="/entrar" element={<Auth mode="login"/>}/><Route path="/cadastro" element={<Auth mode="signup"/>}/><Route path="/recuperar-senha" element={<Auth mode="recover"/>}/><Route path="/conta" element={<Protected><Account/></Protected>}/><Route path="/minha-biblioteca" element={<Protected><Account favoritesOnly/></Protected>}/><Route path="/admin" element={<Protected admin><Admin/></Protected>}/><Route path="/privacidade" element={<Privacy/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>
    {!isReader && <footer className="site-footer"><div className="footer-brand">Arte <em>Literalmente</em></div><p>Livros, ideias e novas perspectivas.</p><div><a href="mailto:contato@arteliteralmente.example">Contato</a><a href="/privacidade">Privacidade</a><span>© {new Date().getFullYear()} Arte Literalmente</span></div></footer>}
  </div>;
}
export default function App() { return <AuthProvider><Shell/></AuthProvider>; }