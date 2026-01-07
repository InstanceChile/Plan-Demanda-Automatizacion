'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginPage from '@/components/LoginPage';

function HomeContent() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      // Redirigir al módulo de análisis semanal si está autenticado
      router.push('/modulos/analisis-semanal');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Mientras redirige, mostrar loading
  return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <p>Cargando...</p>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <HomeContent />
    </AuthProvider>
  );
}
