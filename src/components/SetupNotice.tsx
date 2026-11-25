import { AlertCircle } from 'lucide-react'
export function SetupNotice({ title, detail }: { title: string; detail: string }) {
  return <main className="setup-page"><section className="setup-card"><div className="notice-icon"><AlertCircle size={22} /></div><h1>{title}</h1><p>{detail}</p><button className="button button-primary" onClick={() => window.location.reload()}>Tentar novamente</button></section></main>
}
