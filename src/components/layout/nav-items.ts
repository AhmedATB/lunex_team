import type { LucideIcon } from "lucide-react";
import {
  Home,
  Compass,
  Flame,
  Bookmark,
  Search,
  User,
  Users,
  LayoutDashboard,
  Layers,
  BookOpen,
  MessageSquare,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const SIDEBAR_NAV: NavItem[] = [
  { href: "/", label: "الرئيسية", icon: Home },
  { href: "/series", label: "استكشاف", icon: Compass },
  { href: "/search?sort=views", label: "الأكثر رواجاً", icon: Flame },
  { href: "/bookmarks", label: "مفضلتي", icon: Bookmark },
  { href: "/teams", label: "الفرق", icon: Users },
];

export const BOTTOM_NAV: NavItem[] = [
  { href: "/", label: "الرئيسية", icon: Home },
  { href: "/series", label: "استكشاف", icon: Compass },
  { href: "/search", label: "بحث", icon: Search },
  { href: "/bookmarks", label: "مفضلتي", icon: Bookmark },
  { href: "/profile", label: "حسابي", icon: User },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "نظرة عامة", icon: LayoutDashboard },
  { href: "/admin/users", label: "المستخدمون", icon: Users },
  { href: "/admin/series", label: "السلاسل", icon: Layers },
  { href: "/admin/chapters", label: "الفصول", icon: BookOpen },
  { href: "/admin/comments", label: "التعليقات", icon: MessageSquare },
];
