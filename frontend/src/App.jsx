import { useState } from 'react';
import ConsoleApp from './console/ConsoleApp.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import { loadSession, clearSession } from './auth';

export default function App() {
  const [session, setSession] = useState(() => loadSession());

  if (!session) {
    return <LoginScreen onLogin={(s) => setSession(s)} />;
  }

  return (
    <ErrorBoundary>
      <ConsoleApp
        session={session}
        onLogout={() => {
          clearSession();
          setSession(null);
        }}
      />
    </ErrorBoundary>
  );
}
