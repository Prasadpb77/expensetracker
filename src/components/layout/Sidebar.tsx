import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Receipt, PiggyBank,
  BarChart3, Settings, LogOut, Moon, Sun, Menu, X,
  Wallet, Users, Target, RefreshCw, Sparkles,
} from 'lucide-react';
import { cn, getInitials } from '@/utils';
import { useAppStore } from '@/contexts/store';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';

const navigation = [
  { name: 'Dashboard',   href: '/dashboard',   icon: LayoutDashboard },
  { name: 'Income',      href: '/income',       icon: TrendingUp },
  { name: 'Expenses',    href: '/expenses',     icon: Receipt },
  { name: 'Investments', href: '/investments',  icon: PiggyBank },
  { name: 'Goals',       href: '/goals',        icon: Target },
  { name: 'Budget',      href: '/budget',       icon: Wallet },
  { name: 'Recurring',   href: '/recurring',    icon: RefreshCw },
  { name: 'Reports',     href: '/reports',      icon: BarChart3 },
  { name: 'Fin AI',      href: '/assistant',    icon: Sparkles },
  { name: 'Settings',    href: '/settings',     icon: Settings },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { profile, family, isDarkMode, toggleDarkMode, sidebarOpen, setSidebarOpen } = useAppStore();

  const handleSignOut = async () => {
    await authService.signOut();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-30 flex flex-col bg-white dark:bg-surface-900',
          'border-r border-surface-100 dark:border-surface-800 transition-all duration-300',
          'shadow-glass lg:shadow-none',
          sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-16'
        )}
        style={{
          height: '100vh',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
        }}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center h-14 px-4 border-b border-surface-100 dark:border-surface-800 flex-shrink-0',
          !sidebarOpen && 'lg:justify-center'
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-brand-600 rounded-lg">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            {sidebarOpen && (
              <span className="font-display font-bold text-surface-900 dark:text-surface-100 truncate">
                FamilyFinance
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Family badge */}
        {sidebarOpen && family && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-brand-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-900/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3 text-brand-600 dark:text-brand-400 flex-shrink-0" />
              <span className="text-xs font-medium text-brand-700 dark:text-brand-300 truncate">
                {family.name}
              </span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          {navigation.map(({ name, href, icon: Icon }) => (
            <NavLink
              key={href}
              to={href}
              onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  !sidebarOpen && 'lg:justify-center lg:px-0',
                  isActive
                    ? href === '/assistant'
                      ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/40 dark:to-purple-950/40 text-blue-700 dark:text-blue-300'
                      : 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-200'
                )
              }
              title={!sidebarOpen ? name : undefined}
            >
              {href === '/assistant'
                ? <Icon className={cn('h-4 w-4 flex-shrink-0', !sidebarOpen && 'text-purple-500')} />
                : <Icon className="h-4 w-4 flex-shrink-0" />
              }
              {sidebarOpen && (
                <span className="flex items-center gap-2">
                  {name}
                  {href === '/assistant' && (
                    <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 4, background: 'linear-gradient(135deg,#0284c7,#7c3aed)', color: 'white', fontWeight: 700, letterSpacing: '0.04em' }}>
                      AI
                    </span>
                  )}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="border-t border-surface-100 dark:border-surface-800 p-2 space-y-0.5 flex-shrink-0">
          <button
            onClick={toggleDarkMode}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800',
              !sidebarOpen && 'lg:justify-center'
            )}
          >
            {isDarkMode ? <Sun className="h-4 w-4 flex-shrink-0" /> : <Moon className="h-4 w-4 flex-shrink-0" />}
            {sidebarOpen && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          <button
            onClick={handleSignOut}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              'text-surface-600 dark:text-surface-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600',
              !sidebarOpen && 'lg:justify-center'
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>

          {profile && (
            <div className={cn(
              'flex items-center gap-3 px-3 py-2 mt-1 rounded-lg bg-surface-50 dark:bg-surface-800',
              !sidebarOpen && 'lg:justify-center'
            )}>
              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
                {getInitials(profile.display_name || profile.full_name || 'U')}
              </div>
              {sidebarOpen && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-surface-900 dark:text-surface-100 truncate">
                    {profile.display_name || profile.full_name}
                  </p>
                  <p className="text-xs text-surface-400 truncate">{profile.email}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export function TopBar() {
  const { setSidebarOpen, sidebarOpen } = useAppStore();
  return (
    <header
      className="flex items-center gap-4 px-4 sm:px-6 bg-white dark:bg-surface-900 border-b border-surface-100 dark:border-surface-800 flex-shrink-0"
      style={{
        height: 'calc(3.5rem + env(safe-area-inset-top))',
        paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="flex-shrink-0">
        <Menu className="h-5 w-5" />
      </Button>
    </header>
  );
}
