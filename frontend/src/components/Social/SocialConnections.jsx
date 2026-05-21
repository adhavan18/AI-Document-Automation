import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Link2Off, CheckCircle, AlertCircle } from 'lucide-react';
import { socialApi } from '../../api/social.js';
import useAppStore from '../../store/useAppStore.js';

const PLATFORM_META = {
  instagram: { label: 'Instagram', color: 'from-pink-500 to-orange-400', icon: '📸' },
  linkedin: { label: 'LinkedIn', color: 'from-blue-600 to-blue-500', icon: '💼' },
};

export default function SocialConnections() {
  const connections = useAppStore(s => s.connections);
  const setConnections = useAppStore(s => s.setConnections);
  const markStepComplete = useAppStore(s => s.markStepComplete);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const [searchParams] = useSearchParams();
  const [toast, setToast] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);

  const loadConnections = () =>
    socialApi.getConnections()
      .then(d => { setConnections(d.connections); })
      .catch(() => {});

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      setToast({ type: 'success', msg: `${connected.charAt(0).toUpperCase() + connected.slice(1)} connected!` });
      loadConnections();
      markStepComplete('social');
      setTimeout(() => setToast(null), 3500);
    } else if (error) {
      setToast({ type: 'error', msg: `Connection failed: ${error.replace('_', ' ')}` });
      setTimeout(() => setToast(null), 4000);
    }
  }, [searchParams.toString()]);

  const handleDisconnect = async (platform) => {
    setDisconnecting(platform);
    try {
      if (platform === 'instagram') await socialApi.disconnectInstagram();
      else await socialApi.disconnectLinkedin();
      await loadConnections();
    } finally {
      setDisconnecting(null);
    }
  };

  const isConnected = (platform) => connections.some(c => c.platform === platform);
  const getConnection = (platform) => connections.find(c => c.platform === platform);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Social Accounts</h2>
        <p className="text-gray-500 text-sm mt-1">Connect your accounts to publish content directly.</p>
      </div>

      {toast && (
        <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm fade-in-up
          ${toast.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-red-50 border border-red-200 text-red-700'}`}
        >
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="space-y-4">
        {(['instagram', 'linkedin']).map(platform => {
          const meta = PLATFORM_META[platform];
          const conn = getConnection(platform);
          const connected = !!conn;

          return (
            <div key={platform} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-2xl shadow-sm`}>
                {meta.icon}
              </div>

              <div className="flex-1">
                <p className="font-semibold text-gray-900">{meta.label}</p>
                {connected ? (
                  <p className="text-sm text-gray-500">
                    Connected as <span className="font-medium text-gray-700">{conn.accountName}</span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">Not connected</p>
                )}
              </div>

              {connected ? (
                <button
                  onClick={() => handleDisconnect(platform)}
                  disabled={disconnecting === platform}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg transition disabled:opacity-50"
                >
                  <Link2Off size={14} />
                  {disconnecting === platform ? 'Disconnecting…' : 'Disconnect'}
                </button>
              ) : (
                <button
                  onClick={() => platform === 'instagram' ? socialApi.connectInstagram() : socialApi.connectLinkedin()}
                  className="flex items-center gap-1.5 text-sm text-white bg-primary hover:bg-primary-dark px-4 py-2 rounded-lg transition"
                >
                  <Link2 size={14} />
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
        <strong>Note:</strong> OAuth credentials (App ID, Client ID) must be configured in the backend .env file before connecting.
        Instagram and LinkedIn publishing uses stub responses in this PoC build.
      </div>

      <button
        onClick={() => { markStepComplete('social'); setActiveTab('publish'); }}
        className="mt-4 w-full bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-xl text-sm transition"
      >
        Continue to Publish →
      </button>
    </div>
  );
}
