import React from 'react';
import {
  Search,
  Mail,
  Phone,
  Users,
  Utensils,
  Accessibility,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  HelpCircle,
  XCircle,
  Send,
  SendHorizontal,
} from 'lucide-react';
import { Guest, RSVPStatus, GuestCategory, InvitationStatus } from '@/types/guest';

interface GuestDirectoryTableProps {
  guests: Guest[];
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedCategory: string;
  onCategoryChange: (val: string) => void;
  selectedRSVP: string;
  onRSVPChange: (val: string) => void;
  onEditGuest: (guest: Guest) => void;
  onDeleteGuest: (guest: Guest) => void;
  onQuickUpdateRSVP: (guestId: string, status: RSVPStatus) => void;
  onQuickUpdateInvitation: (guestId: string, status: InvitationStatus) => void;
  isLoading?: boolean;
}

const CATEGORIES: ('All' | GuestCategory)[] = [
  'All',
  'Family',
  'Friends',
  'Colleagues',
  'VIP',
  'Community',
  'Other',
];

const RSVP_FILTERS: { value: string; label: string }[] = [
  { value: 'All', label: 'All RSVPs' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'MAYBE', label: 'Maybe' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'DECLINED', label: 'Declined' },
];

export const GuestDirectoryTable: React.FC<GuestDirectoryTableProps> = ({
  guests,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedRSVP,
  onRSVPChange,
  onEditGuest,
  onDeleteGuest,
  onQuickUpdateRSVP,
  onQuickUpdateInvitation,
  isLoading = false,
}) => {
  const getRSVPBadge = (status: RSVPStatus) => {
    switch (status) {
      case 'CONFIRMED':
      case 'ATTENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            Confirmed
          </span>
        );
      case 'DECLINED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Declined
          </span>
        );
      case 'MAYBE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <HelpCircle className="w-3 h-3 text-purple-600" />
            Maybe
          </span>
        );
      case 'WAITING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            <Clock className="w-3 h-3 text-gray-500" />
            Waiting
          </span>
        );
      case 'INVITED':
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Invited
          </span>
        );
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'VIP':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Family':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Friends':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Colleagues':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Community':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Search & Filters Toolbar */}
      <div className="p-4 border-b border-gray-100 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, email, or table..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* RSVP Filter Dropdown */}
          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">RSVP:</span>
            <select
              value={selectedRSVP}
              onChange={(e) => onRSVPChange(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {RSVP_FILTERS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-xs text-gray-400 font-medium mr-1 shrink-0">Category:</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Table */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-gray-500 animate-pulse">
          Loading guest roster...
        </div>
      ) : guests.length === 0 ? (
        <div className="p-12 text-center space-y-2">
          <Users className="w-10 h-10 text-gray-300 mx-auto" />
          <h4 className="text-sm font-semibold text-gray-800">No guests found</h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'All' || selectedRSVP !== 'All'
              ? 'No guests match your active search and filter criteria.'
              : 'Your guest roster is empty. Add guests to begin tracking RSVPs and dietary preferences.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Guest Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">RSVP Status</th>
                <th className="py-3 px-4">Invitation</th>
                <th className="py-3 px-4">Party Size</th>
                <th className="py-3 px-4">Dietary & Needs</th>
                <th className="py-3 px-4">Table</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {guests.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50/60 transition-colors">
                  {/* Name & Contact */}
                  <td className="py-3 px-4">
                    <p className="font-semibold text-gray-900">{g.name}</p>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
                      {g.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-gray-400" />
                          {g.email}
                        </span>
                      )}
                      {g.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {g.phone}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${getCategoryBadgeClass(
                        g.category
                      )}`}
                    >
                      {g.category}
                    </span>
                  </td>

                  {/* RSVP Status with Quick Selector */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {getRSVPBadge(g.rsvp_status)}
                      <select
                        value={g.rsvp_status}
                        onChange={(e) => onQuickUpdateRSVP(g.id, e.target.value as RSVPStatus)}
                        className="text-[10px] text-gray-500 border border-gray-200 rounded px-1 py-0.5 bg-white cursor-pointer hover:border-gray-300"
                        title="Quick change RSVP"
                      >
                        <option value="CONFIRMED">Confirm</option>
                        <option value="INVITED">Invited</option>
                        <option value="MAYBE">Maybe</option>
                        <option value="WAITING">Waitlist</option>
                        <option value="DECLINED">Decline</option>
                      </select>
                    </div>
                  </td>

                  {/* Invitation Status */}
                  <td className="py-3 px-4">
                    <button
                      onClick={() =>
                        onQuickUpdateInvitation(
                          g.id,
                          g.invitation_status === 'SENT' ? 'NOT_SENT' : 'SENT'
                        )
                      }
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                        g.invitation_status === 'SENT'
                          ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                      title="Click to toggle invitation sent status"
                    >
                      {g.invitation_status === 'SENT' ? (
                        <>
                          <Send className="w-3 h-3 text-blue-600" />
                          Sent
                        </>
                      ) : (
                        <>
                          <SendHorizontal className="w-3 h-3 text-gray-400" />
                          Not Sent
                        </>
                      )}
                    </button>
                  </td>

                  {/* Party Size */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      1 {g.plus_ones > 0 && <span className="text-gray-500 font-normal">+{g.plus_ones}</span>}
                    </span>
                  </td>

                  {/* Dietary & Accessibility */}
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      {(g.dietary_preferences || g.dietary_restrictions) && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 max-w-fit">
                          <Utensils className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {g.dietary_preferences || g.dietary_restrictions}
                          </span>
                        </div>
                      )}
                      {g.accessibility_requirements && (
                        <div className="flex items-center gap-1 text-[11px] text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 max-w-fit">
                          <Accessibility className="w-3 h-3 text-purple-600 shrink-0" />
                          <span className="truncate max-w-[140px]">{g.accessibility_requirements}</span>
                        </div>
                      )}
                      {!g.dietary_preferences && !g.dietary_restrictions && !g.accessibility_requirements && (
                        <span className="text-gray-400 text-[11px]">Standard</span>
                      )}
                    </div>
                  </td>

                  {/* Table Assignment */}
                  <td className="py-3 px-4">
                    {g.table_assignment ? (
                      <span className="font-medium text-gray-800">{g.table_assignment}</span>
                    ) : (
                      <span className="text-gray-400 text-[11px]">Unassigned</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEditGuest(g)}
                        className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Edit guest"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteGuest(g)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete guest"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
