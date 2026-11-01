
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface DiscoverBusiness {
  id: string;
  businessName: string;
  businessType: string;
  industry: string;
  country: string;
  city: string;
  businessDescription: string;
  products: unknown[];
  services: unknown[];
  capabilities: unknown[];
  offers: unknown[];
  needs: unknown[];
  targetMarkets: unknown[];
  isVerified: boolean;
  createdAt: string;
}

interface DiscoverPageProps {
  onNavigate: (path: string, state?: any) => void;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  pageSize: 12,
  total: 0,
  totalPages: 0,
};

function getItemLabel(item: unknown): string {
  if (typeof item === 'string') return item;

  if (item && typeof item === 'object') {
    const value = item as Record<string, unknown>;
    return String(
      value.name ?? value.title ?? value.label ?? value.category ?? ''
    );
  }

  return '';
}

function getTags(items: unknown[], limit = 4): string[] {
  if (!Array.isArray(items)) return [];

  return items
    .map(getItemLabel)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'B'
  );
}

export const DiscoverPage: React.FC<DiscoverPageProps> = ({ onNavigate }) => {
  const { apiFetch } = useAuth();

  const [businesses, setBusinesses] = useState<DiscoverBusiness[]>([]);
  const [pagination, setPagination] =
    useState<Pagination>(EMPTY_PAGINATION);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [industry, setIndustry] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');
  const [offering, setOffering] = useState('');
  const [verification, setVerification] = useState('');

  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');

  const fetchBusinesses = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      if (searchQuery) params.set('query', searchQuery);
      if (industry) params.set('industry', industry);
      if (businessType) params.set('type', businessType);
      if (location) params.set('location', location);
      if (offering) params.set('offering', offering);
      if (verification) params.set('verified', verification);

      params.set('page', String(page));
      params.set('pageSize', '12');

      const response = await apiFetch(
        `/api/business/discover?${params.toString()}`
      );

      setBusinesses(response.businesses ?? []);
      setPagination(response.pagination ?? EMPTY_PAGINATION);
    } catch (err: any) {
      console.error('Business discovery failed:', err);

      setError(
        err.message || 'We could not load businesses. Please try again.'
      );

      setBusinesses([]);
      setPagination(EMPTY_PAGINATION);
    } finally {
      setIsLoading(false);
    }
  }, [
    apiFetch,
    searchQuery,
    industry,
    businessType,
    location,
    offering,
    verification,
    page,
  ]);

  useEffect(() => {
    void fetchBusinesses();
  }, [fetchBusinesses]);

  const submitSearch = (event?: React.FormEvent) => {
    event?.preventDefault();

    const query = searchInput.trim();

    setPage(1);

    if (query === searchQuery && page === 1) {
      void fetchBusinesses();
      return;
    }

    setSearchQuery(query);
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setIndustry('');
    setBusinessType('');
    setLocation('');
    setOffering('');
    setVerification('');
    setPage(1);
  };

  const sendConnectionRequest = async (business: DiscoverBusiness) => {
    setSendingRequest(business.id);
    setRequestError('');
    setRequestSuccess('');

    try {
      await apiFetch('/api/connections/request', {
        method: 'POST',
        body: JSON.stringify({
          targetBusinessId: business.id,
          message: `Hello ${business.businessName}, I discovered your business on NJS and would like to connect.`,
        }),
      });

      setSentRequests((current) =>
        current.includes(business.id)
          ? current
          : [...current, business.id]
      );

      setRequestSuccess(
        `Your connection request to ${business.businessName} has been sent.`
      );
    } catch (err: any) {
      setRequestError(
        err.message || 'Unable to send your connection request.'
      );
    } finally {
      setSendingRequest(null);
    }
  };

  const hasFilters = Boolean(
    searchQuery ||
      industry ||
      businessType ||
      location ||
      offering ||
      verification
  );

  return (
    <div className="flex flex-col w-full gap-7">
      {/* Page heading */}
      <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            NJS Business Network
          </span>

          <h1 className="text-3xl sm:text-4xl font-bold text-on-surface mt-2">
            Discover Businesses
          </h1>

          <p className="text-sm sm:text-base text-on-surface-variant mt-2 max-w-2xl">
            Find businesses, explore what they offer, and discover opportunities
            to work together.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary px-5 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-lg">
            add_business
          </span>
          List your business
        </button>
      </section>

      {/* Search and filters */}
      <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6 shadow-xs">
        <form
          onSubmit={submitSearch}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
              search
            </span>

            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search businesses, products, services..."
              className="w-full rounded-xl bg-surface-container-low py-3.5 pl-12 pr-4 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            type="button"
            onClick={() => submitSearch()}
            disabled={isLoading}
            className="rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold text-on-primary hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-on-surface-variant">
              Industry
            </span>

            <input
              value={industry}
              onChange={(event) => {
                setIndustry(event.target.value);
                setPage(1);
              }}
              placeholder="e.g. Technology"
              className="rounded-xl bg-surface-container-low px-3.5 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-on-surface-variant">
              Business type
            </span>

            <select
              value={businessType}
              onChange={(event) => {
                setBusinessType(event.target.value);
                setPage(1);
              }}
              className="rounded-xl bg-surface-container-low px-3.5 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All business types</option>
              <option value="Supplier">Supplier</option>
              <option value="Manufacturer">Manufacturer</option>
              <option value="Distributor">Distributor</option>
              <option value="Retailer">Retailer</option>
              <option value="Service Provider">Service Provider</option>
              <option value="Wholesaler">Wholesaler</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-on-surface-variant">
              Location
            </span>

            <input
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setPage(1);
              }}
              placeholder="City or country"
              className="rounded-xl bg-surface-container-low px-3.5 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-on-surface-variant">
              Products or services
            </span>

            <input
              value={offering}
              onChange={(event) => {
                setOffering(event.target.value);
                setPage(1);
              }}
              placeholder="What are you looking for?"
              className="rounded-xl bg-surface-container-low px-3.5 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-semibold text-on-surface-variant">
              Verification
            </span>

            <select
              value={verification}
              onChange={(event) => {
                setVerification(event.target.value);
                setPage(1);
              }}
              className="rounded-xl bg-surface-container-low px-3.5 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All businesses</option>
              <option value="verified">NJS verified</option>
              <option value="pending">Not yet verified</option>
            </select>
          </label>
        </div>

        {hasFilters && (
          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </section>

      {/* Request feedback */}
      {(requestError || requestSuccess) && (
        <div
          className={`rounded-xl p-4 text-sm ${
            requestError
              ? 'bg-red-500/10 text-red-500'
              : 'bg-green-500/10 text-green-600'
          }`}
        >
          {requestError || requestSuccess}
        </div>
      )}

      {/* Results heading */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-on-surface">
            Business directory
          </h2>

          <p className="text-sm text-on-surface-variant mt-1">
            {isLoading
              ? 'Finding businesses...'
              : `${pagination.total} ${
                  pagination.total === 1 ? 'business' : 'businesses'
                } found`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchBusinesses()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/40 px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Refresh
        </button>
      </section>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 animate-pulse"
            >
              <div className="flex gap-4">
                <div className="w-14 h-14 rounded-2xl bg-surface-container-high" />

                <div className="flex-1 space-y-3">
                  <div className="h-4 w-2/3 rounded bg-surface-container-high" />
                  <div className="h-3 w-1/3 rounded bg-surface-container-high" />
                </div>
              </div>

              <div className="h-3 w-full rounded bg-surface-container-high mt-6" />
              <div className="h-3 w-4/5 rounded bg-surface-container-high mt-3" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-7 text-center">
          <span className="material-symbols-outlined text-3xl text-red-500">
            cloud_off
          </span>

          <h3 className="text-lg font-bold text-on-surface mt-3">
            Couldn't load the directory
          </h3>

          <p className="text-sm text-on-surface-variant mt-2">{error}</p>

          <button
            type="button"
            onClick={() => void fetchBusinesses()}
            className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
          >
            Try again
          </button>
        </div>
      )}
