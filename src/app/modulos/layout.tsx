'use client';

import { AuthProvider } from '@/context/AuthContext';
import AppLayout from '@/components/AppLayout';

export default function ModulosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AppLayout>{children}</AppLayout>
    </AuthProvider>
  );
}

