export const GENRES: { slug: string; name: string; nameAr: string }[] = [
  { slug: "action", name: "Action", nameAr: "أكشن" },
  { slug: "romance", name: "Romance", nameAr: "رومانسي" },
  { slug: "fantasy", name: "Fantasy", nameAr: "خيال" },
  { slug: "drama", name: "Drama", nameAr: "دراما" },
  { slug: "comedy", name: "Comedy", nameAr: "كوميدي" },
  { slug: "martial-arts", name: "Martial Arts", nameAr: "فنون قتالية" },
  { slug: "school-life", name: "School Life", nameAr: "حياة مدرسية" },
  { slug: "supernatural", name: "Supernatural", nameAr: "خارق للطبيعة" },
  { slug: "adventure", name: "Adventure", nameAr: "مغامرة" },
  { slug: "horror", name: "Horror", nameAr: "رعب" },
  { slug: "psychological", name: "Psychological", nameAr: "نفسي" },
  { slug: "thriller", name: "Thriller", nameAr: "إثارة" },
  { slug: "isekai", name: "Isekai", nameAr: "عالم آخر" },
  { slug: "regression", name: "Regression", nameAr: "رجوع بالزمن" },
  { slug: "murim", name: "Murim", nameAr: "موريم" },
  { slug: "system", name: "System", nameAr: "نظام" },
  { slug: "revenge", name: "Revenge", nameAr: "انتقام" },
  { slug: "tragedy", name: "Tragedy", nameAr: "مأساة" },
  { slug: "sci-fi", name: "Sci-Fi", nameAr: "خيال علمي" },
  { slug: "mystery", name: "Mystery", nameAr: "غموض" },
  { slug: "slice-of-life", name: "Slice of Life", nameAr: "شريحة حياة" },
  { slug: "sports", name: "Sports", nameAr: "رياضة" },
];

export const TITLE_PREFIXES = [
  "أسطورة", "عودة", "ملك", "سيد", "صعود", "نظام", "أعظم", "المخادع",
  "بطل", "وريث", "ملحمة", "ظل", "قوة", "طريق", "حارس", "امبراطور",
];

export const TITLE_CORES = [
  "التنين الأسود", "السيف الأبدي", "الجحيم المتجمد", "العالم المنسي", "الفارس الغامض",
  "أكاديمية السحرة", "برج البقاء", "المصارع الأسطوري", "قلعة الظلام", "نادي الصيادين",
  "الوريث الملعون", "حرب الآلهة", "منطقة الصفر", "زهرة الدم", "متاهة الخلود",
  "قناص العصور", "شفرة القمر", "التاج المكسور", "أرض الغيلان", "نظام اللاعب",
  "المصنع الأخير", "جامعة الأبطال", "دفتر الموت الثاني", "حكاية الذئب الأبيض",
];

export const AUTHORS = [
  "كيم سيونغ", "لي مين جون", "بارك جي هو", "تشوي يونا", "جانغ وو جين",
  "يون سو أه", "هان جاي هيون", "شين دو يون", "أوه هيون وو", "كانغ مين جي",
];

export const TEAM_NAMES = [
  "LUNEX", "NightFall", "Aurora", "Obsidian", "Crimson Order", "Silver Fang",
  "Eclipse", "Phantom", "Zenith", "Ashen", "Velvet Moon", "Ironwill",
];

export const TEAM_COLORS = ["#6D28D9", "#A855F7", "#C084FC", "#8B31E8", "#7C3AED", "#9333EA"];

export const USER_FIRST_NAMES = [
  "أحمد", "محمد", "علي", "يوسف", "عمر", "خالد", "سارة", "لينا", "نور", "مريم",
  "فاطمة", "زينب", "حسن", "حسين", "طارق", "كريم", "ياسمين", "ريم", "دانة", "جود",
  "عبدالله", "سلطان", "فيصل", "ماجد", "لطيفة", "شهد", "رهف", "غلا", "جنى", "لمى",
];

export const USER_LAST_NAMES = [
  "الشمري", "العتيبي", "القحطاني", "المطيري", "الدوسري", "الغامدي", "الزهراني",
  "الحربي", "العنزي", "السبيعي", "الشهري", "البلوي", "الرشيدي", "المالكي",
];

export const COMMENT_SNIPPETS = [
  "الفصل هذا كان ناااار ما توقعت هالتطور 🔥",
  "الترجمة تحفة زي العادة، تسلم الفريق 🙏",
  "متى الفصل الجاي؟ ما اقدر استنى 😭",
  "الرسم في هالفصل مبالغ فيه من الجمال",
  "توقعت شي مختلف بس النهاية صادمة",
  "الشخصية الرئيسية بدأت تتطور بشكل حلو",
  "شكراً لكم على المجهود، عمل احترافي",
  "حبيت الحوار بين البطلين كان طبيعي جداً",
  "اقتباس هذا الفصل يستاهل يتأطر",
  "الفريق قاعد يشتغل بجد, تحسن ملحوظ بالجودة",
];

export const NEWS_ITEMS = [
  { title: "إعلان انضمام فريق تنسيق جديد إلى LUNEX TEAM", category: "announcement" as const },
  { title: "بدء فعالية القراءة الشهرية بجوائز حصرية", category: "event" as const },
  { title: "تحديث سياسة النشر لضمان جودة أعلى للفصول", category: "news" as const },
  { title: "افتتاح باب التقديم للمترجمين والمدققين", category: "announcement" as const },
  { title: "احتفالية الذكرى السنوية الثانية لفريق LUNEX", category: "event" as const },
];
