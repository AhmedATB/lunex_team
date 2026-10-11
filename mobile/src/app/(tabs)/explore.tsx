import { useLocalSearchParams } from "expo-router";
import { SeriesExplorer, type ExplorerFilters } from "../../components/series-explorer";

/** The site's /series: every work, with the filters a home-page "عرض الكل" link carries (sort, status, genre). */
export default function ExploreScreen() {
  const params = useLocalSearchParams<{ sort?: string; status?: string; genre?: string; type?: string; q?: string }>();
  const initial: Partial<ExplorerFilters> = {};
  if (params.sort) initial.sort = params.sort as ExplorerFilters["sort"];
  if (params.status) initial.status = params.status;
  if (params.genre) initial.genre = params.genre;
  if (params.type) initial.type = params.type;
  if (params.q) initial.q = params.q;
  return <SeriesExplorer initial={initial} />;
}
