import type { Metadata } from "next";
import { getNews } from "@/lib/mock/repo";
import { NewsSection } from "@/components/home/news-section";

export const metadata: Metadata = {
  title: "الأخبار والفعاليات",
  description: "آخر أخبار وفعاليات وإعلانات فريق LUNEX TEAM.",
};

export default async function NewsPage() {
  const news = await getNews(20);
  return (
    <div className="container space-y-6 py-6">
      <NewsSection news={news} />
    </div>
  );
}
