import { useState, useEffect } from 'react';
import { Send, Clock, CheckCircle, XCircle, ImageOff, Trash2 } from 'lucide-react';
import ScheduleModal from './ScheduleModal.jsx';
import { publishApi } from '../../api/publish.js';
import useAppStore from '../../store/useAppStore.js';

export default function PublishPanel() {
  const selectedImage = useAppStore(s => s.getSelectedImage());
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const caption = useAppStore(s => s.caption);
  const hashtags = useAppStore(s => s.hashtags);
  const connections = useAppStore(s => s.connections);
  const scheduledPosts = useAppStore(s => s.scheduledPosts);
  const publishHistory = useAppStore(s => s.publishHistory);
  const setScheduledPosts = useAppStore(s => s.setScheduledPosts);
  const setPublishHistory = useAppStore(s => s.setPublishHistory);
  const markStepComplete = useAppStore(s => s.markStepComplete);

  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const connectedPlatforms = connections.map(c => c.platform);

  useEffect(() => {
    publishApi.getScheduled().then(d => setScheduledPosts(d.posts)).catch(() => {});
    publishApi.getHistory().then(d => setPublishHistory(d.history)).catch(() => {});
  }, []);

  const togglePlatform = (p) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handlePublishNow = async () => {
    if (!selectedImage || selectedPlatforms.length === 0) return;
    setPublishing(true);
    setError('');
    setResult(null);
    try {
      const data = await publishApi.publishNow({
        contentId: selectedImage.id,
        platforms: selectedPlatforms,
        caption,
        hashtags,
      });
      setResult(data.record.result);
      markStepComplete('publish');
      publishApi.getHistory().then(d => setPublishHistory(d.history)).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.error || 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  };

  const handleSchedule = async (scheduledAt) => {
    if (!selectedImage || selectedPlatforms.length === 0) return;
    setScheduling(true);
    setError('');
    try {
      await publishApi.schedulePost({
        contentId: selectedImage.id,
        platforms: selectedPlatforms,
        caption,
        hashtags,
        scheduledAt,
      });
      setShowModal(false);
      markStepComplete('publish');
      publishApi.getScheduled().then(d => setScheduledPosts(d.posts)).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.error || 'Scheduling failed.');
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async (id) => {
    try {
      await publishApi.cancelScheduled(id);
      setScheduledPosts(scheduledPosts.filter(p => p.id !== id));
    } catch {}
  };

  if (!selectedImage) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Publish</h2>
          <p className="text-gray-500 text-sm mt-1">Select an image first to publish content.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-16 flex flex-col items-center gap-4 text-gray-400">
          <ImageOff size={48} strokeWidth={1.2} />
          <p className="text-sm">No image selected</p>
          <button onClick={() => setActiveTab('generate')} className="text-sm text-primary hover:underline font-medium">
            Go to Generate →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Publish</h2>
        <p className="text-gray-500 text-sm mt-1">Publish now or schedule for later.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
        {/* Image + caption preview */}
        <div className="flex gap-4">
          <img
            src={`data:${selectedImage.mimeType || 'image/png'};base64,${selectedImage.base64}`}
            alt="To publish"
            className="w-20 h-20 rounded-xl object-cover border border-gray-200 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700 line-clamp-3">{caption || <span className="text-gray-400 italic">No caption set</span>}</p>
            {hashtags.length > 0 && (
              <p className="text-xs text-primary mt-1 truncate">
                {hashtags.slice(0, 5).map(h => `#${h}`).join(' ')}
                {hashtags.length > 5 && ` +${hashtags.length - 5} more`}
              </p>
            )}
          </div>
        </div>

        {/* Platform selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Publish to</label>
          <div className="flex gap-3">
            {(['instagram', 'linkedin']).map(p => {
              const connected = connectedPlatforms.includes(p);
              const selected = selectedPlatforms.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => connected && togglePlatform(p)}
                  disabled={!connected}
                  title={!connected ? `Connect ${p} first` : ''}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition
                    ${selected && connected ? 'bg-primary text-white border-primary' :
                      connected ? 'bg-white text-gray-700 border-gray-300 hover:border-primary/50' :
                        'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'}`}
                >
                  {p === 'instagram' ? '📸' : '💼'}
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                  {!connected && <span className="text-xs opacity-70">(not connected)</span>}
                </button>
              );
            })}
          </div>
          {connectedPlatforms.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">
              No accounts connected.{' '}
              <button onClick={() => setActiveTab('social')} className="text-primary hover:underline">
                Connect accounts →
              </button>
            </p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Result */}
        {result && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Publish result</p>
            {Object.entries(result).map(([platform, r]) => (
              <div key={platform} className="flex items-start gap-2 text-sm">
                {r.success
                  ? <CheckCircle size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  : <XCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />}
                <span className="capitalize font-medium text-gray-700">{platform}:</span>
                <span className="text-gray-500">{r.note || r.error || (r.success ? 'Published' : 'Failed')}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handlePublishNow}
            disabled={publishing || selectedPlatforms.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition"
          >
            {publishing ? 'Publishing…' : <><Send size={14} /> Publish Now</>}
          </button>
          <button
            onClick={() => setShowModal(true)}
            disabled={selectedPlatforms.length === 0}
            className="flex items-center gap-2 border border-gray-300 hover:border-primary text-gray-600 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed font-medium px-5 py-3 rounded-xl text-sm transition"
          >
            <Clock size={14} /> Schedule
          </button>
        </div>
      </div>

      {/* Scheduled posts */}
      {scheduledPosts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Scheduled Posts</h3>
          <div className="space-y-2">
            {scheduledPosts.map(post => (
              <div key={post.id} className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <span className="font-medium capitalize">{post.platforms.join(', ')}</span>
                  <span className="text-gray-400 ml-2">· {new Date(post.scheduledAt).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => handleCancel(post.id)}
                  className="text-red-400 hover:text-red-600 transition"
                  title="Cancel"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Publish history */}
      {publishHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Publish History</h3>
          <div className="space-y-2">
            {publishHistory.slice(0, 5).map(post => (
              <div key={post.id} className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
                {post.status === 'published'
                  ? <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                  : <XCircle size={14} className="text-red-400 flex-shrink-0" />}
                <span className="capitalize font-medium">{post.platforms.join(', ')}</span>
                <span className="text-gray-400 ml-auto">{new Date(post.publishedAt || post.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <ScheduleModal
          onSchedule={handleSchedule}
          onClose={() => setShowModal(false)}
          loading={scheduling}
        />
      )}
    </div>
  );
}
