import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { AppShell } from '../components/AppShell'
import { LoginPage } from '../pages/LoginPage'
import { SetupPage } from '../pages/SetupPage'
import { OverviewPage } from '../pages/OverviewPage'
import { ShoppingPage } from '../pages/ShoppingPage'
import { RegisterPurchasePage } from '../pages/RegisterPurchasePage'
import { MarketModePage } from '../pages/MarketModePage'
import { PriceHistoryPage } from '../pages/PriceHistoryPage'
import { ReportsPage } from '../pages/ReportsPage'
import { LoadingScreen } from '../components/LoadingScreen'
import { SetupNotice } from '../components/SetupNotice'
import { JoinPage } from '../pages/JoinPage'
import { SettingsPage } from '../pages/SettingsPage'
import { PantryPage } from '../pages/PantryPage'
import { ConsumptionPage } from '../pages/ConsumptionPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { applyTheme, readAppPreferences } from '../lib/appPreferences'

function AuthenticatedApp() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const invitationCode = new URLSearchParams(location.search).get('codigo') ?? ''
  if (loading) return <LoadingScreen />
  if (location.pathname === '/convite') return <JoinPage initialCode={invitationCode} />
  if (!user) return <LoginPage />
  return <HouseholdGate />
}

function HouseholdGate() {
  const { user } = useAuth()
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [householdName, setHouseholdName] = useState('Minha casa')
  const [householdId, setHouseholdId] = useState('')
  const [householdRole, setHouseholdRole] = useState('member')

  useEffect(() => {
    let cancelled = false
    async function loadHousehold() {
      if (!supabase || !user) return
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, role, households ( id, name )')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        console.error(error)
        setState('error')
      } else if (!data) {
        setState('empty')
      } else {
        const household = data.households as unknown as { id: string; name: string } | null
        setHouseholdId(data.household_id)
        setHouseholdRole(data.role)
        setHouseholdName(household?.name ?? 'Minha casa')
        setState('ready')
      }
    }
    loadHousehold()
    return () => { cancelled = true }
  }, [user])

  if (state === 'loading') return <LoadingScreen />
  if (state === 'empty') return <SetupPage />
  if (state === 'error') return <SetupNotice title="Não foi possível carregar sua residência" detail="Confira se a migração SQL foi aplicada e tente novamente." />

  return (
    <AppShell householdName={householdName} householdId={householdId}>
      <Routes>
        <Route path="/" element={<OverviewPage householdId={householdId} />} />
        <Route path="/despensa" element={<PantryPage householdId={householdId} />} />
        <Route path="/consumo" element={<ConsumptionPage householdId={householdId} />} />
        <Route path="/compras" element={<ShoppingPage householdId={householdId} householdName={householdName} />} />
        <Route path="/registrar-compra" element={<RegisterPurchasePage householdId={householdId} />} />
        <Route path="/modo-mercado" element={<MarketModePage householdId={householdId} />} />
        <Route path="/precos" element={<PriceHistoryPage householdId={householdId} />} />
        <Route path="/relatorios" element={<ReportsPage householdId={householdId} />} />
        <Route path="/configuracoes" element={<SettingsPage householdId={householdId} householdName={householdName} role={householdRole} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

// A prévia salva alterações somente neste navegador; sincronização entre moradores exige Supabase.
function DemoApp() {
  return (
    <>
      <div className="demo-ribbon"><span className="demo-dot" /> Prévia local — conecte o Supabase para ativar contas e compartilhamento</div>
      <AppShell householdName="Minha casa" demo>
        <Routes>
          <Route path="/" element={<OverviewPage demo />} />
          <Route path="/despensa" element={<PantryPage demo />} />
          <Route path="/consumo" element={<ConsumptionPage demo />} />
          <Route path="/compras" element={<ShoppingPage demo />} />
          <Route path="/registrar-compra" element={<RegisterPurchasePage demo />} />
          <Route path="/modo-mercado" element={<MarketModePage demo />} />
          <Route path="/precos" element={<PriceHistoryPage demo />} />
          <Route path="/relatorios" element={<ReportsPage demo />} />
          <Route path="/configuracoes" element={<SettingsPage demo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </>
  )
}


export default function App() {
  const { configured, user } = useAuth()
  const location = useLocation()
  useEffect(() => {
    const apply = () => applyTheme(readAppPreferences(user?.user_metadata).theme)
    apply()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [user?.user_metadata])
  if (configured && new URLSearchParams(location.search).has('recuperar')) return <ResetPasswordPage />
  return configured ? <AuthenticatedApp /> : <DemoApp />
}
