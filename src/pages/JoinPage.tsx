import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChefHat, KeyRound, LockKeyhole, Mail, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export function JoinPage({ initialCode = '' }: { initialCode?: string }) {
  const { user, signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState(initialCode.toUpperCase())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => { setCode(initialCode.toUpperCase()) }, [initialCode])

  async function acceptInvitation() {
    if (!user || !supabase) return
    const normalized = code.toUpperCase().replace(/[^A-F0-9]/g, '')
    if (normalized.length !== 32) {
      setError('Informe o código completo do convite (32 caracteres).')
      return
    }
    setAccepting(true); setError(''); setMessage('')
    const { error: acceptError } = await supabase.rpc('accept_household_invitation', { p_code: normalized })
    if (acceptError) {
      setError(acceptError.message)
      setAccepting(false)
    } else {
      setMessage('Convite aceito! Abrindo sua despensa compartilhada...')
      navigate('/', { replace: true })
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const normalized = code.toUpperCase().replace(/[^A-F0-9]/g, '')
      if (normalized.length !== 32) throw new Error('Informe o código completo do convite (32 caracteres).')
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else {
        if (!supabase) throw new Error('O Supabase não está configurado.')
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}/convite?codigo=${normalized}` },
        })
        if (signUpError) throw signUpError
        if (!data.session) {
          setMessage('Conta criada. Confirme o e-mail recebido e abra novamente o link do convite para concluir a entrada na residência.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível validar seus dados.')
    } finally { setBusy(false) }
  }

  if (accepting && !error) {
    return <main className="join-layout"><section className="join-card"><div className="brand-mark"><ChefHat size={24}/></div><span className="eyebrow">DESPENSA INTELIGENTE</span><h1>Quase lá!</h1><p>{message || 'Validando seu convite...'}</p></section></main>
  }

  return <main className="join-layout"><section className="join-card">
    <div className="join-brand"><div className="brand-mark"><ChefHat size={23}/></div><span>despensa inteligente</span></div>
    <div className="join-illustration"><div><Users size={30}/></div></div>
    <span className="eyebrow">CONVITE PARA RESIDÊNCIA</span>
    <h1>Compartilhar a cozinha fica mais fácil.</h1>
    <p>Entre ou crie sua conta para acessar a despensa compartilhada. O convite será validado após a autenticação.</p>
    {!initialCode && <><label htmlFor="join-code">Código de convite</label><div className="join-input-with-icon"><KeyRound size={17}/><input id="join-code" value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-F0-9-]/g, ''))} placeholder="ABCD-1234-..." maxLength={39}/></div></>}
    {initialCode && <div className="join-code-badge"><KeyRound size={16}/> Código de convite recebido</div>}
    {user ? <div className="join-signed-in"><p>Você está conectado como <strong>{user.email}</strong>.</p><div className="join-code-badge"><KeyRound size={15}/> {code.replace(/[^A-F0-9]/gi, '').length === 32 ? 'Código pronto para validação.' : 'Informe o código completo para continuar.'}</div><button className="button button-primary" disabled={accepting || code.replace(/[^A-F0-9]/gi, '').length !== 32} onClick={() => void acceptInvitation()}>{accepting ? 'Validando convite...' : 'Aceitar convite'}</button><button className="join-text-button" onClick={() => void signOut()}>Entrar com outra conta</button></div> : <>
      <div className="join-mode-switch"><button className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); setMessage('') }}>Já tenho conta</button><button className={mode === 'signup' ? 'selected' : ''} onClick={() => { setMode('signup'); setError(''); setMessage('') }}>Criar conta</button></div>
      <form className="join-form" onSubmit={submit}>
        <label htmlFor="join-email">E-mail</label><div className="join-input-with-icon"><Mail size={17}/><input id="join-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@email.com" required/></div>
        <label htmlFor="join-password">Senha</label><div className="join-input-with-icon"><LockKeyhole size={17}/><input id="join-password" type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" required/></div>
        <button className="button button-primary" disabled={busy || code.replace(/[^A-F0-9]/gi, '').length !== 32}>{busy ? 'Aguarde...' : mode === 'login' ? 'Entrar e aceitar convite' : 'Criar conta e continuar'}</button>
      </form>
    </>}
    {error && <div className="form-alert error">{error}</div>}{message && <div className="form-alert success">{message}</div>}
    <div className="join-security"><LockKeyhole size={14}/> O acesso só será concedido após verificar o convite e sua conta.</div>
  </section></main>
}
