
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Connection } from '../types';

interface ConnectionsPageProps {
  onNavigate: (path: string, state?: any) => void;
}

type ConnectionFilter = 'all' | 'accepted' | 'pending';

export const ConnectionsPage: React.FC<ConnectionsPageProps> = ({
  onNavigate,
}) => {
  const { apiFetch } = useAuth();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [filter, setFilter] = useState<ConnectionFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (message: string) => {
    setToastMsg(message);
    window.setTimeout(() => setToastMsg(''), 3500);
  };

  const fetchConnections = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/connections');
      setConnections(response.connections ?? []);
    } catch (err: any) {
      console.error('Could not load connections:', err);
      setError(err.message || 'Could not load your connections.');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  const handleRespond = async (
    connectionId: string,
    action: 'accept' | 'reject' | 'remove'
  ) => {
    setBusyId(connectionId);

    try {
      await apiFetch('/api/connections/respond', {
        method: 'POST',
        body: JSON.stringify({ connectionId, action }),
      });

      showToast(
        action === 'accept'
          ? 'Connection accepted!'
          : action === 'reject'
            ? 'Request declined.'
            : 'Connection removed.'
      );

      await fetchConnections();
    } catch (err: any) {
      showToast(err.message || 'That action could not be completed.');
    } finally {
      setBusyId(null);
    }
  };

  const visibleConnections = connections.filter((connection) => {
    if (connection.status === 'removed') return false;
    if (filter === 'accepted') return connection.status === 'accepted';
    if (filter === 'pending') return connection.status === 'pending';
    return true;
  });

  const acceptedCount = connections.filter(
    (connection) => connection.status === 'accepted'
  ).length;

  const pendingCount = connections.filter(
    (connection) => connection.status === 'pending'
  ).length;

  const incomingCount = connections.filter(
    (connection) => connection.status === 'pending' && !connection.isInitiator
  ).length;

  return (
    <div className="flex flex-col w-full relative">
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-on-surface text-surface text-sm font-medium shadow-xl"
        >
          {toastMsg}
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-1 block">
            Enterprise Network
          </span>
          <h1 className="text-3xl font-bold text-on-surface">
            Connections
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant mt-1 leading-relaxed">
            Build business relationships, manage incoming requests, and keep
            track of your network.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('discover')}
          className="bg-primary text-on-primary px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 shadow-xs flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">
            explore
          </span>
          Find Partners
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4">
          <p className="text-xs text-on-surface-variant">Total connections</p>
          <p className="text-2xl font-bold text-on-surface mt-1">
            {acceptedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4">
          <p className="text-xs text-on-surface-variant">Pending requests</p>
          <p className="text-2xl font-bold text-on-surface mt-1">
            {pendingCount}
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4">
          <p className="text-xs text-on-surface-variant">Awaiting your response</p>
          <p className="text-2xl font-bold text-on-surface mt-1">
            {incomingCount}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex bg-surface-container rounded-xl p-1 border border-outline-variant/30 text-xs font-semibold">
          {([
            ['all', 'All'],
            ['accepted', 'Connected'],
            ['pending', 'Pending'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-lg transition-all ${
                filter === value
                  ? 'bg-surface text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void fetchConnections()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/40 px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-10 text-center">
          <span className="material-symbols-outlined text-3xl text-primary animate-spin">
            progress_activity
          </span>
          <p className="text-sm text-on-surface-variant mt-3">
            Loading your business network...
          </p>
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-7 text-center">
          <span className="material-symbols-outlined text-3xl text-red-500">
            cloud_off
          </span>
          <h3 className="text-lg font-bold text-on-surface mt-3">
            Couldn't load connections
          </h3>
          <p className="text-sm text-on-surface-variant mt-2">{error}</p>
          <button
            type="button"
            onClick={() => void fetchConnections()}
            className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && visibleConnections.length === 0 && (
        <div className="bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/30 flex flex-col items-center justify-center max-w-xl mx-auto my-8">
          <div className="w-16 h-16 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px]">
              handshake
            </span>
          </div>

          <h3 className="text-xl font-bold text-on-surface mb-2">
            {filter === 'pending'
              ? 'No pending requests'
              : filter === 'accepted'
                ? 'No connections yet'
                : 'Your network starts here'}
          </h3>

          <p className="text-sm text-on-surface-variant mb-6 leading-relaxed max-w-md">
            {filter === 'pending'
              ? 'New connection requests will appear here when businesses reach out.'
              : 'Discover businesses, send connection requests, and build meaningful partnerships on NJS.'}
          </p>

          <button
            type="button"
            onClick={() => onNavigate('discover')}
            className="bg-primary text-on-primary px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">
              explore
            </span>
            Discover Businesses
          </button>
        </div>
      )}

      {!isLoading && !error && visibleConnections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-12">
          {visibleConnections.map((connection) => {
            const partner = connection.partnerBusiness;
            const incoming =
              !connection.isInitiator && connection.status === 'pending';
            const outgoing =
              connection.isInitiator && connection.status === 'pending';

            return (
              <article
                key={connection.id}
                className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-outline-variant/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        connection.status === 'accepted'
                          ? 'bg-green-500/10 text-green-700'
                          : connection.status === 'rejected'
                            ? 'bg-error-container text-error'
                            : 'bg-primary-fixed text-on-primary-fixed'
                      }`}
                    >
                      {connection.status === 'accepted'
                        ? 'CONNECTED'
                        : incoming
                          ? 'INCOMING REQUEST'
                          : outgoing
                            ? 'REQUEST SENT'
                            : connection.status.toUpperCase()}
                    </span>

                    <span className="text-[11px] text-on-surface-variant">
                      {connection.createdAt
                        ? new Date(connection.createdAt).toLocaleDateString()
                        : ''}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-on-surface mb-1">
                    {partner?.businessName || 'Business Partner'}
                  </h3>

                  <p className="text-xs text-on-surface-variant mb-3">
                    {partner?.industry || 'Business'} ·{' '}
                    {partner?.country || 'Location unavailable'}
                  </p>

                  {partner?.businessDescription && (
                    <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
                      {partner.businessDescription}
                    </p>
                  )}

                  {connection.message && (
                    <div className="p-3 rounded-xl bg-surface-container-low text-xs text-on-surface leading-relaxed mb-4">
                      <span className="font-semibold block mb-1">
                        Request message
                      </span>
                      {connection.message}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-outline-variant/20">
                  {incoming ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === connection.id}
                        onClick={() => void handleRespond(connection.id, 'reject')}
                        className="flex-1 py-2.5 rounded-xl border border-outline-variant text-xs font-semibold hover:bg-surface-container disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={busyId === connection.id}
                        onClick={() => void handleRespond(connection.id, 'accept')}
                        className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                      >
                        {busyId === connection.id ? 'Please wait...' : 'Accept'}
                      </button>
                    </div>
                  ) : connection.status === 'accepted' ? (
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onNavigate('messages')}
                        className="px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container text-xs font-semibold hover:opacity-90 flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          chat
                        </span>
                        Message
                      </button>

                      <button
                        type="button"
                        disabled={busyId === connection.id}
                        onClick={() => void handleRespond(connection.id, 'remove')}
                        className="text-xs text-on-surface-variant hover:text-error disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : outgoing ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-on-surface-variant">
                        Waiting for their response
                      </span>
                      <button
                        type="button"
                        disabled={busyId === connection.id}
                        onClick={() => void handleRespond(connection.id, 'remove')}
                        className="text-xs text-error hover:underline disabled:opacity-50"
                      >
                        Cancel request
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant">
                      This request is no longer active.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConnectionsPage;
