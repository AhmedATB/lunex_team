import type { Metadata } from "next";
import {
  Ban,
  Coins,
  Copyright,
  Handshake,
  History,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Target,
  TimerReset,
} from "lucide-react";

/**
 * Terms sent to a translation team applying to publish through LUNEX TEAM — never linked from the site (not in the header,
 * footer, or sitemap; disallowed in robots.ts too) and reachable without an account, since a team applying has none yet.
 * A team is handed this URL directly; opening it is not itself an offer or an agreement — only actually joining is.
 */
export const metadata: Metadata = {
  title: "شروط شراكة الفرق",
  description: "الشروط التي تُرسل لفريق ترجمة يتقدّم للانضمام إلى LUNEX TEAM: المستحقات، الحصرية، الحد الأدنى، والمخالفات.",
  robots: { index: false, follow: false },
};

function SectionHead({ n, icon: Icon, title }: { n: string; icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="hover-pop flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/15 text-primary-300">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="section-title font-display text-lg font-bold text-white sm:text-xl">
        <span className="me-1.5 text-xs font-semibold text-primary-400/70">{n}</span> {title}
      </h2>
    </div>
  );
}

function Section({
  n,
  icon,
  title,
  children,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <SectionHead n={n} icon={icon} title={title} />
      <div className="panel space-y-3 p-4 text-sm leading-7 text-lunex-gray sm:p-5">{children}</div>
    </section>
  );
}

function Pill({ tone = "muted", children }: { tone?: "muted" | "accent" | "good" | "bad"; children: React.ReactNode }) {
  const toneClass = {
    muted: "bg-white/[0.06] text-lunex-gray",
    accent: "bg-primary-500/15 text-primary-300",
    good: "bg-emerald-500/15 text-emerald-300",
    bad: "bg-red-500/15 text-red-300",
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${toneClass}`}>{children}</span>;
}

const LADDER = [
  { tone: "muted" as const, title: "أسبوع واحد تحت الحد الأدنى", detail: "تذكير تلقائي يصل لقائد الفريق فقط، بلا أي أثر ظاهر." },
  { tone: "accent" as const, title: "أسبوعان إلى ثلاثة متتالية تحت الحد", detail: "يُسجَّل في سجل نشاط الفريق، وتختفي شارة «يستقبل طلبات انضمام» مؤقتًا." },
  { tone: "accent" as const, title: "توقف كامل لفترة طويلة (شهر تقريبًا)", detail: "تتحول شارة الفريق العامة إلى «غير نشط»." },
  { tone: "bad" as const, title: "عمل مهجور بلا أي فصل لفترة أطول (شهرين تقريبًا)", detail: "يصبح قابلًا للانتقال لفريق آخر، ويُسجَّل إنذار على فريقكم — إنذاران يعني تعليق الفريق." },
];

const DOT_TONE = { muted: "border-white/15 bg-white/5 text-lunex-gray", accent: "border-amber-400/40 bg-amber-400/10 text-amber-300", bad: "border-red-400/40 bg-red-400/10 text-red-300" };

export default function PartnerTermsPage() {
  return (
    <div className="container relative max-w-3xl space-y-10 py-8">
      <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="ambient-blob start-[-10%] top-[-6%] h-64 w-64 bg-primary-600/25" />
        <div className="ambient-blob end-[-8%] top-[20%] h-56 w-56 bg-pink-500/15" style={{ animationDelay: "-6s" }} />
      </div>

      <header className="relative space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-primary-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> LUNEX TEAM
        </div>
        <h1 className="section-title font-display text-3xl font-black text-white">شروط شراكة الفرق</h1>
        <p className="text-sm text-lunex-gray">آخر تحديث: 29 سبتمبر 2026</p>
        <p className="max-w-xl pt-1 text-sm leading-7 text-lunex-gray">
          نسعى في LUNEX TEAM لبناء تعاون مستمر ومنظّم مع الفرق الناشرة. هذا المستند يوضّح آلية التعاون من البداية — كيف تُحتسب
          مستحقاتكم، وما هو مطلوب منكم، وما يحصل عند الإخلال بأحد الشروط. تقديمكم لطلب الانضمام يعني موافقتكم على كل ما فيه.
        </p>
      </header>

      <Section n="01" icon={Handshake} title="آلية العمل">
        <ul className="list-disc space-y-2 ps-5 marker:text-primary-400">
          <li>الفريق مسؤول عن اختيار الأعمال وتوفيرها والعمل عليها، بالتنسيق مع إدارة LUNEX قبل البدء بأي عمل جديد.</li>
          <li>LUNEX يوفّر المنصة، النشر، الإدارة، والتنظيم الخاص بالأعمال.</li>
          <li>لا يُشترط أن يوفّر LUNEX أعمالًا للفريق — يمكن للفريق اقتراح الأعمال التي يرغب بالعمل عليها.</li>
        </ul>
      </Section>

      <Section n="02" icon={ShieldOff} title="المحتوى الممنوع">
        <p>لا يجوز نشر أي عمل يحتوي على:</p>
        <ul className="list-disc space-y-2 ps-5 marker:text-red-400">
          <li>مشاهد جنسية صريحة أو محتوى مصنّف +18.</li>
          <li>محتوى خادش للحياء العام.</li>
          <li>دعوة صريحة للكفر أو إساءة مباشرة للأديان والمعتقدات.</li>
        </ul>
        <p>
          أي عمل كهذا <span className="font-semibold text-white">يُرفض في مرحلة المراجعة قبل النشر</span>. وإن اكتُشف بعد
          النشر، يُحذف فورًا، ويُعامل الفريق حسب خطورة الحالة — بنفس تدرّج العقوبة المذكور بسياسة المحتوى المسروق أدناه.
        </p>
      </Section>

      <Section n="03" icon={Coins} title="المستحقات">
        <p>تُحتسب مستحقات <span className="font-semibold text-white">كل فصل بناءً على المشاهدات والجودة</span> معًا — لا سعر ثابت لكل الفصول.</p>
        <p>التدقيق مسؤولية LUNEX أصلًا، أو يُتفق مع الفريق على قيامه به إذا كان لديهم شخص مناسب لهذه المهمة.</p>
        <p>
          <span className="font-semibold text-white">الأعمال ليست تطوعية</span> — تُحسب المستحقات من بداية العمل على الفصل، لكن{" "}
          <span className="font-semibold text-white">الدفع نفسه مؤجَّل</span> إلى حين وصول الموقع إلى أرباح تسمح ببدء الدفع.
          هذا قيد حقيقي نوضّحه لكم من البداية، لا نتجاهله.
        </p>
      </Section>

      <Section n="04" icon={ShieldCheck} title="الحصرية والملكية">
        <p>
          كل عمل يُنشر عبر LUNEX TEAM يصبح <span className="font-semibold text-white">حصريًا للموقع</span> — لا يُنشر على أي
          موقع أو قناة أخرى بعد نشره معنا.
        </p>
        <p>
          إذا انسحب فريقكم لاحقًا، تبقى ملكية الأعمال المنشورة للموقع، لكننا نلتزم بدفع{" "}
          <span className="font-semibold text-white">كل مستحقاتكم</span> عن الفصول التي أنجزتموها فعلًا، حسب الاتفاق الساري
          وقتها.
        </p>
      </Section>

      <Section n="05" icon={Target} title="الالتزام والحد الأدنى">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-black text-white">٥</span>
            <span className="text-sm text-lunex-gray">فصول / أسبوع — حد أدنى ملزم لكل الفرق</span>
          </div>
          <Pill tone="accent">زيادة اختيارية بلا سقف محدد</Pill>
        </div>
        <p>
          الحد الأدنى ثابت للجميع بلا استثناء لحجم الفريق. فريق يشوف نفسه قادر على أكثر يقدر يزيد إنتاجه اختياريًا، وإذا رجع
          للحد الأدنى ما فيه أي أثر — الالتزام الوحيد المُحاسَب عليه هو الحد الأدنى.
        </p>
        <p className="rounded-lg border-s-4 border-amber-400/60 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          يُشترط أيضًا الالتزام بالجودة والمواعيد المتفق عليها. وفي حال مشاكل متكررة (لا بعدد الفصول فقط) يحق للإدارة مراجعة
          أو تعليق التعاون.
        </p>
      </Section>

      <Section n="06" icon={TimerReset} title="التأخير والتوقف">
        <ol className="space-y-0">
          {LADDER.map((step, i) => (
            <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
              {i < LADDER.length - 1 && <span className="absolute start-[15px] top-8 h-full w-px bg-white/10" aria-hidden />}
              <span className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-display text-xs font-bold ${DOT_TONE[step.tone]}`}>
                {["١", "٢", "٣", "٤"][i]}
              </span>
              <div className="pt-0.5">
                <p className="font-semibold text-white">{step.title}</p>
                <p className="mt-0.5 text-[13px] text-lunex-gray">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section n="07" icon={ShieldAlert} title="المحتوى المسروق">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-red-400/25 bg-red-400/[0.06] p-3.5">
            <p className="text-sm font-bold text-white">سرقتم فصلًا من فريق آخر بدون إخبارنا</p>
            <p className="mt-1 text-[13px] text-lunex-gray">تعليق فوري للفريق.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <p className="text-sm font-bold text-white">أخبرتمونا أنتم بنفسكم</p>
            <p className="mt-1 text-[13px] text-lunex-gray">
              إنذار أول فقط. تكرار الأمر (أُخبِرنا أو لم نُخبَر) يعني <span className="font-semibold text-white">حذف الفريق نهائيًا</span>.
            </p>
          </div>
        </div>
      </Section>

      <Section n="08" icon={Copyright} title="حقوق النشر والعلامات">
        <p>
          صفحة بداية الفصل هي صفحتكم الخاصة كفريق. أما باقي الفصل، فلا يجوز وضع أي علامة مائية أو شعار خاص بالفريق فيه، ولا
          كعلامة متكررة على صفحاته.
        </p>
        <p><span className="font-semibold text-white">العلامة المائية حق لـ LUNEX TEAM</span> وتوضع بشكل متكرر على كل صفحات الفصل.</p>
      </Section>

      <Section n="09" icon={History} title="أعمال منشورة مسبقًا في موقع آخر">
        <p>إذا كان عندكم فصول مترجمة ومنشورة مسبقًا في موقع آخر وتريدون نشرها معنا:</p>
        <p>
          <span className="font-semibold text-white">يجب إثبات أنكم المترجمون الأصليون</span> لها أولًا — لا تُقبل بدون إثبات،
          بنفس صرامة قاعدة السرقة أعلاه.
        </p>
        <p>
          الحصرية تسري من <span className="font-semibold text-white">تاريخ انضمامكم فقط</span>: توقفون عن نشر فصول جديدة في
          الموقع الآخر من تلك اللحظة، بينما تبقى فصولكم القديمة هناك كما هي — هذا خارج عن سيطرتنا.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Pill tone="muted"><Ban className="h-3 w-3" aria-hidden /> الفصول القديمة (backlog): لا تُدفع ولا تُحسب</Pill>
          <Pill tone="good">الفصول الجديدة بعد الانضمام: تُدفع وتُحسب كأي فصل عادي</Pill>
        </div>
      </Section>

      <Section n="10" icon={Handshake} title="الاستمرارية">
        <p>التعاون قائم على الالتزام من الطرفين، وأي توقف لفترة طويلة يُفضَّل إبلاغ الإدارة به مسبقًا.</p>
        <p>المستحقات الخاصة بالأعمال المنجزة تبقى محفوظة حسب الاتفاق حتى في حال انتهاء التعاون.</p>
      </Section>

      <div className="magic-border relative overflow-hidden rounded-2xl border border-primary-400/30 bg-gradient-to-br from-primary-600/15 via-transparent to-pink-500/10 p-5 sm:p-6">
        <h3 className="font-display text-lg font-bold text-white">بالتقدّم لطلب الانضمام</h3>
        <p className="mt-1.5 text-sm leading-7 text-lunex-gray">فإن فريقكم يوافق على جميع الشروط المذكورة أعلاه بالكامل.</p>
        <p className="mt-1.5 text-sm leading-7 text-lunex-gray">
          هدفنا بناء فرق قوية داخل LUNEX — يستفيد الفريق من المنصة، وتساهم أعماله في نموّها واستمرارها. لأي استفسار قبل
          التقديم، تواصلوا معنا عبر قنوات الموقع الرسمية.
        </p>
      </div>
    </div>
  );
}
