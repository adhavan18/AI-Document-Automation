import ConsoleApp from './console/ConsoleApp.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

export default function App() {
  const session = { name: 'User'};

  return (
    <ErrorBoundary>
      <ConsoleApp session={session} onLogout={() => {}} />
    </ErrorBoundary>
  );
}
