import { BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
export default function BookCover({ path, title, className = '' }: { path: string | null; title: string; className?: string }) {
  const src = path && supabase ? (path.startsWith('http') ? path : supabase.storage.from('book-covers').getPublicUrl(path).data.publicUrl) : null;
  return <div className={`book-cover ${className}`}>{src ? <img loading="lazy" src={src} alt={`Capa de ${title}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <div className="cover-placeholder"><BookOpen size={30} strokeWidth={1.2} /><span>{title}</span></div>}</div>;
}