import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Connection } from '../types';

interface ConnectionsPageProps {
  onNavigate: (path: string, state?: any) => void;
}

export const ConnectionsPage: React.FC<ConnectionsPageProps> = ({ onNavigate }) => {
  const { user, apiFetch } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [filter, setFilter] = useState<'all' | 'accepted' | 'pending'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchConnections = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/connections');
      setConnections(data.connections || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleRespond = async (connectionId: string, action: 'accept' | 'reject' | 'remove') => {
    try {
      await apiFetch('/api/connections/respond', {
        method: 'POST',
        body: JSON.stringify({ connectionId, action }),
      });
      showToast(`Connection ${action}ed.`);
      fetchConnections();
    } catch (err: any) {
      showToast(err.message || 'Action failed.');
    }
  };

  const filteredConnections = connections.filter(c => {
    if (filter === 'accepted') return c.status === 'accepted';
    if (filter === 'pending') return c.status === 'pending';
    return c.status !== 'removed';
  });

  return (
    <div className="flex flex-col w-full relative">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-on-surface text-surface text-sm font-medium shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-1 block">
            Enterprise Network
          </span>
          <h1 className="text-3xl font-bold text-on-surface">Connections</h1>
          <p className="text-sm sm:text-base text-on-surface-variant mt-1 leading-relaxed">
            Manage your verified relationships, pending partner proposals, and mutual collaboration channels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-surface-container rounded-xl p-1 border border-outline-variant/30 text-xs font-semibold">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filter === 'all' ? 'bg-surface text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              All ({connections.filter(c => c.status !== 'removed').length})
            </button>
            <button
              onClick={() => setFilter('accepted')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filter === 'accepted' ? 'bg-surface text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Connected ({connections.filter(c => c.status === 'accepted').length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filter === 'pending' ? 'bg-surface text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Pending ({connections.filter(c => c.status === 'pending').length})
            </button>
          </div>
          <button
            onClick={() => onNavigate('discover')}
            className="bg-primary text-on-primary px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 shadow-xs cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">explore</span>
            Find Partners
          </button>
        </div>
      </div>

      {filteredConnections.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/30 flex flex-col items-center justify-center max-w-xl mx-auto my-8">
          <div className="w-16 h-16 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px]">handshake</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">No connections yet.</h3>
          <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
            Discover and connect with relevant businesses to scale your enterprise operations.
          </p>
          <button
            onClick={() => onNavigate('discover')}
            className="bg-primary-container text-on-primary-container px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">explore</span>
            Discover Businesses
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredConnections.map((conn) => {
            const partner = conn.partnerBusiness;
            const isIncomingPending = !conn.isInitiator && conn.status === 'pending';

            return (
              <div
                key={conn.id}
                className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-outline-variant/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      conn.status === 'accepted'
                        ? 'bg-green-500/10 text-green-700'
                        : conn.status === 'rejected'
                        ? 'bg-error-container text-error'
                        : 'bg-primary-fixed text-on-primary-fixed'
                    }`}>
                      {conn.status.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {new Date(conn.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-on-surface mb-1">
                    {partner?.businessName || 'Enterprise Partner'}
                  </h3>
                  <p className="text-xs text-on-surface-variant mb-3">
                    {partner?.industry || 'B2B'} • {partner?.country || 'Global'}
                  </p>

                  {conn.message && (
                    <div className="p-3 rounded-xl bg-surface-container-low text-xs text-on-surface leading-relaxed mb-4 italic">
                      "{conn.message}"
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between gap-2">
                  {isIncomingPending ? (
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => handleRespond(conn.id, 'reject')}
                        className="flex-1 py-2 rounded-xl border border-outline-variant text-xs font-semibold hover:bg-surface-container"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleRespond(conn.id, 'accept')}
                        className="flex-1 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 shadow-xs"
                      >
                        Accept
                      </button>
                    </div>
                  ) : conn.status === 'accepted' ? (
                    <div className="flex items-center justify-between w-full">
                      <button
                        onClick={() => onNavigate('messages')}
                        className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container text-xs font-semibold hover:opacity-90 flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">chat</span>
                        Message
                      </button>
                      <button
                        onClick={() => handleRespond(conn.id, 'remove')}
                        className="text-xs text-on-surface-variant hover:text-error"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full text-xs text-on-surface-variant">
                      <span>Request Dispatched</span>
                      <button
                        onClick={() => handleRespond(conn.id, 'remove')}
                        className="text-error hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
