import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/Layout/DashboardLayout.jsx';
import useAppStore from '../store/useAppStore.js';
import { socialApi } from '../api/social.js';

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const setConnections = useAppStore(s => s.setConnections);
  const setActiveTab = useAppStore(s => s.setActiveTab);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected || error) {
      if (connected) {
        setActiveTab('social');
        socialApi.getConnections()
          .then(data => setConnections(data.connections))
          .catch(() => {});
      }
      // Clear query params after handling
      setSearchParams({}, { replace: true });
    }
  }, []);

  return <DashboardLayout />;
}
