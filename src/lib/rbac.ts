import type { GlobalRole, TeamRole, User } from "./types";

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
