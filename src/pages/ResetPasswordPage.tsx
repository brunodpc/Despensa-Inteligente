import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChefHat, Eye, EyeOff, Leaf, LockKeyhole } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function ResetPasswordPage() {
  const { user, loading, updatePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return }
    if (password.length < 8) { setError('Use pelo menos 8 caracteres.'); return }
    setBusy(true)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar a senha.')
    } finally { setBusy(false) }
  }

  async function backToLogin() {
    await signOut()
    navigate('/')
  }

  const canReset = !loading && !!user && !done

  return <main className="auth-layout"><section className="auth-story"><div className="auth-brand"><div className="brand-mark"><ChefHat size={24}/></div><div><strong>despensa</strong><span>INTELIGENTE</span></div></div><div className="auth-story-content"><div className="eyebrow"><Leaf size={14}/> SEU ACESSO, EM BOAS MÃOS</div><h1>Um novo começo é só <em>uma senha.</em></h1><p>Escolha uma senha segura para continuar cuidando da sua despensa e das compras da casa.</p><div className="auth-feature-list"><span><i/> Estoque sempre organizado</span><span><i/> Compras sem esquecer nada</span><span><i/> Gastos sob controle</span></div></div><div className="auth-story-footer">Feito para simplificar a rotina da sua casa.</div></section><section className="auth-panel"><div className="auth-form-wrap"><div className="auth-mobile-symbol"><div className="brand-mark"><ChefHat size={22}/></div><span>despensa inteligente</span></div><div className="auth-heading"><span className="eyebrow">NOVA SENHA</span><h2>{done ? 'Senha atualizada!' : loading ? 'Verificando o link...' : user ? 'Defina sua nova senha.' : 'Link inválido ou expirado.'}</h2><p>{done ? 'Sua nova senha já está ativa. Entre novamente para continuar.' : loading ? 'Estamos confirmando o link de recuperação.' : user ? 'Escolha uma senha com pelo menos 8 caracteres.' : 'Solicite um novo link na tela de login.'}</p></div>{canReset && <form onSubmit={submit} className="auth-form"><label htmlFor="new-password">Nova senha</label><div className="input-with-icon"><LockKeyhole size={17}/><input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required/><button className="password-toggle" type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div><label htmlFor="confirm-password">Confirmar senha</label><div className="input-with-icon"><LockKeyhole size={17}/><input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Repita a nova senha" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required/></div>{error && <div className="form-alert error">{error}</div>}<button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Salvando...' : 'Salvar nova senha'}</button></form>}{!loading && !user && !done && <div className="form-alert error">Este link de recuperação não pode mais ser usado. Peça um novo na tela inicial.</div>}{done && <div className="form-alert success">Senha alterada com sucesso.</div>}{(done || (!loading && !user)) && <button className="button button-primary auth-submit" onClick={() => void backToLogin()}>Voltar para o login</button>}<div className="auth-security"><LockKeyhole size={14}/> Seus dados são protegidos e compartilhados apenas com sua residência.</div></div></section></main>
}
