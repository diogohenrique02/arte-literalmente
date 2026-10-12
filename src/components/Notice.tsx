import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
export default function Notice({ type = 'info', children }: { type?: 'info' | 'error' | 'success'; children: React.ReactNode }) {
  const Icon = type === 'error' ? AlertCircle : type === 'success' ? CheckCircle2 : Info;
  return <div role={type === 'error' ? 'alert' : 'status'} className={`notice notice-${type}`}><Icon size={18} /> <span>{children}</span></div>;
}