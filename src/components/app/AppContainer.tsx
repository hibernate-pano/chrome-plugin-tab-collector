import React, { useEffect } from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { MainApp } from './MainApp';
import { getActiveBackend, initStorage } from '@/storage/storageAdapter';

export const AppContainer: React.FC = () => {
  useEffect(() => {
    initStorage()
      .then(() => {
        const backend = getActiveBackend();
        if (backend) {
          console.log(`[storage] active backend: ${backend}`);
        }
      })
      .catch(error => {
        console.error('[storage] init failed', error);
      });
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ThemeProvider>
          <MainApp />
        </ThemeProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};
