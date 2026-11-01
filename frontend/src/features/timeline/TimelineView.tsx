import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Sparkles,
  Trash2,
  Edit2,
  MapPin,
  User,
  Filter,
  ListTodo,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useEventStore } from '@/stores/useEventStore';
import {
  useTimelineOverviewQuery,
  useCreateMilestoneMutation,
  useUpdateMilestoneMutation,
  useDeleteMilestoneMutation,
  useSeedMilestonesMutation,
  useCreateActivityMutation,
  useUpdateActivityMutation,
  useDeleteActivityMutation,
} from './hooks';
import { MilestoneModal } from './MilestoneModal';
import { ActivityModal } from './ActivityModal';
import {
  TimelineMilestone,
  TimelineActivity,
  MilestoneCreateInput,
  MilestoneUpdateInput,
  ActivityCreateInput,
  ActivityUpdateInput,
  MilestonePriority,
  MilestoneStatus,
} from '@/types/timeline';

interface TimelineViewProps {
  onNavigateToEvents?: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ onNavigateToEvents }) => {
  const activeEvent = useEventStore((state) => state.activeEvent);

  const { data: timeline, isLoading, error } = useTimelineOverviewQuery(
    activeEvent?.id || null
  );

  const createMilestoneMutation = useCreateMilestoneMutation(activeEvent?.id || '');
  const updateMilestoneMutation = useUpdateMilestoneMutation(activeEvent?.id || '');
  const deleteMilestoneMutation = useDeleteMilestoneMutation(activeEvent?.id || '');
  const seedMilestonesMutation = useSeedMilestonesMutation(activeEvent?.id || '');

  const createActivityMutation = useCreateActivityMutation(activeEvent?.id || '');
  const updateActivityMutation = useUpdateActivityMutation(activeEvent?.id || '');
  const deleteActivityMutation = useDeleteActivityMutation(activeEvent?.id || '');

  // UI States
  const [activeTab, setActiveTab] = useState<'milestones' | 'runofshow'>('milestones');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Modals
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<TimelineMilestone | null>(null);

  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<TimelineActivity | null>(null);

  const [deletingMilestoneId, setDeletingMilestoneId] = useState<string | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);

  if (!activeEvent) {
    return (
      <Card className="p-8 text-center max-w-xl mx-auto my-12 border-dashed border-slate-300">
        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
          <Calendar className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Event Selected</h3>
        <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto mb-6">
          Please select an event from the Event Hub or create a new event to activate timeline milestones and day-of schedule orchestration.
        </p>
        <Button variant="primary" onClick={onNavigateToEvents} className="mx-auto">
          Go to Events Hub
        </Button>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-slate-500">Loading timeline milestones and schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-rose-50 rounded-2xl border border-rose-200 text-rose-800">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h4 className="font-bold">Failed to load timeline overview</h4>
        <p className="text-xs mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  const milestones = timeline?.milestones || [];
  const activities = timeline?.activities || [];

  // Filter Milestones
  const filteredMilestones = milestones.filter((m) => {
    if (statusFilter === 'PENDING' && m.status === 'COMPLETED') return false;
    if (statusFilter === 'COMPLETED' && m.status !== 'COMPLETED') return false;
    if (statusFilter === 'OVERDUE' && !m.is_overdue) return false;
    if (priorityFilter !== 'ALL' && m.priority !== priorityFilter) return false;
    return true;
  });

  const handleToggleComplete = async (milestone: TimelineMilestone) => {
    const newStatus: MilestoneStatus =
      milestone.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    await updateMilestoneMutation.mutateAsync({
      milestoneId: milestone.id,
      data: { status: newStatus },
    });
  };

  const getPriorityBadge = (p: MilestonePriority) => {
    switch (p) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">LOW</span>;
      default:
        return null;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'No date specified';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Top Bar Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Timeline & Schedule Command</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {activeEvent.title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Milestone sequencing, countdown deadlines, and day-of minute-by-minute itinerary.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {milestones.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedMilestonesMutation.mutate()}
              disabled={seedMilestonesMutation.isPending}
              className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              {seedMilestonesMutation.isPending ? 'Seeding...' : 'Seed Standard Milestones'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingActivity(null);
              setIsActivityModalOpen(true);
            }}
            className="text-xs"
          >
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-600" />
            Schedule Activity
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingMilestone(null);
              setIsMilestoneModalOpen(true);
            }}
            className="text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Milestone
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Milestones */}
        <Card className="p-5 border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Milestones
            </span>
            <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
              <ListTodo className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {timeline?.total_milestones || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Across planning and day-of execution phases
          </p>
        </Card>

        {/* Completed Milestones */}
        <Card className="p-5 border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Completed
            </span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">
            {timeline?.completed_milestones || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {timeline?.pending_milestones || 0} milestones pending completion
          </p>
        </Card>

        {/* Completion Progress */}
        <Card className="p-5 border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Progress
            </span>
            <span className="text-xs font-bold text-emerald-600">
              {timeline?.completion_percentage || 0}%
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(timeline?.completion_percentage || 0, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Target event readiness status
          </p>
        </Card>

        {/* Overdue / Upcoming Alert Card */}
        <Card
          className={`p-5 transition-all ${
            (timeline?.overdue_milestones || 0) > 0
              ? 'bg-rose-50/60 border-rose-300'
              : 'bg-white border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                (timeline?.overdue_milestones || 0) > 0 ? 'text-rose-700' : 'text-slate-500'
              }`}
            >
              Overdue Milestones
            </span>
            <div
              className={`p-2 rounded-xl ${
                (timeline?.overdue_milestones || 0) > 0
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-black ${
              (timeline?.overdue_milestones || 0) > 0 ? 'text-rose-700' : 'text-slate-900'
            }`}
          >
            {timeline?.overdue_milestones || 0}
          </div>
          <p
            className={`text-[11px] mt-1 ${
              (timeline?.overdue_milestones || 0) > 0 ? 'text-rose-600 font-semibold' : 'text-slate-500'
            }`}
          >
            {(timeline?.overdue_milestones || 0) > 0
              ? 'Urgent attention required on delayed tasks'
              : 'All milestones tracking on schedule'}
          </p>
        </Card>
      </div>

      {/* Main Content Area with View Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Navigation Tabs & Filters */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/40">
          <div className="flex items-center space-x-2 bg-slate-200/60 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('milestones')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'milestones'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Milestones Roadmap ({milestones.length})
            </button>
            <button
              onClick={() => setActiveTab('runofshow')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'runofshow'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day-Of Itinerary & Run of Show ({activities.length})
            </button>
          </div>

          {activeTab === 'milestones' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Status:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Only</option>
                <option value="COMPLETED">Completed Only</option>
                <option value="OVERDUE">Overdue Only</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Milestones Roadmap */}
        {activeTab === 'milestones' && (
          <div className="p-4 sm:p-6 divide-y divide-slate-100">
            {filteredMilestones.length === 0 ? (
              <div className="py-12 text-center max-w-sm mx-auto">
                <ListTodo className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-800">No Milestones Found</h4>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Add planning milestones or seed standard milestones for this event.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => seedMilestonesMutation.mutate()}
                  disabled={seedMilestonesMutation.isPending}
                  className="text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Seed Standard Milestones
                </Button>
              </div>
            ) : (
              filteredMilestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/60 p-3 rounded-xl transition-colors"
                >
                  <div className="flex items-start space-x-3.5">
                    {/* Status Checkbox Button */}
                    <button
                      onClick={() => handleToggleComplete(milestone)}
                      title={milestone.is_completed ? 'Mark incomplete' : 'Mark completed'}
                      className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                        milestone.is_completed
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 hover:border-emerald-500 bg-white'
                      }`}
                    >
                      {milestone.is_completed && <CheckCircle2 className="w-4 h-4" />}
                    </button>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4
                          className={`text-sm font-bold tracking-tight ${
                            milestone.is_completed
                              ? 'line-through text-slate-400'
                              : 'text-slate-900'
                          }`}
                        >
                          {milestone.title}
                        </h4>
                        {getPriorityBadge(milestone.priority)}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {milestone.phase.replace(/_/g, ' ')}
                        </span>
                        {milestone.is_overdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 flex items-center space-x-1 animate-pulse">
                            <AlertCircle className="w-3 h-3 mr-0.5" />
                            OVERDUE
                          </span>
                        )}
                      </div>

                      {milestone.description && (
                        <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                          {milestone.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Due: {formatDateTime(milestone.target_date || milestone.due_date)}</span>
                        </span>
                        {milestone.activities && milestone.activities.length > 0 && (
                          <span className="flex items-center space-x-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 mr-1" />
                            {milestone.activities.length} scheduled activity
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => {
                        setEditingMilestone(milestone);
                        setIsMilestoneModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit milestone"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingMilestoneId(milestone.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete milestone"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Day-Of Itinerary & Run of Show */}
        {activeTab === 'runofshow' && (
          <div className="p-4 sm:p-6">
            {activities.length === 0 ? (
              <div className="py-12 text-center max-w-sm mx-auto">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-800">No Scheduled Activities</h4>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Build minute-by-minute day-of itinerary for ceremonies, processions, and hospitality.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingActivity(null);
                    setIsActivityModalOpen(true);
                  }}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Schedule First Activity
                </Button>
              </div>
            ) : (
              <div className="relative border-l-2 border-emerald-400/40 ml-4 sm:ml-6 pl-4 sm:pl-6 space-y-6">
                {activities.map((act) => (
                  <div key={act.id} className="relative group">
                    {/* Timeline dot */}
                    <div className="absolute -left-[23px] sm:-left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-emerald-500 shadow-sm" />

                    <div className="bg-slate-50/70 hover:bg-slate-50 p-4 rounded-xl border border-slate-200/80 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100/70 text-emerald-800 font-mono">
                            {new Date(act.start_time).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {act.end_time &&
                              ` - ${new Date(act.end_time).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                            {act.status}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 self-end sm:self-auto">
                          <button
                            onClick={() => {
                              setEditingActivity(act);
                              setIsActivityModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
                            title="Edit activity"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingActivityId(act.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                            title="Delete activity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 mt-2">{act.title}</h4>

                      {act.description && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {act.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2.5">
                        {act.location && (
                          <span className="flex items-center space-x-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{act.location}</span>
                          </span>
                        )}
                        {act.responsible_party && (
                          <span className="flex items-center space-x-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>Lead: {act.responsible_party}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Milestone Modal */}
      <MilestoneModal
        isOpen={isMilestoneModalOpen}
        onClose={() => setIsMilestoneModalOpen(false)}
        milestone={editingMilestone}
        onSubmit={async (data) => {
          if (editingMilestone) {
            await updateMilestoneMutation.mutateAsync({
              milestoneId: editingMilestone.id,
              data: data as MilestoneUpdateInput,
            });
          } else {
            await createMilestoneMutation.mutateAsync(data as MilestoneCreateInput);
          }
        }}
        isLoading={createMilestoneMutation.isPending || updateMilestoneMutation.isPending}
      />

      {/* Activity Modal */}
      <ActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        activity={editingActivity}
        milestones={milestones}
        onSubmit={async (data) => {
          if (editingActivity) {
            await updateActivityMutation.mutateAsync({
              activityId: editingActivity.id,
              data: data as ActivityUpdateInput,
            });
          } else {
            await createActivityMutation.mutateAsync(data as ActivityCreateInput);
          }
        }}
        isLoading={createActivityMutation.isPending || updateActivityMutation.isPending}
      />

      {/* Delete Milestone Confirmation Modal */}
      {deletingMilestoneId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Delete Planning Milestone?</h4>
            <p className="text-xs text-slate-500">
              Are you sure you want to remove this milestone from the timeline? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingMilestoneId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await deleteMilestoneMutation.mutateAsync(deletingMilestoneId);
                  setDeletingMilestoneId(null);
                }}
                disabled={deleteMilestoneMutation.isPending}
              >
                {deleteMilestoneMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Activity Confirmation Modal */}
      {deletingActivityId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Delete Scheduled Activity?</h4>
            <p className="text-xs text-slate-500">
              Remove this activity from the day-of execution itinerary?
            </p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingActivityId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await deleteActivityMutation.mutateAsync(deletingActivityId);
                  setDeletingActivityId(null);
                }}
                disabled={deleteActivityMutation.isPending}
              >
                {deleteActivityMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
