import type { LucideIcon } from "lucide-react";
import {
  Home,
  Compass,
  Flame,
  Bookmark,
  User,
  Users,
  LayoutDashboard,
  Layers,
  BookOpen,
  BookText,
  MessageSquare,
  ClipboardList,
  Coins,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const SIDEBAR_NAV: NavItem[] = [
  { href: "/", label: "الرئيسية", icon: Home },
  { href: "/series", label: "استكشاف", icon: Compass },
  { href: "/series?type=novel", label: "الروايات", icon: BookText },
  { href: "/store", label: "المتجر", icon: Coins },
  { href: "/search?sort=views", label: "الأكثر رواجاً", icon: Flame },
  { href: "/bookmarks", label: "مفضلتي", icon: Bookmark },
  { href: "/teams", label: "الفرق", icon: Users },
];

export const BOTTOM_NAV: NavItem[] = [
  { href: "/", label: "الرئيسية", icon: Home },
  { href: "/series", label: "استكشاف", icon: Compass },
  { href: "/series?type=novel", label: "الروايات", icon: BookText },
  { href: "/store", label: "المتجر", icon: Coins },
  { href: "/bookmarks", label: "مفضلتي", icon: Bookmark },
  { href: "/profile", label: "حسابي", icon: User },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "نظرة عامة", icon: LayoutDashboard },
  { href: "/admin/users", label: "المستخدمون", icon: Users },
  { href: "/admin/team-requests", label: "طلبات الفرق", icon: ClipboardList },
  { href: "/admin/series", label: "السلاسل", icon: Layers },
  { href: "/admin/chapters", label: "الفصول", icon: BookOpen },
  { href: "/admin/comments", label: "التعليقات", icon: MessageSquare },
  { href: "/admin/monetization", label: "المكافآت والأرباح", icon: Coins },
];
