import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Bell, ChefHat, ChevronDown, HelpCircle, LayoutDashboard, ListChecks, LogOut, Minus, Package, Receipt, Settings, ShoppingBasket, Store, TrendingUp, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { readDemoData } from '../lib/demoData'
import { SHOPPING_LIST_CHANGED } from '../lib/events'

const navItems = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/despensa', label: 'Minha despensa', icon: Package },
  { to: '/consumo', label: 'Consumo rápido', icon: Minus },
  { to: '/compras', label: 'Lista de compras', icon: ListChecks },
  { to: '/registrar-compra', label: 'Registrar compra', icon: Receipt },
  { to: '/modo-mercado', label: 'Modo mercado', icon: ShoppingBasket },
]
const insights = [
  { to: '/precos', label: 'Histórico de preços', icon: TrendingUp },
  { to: '/relatorios', label: 'Relatórios', icon: Store },
]
const titles: Record<string, string> = {
  '/': 'Visão geral', '/despensa': 'Minha despensa', '/consumo': 'Consumo rápido', '/compras': 'Lista de compras',
  '/registrar-compra': 'Registrar compra', '/modo-mercado': 'Modo mercado',
  '/precos': 'Histórico de preços', '/relatorios': 'Relatórios', '/configuracoes': 'Configurações'
}

export function AppShell({ children, householdName, householdId, demo = false }: { children: ReactNode; householdName: string; householdId?: string; demo?: boolean }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const pageTitle = titles[pathname] ?? 'Despensa Inteligente'
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let active = true
    async function loadPending() {
      if (demo) {
        setPendingCount(readDemoData().list.items.filter(item => !item.is_checked).length)
        return
      }
      if (!supabase || !householdId) { setPendingCount(0); return }
      const { data: list, error: listError } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('household_id', householdId)
        .eq('status', 'active')
        .maybeSingle()
      if (!active || listError || !list) { if (active) setPendingCount(0); return }
      const { count, error: countError } = await supabase
        .from('shopping_list_items')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .eq('list_id', list.id)
        .eq('is_checked', false)
      if (active && !countError) setPendingCount(count ?? 0)
    }
    void loadPending()
    const refresh = () => void loadPending()
    window.addEventListener(SHOPPING_LIST_CHANGED, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      active = false
      window.removeEventListener(SHOPPING_LIST_CHANGED, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [demo, householdId, pathname])

  const pendingLabel = pendingCount > 99 ? '99+' : String(pendingCount)

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark"><ChefHat size={23} strokeWidth={1.8} /></div><div><strong>despensa</strong><span>INTELIGENTE</span></div></div>
        <button className="house-switcher"><span className="house-avatar">{householdName.slice(0, 1).toUpperCase()}</span><span className="house-copy"><strong>{householdName}</strong><small>Residência compartilhada</small></span><ChevronDown size={15} /></button>
        <div className="nav-caption">SUA COZINHA</div>
        <nav className="main-nav">{navItems.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.to === '/compras' && pendingCount > 0 && <span className="nav-count">{pendingLabel}</span>}</NavLink>)}</nav>
        <div className="nav-caption nav-caption-spaced">ACOMPANHAMENTO</div>
        <nav className="main-nav">{insights.map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span></NavLink>)}</nav>
        <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><HelpCircle size={17}/></div><strong>Organize melhor sua cozinha</strong><p>Pequenos registros ajudam a evitar desperdício e compras repetidas.</p></div><NavLink to="/configuracoes" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Settings size={18}/><span>Configurações</span></NavLink><div className="profile-row"><div className="profile-avatar">{String(user?.user_metadata?.display_name ?? user?.email ?? 'B').slice(0,1).toUpperCase()}</div><div className="profile-copy"><strong>{String(user?.user_metadata?.display_name ?? user?.email ?? 'Modo demonstração')}</strong><small>{demo ? 'Dados ilustrativos' : 'Membro da residência'}</small></div>{!demo && <button className="icon-button profile-logout" title="Sair" onClick={handleSignOut}><LogOut size={16}/></button>}</div></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="mobile-brand"><div className="brand-mark"><ChefHat size={20}/></div><strong>despensa</strong></div><div className="breadcrumb"><span>Minha cozinha</span><span className="crumb-separator">/</span><strong>{pageTitle}</strong></div><div className="topbar-actions"><div className="sync-indicator"><span className="sync-dot"/>{demo ? 'Prévia local' : 'Sincronizado'}</div><button className="icon-button notification-button" aria-label="Notificações"><Bell size={18}/><i/></button><div className="topbar-house"><Users size={15}/><span>{householdName}</span></div></div></header>
        <div className="page-content">{children}</div>
      </main>
      <nav className="mobile-nav">{navItems.slice(0, 5).map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}><item.icon size={19}/><span>{item.label === 'Visão geral' ? 'Início' : item.label === 'Minha despensa' ? 'Despensa' : item.label === 'Consumo rápido' ? 'Consumo' : item.label === 'Lista de compras' ? 'Lista' : item.label === 'Registrar compra' ? 'Compra' : 'Mercado'}</span>{item.to === '/compras' && pendingCount > 0 && <span className="nav-count">{pendingLabel}</span>}</NavLink>)}</nav>
    </div>
  )
}
