import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store';
import { PageLoading } from '../components/common';

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { init } = useAuthStore();

  useEffect(() => {
    const session = searchParams.get('session');
    const error = searchParams.get('error');

    if (error) {
      navigate('/login?error=' + error);
      return;
    }

    if (session) {
      localStorage.setItem('ayni_session', session);
      // Also set as flatmate_session for the api client compatibility
      localStorage.setItem('flatmate_session', session);
      init().then(() => navigate('/'));
    } else {
      navigate('/login');
    }
  }, []);

  return <PageLoading />;
}
