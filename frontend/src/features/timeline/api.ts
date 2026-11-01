import { apiClient } from '@/lib/api-client';
import {
  TimelineOverview,
  TimelineMilestone,
  TimelineActivity,
  MilestoneCreateInput,
  MilestoneUpdateInput,
  ActivityCreateInput,
  ActivityUpdateInput,
} from '@/types/timeline';

export const timelineApi = {
  getTimeline: async (eventId: string): Promise<TimelineOverview> => {
    return apiClient.get<TimelineOverview>(`/events/${eventId}/timeline`);
  },

  createMilestone: async (
    eventId: string,
    data: MilestoneCreateInput
  ): Promise<TimelineMilestone> => {
    return apiClient.post<TimelineMilestone>(
      `/events/${eventId}/timeline/milestones`,
      data
    );
  },

  seedMilestones: async (eventId: string): Promise<TimelineMilestone[]> => {
    return apiClient.post<TimelineMilestone[]>(
      `/events/${eventId}/timeline/milestones/seed`,
      {}
    );
  },

  updateMilestone: async (
    eventId: string,
    milestoneId: string,
    data: MilestoneUpdateInput
  ): Promise<TimelineMilestone> => {
    return apiClient.put<TimelineMilestone>(
      `/events/${eventId}/timeline/milestones/${milestoneId}`,
      data
    );
  },

  deleteMilestone: async (eventId: string, milestoneId: string): Promise<void> => {
    return apiClient.delete<void>(`/events/${eventId}/timeline/milestones/${milestoneId}`);
  },

  createActivity: async (
    eventId: string,
    data: ActivityCreateInput
  ): Promise<TimelineActivity> => {
    return apiClient.post<TimelineActivity>(
      `/events/${eventId}/timeline/activities`,
      data
    );
  },

  updateActivity: async (
    eventId: string,
    activityId: string,
    data: ActivityUpdateInput
  ): Promise<TimelineActivity> => {
    return apiClient.put<TimelineActivity>(
      `/events/${eventId}/timeline/activities/${activityId}`,
      data
    );
  },

  deleteActivity: async (eventId: string, activityId: string): Promise<void> => {
    return apiClient.delete<void>(`/events/${eventId}/timeline/activities/${activityId}`);
  },
};

