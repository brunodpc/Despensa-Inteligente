import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertCircle, Check, ChefHat, CircleUserRound, Cloud, Globe2, Info,
  KeyRound, LogOut, Mail, Save, ShieldCheck, SlidersHorizontal,
  Smartphone, Store, Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  applyTheme,
  persistAppPreferences,
  readAppPreferences,
} from '../lib/appPreferences'
import type { AppPreferences, BaseUnitPreference, ExpiryAlertDays, ThemePreference } from '../lib/appPreferences'
import { HouseholdSettingsPage } from './HouseholdSettingsPage'

const DEMO_NAME_KEY = 'despensa-inteligente.demo-profile-name'

type Props = {
  demo?: boolean
  householdId?: string
  householdName?: string
  role?: string
}

export function SettingsPage({ demo = false, householdId, householdName = 'Minha casa', role = 'member' }: Props) {
  const { user, signOut } = useAuth()
  const isDemo = demo || !user || !supabase
  const [displayName, setDisplayName] = useState(() => {
    const metadataName = user?.user_metadata?.display_name ?? user?.user_metadata?.full_name
    if (typeof metadataName === 'string' && metadataName.trim()) return metadataName
    try { return window.localStorage.getItem(DEMO_NAME_KEY) ?? '' } catch { return '' }
  })
  const [preferences, setPreferences] = useState<AppPreferences>(() => readAppPreferences(user?.user_metadata))
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState<'profile' | 'preferences' | 'email' | 'password' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const metadataName = user?.user_metadata?.display_name ?? user?.user_metadata?.full_name
    if (typeof metadataName === 'string') setDisplayName(metadataName)
    setPreferences(readAppPreferences(user?.user_metadata))
    persistAppPreferences(readAppPreferences(user?.user_metadata))
  }, [user?.id, user?.user_metadata])

  function clearFeedback() { setError(''); setNotice('') }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    const name = displayName.trim()
    if (!name) { setError('Informe como deseja ser identificado no aplicativo.'); return }
    setBusy('profile')
    try {
      if (isDemo) {
        window.localStorage.setItem(DEMO_NAME_KEY, name)
        setNotice('Nome salvo neste navegador. Para associá-lo a uma conta, conecte o Supabase e entre na sua conta.')
      } else {
        const { error: updateError } = await supabase!.auth.updateUser({
          data: { ...user!.user_metadata, display_name: name },
        })
        if (updateError) throw updateError
        setNotice('Seu perfil foi atualizado.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar o perfil.')
    } finally { setBusy(null) }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    setBusy('preferences')
    persistAppPreferences(preferences)
    try {
      if (!isDemo) {
        const { error: updateError } = await supabase!.auth.updateUser({
          data: { ...user!.user_metadata, app_preferences: preferences },
        })
        if (updateError) throw updateError
        setNotice('Preferências salvas na sua conta e neste dispositivo.')
      } else {
        setNotice('Preferências salvas neste navegador. Elas não serão sincronizadas com outros dispositivos enquanto o Supabase não estiver conectado.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar as preferências na conta. Elas foram mantidas neste dispositivo.')
    } finally { setBusy(null) }
  }

  async function requestEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    if (isDemo) { setError('Conecte sua conta para alterar o e-mail.'); return }
    if (!newEmail.trim() || newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setError('Informe um e-mail diferente do atual.')
      return
    }
    setBusy('email')
    try {
      const { error: updateError } = await supabase!.auth.updateUser({ email: newEmail.trim().toLowerCase() })
      if (updateError) throw updateError
      setNotice('Solicitação registrada. Siga as instruções de confirmação enviadas pelo Supabase para concluir a alteração do e-mail.')
      setNewEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível solicitar a alteração do e-mail.')
    } finally { setBusy(null) }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    if (isDemo) { setError('A alteração de senha fica disponível depois que você conectar e acessar uma conta.'); return }
    if (newPassword.length < 8) { setError('A nova senha deve ter pelo menos 8 caracteres.'); return }
    if (newPassword !== confirmPassword) { setError('A confirmação da senha não corresponde.'); return }
    setBusy('password')
    try {
      const { error: updateError } = await supabase!.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setNewPassword(''); setConfirmPassword('')
      setNotice('Senha atualizada com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a senha.')
    } finally { setBusy(null) }
  }

  async function handleSignOut() {
    clearFeedback()
    try { await signOut() }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível sair da conta.') }
  }

  return (
    <div className="account-settings-page">
      <div className="page-heading-row account-settings-heading">
        <div><span className="eyebrow">PREFERÊNCIAS E CONTA</span><h1>Configurações</h1><p>Gerencie seu perfil, o comportamento do aplicativo e as informações da residência.</p></div>
        <div className="settings-house-icon"><SlidersHorizontal size={22}/></div>
      </div>

      <div className={`settings-environment ${isDemo ? 'demo' : 'connected'}`}>
        {isDemo ? <AlertCircle size={17}/> : <Cloud size={17}/>}
        <span><strong>{isDemo ? 'Prévia local — modo demonstração' : 'Conta conectada'}</strong>{isDemo ? ' As configurações de perfil e preferências ficam salvas somente neste navegador. Conecte o Supabase para ativar conta e sincronização.' : ' As preferências da conta são sincronizadas pelo Supabase.'}</span>
      </div>

      {error && <div className="form-alert error settings-feedback">{error}</div>}
      {notice && <div className="form-alert success settings-feedback"><Check size={15}/>{notice}</div>}

      <nav className="settings-section-nav" aria-label="Seções das configurações">
        <a href="#perfil"><CircleUserRound size={15}/> Minha conta</a>
        <a href="#aplicativo"><SlidersHorizontal size={15}/> Aplicativo</a>
        <a href="#residencia"><Users size={15}/> Residência</a>
        <a href="#sobre"><Info size={15}/> Sobre</a>
      </nav>

      <section className="panel account-settings-panel" id="perfil">
        <div className="panel-heading"><div><h2>Minha conta</h2><p>Informações de identificação e segurança.</p></div><CircleUserRound size={20}/></div>
        <form className="settings-form" onSubmit={event => void saveProfile(event)}>
          <label>Nome de exibição<input className="text-input" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Como devemos chamar você?" maxLength={70}/><small>Esse nome será usado na interface. Você poderá alterá-lo depois.</small></label>
          <label>E-mail da conta<input className="text-input" value={user?.email ?? 'Não conectado — prévia local'} readOnly disabled/><small>{isDemo ? 'O e-mail ficará disponível quando você entrar em uma conta.' : 'Identificador de acesso da sua conta.'}</small></label>
          <div className="settings-form-actions"><button className="button button-primary" disabled={busy !== null}><Save size={15}/>{busy === 'profile' ? 'Salvando...' : 'Salvar perfil'}</button></div>
        </form>

        {!isDemo && <div className="settings-subsection">
          <h3><Mail size={16}/> Alterar e-mail</h3>
          <p>O Supabase poderá solicitar confirmação para concluir a troca de endereço.</p>
          <form className="settings-inline-form" onSubmit={event => void requestEmailChange(event)}>
            <input className="text-input" type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} placeholder="novo@email.com" required/>
            <button className="button button-secondary" disabled={busy !== null}>{busy === 'email' ? 'Enviando...' : 'Solicitar alteração'}</button>
          </form>
        </div>}

        <div className="settings-subsection">
          <h3><KeyRound size={16}/> Segurança e senha</h3>
          {isDemo ? <p>Entre em uma conta conectada para atualizar a senha e gerenciar a segurança do acesso.</p> : <form className="settings-form" onSubmit={event => void changePassword(event)}>
            <label>Nova senha<input className="text-input" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" required/></label>
            <label>Confirmar nova senha<input className="text-input" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Digite novamente" required/></label>
            <div className="settings-form-actions"><button className="button button-secondary" disabled={busy !== null}>{busy === 'password' ? 'Atualizando...' : 'Atualizar senha'}</button></div>
          </form>}
        </div>
        {!isDemo && <div className="settings-danger-row"><div><strong>Sair da conta</strong><span>Encerra sua sessão neste dispositivo.</span></div><button className="button button-danger" onClick={() => void handleSignOut()}><LogOut size={15}/> Sair</button></div>}
      </section>

      <section className="panel account-settings-panel" id="aplicativo">
        <div className="panel-heading"><div><h2>Preferências do aplicativo</h2><p>Defina os padrões usados para organizar sua despensa.</p></div><SlidersHorizontal size={20}/></div>
        <form className="settings-form" onSubmit={event => void savePreferences(event)}>
          <div className="settings-preference-grid">
            <label>Unidade padrão para novos produtos<select className="text-input" value={preferences.defaultBaseUnit} onChange={event => setPreferences(current => ({ ...current, defaultBaseUnit: event.target.value as BaseUnitPreference }))}><option value="un">Unidades (un)</option><option value="g">Gramas (g)</option><option value="ml">Mililitros (ml)</option></select><small>Usada como sugestão inicial ao cadastrar um produto. A unidade poderá ser alterada no cadastro.</small></label>
            <label>Alerta de validade<select className="text-input" value={preferences.expiryAlertDays} onChange={event => setPreferences(current => ({ ...current, expiryAlertDays: Number(event.target.value) as ExpiryAlertDays }))}><option value={3}>3 dias antes</option><option value={7}>7 dias antes</option><option value={15}>15 dias antes</option></select><small>Define quando um lote passa a ser destacado como próximo do vencimento.</small></label>
            <label>Aparência<select className="text-input" value={preferences.theme} onChange={event => { const theme = event.target.value as ThemePreference; setPreferences(current => ({ ...current, theme })); applyTheme(theme) }}><option value="light">Claro</option><option value="dark">Escuro</option><option value="system">Seguir o sistema</option></select><small>O tema é aplicado neste dispositivo e sincronizado com sua conta.</small></label>
          </div>
          <div className="settings-fixed-preferences">
            <div><Globe2 size={17}/><span><strong>Idioma</strong><small>Português (Brasil)</small></span><em>PT-BR</em></div>
            <div><Store size={17}/><span><strong>Moeda</strong><small>Real brasileiro</small></span><em>BRL · R$</em></div>
            <div><Smartphone size={17}/><span><strong>Layout</strong><small>Adaptável ao dispositivo</small></span><em>Responsivo</em></div>
          </div>
          <div className="settings-form-actions"><button className="button button-primary" disabled={busy !== null}><Save size={15}/>{busy === 'preferences' ? 'Salvando...' : 'Salvar preferências'}</button></div>
        </form>
        <div className="settings-note"><Info size={15}/><span>Os padrões de unidade e alerta são preferências pessoais. O estoque continua compartilhado entre todos os membros da residência.</span></div>
      </section>

      <section className="account-settings-panel" id="residencia">
        {householdId && !isDemo
          ? <HouseholdSettingsPage householdId={householdId} householdName={householdName} role={role}/>
          : <div className="panel account-settings-panel-inner"><div className="panel-heading"><div><h2>Residência e compartilhamento</h2><p>Convites, membros e informações da casa.</p></div><Users size={20}/></div><div className="settings-locked-state"><Store size={22}/><div><strong>Conecte sua residência para administrar o compartilhamento.</strong><span>Depois de configurar o Supabase e criar sua residência, esta seção permitirá convidar pessoas por e-mail ou link/código e acompanhar os membros.</span></div></div></div>}
      </section>

      <section className="panel account-settings-panel" id="sobre">
        <div className="panel-heading"><div><h2>Sobre a Despensa Inteligente</h2><p>Informações da instalação atual.</p></div><ChefHat size={20}/></div>
        <div className="settings-about-grid">
          <div><span>Versão</span><strong>0.1.0 · Desenvolvimento</strong></div>
          <div><span>Ambiente</span><strong>{isSupabaseConfigured ? 'Supabase configurado' : 'Demonstração local'}</strong></div>
          <div><span>Plataforma</span><strong>Web / PWA</strong></div>
          <div><span>Dados</span><strong>{isDemo ? 'Ilustrativos e locais' : 'Conta e residência'}</strong></div>
        </div>
        <div className="settings-note"><ShieldCheck size={15}/><span>Antes da publicação nas lojas serão adicionados os fluxos de exportação de dados, exclusão de conta e documentos públicos de privacidade. Eles ainda não estão disponíveis nesta versão.</span></div>
      </section>
    </div>
  )
}
