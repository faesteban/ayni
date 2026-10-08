import { useLocation, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'Grupos', icon: '🏠', exact: true },
  { path: null, label: 'Gastos', icon: '💰', param: 'expenses' },
  { path: null, label: 'Notas', icon: '📝', param: 'notes' },
  { path: null, label: 'Tareas', icon: '✅', param: 'tasks' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract groupId from URL if we're in a group
  const groupMatch = location.pathname.match(/\/groups\/([^/]+)/);
  const groupId = groupMatch?.[1];

  const isActive = (item) => {
    if (item.exact) return location.pathname === '/';
    if (item.param && groupId) return location.pathname.endsWith(`/${item.param}`);
    return false;
  };

  const handleNav = (item) => {
    if (item.exact) {
      navigate('/');
    } else if (item.param && groupId) {
      navigate(`/groups/${groupId}/${item.param}`);
    }
  };

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(item => (
        <button
          key={item.label}
          className={`bottom-nav-item ${isActive(item) ? 'active' : ''}`}
          onClick={() => handleNav(item)}
          disabled={!item.exact && !groupId}
          style={{ opacity: !item.exact && !groupId ? 0.3 : 1 }}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
