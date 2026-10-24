import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BusinessProfile } from '../../types';

interface OnboardingFlowProps {
  onComplete: () => void;
  onNavigate: (path: string) => void;
}

type OnboardingStep =
  | 'business'
  | 'about'
  | 'offers'
  | 'needs'
  | 'targets'
  | 'goals'
  | 'checklist'
  | 'ai-profile'
  | 'review';

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, onNavigate }) => {
  const { businessProfile, updateBusinessProfile, apiFetch } = useAuth();

  const [currentStep, setCurrentStep] = useState<OnboardingStep>('business');
  const [formData, setFormData] = useState<Partial<BusinessProfile>>({
    businessName: '',
    businessType: 'Supplier',
    industry: '',
    country: '',
    city: '',
    website: '',
    phone: '',
    businessDescription: '',
    products: [],
    services: [],
    capabilities: [],
    offers: [],
    needs: [],
    targetCustomers: [],
    targetSuppliers: [],
    targetManufacturers: [],
    targetPartners: [],
    targetMarkets: [],
    businessGoals: [],
    businessKeywords: [],
  });

  const [naturalLanguageDescription, setNaturalLanguageDescription] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Sync existing profile if user resumes
  useEffect(() => {
    if (businessProfile) {
      setFormData(prev => ({
        ...prev,
        ...businessProfile,
      }));
      if (businessProfile.onboardingStep) {
        setCurrentStep(businessProfile.onboardingStep as OnboardingStep);
      }
    }
  }, [businessProfile]);

  // Temporary inputs for array fields
  const [offerInput, setOfferInput] = useState('');
  const [needInput, setNeedInput] = useState('');
  const [productInput, setProductInput] = useState('');
  const [targetCustomerInput, setTargetCustomerInput] = useState('');
  const [targetMarketInput, setTargetMarketInput] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  // Calculate actual readiness from real completed fields
  const calculateChecklist = () => {
    const checks = {
      basics: Boolean(formData.businessName && formData.industry && formData.country),
      description: Boolean(formData.businessDescription && formData.businessDescription.length > 20),
      productsOffers: Boolean((formData.products && formData.products.length > 0) || (formData.offers && formData.offers.length > 0)),
      needs: Boolean(formData.needs && formData.needs.length > 0),
      targets: Boolean((formData.targetCustomers && formData.targetCustomers.length > 0) || (formData.targetMarkets && formData.targetMarkets.length > 0)),
      goals: Boolean(formData.businessGoals && formData.businessGoals.length > 0),
    };

    const completedCount = Object.values(checks).filter(Boolean).length;
    const totalCount = Object.keys(checks).length;
    const percentage = Math.round((completedCount / totalCount) * 100);

    return { checks, completedCount, totalCount, percentage };
  };

  const checklistData = calculateChecklist();

  const handleNextStep = async (nextStep: OnboardingStep) => {
    // Save progress to database
    await updateBusinessProfile({
      ...formData,
      onboardingStep: nextStep,
    });
    setCurrentStep(nextStep);
  };

  // AI Profile generation using Gemini
  const handleGenerateAiProfile = async () => {
    const textToAnalyze = naturalLanguageDescription.trim() || formData.businessDescription || '';
    if (!textToAnalyze) {
      setAiError('Please provide a description of your business in your own words.');
      return;
    }

    setIsAiLoading(true);
    setAiError(null);

    try {
      const res = await apiFetch('/api/ai/build-profile', {
        method: 'POST',
        body: JSON.stringify({ description: textToAnalyze }),
      });

      const gen = res.generated;
      if (gen) {
        setFormData(prev => ({
          ...prev,
          businessDescription: gen.businessSummary || prev.businessDescription,
          industry: gen.industry || prev.industry,
          businessType: gen.businessType || prev.businessType,
          products: gen.products ? gen.products.map((p: string, i: number) => ({ id: 'p_' + i, name: p })) : prev.products,
          services: gen.services ? gen.services.map((s: string, i: number) => ({ id: 's_' + i, name: s })) : prev.services,
          capabilities: gen.capabilities || prev.capabilities,
          offers: gen.offers ? gen.offers.map((o: string, i: number) => ({ id: 'o_' + i, title: o, category: gen.industry || 'B2B' })) : prev.offers,
          needs: gen.needs ? gen.needs.map((n: string, i: number) => ({ id: 'n_' + i, title: n, category: 'Procurement' })) : prev.needs,
          targetCustomers: gen.targetCustomers || prev.targetCustomers,
          targetMarkets: gen.markets || prev.targetMarkets,
          businessKeywords: gen.keywords || prev.businessKeywords,
        }));
        // Move to review
        handleNextStep('review');
      }
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate AI profile.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFinishOnboarding = async () => {
    await updateBusinessProfile({
      ...formData,
      onboardingCompleted: true,
      onboardingStep: 'completed',
    });
    onComplete();
  };

  return (
    <div className="bg-surface min-h-screen text-on-surface flex flex-col justify-between py-8 px-4 sm:px-8">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b border-outline-variant/30">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold text-base shadow-xs">
            NJS
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight">Business Onboarding</h1>
            <p className="text-xs text-on-surface-variant">Step: {currentStep.toUpperCase().replace('-', ' ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-primary">
            Readiness: {checklistData.percentage}%
          </span>
          <div className="w-24 h-2 rounded-full bg-surface-container overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${checklistData.percentage}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto w-full my-auto py-8">
        <div className="bg-surface-container-lowest rounded-2xl shadow-xl p-6 sm:p-10 border border-outline-variant/30">
          {/* STEP 1: BUSINESS BASICS */}
          {currentStep === 'business' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold uppercase tracking-wider">
                  Step 1 of 8
                </span>
                <h2 className="text-2xl font-bold text-on-surface mt-2">Business Basics</h2>
                <p className="text-sm text-on-surface-variant">
                  Tell us the fundamentals of your enterprise to establish your verified presence.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-on-surface mb-1">Business Name *</label>
                  <input
                    type="text"
                    value={formData.businessName || ''}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="e.g., Apex Manufacturing Group"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Business Type *</label>
                  <select
                    value={formData.businessType || 'Supplier'}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                  >
                    <option value="Manufacturer">Manufacturer</option>
                    <option value="Supplier">Supplier</option>
                    <option value="Retailer">Retailer</option>
                    <option value="Distributor">Distributor</option>
                    <option value="Wholesaler">Wholesaler</option>
                    <option value="Service Provider">Service Provider</option>
                    <option value="Enterprise B2B">Enterprise B2B</option>
                    <option value="Startup">Startup</option>
                    <option value="Agency">Agency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Primary Industry *</label>
                  <input
                    type="text"
                    value={formData.industry || ''}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    placeholder="e.g., Textiles, SaaS, Industrial Hardware"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Country *</label>
                  <input
                    type="text"
                    value={formData.country || ''}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="e.g., United Kingdom, Germany, United States"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g., London, Berlin, New York"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Website URL</label>
                  <input
                    type="url"
                    value={formData.website || ''}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://apexgroup.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Corporate Phone</label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+44 20 7946 0991"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => handleNextStep('about')}
                  disabled={!formData.businessName || !formData.industry}
                  className="px-6 py-3 rounded-xl bg-primary-container text-on-primary-container font-semibold text-sm hover:opacity-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>Continue to Description</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: BUSINESS DESCRIPTION */}
          {currentStep === 'about' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold uppercase tracking-wider">
                  Step 2 of 8
                </span>
                <h2 className="text-2xl font-bold text-on-surface mt-2">Business Description</h2>
                <p className="text-sm text-on-surface-variant">
                  Describe what your company does, your production capabilities, and your commercial focus.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-on-surface">Company Overview *</label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!formData.businessDescription) return;
                      setIsAiLoading(true);
                      try {
                        const res = await apiFetch('/api/ai/improve-description', {
                          method: 'POST',
                          body: JSON.stringify({ description: formData.businessDescription }),
                        });
                        setFormData({ ...formData, businessDescription: res.improved });
                      } catch {}
                      setIsAiLoading(false);
                    }}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    {isAiLoading ? 'Enhancing...' : 'AI Enhance'}
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={formData.businessDescription || ''}
                  onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
                  placeholder="e.g., We are a certified manufacturer specializing in sustainable organic cotton textiles and batch garment fabrication with ISO 9001 and OEKO-TEX compliance..."
                  className="w-full p-4 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface leading-relaxed"
                />
              </div>

              <div className="flex justify-between pt-4 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setCurrentStep('business')}
                  className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container-low cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => handleNextStep('offers')}
                  className="px-6 py-3 rounded-xl bg-primary-container text-on-primary-container font-semibold text-sm hover:opacity-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue to What We Offer</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: WHAT WE OFFER */}
          {currentStep === 'offers' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold uppercase tracking-wider">
                  Step 3 of 8
                </span>
                <h2 className="text-2xl font-bold text-on-surface mt-2">What We Offer</h2>
                <p className="text-sm text-on-surface-variant">
                  Add the core products, services, and commercial capabilities you supply to other businesses.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-on-surface">Commercial Offerings / Products</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={offerInput}
                    onChange={(e) => setOfferInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (offerInput.trim()) {
                          const newOffers = [...(formData.offers || []), { id: 'off_' + Date.now(), title: offerInput.trim(), category: formData.industry || 'General' }];
                          setFormData({ ...formData, offers: newOffers });
                          setOfferInput('');
                        }
                      }
                    }}
                    placeholder="e.g., Custom Batch Textile Dyeing, OEM Organic Cotton Shirts"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (offerInput.trim()) {
                        const newOffers = [...(formData.offers || []), { id: 'off_' + Date.now(), title: offerInput.trim(), category: formData.industry || 'General' }];
                        setFormData({ ...formData, offers: newOffers });
                        setOfferInput('');
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {formData.offers && formData.offers.length > 0 ? (
                    formData.offers.map((off, idx) => (
                      <span
                        key={off.id || idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-primary text-xs font-medium border border-outline-variant/30"
                      >
                        {off.title}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              offers: formData.offers?.filter((_, i) => i !== idx),
                            });
                          }}
                          className="hover:text-error"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-on-surface-variant italic">No offerings added yet. Enter items above.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setCurrentStep('about')}
                  className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container-low cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => handleNextStep('needs')}
                  className="px-6 py-3 rounded-xl bg-primary-container text-on-primary-container font-semibold text-sm hover:opacity-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue to What We Need</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: WHAT WE NEED */}
          {currentStep === 'needs' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold uppercase tracking-wider">
                  Step 4 of 8
                </span>
                <h2 className="text-2xl font-bold text-on-surface mt-2">What We Need</h2>
                <p className="text-sm text-on-surface-variant">
                  Specify what supplies, materials, machinery, or services your business is currently looking to procure.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-on-surface">Sourcing Needs / Requirements</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={needInput}
                    onChange={(e) => setNeedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (needInput.trim()) {
                          const newNeeds = [...(formData.needs || []), { id: 'need_' + Date.now(), title: needInput.trim(), category: 'Procurement' }];
                          setFormData({ ...formData, needs: newNeeds });
                          setNeedInput('');
                        }
                      }
                    }}
                    placeholder="e.g., Raw GOTS certified yarn, Biodegradable packaging boxes"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (needInput.trim()) {
                        const newNeeds = [...(formData.needs || []), { id: 'need_' + Date.now(), title: needInput.trim(), category: 'Procurement' }];
                        setFormData({ ...formData, needs: newNeeds });
                        setNeedInput('');
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {formData.needs && formData.needs.length > 0 ? (
                    formData.needs.map((need, idx) => (
                      <span
                        key={need.id || idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-primary text-xs font-medium border border-outline-variant/30"
                      >
                        {need.title}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              needs: formData.needs?.filter((_, i) => i !== idx),
                            });
                          }}
                          className="hover:text-error"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-on-surface-variant italic">No procurement needs listed yet.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setCurrentStep('offers')}
                  className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container-low cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => handleNextStep('targets')}
                  className="px-6 py-3 rounded-xl bg-primary-container text-on-primary-container font-semibold text-sm hover:opacity-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue to Target Businesses</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: TARGET BUSINESSES */}
          {currentStep === 'targets' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold uppercase tracking-wider">
                  Step 5 of 8
                </span>
                <h2 className="text-2xl font-bold text-on-surface mt-2">Target Businesses & Markets</h2>
                <p className="text-sm text-on-surface-variant">
                  Which types of enterprises and regions do you want the AI to match you with?
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Target Customers (e.g. D2C Fashion Brands, Retail Chains)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetCustomerInput}
                      onChange={(e) => setTargetCustomerInput(e.target.value)}
                      placeholder="Add target customer profile"
                      className="flex-1 px-4 py-2 rounded-xl bg-surface border border-outline-variant outline-none text-sm text-on-surface"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (targetCustomerInput.trim()) {
                          setFormData({
                            ...formData,
                            targetCustomers: [...(formData.targetCustomers || []), targetCustomerInput.trim()],
                          });
                          setTargetCustomerInput('');
                        }
                      }}
                      className="px-4 py-2 bg-surface-container-high rounded-xl text-xs font-semibold hover:bg-surface-container-highest cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.targetCustomers?.map((c, i) => (
                      <span key={i} className="px-2.5 py-1 rounded bg-surface-container text-xs text-on-surface">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Target Geographic Markets (e.g. Western Europe, North America)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetMarketInput}
                      onChange={(e) => setTargetMarketInput(e.target.value)}
                      placeholder="Add target market"
                      className="flex-1 px-4 py-2 rounded-xl bg-surface border border-outline-variant outline-none text-sm text-on-surface"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (targetMarketInput.trim()) {
                          setFormData({
                            ...formData,
                            targetMarkets: [...(formData.targetMarkets || []), targetMarketInput.trim()],
                          });
                          setTargetMarketInput('');
                        }
                      }}
                      className="px-4 py-2 bg-surface-container-high rounded-xl text-xs font-semibold hover:bg-surface-container-highest cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.targetMarkets?.map((m, i) => (
                      <span key={i} className="px-2.5 py-1 rounded bg-surface-container text-xs text-on-surface">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setCurrentStep('needs')}
                  className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container-low cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => handleNextStep('goals')}
                  className="px-6 py-3 rounded-xl bg-primary-container text-on-primary-container font-semibold text-sm hover:opacity-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue to Goals</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: BUSINESS GOALS */}
          {currentStep === 'goals' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold uppercase tracking-wider">
                  Step 6 of 8
                </span>
                <h2 className="text-2xl font-bold text-on-surface mt-2">Business Goals & Keywords</h2>
                <p className="text-sm text-on-surface-variant">
                  Help the AI understand your key commercial objectives and search indexing tags.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Commercial Goals</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      placeholder="e.g., Secure European retail distribution, Expand contract manufacturing"
                      className="flex-1 px-4 py-2 rounded-xl bg-surface border border-outline-variant outline-none text-sm text-on-surface"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (goalInput.trim()) {
                          setFormData({
                            ...formData,
                            businessGoals: [...(formData.businessGoals || []), goalInput.trim()],
                          });
                          setGoalInput('');
                        }
                      }}
                      className="px-4 py-2 bg-surface-container-high rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.businessGoals?.map((g, i) => (
                      <span key={i} className="px-2.5 py-1 rounded bg-surface-container text-xs text-on-surface">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Search Keywords</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      placeholder="e.g., Organic Cotton, Batch Sourcing, ISO9001"
                      className="flex-1 px-4 py-2 rounded-xl bg-surface border border-outline-variant outline-none text-sm text-on-surface"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (keywordInput.trim()) {
                          setFormData({
                            ...formData,
                            businessKeywords: [...(formData.businessKeywords || []), keywordInput.trim()],
                          });
                          setKeywordInput('');
                        }
                      }}
                      className="px-4 py-2 bg-surface-container-high rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.businessKeywords?.map((k, i) => (
                      <span key={i} className="px-2.5 py-1 rounded bg-surface-container text-xs text-on-surface">
                        #{k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setCurrentStep('targets')}
                  className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container-low cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => handleNextStep('checklist')}
                  className="px-6 py-3 rounded-xl bg-primary-container text-on-primary-container font-semibold text-sm hover:opacity-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>View AI Checklist</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: AI CHECKLIST */}
          {currentStep === 'checklist' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold uppercase tracking-wider">
                  Step 7 of 8
                </span>
                <h2 className="text-2xl font-bold text-on-surface mt-2">AI Readiness Checklist</h2>
                <p className="text-sm text-on-surface-variant">
                  We calculate readiness based strictly on actual completed operational fields.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Profile Completeness
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {checklistData.completedCount} of {checklistData.totalCount} completed ({checklistData.percentage}%)
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${checklistData.percentage}%` }}
                  />
                </div>
              </div>

              {/* Checklist Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-[20px] ${checklistData.checks.basics ? 'text-green-600' : 'text-on-surface-variant/40'}`}>
                      {checklistData.checks.basics ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-on-surface">Business Basics</div>
                      <div className="text-xs text-on-surface-variant">{formData.businessName || 'Name'}, {formData.industry || 'Industry'}</div>
                    </div>
                  </div>
                  <button onClick={() => setCurrentStep('business')} className="text-xs text-primary font-semibold hover:underline">
                    Edit
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-[20px] ${checklistData.checks.description ? 'text-green-600' : 'text-on-surface-variant/40'}`}>
                      {checklistData.checks.description ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-on-surface">Company Description</div>
                      <div className="text-xs text-on-surface-variant truncate max-w-xs">{formData.businessDescription?.slice(0, 45) || 'No description yet'}...</div>
                    </div>
                  </div>
                  <button onClick={() => setCurrentStep('about')} className="text-xs text-primary font-semibold hover:underline">
                    Edit
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-[20px] ${checklistData.checks.productsOffers ? 'text-green-600' : 'text-on-surface-variant/40'}`}>
                      {checklistData.checks.productsOffers ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-on-surface">Products & What We Offer</div>
                      <div className="text-xs text-on-surface-variant">{formData.offers?.length || 0} items defined</div>
                    </div>
                  </div>
                  <button onClick={() => setCurrentStep('offers')} className="text-xs text-primary font-semibold hover:underline">
                    Edit
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-[20px] ${checklistData.checks.needs ? 'text-green-600' : 'text-on-surface-variant/40'}`}>
                      {checklistData.checks.needs ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-on-surface">What We Need</div>
                      <div className="text-xs text-on-surface-variant">{formData.needs?.length || 0} procurement needs listed</div>
                    </div>
                  </div>
                  <button onClick={() => setCurrentStep('needs')} className="text-xs text-primary font-semibold hover:underline">
                    Edit
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-[20px] ${checklistData.checks.targets ? 'text-green-600' : 'text-on-surface-variant/40'}`}>
                      {checklistData.checks.targets ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-on-surface">Target Businesses & Markets</div>
                      <div className="text-xs text-on-surface-variant">{formData.targetCustomers?.length || 0} customer profiles, {formData.targetMarkets?.length || 0} markets</div>
                    </div>
                  </div>
                  <button onClick={() => setCurrentStep('targets')} className="text-xs text-primary font-semibold hover:underline">
                    Edit
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-[20px] ${checklistData.checks.goals ? 'text-green-600' : 'text-on-surface-variant/40'}`}>
                      {checklistData.checks.goals ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-on-surface">Goals & Search Keywords</div>
                      <div className="text-xs text-on-surface-variant">{formData.businessGoals?.length || 0} goals defined</div>
                    </div>
                  </div>
                  <button onClick={() => setCurrentStep('goals')} className="text-xs text-primary font-semibold hover:underline">
                    Edit
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setCurrentStep('goals')}
                  className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container-low cursor-pointer"
                >
                  Back
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('ai-profile')}
                    className="px-5 py-3 rounded-xl bg-surface-container-high text-on-surface text-sm font-semibold hover:bg-surface-container-highest transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">psychology</span>
                    Use AI Natural Language Builder
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNextStep('review')}
                    className="px-6 py-3 rounded-xl bg-primary-container text-on-primary-container font-semibold text-sm hover:opacity-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <span>Review Profile</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP: AI PROFILE GENERATOR (Natural Language) */}
          {currentStep === 'ai-profile' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold uppercase tracking-wider">
                  AI Profile Builder
                </span>
                <h2 className="text-2xl font-bold text-on-surface mt-2">Describe Your Business in Your Own Words</h2>
                <p className="text-sm text-on-surface-variant">
                  Gemini will analyze your exact words to extract verified offerings, needs, keywords, and market fit.
                </p>
              </div>

              {aiError && (
                <div className="p-3 rounded-xl bg-error-container/40 border border-error/30 text-error text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{aiError}</span>
                </div>
              )}

              <div>
                <textarea
                  rows={6}
                  value={naturalLanguageDescription}
                  onChange={(e) => setNaturalLanguageDescription(e.target.value)}
                  placeholder="e.g., We are a boutique precision machining factory in Stuttgart. We produce high-tolerance titanium components for medical robotics and industrial aerospace. Currently we are seeking suppliers of certified medical-grade titanium rods and looking for European medical device manufacturers who need batch prototype runs..."
                  className="w-full p-4 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface leading-relaxed"
                />
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low text-xs text-on-surface-variant flex items-start gap-2.5">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">verified_user</span>
                <span>
                  <strong>Strict AI Rule:</strong> The AI extracts only what you state and does not hallucinate fictional revenue, clients, or awards. You will review everything before saving.
                </span>
              </div>

              <div className="flex justify-between pt-4 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setCurrentStep('checklist')}
                  className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container-low cursor-pointer"
                >
                  Back to Checklist
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAiProfile}
                  disabled={isAiLoading || !naturalLanguageDescription.trim()}
                  className="px-6 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isAiLoading ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      <span>Analyzing with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                      <span>Build My AI Profile</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 8: FINAL REVIEW */}
          {currentStep === 'review' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold uppercase tracking-wider">
                    Final Step
                  </span>
                  <h2 className="text-2xl font-bold text-on-surface mt-2">Review Your Enterprise Profile</h2>
                  <p className="text-sm text-on-surface-variant">
                    Confirm your details. You can edit this anytime from your dashboard.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase text-on-surface-variant block">Verification Status</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    Ready for Matching
                  </span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-on-surface">{formData.businessName || 'Business Name'}</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {formData.businessType} • {formData.industry} • {formData.city ? `${formData.city}, ` : ''}{formData.country}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-xs font-semibold">
                    {checklistData.percentage}% Complete
                  </span>
                </div>

                <p className="text-sm text-on-surface leading-relaxed">
                  {formData.businessDescription || 'No description provided.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-outline-variant/20">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      What We Offer ({formData.offers?.length || 0})
                    </h4>
                    <ul className="text-xs text-on-surface space-y-1">
                      {formData.offers && formData.offers.length > 0 ? (
                        formData.offers.map((o, i) => <li key={i} className="flex items-center gap-1.5">• {o.title}</li>)
                      ) : (
                        <li className="text-on-surface-variant italic">None specified</li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      What We Need ({formData.needs?.length || 0})
                    </h4>
                    <ul className="text-xs text-on-surface space-y-1">
                      {formData.needs && formData.needs.length > 0 ? (
                        formData.needs.map((n, i) => <li key={i} className="flex items-center gap-1.5">• {n.title}</li>)
                      ) : (
                        <li className="text-on-surface-variant italic">None specified</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="pt-2 border-t border-outline-variant/20 flex flex-wrap gap-1.5">
                  {formData.businessKeywords?.map((kw, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-surface-container-highest text-[11px] text-on-surface-variant">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setCurrentStep('checklist')}
                  className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container-low cursor-pointer"
                >
                  Back to Checklist
                </button>
                <button
                  type="button"
                  onClick={handleFinishOnboarding}
                  className="px-8 py-3.5 rounded-xl bg-primary-container text-on-primary-container font-semibold text-sm hover:opacity-95 transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span>Complete Setup &amp; Launch Dashboard</span>
                  <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-on-surface-variant pt-6 border-t border-outline-variant/20">
        © 2025 NJS Platform. All rights reserved. • Matchmaking with zero hallucinated data.
      </footer>
    </div>
  );
};
