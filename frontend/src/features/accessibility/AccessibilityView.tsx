import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Info,
  Volume2,
  Square,
  Sparkles,
  PhoneCall,
  MapPin,
  Clock,
  HeartHandshake,
  DoorOpen,
  Eye,
  Ear,
  Brain,
  FileText,
  Save,
  Loader2,
  Calendar,
} from 'lucide-react';
import { useEventStore } from '@/stores/useEventStore';
import { useEventsQuery } from '@/features/events/hooks';
import {
  useAccessibilityQuery,
  useUpdateAccessibilityProfileMutation,
  useUpdateVenueAccessibilityMutation,
  useGenerateAccessibilityPlanMutation,
} from '@/features/accessibility/api';
import {
  VerificationStatus,
  AccessibilityProfileInput,
  VenueAccessibilityInput,
} from '@/types/accessibility';
import { useAccessibilitySettingsStore } from '@/stores/useAccessibilitySettingsStore';
import { Button } from '@/components/ui';

export const AccessibilityView: React.FC = () => {
  const { activeEventId, activeEvent } = useEventStore();
  const { data: events = [] } = useEventsQuery();

  const currentEvent =
    events.find((e) => e.id === activeEventId) || activeEvent || events[0] || null;

  const {
    data: accessibilityData,
    isLoading: isAccessibilityLoading,
  } = useAccessibilityQuery(currentEvent?.id || null);

  const updateProfileMutation = useUpdateAccessibilityProfileMutation(currentEvent?.id || '');
  const updateVenueMutation = useUpdateVenueAccessibilityMutation(currentEvent?.id || '');
  const generatePlanMutation = useGenerateAccessibilityPlanMutation(currentEvent?.id || '');

  const { speak, stopSpeech, isSpeaking, textToSpeechEnabled } = useAccessibilitySettingsStore();

  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'facilities' | 'routes_timeline' | 'emergency'>('profile');

  // Form states for profile requirements
  const [profileForm, setProfileForm] = useState<AccessibilityProfileInput | null>(null);

  // Form states for venue facilities
  const [facilityEdits, setFacilityEdits] = useState<Record<string, { status: VerificationStatus; notes: string }>>({});

  // Form states for emergency support
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [venuePhone, setVenuePhone] = useState('');
  const [evacuationProcedure, setEvacuationProcedure] = useState('');
  const [assemblyPoint, setAssemblyPoint] = useState('');

  // Sync state when data loads
  React.useEffect(() => {
    if (accessibilityData) {
      setProfileForm({
        mobility_assistance: accessibilityData.profile.mobility_assistance,
        wheelchair_accessibility: accessibilityData.profile.wheelchair_accessibility,
        visual_impairment: accessibilityData.profile.visual_impairment,
        hearing_impairment: accessibilityData.profile.hearing_impairment,
        cognitive_accessibility: accessibilityData.profile.cognitive_accessibility,
        dyslexia_friendly: accessibilityData.profile.dyslexia_friendly,
        sensory_sensitivities: accessibilityData.profile.sensory_sensitivities,
        language_assistance: accessibilityData.profile.language_assistance,
        other_requirements: accessibilityData.profile.other_requirements,
        additional_notes: accessibilityData.profile.additional_notes,
      });

      const initialFacs: Record<string, { status: VerificationStatus; notes: string }> = {};
      Object.entries(accessibilityData.facilities).forEach(([k, v]) => {
        initialFacs[k] = { status: v.status, notes: v.notes || '' };
      });
      setFacilityEdits(initialFacs);

      setEmergencyPhone(accessibilityData.emergency.emergency_contact_phone || '');
      setVenuePhone(accessibilityData.emergency.venue_assistance_phone || '');
      setEvacuationProcedure(accessibilityData.emergency.evacuation_procedure || '');
      setAssemblyPoint(accessibilityData.emergency.assembly_point || '');
    }
  }, [accessibilityData]);

  if (!currentEvent) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">No Event Selected</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Please select or create an event from the Events Hub to configure its accessibility profile and plan.
        </p>
      </div>
    );
  }

  const generatedPlan = accessibilityData?.generated_plan;
  const coverageScore = accessibilityData?.coverage_score ?? 0;
  const confidenceLevel = accessibilityData?.confidence_level ?? 'LOW';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm) return;
    await updateProfileMutation.mutateAsync(profileForm);
  };

  const handleSaveVenue = async () => {
    const payload: VenueAccessibilityInput = {
      facilities: facilityEdits,
    };
    await updateVenueMutation.mutateAsync(payload);
  };

  const handleSaveEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: VenueAccessibilityInput = {
      emergency: {
        emergency_contact_phone: emergencyPhone,
        venue_assistance_phone: venuePhone,
        evacuation_procedure: evacuationProcedure,
        assembly_point: assemblyPoint,
        verification_status: emergencyPhone && evacuationProcedure ? 'VERIFIED' : 'UNVERIFIED',
      },
    };
    await updateVenueMutation.mutateAsync(payload);
  };

  const handleReadSummary = () => {
    if (isSpeaking) {
      stopSpeech();
    } else {
      const textToRead = generatedPlan?.summary || `Event ${currentEvent.title} has an accessibility coverage score of ${coverageScore}% with ${confidenceLevel} confidence.`;
      speak(textToRead);
    }
  };

  const handleReadWhyPlan = () => {
    if (isSpeaking) {
      stopSpeech();
    } else if (generatedPlan?.why_this_plan) {
      const why = generatedPlan.why_this_plan;
      const text = `Coverage score is ${why.coverage_score} percent with ${why.confidence_level} confidence. Missing items: ${why.missing_information.join('. ')}. Warnings: ${why.unverified_warnings.join('. ')}. Disclaimer: ${why.compliance_disclaimer}`;
      speak(text);
    }
  };

  const getConfidenceBadgeColor = (lvl: string) => {
    switch (lvl) {
      case 'HIGH':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-rose-100 text-rose-800 border-rose-300';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Overview & Coverage Score Card */}
      <section
        aria-labelledby="accessibility-hub-title"
        className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 tracking-wide uppercase">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Inclusive Event Infrastructure</span>
            </div>
            <h1 id="accessibility-hub-title" className="text-2xl font-bold text-slate-900 mt-1">
              Accessibility Hub & Plan
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Event: <span className="font-semibold text-slate-800">{currentEvent.title}</span> ({currentEvent.event_type})
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {textToSpeechEnabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReadSummary}
                className="flex items-center space-x-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
                aria-label={isSpeaking ? 'Stop voice read aloud' : 'Listen to accessibility summary'}
              >
                {isSpeaking ? (
                  <>
                    <Square className="w-4 h-4 text-rose-600" />
                    <span>Stop Voice</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                    <span>Listen Aloud</span>
                  </>
                )}
              </Button>
            )}

            <Button
              type="button"
              onClick={() => generatePlanMutation.mutate()}
              disabled={generatePlanMutation.isPending || isAccessibilityLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-2"
            >
              {generatePlanMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Plan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{generatedPlan ? 'Refresh Accessibility Plan' : 'Generate Accessibility Plan'}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Coverage Score & Confidence Gauge */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500">Coverage Score</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                {coverageScore}%
              </div>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-slate-200 flex items-center justify-center font-bold text-sm text-emerald-700 bg-white">
              {Math.round(coverageScore)}%
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500">Plan Confidence</span>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getConfidenceBadgeColor(confidenceLevel)}`}>
                  {confidenceLevel} CONFIDENCE
                </span>
              </div>
            </div>
            <ShieldCheck className="w-8 h-8 text-slate-400" />
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500">Privacy Safeguard</span>
              <div className="text-xs font-semibold text-emerald-700 mt-1 flex items-center space-x-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Zero Guest PII Exposed</span>
              </div>
            </div>
            <HeartHandshake className="w-8 h-8 text-slate-400" />
          </div>
        </div>

        {/* Executive Plan Summary Banner */}
        {generatedPlan && (
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-950 text-xs sm:text-sm leading-relaxed">
            <span className="font-bold text-emerald-900">Executive Accessibility Summary: </span>
            {generatedPlan.summary}
          </div>
        )}
      </section>

      {/* 2. "Why This Plan?" Explainability & Verification Status Section */}
      {generatedPlan?.why_this_plan && (
        <section
          aria-labelledby="why-this-plan-heading"
          className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Info className="w-5 h-5 text-blue-600" />
              <h2 id="why-this-plan-heading" className="text-base font-bold text-slate-900">
                Why This Plan? (Explainability & Reliability)
              </h2>
            </div>
            {textToSpeechEnabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReadWhyPlan}
                className="text-xs text-blue-700 hover:bg-blue-50 flex items-center space-x-1"
                aria-label="Read why this plan section aloud"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Read Section</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Unverified Warnings */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
              <div className="flex items-center space-x-1.5 font-bold text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Unverified Items & Action Alerts ({generatedPlan.why_this_plan.unverified_warnings.length})</span>
              </div>
              {generatedPlan.why_this_plan.unverified_warnings.length === 0 ? (
                <p className="text-xs text-emerald-700 font-medium">All essential venue facilities have been confirmed on-site.</p>
              ) : (
                <ul className="text-xs text-amber-900 space-y-1.5 list-disc pl-4">
                  {generatedPlan.why_this_plan.unverified_warnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Missing Information Indicators */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 space-y-2">
              <div className="flex items-center space-x-1.5 font-bold text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-600" />
                <span>Missing Information Indicators ({generatedPlan.why_this_plan.missing_information.length})</span>
              </div>
              {generatedPlan.why_this_plan.missing_information.length === 0 ? (
                <p className="text-xs text-emerald-700 font-medium">Complete venue and emergency details provided.</p>
              ) : (
                <ul className="text-xs text-blue-900 space-y-1.5 list-disc pl-4">
                  {generatedPlan.why_this_plan.missing_information.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Compliance Disclaimer (Mandatory Regulatory Callout) */}
          <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-300 text-xs text-slate-700 font-medium leading-relaxed">
            <span className="font-bold text-slate-900">Regulatory Disclaimer: </span>
            {generatedPlan.why_this_plan.compliance_disclaimer}
          </div>
        </section>
      )}

      {/* 3. Navigation Tabs for Accessibility Domains */}
      <nav aria-label="Accessibility Domain Sections" className="flex border-b border-slate-200 space-x-4">
        {[
          { id: 'profile', label: '1. Requirements Profile', icon: Eye },
          { id: 'facilities', label: '2. Venue Facilities Checklist', icon: DoorOpen },
          { id: 'routes_timeline', label: '3. Routes & Timeline Guidance', icon: Clock },
          { id: 'emergency', label: '4. Emergency & SOS Support', icon: PhoneCall },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`pb-3 px-2 flex items-center space-x-2 text-sm font-semibold border-b-2 transition-colors ${
                isActive
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 4. Tab Content Sections */}

      {/* TAB 1: Accessibility Profile */}
      {activeSubTab === 'profile' && profileForm && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Accessibility Requirements Profile</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure universal and personalized accessibility requirements for this event.
            </p>
          </div>

          {/* Privacy Note */}
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-purple-700 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold">Aggregated Guest Signals: </span>
              Attendee accommodations requested via invitations are aggregated automatically to protect guest privacy. Personal attendee names and contacts are never sent to external AI providers.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'wheelchair_accessibility', label: 'Wheelchair Accessibility', icon: DoorOpen, desc: 'Step-free access, ramps, elevators, and wide doorways.' },
              { key: 'mobility_assistance', label: 'Mobility Assistance', icon: HeartHandshake, desc: 'Assistance for walking, resting seats, and close parking.' },
              { key: 'visual_impairment', label: 'Visual Impairment Support', icon: Eye, desc: 'High contrast signage, large print, and tactile guidance.' },
              { key: 'hearing_impairment', label: 'Hearing Impairment Support', icon: Ear, desc: 'Assistive listening, CART captioning, and sign language.' },
              { key: 'sensory_sensitivities', label: 'Sensory Sensitivity / Quiet Spaces', icon: Brain, desc: 'Decompression rooms, subdued lighting, and volume control.' },
              { key: 'cognitive_accessibility', label: 'Cognitive Accessibility', icon: Brain, desc: 'Clear schedule, visual agendas, and simplified layout.' },
              { key: 'dyslexia_friendly', label: 'Dyslexia-Friendly Communications', icon: FileText, desc: 'Specialized fonts, high contrast, and voice-assisted materials.' },
              { key: 'language_assistance', label: 'Language & Translation', icon: Brain, desc: 'Multi-language signage and live interpreter services.' },
            ].map((cat) => {
              const Icon = cat.icon;
              const isChecked = Boolean((profileForm as any)[cat.key]);
              return (
                <label
                  key={cat.key}
                  className={`p-4 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition-all ${
                    isChecked
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Icon className={`w-5 h-5 ${isChecked ? 'text-emerald-700' : 'text-slate-400'}`} />
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, [cat.key]: e.target.checked })
                        }
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                    </div>
                    <span className="block text-xs font-bold text-slate-900">{cat.label}</span>
                    <p className="text-[11px] text-slate-500 leading-normal">{cat.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Additional Notes */}
          <div className="space-y-1.5">
            <label htmlFor="accessibility-additional-notes" className="text-xs font-bold text-slate-700">
              Additional Organizer Accessibility Notes
            </label>
            <textarea
              id="accessibility-additional-notes"
              rows={3}
              value={profileForm.additional_notes || ''}
              onChange={(e) => setProfileForm({ ...profileForm, additional_notes: e.target.value })}
              placeholder="e.g., VIP speaker requires motorized wheelchair clearance (min 32 in). Service animals present."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-2"
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save Requirements Profile</span>
            </Button>
          </div>
        </form>
      )}

      {/* TAB 2: Venue Facilities Verification Checklist */}
      {activeSubTab === 'facilities' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Venue Facilities Verification Checklist</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every facility must be physically verified by the organizer. Avoid assuming facility status.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleSaveVenue}
              disabled={updateVenueMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center space-x-1.5"
            >
              {updateVenueMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save All Verifications</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(accessibilityData?.facilities || {}).map(([key, item]) => {
              const currentEdit = facilityEdits[key] || { status: item.status, notes: item.notes || '' };

              return (
                <div
                  key={key}
                  className={`p-4 rounded-xl border transition-colors ${
                    currentEdit.status === 'VERIFIED'
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : currentEdit.status === 'NOT_AVAILABLE'
                      ? 'border-rose-200 bg-rose-50/20'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{item.label}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        currentEdit.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : currentEdit.status === 'NOT_AVAILABLE'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {currentEdit.status}
                    </span>
                  </div>

                  {/* Status Toggle Radio Group */}
                  <div className="flex space-x-2 mt-3">
                    {(['VERIFIED', 'UNVERIFIED', 'NOT_AVAILABLE'] as VerificationStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          setFacilityEdits({
                            ...facilityEdits,
                            [key]: { ...currentEdit, status: st },
                          })
                        }
                        className={`flex-1 py-1 text-[10px] font-semibold rounded-lg border transition-colors ${
                          currentEdit.status === st
                            ? st === 'VERIFIED'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : st === 'NOT_AVAILABLE'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {st === 'NOT_AVAILABLE' ? 'NOT AVAIL' : st}
                      </button>
                    ))}
                  </div>

                  {/* Notes input */}
                  <div className="mt-2.5">
                    <input
                      type="text"
                      value={currentEdit.notes}
                      onChange={(e) =>
                        setFacilityEdits({
                          ...facilityEdits,
                          [key]: { ...currentEdit, notes: e.target.value },
                        })
                      }
                      placeholder="Notes (e.g., width 36 in, grab bars present, key at front desk)"
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {item.verified_at && (
                    <div className="text-[10px] text-slate-400 mt-1">
                      Verified at: {new Date(item.verified_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Routes & Timeline Guidance */}
      {activeSubTab === 'routes_timeline' && (
        <div className="space-y-6">
          {/* Accessible Routes Guidance */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Accessible Routes & Navigation Guidance</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Route instructions for attendees requiring step-free access and elevator navigation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(generatedPlan?.accessible_routes || []).map((route, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{route.route_type}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        route.step_free
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {route.step_free ? 'STEP-FREE' : 'BARRIER DETECTED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-normal">{route.description}</p>
                  <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{route.distance_notes}</span>
                  </div>
                  {route.warning_alert && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span>{route.warning_alert}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Accessible Timeline Barrier Analysis */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Accessible Timeline & Schedule Analysis</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Identifies prolonged activities (&gt;90 mins), sensory triggers, and recommends decompression intervals.
              </p>
            </div>

            {(!generatedPlan?.accessible_timeline || generatedPlan.accessible_timeline.length === 0) ? (
              <p className="text-xs text-slate-500 italic">No timeline activities configured yet for this event.</p>
            ) : (
              <div className="space-y-3">
                {generatedPlan.accessible_timeline.map((act) => (
                  <div
                    key={act.activity_id}
                    className={`p-4 rounded-xl border transition-colors ${
                      act.potential_barrier
                        ? 'border-amber-200 bg-amber-50/30'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{act.title}</span>
                      <span className="text-xs text-slate-500 font-medium">
                        {act.duration_minutes} minutes
                      </span>
                    </div>

                    {act.potential_barrier && (
                      <div className="mt-2 text-xs text-amber-900 font-medium flex items-start space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <span>{act.potential_barrier}</span>
                      </div>
                    )}

                    {act.suggested_accommodation && (
                      <div className="mt-1 text-xs text-emerald-800 font-medium flex items-start space-x-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>{act.suggested_accommodation}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Emergency & SOS Support */}
      {activeSubTab === 'emergency' && (
        <form onSubmit={handleSaveEmergency} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Emergency & Accessible SOS Support</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rapid assistance telephone contacts, designated ground-floor assembly areas, and audible egress instructions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="emergency-organizer-phone" className="text-xs font-bold text-slate-700">
                Organizer Dedicated Emergency Phone
              </label>
              <input
                id="emergency-organizer-phone"
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="emergency-venue-phone" className="text-xs font-bold text-slate-700">
                Venue Security / Assistance Phone
              </label>
              <input
                id="emergency-venue-phone"
                type="tel"
                value={venuePhone}
                onChange={(e) => setVenuePhone(e.target.value)}
                placeholder="+1 555 987 6543"
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emergency-evacuation-procedure" className="text-xs font-bold text-slate-700">
              Accessible Evacuation Procedure
            </label>
            <textarea
              id="emergency-evacuation-procedure"
              rows={3}
              value={evacuationProcedure}
              onChange={(e) => setEvacuationProcedure(e.target.value)}
              placeholder="e.g., Ground-floor direct egress via East exit ramp. Designated assistance wardens assigned to ballroom companion seating."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emergency-assembly-point" className="text-xs font-bold text-slate-700">
              Assembly Point Location
            </label>
            <input
              id="emergency-assembly-point"
              type="text"
              value={assemblyPoint}
              onChange={(e) => setAssemblyPoint(e.target.value)}
              placeholder="e.g., North Courtyard flagpole, barrier-free paved area."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateVenueMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-2"
            >
              {updateVenueMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save Emergency Support</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
