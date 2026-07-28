"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Team,
  TeamCreationRequest,
  CustomRole,
  RecruitmentApplication,
  TeamActivityLogEntry,
  CollaborationRequest,
  CollaborationType,
  TeamRole,
  SeriesProductionRole,
} from "@/lib/types";

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-") || `team-${Date.now()}`;
}

interface TeamManagementState {
  submittedRequests: TeamCreationRequest[];
  requestOverrides: Record<string, { status: TeamCreationRequest["status"]; reviewerNote?: string; reviewedAt: string; createdTeamId?: string }>;
  createdTeams: Team[];
  addedCustomRoles: CustomRole[];
  applicationOverrides: Record<string, RecruitmentApplication["status"]>;
  collaborationOverrides: Record<string, CollaborationRequest["status"]>;
  addedActivity: TeamActivityLogEntry[];
  memberRoleOverrides: Record<string, { teamRole?: TeamRole; customRoleId?: string }>;
  removedMemberIds: Record<string, string[]>;
  seriesAssignmentOverrides: { id: string; seriesId: string; role: SeriesProductionRole; userId: string; assignedAt: string; assignedBy: string }[];
  addedCollaborationRequests: CollaborationRequest[];

  submitTeamRequest: (req: Omit<TeamCreationRequest, "id" | "status" | "createdAt">) => void;
  reviewRequest: (
    request: TeamCreationRequest,
    status: TeamCreationRequest["status"],
    reviewerId: string,
    note?: string
  ) => void;
  reviewApplication: (applicationId: string, teamId: string, status: RecruitmentApplication["status"]) => void;
  createCustomRole: (role: Omit<CustomRole, "id" | "createdAt" | "isDefault">) => void;
  respondToCollaboration: (id: string, teamId: string, status: CollaborationRequest["status"]) => void;
  setMemberRole: (userId: string, teamId: string, patch: { teamRole?: TeamRole; customRoleId?: string }, actorId: string, actionLabel: string) => void;
  removeMember: (userId: string, teamId: string, actorId: string) => void;
  setSeriesAssignment: (seriesId: string, role: SeriesProductionRole, userId: string, assignedBy: string) => void;
  createCollaborationRequest: (req: {
    fromTeamId: string;
    toTeamId: string;
    seriesId: string;
    type: CollaborationType;
    message: string;
  }) => void;
  logActivity: (entry: Omit<TeamActivityLogEntry, "id" | "at">) => void;
}

export const useTeamManagement = create<TeamManagementState>()(
  persist(
    (set, get) => ({
      submittedRequests: [],
      requestOverrides: {},
      createdTeams: [],
      addedCustomRoles: [],
      applicationOverrides: {},
      collaborationOverrides: {},
      addedActivity: [],
      memberRoleOverrides: {},
      removedMemberIds: {},
      seriesAssignmentOverrides: [],
      addedCollaborationRequests: [],

      submitTeamRequest: (req) => {
        const id = `submitted-request-${Date.now()}`;
        set((s) => ({
          submittedRequests: [
            { ...req, id, status: "pending", createdAt: new Date().toISOString() },
            ...s.submittedRequests,
          ],
        }));
      },

      reviewRequest: (request, status, reviewerId, note) => {
        const reviewedAt = new Date().toISOString();
        let createdTeamId: string | undefined;

        if (status === "approved") {
          const team: Team = {
            id: `created-team-${Date.now()}`,
            slug: slugify(request.teamName),
            name: request.teamName,
            logoHue: 270,
            color: "#A855F7",
            description: request.description,
            leaderId: request.requesterId,
            memberIds: [request.requesterId],
            discordUrl: request.discordUrl,
            rank: 999,
            recruiting: true,
            createdAt: reviewedAt,
            category: request.category,
            goals: request.goals,
            status: "active",
            lastActivityAt: reviewedAt,
          };
          createdTeamId = team.id;
          set((s) => ({ createdTeams: [...s.createdTeams, team] }));
        }

        set((s) => ({
          requestOverrides: {
            ...s.requestOverrides,
            [request.id]: { status, reviewerNote: note, reviewedAt, createdTeamId },
          },
        }));

        get().logActivity({
          teamId: createdTeamId ?? "platform",
          userId: reviewerId,
          action:
            status === "approved"
              ? `وافق على طلب إنشاء فريق "${request.teamName}"`
              : status === "rejected"
                ? `رفض طلب إنشاء فريق "${request.teamName}"`
                : status === "needs_modification"
                  ? `طلب تعديلات على طلب فريق "${request.teamName}"`
                  : status === "suspended"
                    ? `علّق طلب فريق "${request.teamName}"`
                    : `أرشف طلب فريق "${request.teamName}"`,
        });
      },

      reviewApplication: (applicationId, teamId, status) => {
        set((s) => ({
          applicationOverrides: { ...s.applicationOverrides, [applicationId]: status },
        }));
        get().logActivity({
          teamId,
          userId: teamId,
          action:
            status === "accepted"
              ? "قبل طلب انضمام جديد"
              : status === "rejected"
                ? "رفض طلب انضمام"
                : status === "interview"
                  ? "طلب إجراء مقابلة مع متقدم"
                  : "وضع متقدماً في قائمة الانتظار",
        });
      },

      createCustomRole: (role) => {
        const newRole: CustomRole = {
          ...role,
          id: `custom-role-added-${Date.now()}`,
          isDefault: false,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ addedCustomRoles: [...s.addedCustomRoles, newRole] }));
        get().logActivity({ teamId: role.teamId, userId: role.teamId, action: `أنشأ دوراً مخصصاً جديداً "${role.nameAr}"` });
      },

      respondToCollaboration: (id, teamId, status) => {
        set((s) => ({ collaborationOverrides: { ...s.collaborationOverrides, [id]: status } }));
        get().logActivity({
          teamId,
          userId: teamId,
          action: status === "accepted" ? "قبل طلب تعاون من فريق آخر" : status === "rejected" ? "رفض طلب تعاون" : "بدأ تفاوضاً على طلب تعاون",
        });
      },

      setMemberRole: (userId, teamId, patch, actorId, actionLabel) => {
        set((s) => ({
          memberRoleOverrides: { ...s.memberRoleOverrides, [userId]: { ...s.memberRoleOverrides[userId], ...patch } },
        }));
        get().logActivity({ teamId, userId: actorId, action: actionLabel, target: userId });
      },

      removeMember: (userId, teamId, actorId) => {
        set((s) => ({
          removedMemberIds: {
            ...s.removedMemberIds,
            [teamId]: [...(s.removedMemberIds[teamId] ?? []), userId],
          },
        }));
        get().logActivity({ teamId, userId: actorId, action: "أزال عضواً من الفريق", target: userId });
      },

      setSeriesAssignment: (seriesId, role, userId, assignedBy) => {
        set((s) => ({
          seriesAssignmentOverrides: [
            ...s.seriesAssignmentOverrides.filter((a) => !(a.seriesId === seriesId && a.role === role)),
            { id: `assign-override-${seriesId}-${role}-${Date.now()}`, seriesId, role, userId, assignedAt: new Date().toISOString(), assignedBy },
          ],
        }));
      },

      createCollaborationRequest: (req) => {
        const newReq: CollaborationRequest = {
          ...req,
          id: `collab-added-${Date.now()}`,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ addedCollaborationRequests: [newReq, ...s.addedCollaborationRequests] }));
        get().logActivity({ teamId: req.fromTeamId, userId: req.fromTeamId, action: "أرسل طلب تعاون لفريق آخر" });
      },

      logActivity: (entry) => {
        set((s) => ({
          addedActivity: [
            { ...entry, id: `activity-added-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString() },
            ...s.addedActivity,
          ],
        }));
      },
    }),
    { name: "lunex-team-management", skipHydration: true }
  )
);
