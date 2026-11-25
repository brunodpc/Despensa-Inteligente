import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChefHat, Home, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function SetupPage() {
  const [name, setName] = useState('Minha casa')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function createHousehold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError('')
    const { error: rpcError } = await supabase.rpc('create_household', { p_name: name.trim() })
    if (rpcError) { setError(rpcError.message); setBusy(false); return }
    navigate(0)
  }

  return <main className="setup-page"><section className="setup-card setup-card-wide"><div className="setup-brand"><div className="brand-mark"><ChefHat size={23}/></div><span>despensa inteligente</span></div><div className="setup-illustration"><div className="setup-illustration-circle"><Home size={34}/><span><Users size={16}/></span></div></div><span className="eyebrow">PRIMEIRO PASSO</span><h1>Vamos organizar sua casa?</h1><p>Crie a residência que será compartilhada com as pessoas que usam a mesma cozinha. O estoque e as compras ficarão vinculados a ela.</p><form onSubmit={createHousehold} className="setup-form"><label htmlFor="household-name">Nome da residência</label><input id="household-name" className="text-input" value={name} onChange={e => setName(e.target.value)} maxLength={60} required/><button className="button button-primary" disabled={busy || !name.trim()}>{busy ? 'Criando...' : 'Criar minha residência'}</button>{error && <div className="form-alert error">{error}</div>}</form><small className="setup-footnote">Você poderá convidar outros membros nas configurações da residência.</small></section></main>
}
