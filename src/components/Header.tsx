import { BookOpen, Menu, Moon, Sun, UserRound, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
export default function Header({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  return <header className="site-header"><div className="header-inner">
    <Link to="/" className="brand"><span className="brand-mark"><BookOpen size={23}/></span><span>Arte <em>Literalmente</em></span></Link>
    <button className="icon-button mobile-menu" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
    <nav className={menuOpen ? 'main-nav nav-open' : 'main-nav'} aria-label="Navegação principal">
      <NavLink to="/" onClick={() => setMenuOpen(false)}>Explorar</NavLink>
<NavLink to="/solicitar-livro" onClick={() => setMenuOpen(false)}>Solicitar um livro</NavLink>
      {user && <NavLink to="/minha-biblioteca" onClick={() => setMenuOpen(false)}>Minha biblioteca</NavLink>}
{user && <NavLink to="/enviar-livro" onClick={() => setMenuOpen(false)}>Enviar um livro</NavLink>}
      {isAdmin && <NavLink to="/admin" onClick={() => setMenuOpen(false)}>Administração</NavLink>}
      <button className="theme-toggle" onClick={onToggleTheme} aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}>{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button>
      <Link className="account-link" to={user ? '/conta' : '/entrar'} onClick={() => setMenuOpen(false)}><UserRound size={17}/>{user ? 'Minha conta' : 'Entrar'}</Link>
    </nav>
  </div></header>;
}
