
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  PiggyBank,
  BarChart3,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Wallet,
  Users,
} from 'lucide-react';
import { cn, getInitials } from '@/utils';
import { useAppStore } from '@/contexts/store';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Income', href: '/income', icon: TrendingUp },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Budget', href: '/budget', icon: PiggyBank },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
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

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-30 h-screen flex flex-col bg-white dark:bg-surface-900',
          'border-r border-surface-100 dark:border-surface-800 transition-all duration-300',
          'shadow-glass lg:shadow-none',
          sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-16'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center h-16 px-4 border-b border-surface-100 dark:border-surface-800',
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
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Family info */}
        {sidebarOpen && family && (
          <div className="mx-3 mt-3 px-3 py-2.5 rounded-lg bg-brand-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-900/50">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 flex-shrink-0" />
              <span className="text-xs font-medium text-brand-700 dark:text-brand-300 truncate">
                {family.name}
              </span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map(({ name, href, icon: Icon }) => (
            <NavLink
              key={href}
              to={href}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  !sidebarOpen && 'lg:justify-center lg:px-0',
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-200'
                )
              }
              title={!sidebarOpen ? name : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {sidebarOpen && <span>{name}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-surface-100 dark:border-surface-800 p-3 space-y-1">
          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800',
              !sidebarOpen && 'lg:justify-center'
            )}
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Moon className="h-4 w-4 flex-shrink-0" />
            )}
            {sidebarOpen && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {/* Sign out */}
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

          {/* User profile */}
          {profile && (
            <div className={cn(
              'flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg bg-surface-50 dark:bg-surface-800',
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

export function TopBar({ title }: { title?: string }) {
  const { setSidebarOpen, sidebarOpen } = useAppStore();

  return (
    <header className="h-16 flex items-center gap-4 px-4 sm:px-6 bg-white dark:bg-surface-900 border-b border-surface-100 dark:border-surface-800">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="flex-shrink-0"
      >
        <Menu className="h-5 w-5" />
      </Button>
      {title && (
        <h1 className="font-display font-semibold text-surface-900 dark:text-surface-100 text-lg">
          {title}
        </h1>
      )}
    </header>
  );
}
