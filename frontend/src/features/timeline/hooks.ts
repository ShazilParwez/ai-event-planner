import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timelineApi } from './api';
import {
  MilestoneCreateInput,
  MilestoneUpdateInput,
  ActivityCreateInput,
  ActivityUpdateInput,
} from '@/types/timeline';

export const TIMELINE_QUERY_KEYS = {
  all: ['timeline'] as const,
  overview: (eventId: string) => ['timeline', 'overview', eventId] as const,
};

export const useTimelineOverviewQuery = (eventId: string | null) => {
  return useQuery({
    queryKey: TIMELINE_QUERY_KEYS.overview(eventId || ''),
    queryFn: () => timelineApi.getTimeline(eventId!),
    enabled: Boolean(eventId),
  });
};

export const useCreateMilestoneMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MilestoneCreateInput) => timelineApi.createMilestone(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEYS.overview(eventId) });
    },
  });
};

export const useSeedMilestonesMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => timelineApi.seedMilestones(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEYS.overview(eventId) });
    },
  });
};

export const useUpdateMilestoneMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, data }: { milestoneId: string; data: MilestoneUpdateInput }) =>
      timelineApi.updateMilestone(eventId, milestoneId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEYS.overview(eventId) });
    },
  });
};

export const useDeleteMilestoneMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (milestoneId: string) => timelineApi.deleteMilestone(eventId, milestoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEYS.overview(eventId) });
    },
  });
};

export const useCreateActivityMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ActivityCreateInput) => timelineApi.createActivity(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEYS.overview(eventId) });
    },
  });
};

export const useUpdateActivityMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, data }: { activityId: string; data: ActivityUpdateInput }) =>
      timelineApi.updateActivity(eventId, activityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEYS.overview(eventId) });
    },
  });
};

export const useDeleteActivityMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (activityId: string) => timelineApi.deleteActivity(eventId, activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEYS.overview(eventId) });
    },
  });
};

