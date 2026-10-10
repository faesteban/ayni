import { useThemeStore } from '../store';

export function ThemeToggle({ showLabel = false, className = '', style = {} }) {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`btn btn-ghost ${!showLabel ? 'btn-icon' : ''} ${className}`}
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={{
        borderRadius: showLabel ? 'var(--radius-md)' : 'var(--radius-full)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: showLabel ? 'flex-start' : 'center',
        gap: 'var(--space-2)',
        fontSize: '1rem',
        transition: 'all var(--transition-base)',
        ...style,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          transition: 'transform var(--transition-base)',
          transform: isDark ? 'rotate(0deg)' : 'rotate(360deg)',
        }}
      >
        {isDark ? '🌙' : '☀️'}
      </span>
      {showLabel && (
        <span style={{ fontSize: '0.9rem' }}>
          {isDark ? 'Modo claro' : 'Modo oscuro'}
        </span>
      )}
    </button>
  );
}
