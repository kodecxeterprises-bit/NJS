import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BusinessProfile } from '../types';

interface DiscoverPageProps {
  onNavigate: (path: string, state?: any) => void;
}

export const DiscoverPage: React.FC<DiscoverPageProps> = ({ onNavigate }) => {
  const { apiFetch, businessProfile } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState('All Industries');
  const [locationFilter, setLocationFilter] = useState('Global');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [offeringFilter, setOfferingFilter] = useState('Any Offering');
  const [companySizeFilter, setCompanySizeFilter] = useState('Any Size');
  const [verificationFilter, setVerificationFilter] = useState('All Verified');
  const [marketFilter, setMarketFilter] = useState('All Markets');

  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchBusinesses = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.set('query', searchQuery);
      if (industryFilter !== 'All Industries') queryParams.set('industry', industryFilter);
      if (locationFilter !== 'Global') queryParams.set('location', locationFilter);
      if (typeFilter !== 'All Types') queryParams.set('type', typeFilter);

      const res = await apiFetch(`/api/business/all?${queryParams.toString()}`);
      setBusinesses(res.businesses || []);
    } catch (err) {
      console.error('Failed to load businesses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, [industryFilter, locationFilter, typeFilter]);

  const handleConnect = async (business: BusinessProfile) => {
    try {
      await apiFetch('/api/connections/request', {
        method: 'POST',
        body: JSON.stringify({
          targetBusinessId: business.id,
          message: 'Hello, we discovered your profile on NJS and would like to explore mutual business opportunities.',
        }),
      });
      setFeedback(`Connection request dispatched to ${business.businessName}!`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback(err.message || 'Unable to send connection request.');
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleSaveLead = async (business: BusinessProfile) => {
    try {
      await apiFetch('/api/leads/save', {
        method: 'POST',
        body: JSON.stringify({
          companyName: business.businessName,
          targetBusinessId: business.id,
          industry: business.industry,
          location: `${business.city ? business.city + ', ' : ''}${business.country}`,
          domain: business.website,
        }),
      });
      setFeedback(`Saved ${business.businessName} to Saved Leads.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback(err.message || 'Unable to save lead.');
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Section / Header Info */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-1 block">
            Enterprise Directory
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-on-surface">Discover Businesses</h1>
          <p className="text-sm sm:text-base text-on-surface-variant mt-1">
            Explore verified B2B partners, suppliers, and service providers tailored to your enterprise criteria.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFeedback('Filter preset saved for your current enterprise search.');
              setTimeout(() => setFeedback(null), 3000);
            }}
            className="bg-surface-container-high text-on-surface px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-surface-dim transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Saved Filters
          </button>
          <button
            onClick={() => onNavigate('profile')}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_business</span>
            List Business
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-800 text-sm flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* Search & Filter Bar Section */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs mb-8 transition-all border border-outline-variant/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchBusinesses();
          }}
          className="relative flex items-center mb-6"
        >
          <span className="material-symbols-outlined absolute left-4 text-on-surface-variant text-[24px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search businesses, products or services..."
            className="w-full bg-surface-container-low text-on-surface pl-12 pr-28 py-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base placeholder:text-on-surface-variant/60 transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 bg-primary text-on-primary px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Search
          </button>
        </form>

        {/* Robust Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 pt-4 border-t border-outline-variant/20">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Industry
            </label>
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="bg-surface-container-low text-on-surface text-xs sm:text-sm px-3 py-2 rounded-xl outline-none cursor-pointer hover:bg-surface-container transition-colors"
            >
              <option>All Industries</option>
              <option>SaaS &amp; Tech</option>
              <option>Manufacturing</option>
              <option>Logistics</option>
              <option>Fintech</option>
              <option>Textiles &amp; Apparel</option>
              <option>Packaging</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Location
            </label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="bg-surface-container-low text-on-surface text-xs sm:text-sm px-3 py-2 rounded-xl outline-none cursor-pointer hover:bg-surface-container transition-colors"
            >
              <option>Global</option>
              <option>North America</option>
              <option>Europe</option>
              <option>Asia Pacific</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Business Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-surface-container-low text-on-surface text-xs sm:text-sm px-3 py-2 rounded-xl outline-none cursor-pointer hover:bg-surface-container transition-colors"
            >
              <option>All Types</option>
              <option>Supplier</option>
              <option>Manufacturer</option>
              <option>Service Partner</option>
              <option>Distributor</option>
              <option>Retailer</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Products / Services
            </label>
            <select
              value={offeringFilter}
              onChange={(e) => setOfferingFilter(e.target.value)}
              className="bg-surface-container-low text-on-surface text-xs sm:text-sm px-3 py-2 rounded-xl outline-none cursor-pointer hover:bg-surface-container transition-colors"
            >
              <option>Any Offering</option>
              <option>API Integration</option>
              <option>Raw Materials</option>
              <option>Consulting</option>
              <option>Custom Fabrication</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Company Size
            </label>
            <select
              value={companySizeFilter}
              onChange={(e) => setCompanySizeFilter(e.target.value)}
              className="bg-surface-container-low text-on-surface text-xs sm:text-sm px-3 py-2 rounded-xl outline-none cursor-pointer hover:bg-surface-container transition-colors"
            >
              <option>Any Size</option>
              <option>1-50 employees</option>
              <option>51-250 employees</option>
              <option>250+ employees</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Verification
            </label>
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className="bg-surface-container-low text-on-surface text-xs sm:text-sm px-3 py-2 rounded-xl outline-none cursor-pointer hover:bg-surface-container transition-colors"
            >
              <option>All Verified</option>
              <option>NJS Verified Only</option>
              <option>Pending</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Operating Market
            </label>
            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="bg-surface-container-low text-on-surface text-xs sm:text-sm px-3 py-2 rounded-xl outline-none cursor-pointer hover:bg-surface-container transition-colors"
            >
              <option>All Markets</option>
              <option>Enterprise B2B</option>
              <option>SME / SMB</option>
              <option>Public Sector</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area: Example Business Result & Empty/Live State */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Left Column / Showcase Card (Example Business Result Template) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Example business result template
              </span>
            </div>
            <span className="text-xs text-on-surface-variant">Demonstrating structural layout</span>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden group hover:shadow-md transition-all border border-outline-variant/30">
            {/* Absolute badge */}
            <div className="absolute top-6 right-6 flex items-center gap-1.5 bg-primary-fixed text-on-primary-fixed px-3 py-1 rounded-full text-xs font-semibold">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              NJS Verified Enterprise
            </div>

            <div className="flex items-start gap-4 sm:gap-5 mb-6">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary font-bold text-xl sm:text-2xl shrink-0">
                NX
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
                  Nexus Global Systems
                  <span
                    className="material-symbols-outlined text-primary text-[20px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
                  Enterprise Cloud Infrastructure &amp; AI Supply Chain Optimization
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-on-surface-variant flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                    Frankfurt, Germany
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">group</span>
                    250-500 employees
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">public</span>
                    Global B2B
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-on-surface/90 mb-6 leading-relaxed">
              Leading provider of mission-critical cloud orchestrations and secure enterprise communication backbones. Specializing in high-throughput data pipelines and automated compliance frameworks for tier-one industrial partners.
            </p>

            {/* Tags / Offerings */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="bg-surface-container-low text-on-surface-variant px-3 py-1 rounded-lg text-xs font-medium">
                Cloud Architecture
              </span>
              <span className="bg-surface-container-low text-on-surface-variant px-3 py-1 rounded-lg text-xs font-medium">
                Supply Chain AI
              </span>
              <span className="bg-surface-container-low text-on-surface-variant px-3 py-1 rounded-lg text-xs font-medium">
                API Middleware
              </span>
              <span className="bg-surface-container-low text-on-surface-variant px-3 py-1 rounded-lg text-xs font-medium">
                ISO-27001
              </span>
            </div>

            {/* Card Footer Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-outline-variant/15 flex-wrap gap-3">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-primary font-semibold">
                <span className="material-symbols-outlined text-[18px]">star</span>
                4.9 (42 Enterprise Reviews)
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setFeedback('Nexus Global Systems is a verified reference template demonstrating complete NJS profile layout and compliance scores.');
                    setTimeout(() => setFeedback(null), 4000);
                  }}
                  className="bg-surface-container-high text-on-surface px-4 py-2 rounded-xl text-xs sm:text-sm font-medium hover:bg-surface-dim transition-colors cursor-pointer"
                >
                  View Profile
                </button>
                <button
                  onClick={() => {
                    setFeedback('Direct connection requests can be sent to registered enterprise peers.');
                    setTimeout(() => setFeedback(null), 4000);
                  }}
                  className="bg-primary text-on-primary px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column / Live Search State Panel */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Live Search State
            </span>
            <span className="text-xs text-primary font-medium">
              {businesses.length} active registered
            </span>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col items-center justify-center text-center h-full min-h-[380px] border border-outline-variant/30">
            {businesses.length === 0 ? (
              <>
                <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-primary mb-4">
                  <span className="material-symbols-outlined text-[32px]">search_off</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">
                  No businesses found yet.
                </h3>
                <p className="text-xs sm:text-sm text-on-surface-variant max-w-xs mb-6 leading-relaxed">
                  Adjust your filter parameters or initiate a targeted query to discover active enterprise partners.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIndustryFilter('All Industries');
                    setLocationFilter('Global');
                    setTypeFilter('All Types');
                    setSearchQuery('');
                    fetchBusinesses();
                  }}
                  className="bg-primary-container text-on-primary-container px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  Start a Search
                </button>
              </>
            ) : (
              <div className="w-full text-left space-y-4">
                <h4 className="text-sm font-bold text-on-surface mb-2">
                  Matching Registered Entities
                </h4>
                {businesses.map((biz) => (
                  <div
                    key={biz.id}
                    className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-primary transition-all flex items-center justify-between"
                  >
                    <div>
                      <h5 className="font-bold text-sm text-on-surface">{biz.businessName}</h5>
                      <p className="text-xs text-on-surface-variant">{biz.industry} • {biz.country}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveLead(biz)}
                        className="p-1.5 rounded-lg bg-surface-container hover:text-primary text-on-surface-variant"
                        title="Save lead"
                      >
                        <span className="material-symbols-outlined text-[18px]">bookmark</span>
                      </button>
                      <button
                        onClick={() => handleConnect(biz)}
                        className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90"
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Discover Prompt Section */}
      <div className="bg-surface-container-low rounded-2xl p-6 sm:p-8 mb-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-outline-variant/30">
        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            AI Matching Engine
          </span>
          <h3 className="text-xl sm:text-2xl font-bold text-on-surface">
            Looking for a bespoke supplier match?
          </h3>
          <p className="text-sm text-on-surface-variant max-w-xl leading-relaxed">
            Let our AI analyze your requirements and automatically route RFPs to verified businesses meeting your precise scale and compliance needs.
          </p>
        </div>
        <button
          onClick={() => onNavigate('ai-matches')}
          className="bg-primary text-on-primary px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shrink-0 flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          Launch AI Matchmaker
        </button>
      </div>
    </div>
  );
};
