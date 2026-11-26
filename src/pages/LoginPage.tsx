import { useState } from 'react'
import type { FormEvent } from 'react'
import { ChefHat, Eye, EyeOff, Leaf, LockKeyhole, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'signup' | 'recover'

export function LoginPage() {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      if (mode === 'login') await signIn(email, password)
      else if (mode === 'signup') {
        const result = await signUp(email, password)
        setMessage(result.needsEmailConfirmation ? 'Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.' : 'Conta criada com sucesso!')
      } else {
        await requestPasswordReset(email)
        setMessage('Link de recuperação enviado. Abra o e-mail e use o botão para criar uma nova senha.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a operação.')
    } finally { setBusy(false) }
  }

  function switchMode(next: Mode) {
    setMode(next); setError(''); setMessage('')
  }

  const title = mode === 'login' ? 'Que bom ter você de volta.' : mode === 'signup' ? 'Vamos criar sua conta.' : 'Vamos recuperar sua senha.'
  const subtitle = mode === 'login'
    ? 'Entre para acessar a despensa da sua casa.'
    : mode === 'signup'
      ? 'Crie sua conta para começar a organizar.'
      : 'Informe o e-mail da sua conta para receber o link de recuperação.'
  const submitLabel = busy
    ? 'Aguarde...'
    : mode === 'login'
      ? 'Entrar na minha despensa'
      : mode === 'signup'
        ? 'Criar minha conta'
        : 'Enviar link de recuperação'

  return <main className="auth-layout"><section className="auth-story"><div className="auth-brand"><div className="brand-mark"><ChefHat size={24}/></div><div><strong>despensa</strong><span>INTELIGENTE</span></div></div><div className="auth-story-content"><div className="eyebrow"><Leaf size={14}/> ROTINA MAIS LEVE, COZINHA ORGANIZADA</div><h1>Uma cozinha bem cuidada começa com <em>boas escolhas.</em></h1><p>Saiba o que tem em casa, planeje suas compras e acompanhe tudo junto com quem divide a cozinha com você.</p><div className="auth-feature-list"><span><i/> Estoque sempre organizado</span><span><i/> Compras sem esquecer nada</span><span><i/> Gastos sob controle</span></div></div><div className="auth-story-footer">Feito para simplificar a rotina da sua casa.</div></section><section className="auth-panel"><div className="auth-form-wrap"><div className="auth-mobile-symbol"><div className="brand-mark"><ChefHat size={22}/></div><span>despensa inteligente</span></div><div className="auth-heading"><span className="eyebrow">{mode === 'recover' ? 'RECUPERAÇÃO DE ACESSO' : 'BEM-VINDO À SUA COZINHA'}</span><h2>{title}</h2><p>{subtitle}</p></div><form onSubmit={submit} className="auth-form"><label htmlFor="email">E-mail</label><div className="input-with-icon"><Mail size={17}/><input id="email" type="email" autoComplete="email" placeholder="voce@email.com" value={email} onChange={e => setEmail(e.target.value)} required/></div>{mode !== 'recover' && <><label htmlFor="password">Senha</label><div className="input-with-icon"><LockKeyhole size={17}/><input id="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Mínimo de 8 caracteres" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required/><button className="password-toggle" type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></>}{mode === 'login' && <button className="auth-forgot" type="button" onClick={() => switchMode('recover')}>Esqueci minha senha</button>}{error && <div className="form-alert error">{error}</div>}{message && <div className="form-alert success">{message}</div>}<button className="button button-primary auth-submit" disabled={busy}>{submitLabel}</button></form><p className="auth-switch">{mode === 'login' ? 'Ainda não tem uma conta?' : mode === 'signup' ? 'Já possui uma conta?' : 'Lembrou da senha?'} <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Criar conta' : mode === 'signup' ? 'Fazer login' : 'Voltar para o login'}</button></p><div className="auth-security"><LockKeyhole size={14}/> Seus dados são protegidos e compartilhados apenas com sua residência.</div></div></section></main>
}
