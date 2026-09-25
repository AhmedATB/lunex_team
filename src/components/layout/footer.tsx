import Link from "next/link";
import Image from "next/image";
import { CookieSettingsButton } from "@/components/consent/cookie-settings-button";
import { ADS_ENABLED, SMARTLINK_URL, SPONSORED_LINK_REL } from "@/lib/ads";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-background pb-24 pt-10 lg:pb-10">
      <div className="container grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/brand/icon-square.png" alt="LUNEX TEAM" width={32} height={32} className="rounded-full" />
            <span className="font-display text-lg font-bold text-white">LUNEX TEAM</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-lunex-gray">
            منصة ترجمة ونشر مانهوا احترافية، نصنع تجربة قراءة فاخرة للقرّاء العرب.
          </p>
        </div>

        <FooterCol
          title="استكشف"
          links={[
            { href: "/series", label: "كل السلاسل" },
            { href: "/search?status=ongoing", label: "المستمرة" },
            { href: "/search?status=completed", label: "المكتملة" },
            { href: "/search?sort=trending", label: "الأكثر قراءة هذا الأسبوع" },
          ]}
        />
        <FooterCol
          title="الفريق"
          links={[
            { href: "/teams", label: "فرقنا" },
            { href: "/teams", label: "انضم إلينا" },
            { href: "/news", label: "الأخبار والفعاليات" },
          ]}
        />
        <FooterCol
          title="الحساب"
          links={[
            { href: "/login", label: "تسجيل الدخول" },
            { href: "/register", label: "إنشاء حساب" },
            { href: "/profile", label: "ملفي الشخصي" },
          ]}
        />
      </div>
      <div className="container mt-8 flex flex-col items-center gap-3 border-t border-white/10 pt-6 text-xs text-lunex-gray">
        <nav aria-label="روابط قانونية" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/terms" className="transition-colors hover:text-primary-300">
            الشروط والأحكام
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-primary-300">
            سياسة الخصوصية
          </Link>
          <CookieSettingsButton className="transition-colors hover:text-primary-300" />
          {ADS_ENABLED && (
            <a href={SMARTLINK_URL} target="_blank" rel={SPONSORED_LINK_REL} className="transition-colors hover:text-primary-300">
              ادعم الموقع (رابط إعلاني)
            </a>
          )}
        </nav>
        <p className="text-center">© {new Date().getFullYear()} LUNEX TEAM. جميع الحقوق محفوظة.</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h4 className="font-display text-sm font-bold text-white">{title}</h4>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-sm text-lunex-gray transition-colors hover:text-primary-300">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
