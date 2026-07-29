"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Team,
  TeamCreationRequest,
  CustomRole,
  RecruitmentApplication,
  RecruitmentPosition,
  TeamActivityLogEntry,
  CollaborationRequest,
  CollaborationType,
  TeamRole,
  SeriesProductionRole,
  LeadershipTransferEntry,
  Department,
} from "@/lib/types";

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-") || `team-${Date.now()}`;
}

/** Merges any admin/leader-edited fields on top of a base team (seeded or created), by team id. */
export function applyTeamOverride(team: Team, overrides: Record<string, Partial<Team>>): Team {
  return { ...team, ...(overrides[team.id] ?? {}) };
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
  teamInfoOverrides: Record<string, Partial<Team>>;
  leadershipTransfers: LeadershipTransferEntry[];
  addedDepartments: Department[];
  departmentOverrides: Record<string, Partial<Pick<Department, "nameAr" | "leaderId" | "memberIds">>>;
  removedDepartmentIds: string[];
  addedRecruitmentPositions: RecruitmentPosition[];
  recruitmentPositionOverrides: Record<string, Partial<Pick<RecruitmentPosition, "isOpen" | "description">>>;
  customRoleOverrides: Record<string, Partial<Pick<CustomRole, "nameAr" | "name" | "color" | "permissions">>>;
  removedCustomRoleIds: string[];

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
  updateTeamInfo: (
    teamId: string,
    patch: Partial<Pick<Team, "name" | "description" | "goals" | "discordUrl" | "category" | "recruiting" | "logoUrl" | "color">>,
    actorId: string
  ) => void;
  transferLeadership: (teamId: string, fromUserId: string, toUserId: string, actorId: string, reason: string) => void;
  createDepartment: (dept: Omit<Department, "id">, actorId: string) => void;
  updateDepartment: (
    id: string,
    patch: Partial<Pick<Department, "nameAr" | "leaderId" | "memberIds">>,
    teamId: string,
    actorId: string
  ) => void;
  removeDepartment: (id: string, teamId: string, actorId: string) => void;
  createRecruitmentPosition: (pos: Omit<RecruitmentPosition, "id" | "createdAt" | "isOpen">, actorId: string) => void;
  toggleRecruitmentPosition: (id: string, teamId: string, isOpen: boolean, actorId: string) => void;
  updateCustomRole: (
    id: string,
    patch: Partial<Pick<CustomRole, "nameAr" | "name" | "color" | "permissions">>,
    teamId: string,
    actorId: string
  ) => void;
  removeCustomRole: (id: string, teamId: string, actorId: string) => void;
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
      teamInfoOverrides: {},
      leadershipTransfers: [],
      addedDepartments: [],
      departmentOverrides: {},
      removedDepartmentIds: [],
      addedRecruitmentPositions: [],
      recruitmentPositionOverrides: {},
      customRoleOverrides: {},
      removedCustomRoleIds: [],

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
            color: request.color ?? "#A855F7",
            logoUrl: request.logoUrl,
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

      updateTeamInfo: (teamId, patch, actorId) => {
        set((s) => ({
          teamInfoOverrides: { ...s.teamInfoOverrides, [teamId]: { ...s.teamInfoOverrides[teamId], ...patch } },
        }));
        get().logActivity({ teamId, userId: actorId, action: "عدّل معلومات الفريق" });
      },

      transferLeadership: (teamId, fromUserId, toUserId, actorId, reason) => {
        const at = new Date().toISOString();
        set((s) => ({
          teamInfoOverrides: { ...s.teamInfoOverrides, [teamId]: { ...s.teamInfoOverrides[teamId], leaderId: toUserId } },
          memberRoleOverrides: {
            ...s.memberRoleOverrides,
            [toUserId]: { ...s.memberRoleOverrides[toUserId], teamRole: "team_leader" },
            [fromUserId]: { ...s.memberRoleOverrides[fromUserId], teamRole: "assistant_leader" },
          },
          leadershipTransfers: [
            { id: `leadership-transfer-${Date.now()}`, teamId, fromUserId, toUserId, reason, at },
            ...s.leadershipTransfers,
          ],
        }));
        get().logActivity({ teamId, userId: actorId, action: "نقل قيادة الفريق", target: toUserId });
      },

      createDepartment: (dept, actorId) => {
        const newDept: Department = { ...dept, id: `dept-added-${Date.now()}` };
        set((s) => ({ addedDepartments: [...s.addedDepartments, newDept] }));
        get().logActivity({ teamId: dept.teamId, userId: actorId, action: `أنشأ قسماً جديداً "${dept.nameAr}"` });
      },

      updateDepartment: (id, patch, teamId, actorId) => {
        set((s) => ({
          departmentOverrides: { ...s.departmentOverrides, [id]: { ...s.departmentOverrides[id], ...patch } },
        }));
        get().logActivity({ teamId, userId: actorId, action: "عدّل بيانات قسم" });
      },

      removeDepartment: (id, teamId, actorId) => {
        set((s) => ({ removedDepartmentIds: [...s.removedDepartmentIds, id] }));
        get().logActivity({ teamId, userId: actorId, action: "حذف قسماً" });
      },

      createRecruitmentPosition: (pos, actorId) => {
        const newPos: RecruitmentPosition = { ...pos, id: `recruit-pos-added-${Date.now()}`, isOpen: true, createdAt: new Date().toISOString() };
        set((s) => ({ addedRecruitmentPositions: [...s.addedRecruitmentPositions, newPos] }));
        get().logActivity({ teamId: pos.teamId, userId: actorId, action: `فتح وظيفة "${newPos.role}" للتوظيف` });
      },

      toggleRecruitmentPosition: (id, teamId, isOpen, actorId) => {
        set((s) => ({
          recruitmentPositionOverrides: { ...s.recruitmentPositionOverrides, [id]: { ...s.recruitmentPositionOverrides[id], isOpen } },
        }));
        get().logActivity({ teamId, userId: actorId, action: isOpen ? "أعاد فتح وظيفة للتوظيف" : "أغلق وظيفة توظيف" });
      },

      updateCustomRole: (id, patch, teamId, actorId) => {
        set((s) => ({
          customRoleOverrides: { ...s.customRoleOverrides, [id]: { ...s.customRoleOverrides[id], ...patch } },
        }));
        get().logActivity({ teamId, userId: actorId, action: "عدّل دوراً مخصصاً" });
      },

      removeCustomRole: (id, teamId, actorId) => {
        set((s) => ({ removedCustomRoleIds: [...s.removedCustomRoleIds, id] }));
        get().logActivity({ teamId, userId: actorId, action: "حذف دوراً مخصصاً" });
      },
    }),
    { name: "lunex-team-management", skipHydration: true }
  )
);
