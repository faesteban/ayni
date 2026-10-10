import { api } from '../api/client';
import { ThemeToggle } from '../components/ThemeToggle';

export function LoginPage() {
  const handleGoogleLogin = () => {
    window.location.href = api.auth.googleUrl();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
      position: 'relative',
      background: 'radial-gradient(ellipse at top, rgba(108, 99, 255, 0.18) 0%, var(--bg-base) 70%)',
    }}>
      <div style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)' }}>
        <ThemeToggle />
      </div>
      {/* Logo */}
      <div className="animate-slide-up" style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
        <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>🤝</div>
        <h1 className="gradient-text" style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>
          Ayni
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: 320 }}>
          Gastos, notas y tareas compartidas con tu grupo
        </p>
      </div>

      {/* Feature highlights */}
      <div className="animate-fade-in" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-10)',
        maxWidth: 340,
        width: '100%',
      }}>
        {[
          { icon: '💰', label: 'Gastos', desc: 'Divide y salda' },
          { icon: '📝', label: 'Notas', desc: 'Ideas del grupo' },
          { icon: '✅', label: 'Tareas', desc: 'Quién hace qué' },
          { icon: '🔔', label: 'Alertas', desc: 'Sin olvidar nada' },
        ].map(f => (
          <div key={f.label} className="glass-card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{f.label}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Login button */}
      <div style={{ width: '100%', maxWidth: 340 }}>
        <button
          className="btn btn-primary btn-lg w-full"
          onClick={handleGoogleLogin}
          style={{ fontSize: '1rem' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continuar con Google
        </button>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-5)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Al continuar aceptas los términos de uso.
          <br />Solo tú y tu grupo ven tus datos.
        </p>
      </div>
    </div>
  );
}
