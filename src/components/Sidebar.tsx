'use client';

import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';

interface Module {
  id: string;
  name: string;
  icon: string;
  path: string;
  description: string;
  available: boolean;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const MODULES: Module[] = [
  {
    id: 'analisis-semanal',
    name: 'Análisis Semanal',
    icon: '📊',
    path: '/modulos/analisis-semanal',
    description: 'Control y análisis de demanda semanal',
    available: true
  },
  {
    id: 'plan-demanda',
    name: 'Plan Demanda',
    icon: '📈',
    path: '/modulos/plan-demanda',
    description: 'Gestión del plan de demanda',
    available: true
  }
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleModuleClick = (module: Module) => {
    if (module.available) {
      router.push(module.path);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <>
      {/* Botón flotante para expandir cuando está colapsado */}
      {collapsed && (
        <button className="sidebar-toggle-btn expanded" onClick={onToggle} title="Expandir menú">
          <span>☰</span>
        </button>
      )}
      
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            {!collapsed && (
              <Image 
                src="/logo-instance.svg" 
                alt="Instance" 
                width={140} 
                height={32}
                priority
                className="logo-image"
              />
            )}
          </div>
          <button className="sidebar-toggle-btn" onClick={onToggle} title={collapsed ? 'Expandir' : 'Colapsar'}>
            <span>{collapsed ? '→' : '←'}</span>
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            {!collapsed && <span className="nav-section-title">Módulos</span>}
            <ul className="nav-list">
              {MODULES.map((module) => (
                <li key={module.id}>
                  <button
                    className={`nav-item ${pathname === module.path ? 'active' : ''} ${!module.available ? 'disabled' : ''}`}
                    onClick={() => handleModuleClick(module)}
                    disabled={!module.available}
                    title={collapsed ? module.name : undefined}
                  >
                    <span className="nav-icon">{module.icon}</span>
                    {!collapsed && (
                      <div className="nav-content">
                        <span className="nav-name">{module.name}</span>
                        <span className="nav-description">{module.description}</span>
                      </div>
                    )}
                    {!collapsed && !module.available && <span className="nav-badge">Próximamente</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="user-details">
                <span className="user-name">{user?.username}</span>
                <span className="user-role">Administrador</span>
              </div>
            )}
          </div>
          <button className="logout-button" onClick={handleLogout} title="Cerrar sesión">
            <span>🚪</span>
          </button>
        </div>
      </aside>
    </>
  );
}

