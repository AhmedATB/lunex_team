import type { GlobalRole, TeamRole, User, TeamPermission, CustomRole } from "./types";

export type Permission =
  | "create_team"
  | "delete_team"
  | "edit_team"
  | "assign_members"
  | "remove_members"
  | "publish_chapters"
  | "unpublish_chapters"
  | "upload_images"
  | "upload_zip"
  | "manage_series"
  | "manage_team_projects"
  | "approve_recruitment"
  | "reject_recruitment"
  | "assign_tasks"
  | "create_announcements"
  | "delete_comments"
  | "pin_comments"
  | "manage_reports"
  | "invite_members"
  | "transfer_leadership"
  | "edit_team_profile"
  | "manage_team_settings"
  | "view_statistics"
  | "view_financial_dashboard"
  | "manage_api_keys"
  | "manage_integrations"
  | "manage_security_settings"
  | "manage_users"
  | "manage_platform_settings"
  | "impersonate_team";

const GLOBAL_ROLE_PERMISSIONS: Record<GlobalRole, Permission[]> = {
  guest: [],
  reader: [],
  verified_member: [],
  uploader: ["upload_images", "upload_zip"],
  moderator: ["delete_comments", "pin_comments", "manage_reports"],
  support: ["manage_reports"],
  news_manager: ["create_announcements"],
  editor: ["manage_series", "publish_chapters", "unpublish_chapters", "upload_images", "upload_zip"],
  global_team_manager: [
    "create_team",
    "edit_team",
    "assign_members",
    "remove_members",
    "manage_team_projects",
    "view_statistics",
  ],
  super_administrator: [
    "create_team",
    "delete_team",
    "edit_team",
    "assign_members",
    "remove_members",
    "publish_chapters",
    "unpublish_chapters",
    "upload_images",
    "upload_zip",
    "manage_series",
    "manage_team_projects",
    "approve_recruitment",
    "reject_recruitment",
    "assign_tasks",
    "create_announcements",
    "delete_comments",
    "pin_comments",
    "manage_reports",
    "invite_members",
    "manage_users",
    "view_statistics",
    "manage_api_keys",
    "manage_integrations",
    "manage_security_settings",
    "impersonate_team",
  ],
  owner: [
    "create_team",
    "delete_team",
    "edit_team",
    "assign_members",
    "remove_members",
    "publish_chapters",
    "unpublish_chapters",
    "upload_images",
    "upload_zip",
    "manage_series",
    "manage_team_projects",
    "approve_recruitment",
    "reject_recruitment",
    "assign_tasks",
    "create_announcements",
    "delete_comments",
    "pin_comments",
    "manage_reports",
    "invite_members",
    "transfer_leadership",
    "manage_users",
    "view_statistics",
    "view_financial_dashboard",
    "manage_api_keys",
    "manage_integrations",
    "manage_security_settings",
    "manage_platform_settings",
    "impersonate_team",
  ],
};

const TEAM_ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
  trainee: [],
  member: [],
  translator: ["upload_images"],
  proofreader: [],
  cleaner: ["upload_images"],
  redrawer: ["upload_images"],
  typesetter: ["upload_images"],
  qc: ["unpublish_chapters"],
  publisher: ["publish_chapters", "unpublish_chapters", "upload_images", "upload_zip"],
  uploader: ["upload_images", "upload_zip"],
  recruiter: ["approve_recruitment", "reject_recruitment", "invite_members"],
  reviewer: ["assign_tasks"],
  team_administrator: [
    "edit_team_profile",
    "manage_team_settings",
    "assign_members",
    "assign_tasks",
    "manage_team_projects",
    "approve_recruitment",
    "reject_recruitment",
    "invite_members",
    "publish_chapters",
    "unpublish_chapters",
    "upload_images",
    "upload_zip",
    "view_statistics",
  ],
  assistant_leader: [
    "edit_team_profile",
    "manage_team_settings",
    "assign_members",
    "remove_members",
    "assign_tasks",
    "manage_team_projects",
    "approve_recruitment",
    "reject_recruitment",
    "invite_members",
    "publish_chapters",
    "unpublish_chapters",
    "upload_images",
    "upload_zip",
    "view_statistics",
  ],
  team_leader: [
    "edit_team",
    "edit_team_profile",
    "manage_team_settings",
    "assign_members",
    "remove_members",
    "assign_tasks",
    "manage_team_projects",
    "approve_recruitment",
    "reject_recruitment",
    "invite_members",
    "transfer_leadership",
    "publish_chapters",
    "unpublish_chapters",
    "upload_images",
    "upload_zip",
    "view_statistics",
    "view_financial_dashboard",
  ],
};

export function getPermissions(user: Pick<User, "role" | "teamRole">): Set<Permission> {
  const perms = new Set<Permission>(GLOBAL_ROLE_PERMISSIONS[user.role] ?? []);
  if (user.teamRole) {
    for (const p of TEAM_ROLE_PERMISSIONS[user.teamRole] ?? []) perms.add(p);
  }
  return perms;
}

export function can(user: Pick<User, "role" | "teamRole">, permission: Permission): boolean {
  return getPermissions(user).has(permission);
}

export const GLOBAL_ROLE_LABELS: Record<GlobalRole, string> = {
  guest: "زائر",
  reader: "قارئ",
  verified_member: "عضو موثّق",
  uploader: "رافع فصول",
  moderator: "مشرف",
  support: "دعم فني",
  news_manager: "مسؤول أخبار",
  editor: "محرر",
  global_team_manager: "مدير فرق عام",
  super_administrator: "مسؤول أعلى",
  owner: "المالك",
};

export const TEAM_PERMISSION_GROUPS: { category: string; permissions: TeamPermission[] }[] = [
  {
    category: "إدارة الفريق",
    permissions: ["edit_team_info", "change_logo", "change_banner", "manage_members", "manage_roles", "manage_permissions"],
  },
  {
    category: "إدارة السلاسل",
    permissions: ["add_series", "edit_series", "assign_workers", "archive_series"],
  },
  {
    category: "إدارة الفصول",
    permissions: ["upload_chapter", "edit_chapter", "delete_chapter", "publish_chapter", "schedule_release"],
  },
  {
    category: "إدارة الأعضاء",
    permissions: ["invite_members", "remove_members", "promote_members", "demote_members"],
  },
  {
    category: "الإحصائيات",
    permissions: ["view_team_statistics", "view_member_performance"],
  },
];

export const TEAM_PERMISSION_LABELS: Record<TeamPermission, string> = {
  edit_team_info: "تعديل معلومات الفريق",
  change_logo: "تغيير الشعار",
  change_banner: "تغيير البانر",
  manage_members: "إدارة الأعضاء",
  manage_roles: "إدارة الأدوار",
  manage_permissions: "إدارة الصلاحيات",
  add_series: "إضافة سلسلة",
  edit_series: "تعديل سلسلة",
  assign_workers: "تعيين عاملين",
  archive_series: "أرشفة سلسلة",
  upload_chapter: "رفع فصل",
  edit_chapter: "تعديل فصل",
  delete_chapter: "حذف فصل",
  publish_chapter: "نشر فصل",
  schedule_release: "جدولة الإصدار",
  invite_members: "دعوة أعضاء",
  remove_members: "إزالة أعضاء",
  promote_members: "ترقية أعضاء",
  demote_members: "تنزيل رتبة أعضاء",
  view_team_statistics: "عرض إحصائيات الفريق",
  view_member_performance: "عرض أداء الأعضاء",
};

const DEFAULT_ROLE_TEAM_PERMISSIONS: Record<TeamRole, TeamPermission[]> = {
  trainee: [],
  member: [],
  translator: ["upload_chapter"],
  proofreader: ["edit_chapter"],
  cleaner: ["upload_chapter"],
  redrawer: ["upload_chapter"],
  typesetter: ["upload_chapter", "edit_chapter"],
  qc: ["edit_chapter", "view_member_performance"],
  publisher: ["publish_chapter", "schedule_release", "upload_chapter"],
  uploader: ["upload_chapter"],
  recruiter: ["invite_members"],
  reviewer: ["assign_workers", "view_member_performance"],
  team_administrator: [
    "edit_team_info",
    "manage_members",
    "add_series",
    "edit_series",
    "assign_workers",
    "invite_members",
    "remove_members",
    "promote_members",
    "demote_members",
    "publish_chapter",
    "schedule_release",
    "view_team_statistics",
    "view_member_performance",
  ],
  assistant_leader: [
    "edit_team_info",
    "change_logo",
    "change_banner",
    "manage_members",
    "manage_roles",
    "add_series",
    "edit_series",
    "assign_workers",
    "archive_series",
    "invite_members",
    "remove_members",
    "promote_members",
    "demote_members",
    "publish_chapter",
    "schedule_release",
    "view_team_statistics",
    "view_member_performance",
  ],
  team_leader: [
    "edit_team_info",
    "change_logo",
    "change_banner",
    "manage_members",
    "manage_roles",
    "manage_permissions",
    "add_series",
    "edit_series",
    "assign_workers",
    "archive_series",
    "upload_chapter",
    "edit_chapter",
    "delete_chapter",
    "publish_chapter",
    "schedule_release",
    "invite_members",
    "remove_members",
    "promote_members",
    "demote_members",
    "view_team_statistics",
    "view_member_performance",
  ],
};

/**
 * A team member's effective permissions are the union of their fixed TeamRole's
 * baked-in defaults and any custom role assigned by the team leader — custom
 * roles are additive, not a replacement, so "Senior Translator" can layer extra
 * permissions on top of the base "translator" grant.
 */
export function getTeamPermissions(
  user: Pick<User, "teamRole" | "customRoleId">,
  customRoles: CustomRole[] = []
): Set<TeamPermission> {
  const perms = new Set<TeamPermission>();
  if (user.teamRole) {
    for (const p of DEFAULT_ROLE_TEAM_PERMISSIONS[user.teamRole] ?? []) perms.add(p);
  }
  if (user.customRoleId) {
    const role = customRoles.find((r) => r.id === user.customRoleId);
    for (const p of role?.permissions ?? []) perms.add(p);
  }
  return perms;
}

export function canInTeam(
  user: Pick<User, "teamRole" | "customRoleId">,
  permission: TeamPermission,
  customRoles: CustomRole[] = []
): boolean {
  return getTeamPermissions(user, customRoles).has(permission);
}

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  trainee: "متدرب",
  member: "عضو",
  translator: "مترجم",
  proofreader: "مدقق لغوي",
  cleaner: "منظف صور",
  redrawer: "رسّام",
  typesetter: "تنسيق",
  qc: "مراقبة جودة",
  publisher: "ناشر",
  uploader: "رافع",
  recruiter: "مسؤول توظيف",
  reviewer: "مراجع",
  team_administrator: "مدير فريق",
  assistant_leader: "نائب القائد",
  team_leader: "قائد الفريق",
};
