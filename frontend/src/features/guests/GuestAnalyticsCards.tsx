import React from 'react';
import { Users, CheckCircle2, Clock, HelpCircle, XCircle, Utensils, HeartHandshake } from 'lucide-react';
import { GuestAnalytics } from '@/types/guest';

interface GuestAnalyticsCardsProps {
  analytics?: GuestAnalytics | null | undefined;
  isLoading?: boolean;
}

export const GuestAnalyticsCards: React.FC<GuestAnalyticsCardsProps> = ({
  analytics,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 h-24" />
        ))}
      </div>
    );
  }

  const totalGuests = analytics?.total_guests ?? 0;
  const confirmed = analytics?.confirmed_guests ?? 0;
  const expectedAttendance = analytics?.expected_attendance ?? 0;
  const pending = analytics?.pending_responses ?? 0;
  const maybe = analytics?.maybe_responses ?? 0;
  const declined = analytics?.declined_guests ?? 0;
  const attendanceRate = analytics?.attendance_rate ?? 0;
  const dietaryEntries = Object.entries(analytics?.dietary_preference_distribution ?? {});

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Guests */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Guests</p>
            <p className="text-xl font-bold text-gray-900">{totalGuests}</p>
            <p className="text-[11px] text-gray-400">
              {analytics?.total_invited ?? 0} invited
            </p>
          </div>
        </div>

        {/* Confirmed / Expected Attendance */}
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Expected Heads</p>
            <p className="text-xl font-bold text-emerald-700">{expectedAttendance}</p>
            <p className="text-[11px] text-emerald-600 font-medium">
              {confirmed} confirmed ({attendanceRate}%)
            </p>
          </div>
        </div>

        {/* Pending Responses */}
        <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Pending RSVP</p>
            <p className="text-xl font-bold text-amber-700">{pending}</p>
            <p className="text-[11px] text-amber-600">Awaiting reply</p>
          </div>
        </div>

        {/* Maybe / Tentative */}
        <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Tentative (Maybe)</p>
            <p className="text-xl font-bold text-purple-700">{maybe}</p>
            <p className="text-[11px] text-purple-600">Unconfirmed</p>
          </div>
        </div>

        {/* Declined */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Declined</p>
            <p className="text-xl font-bold text-rose-600">{declined}</p>
            <p className="text-[11px] text-gray-400">Cannot attend</p>
          </div>
        </div>
      </div>

      {/* Dietary & Category Highlights */}
      {dietaryEntries.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3 flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-amber-900 mr-2">
            <Utensils className="w-4 h-4 text-amber-700" />
            <span>Catering Dietary Matrix:</span>
          </div>
          {dietaryEntries.map(([diet, count]) => (
            <span
              key={diet}
              className="bg-white px-2.5 py-1 rounded-md border border-amber-200 text-amber-800 font-medium shadow-2xs"
            >
              {diet}: <span className="font-bold">{count}</span>
            </span>
          ))}
          <div className="ml-auto text-[11px] text-amber-700 flex items-center gap-1">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Exact deterministic catering headcounts</span>
          </div>
        </div>
      )}
    </div>
  );
};
