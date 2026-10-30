import { GET as feedCsv } from "../feed.csv/route";

// Old address of the Google Ads conversion feed — kept so nothing breaks. The
// real one is /api/ad-conversions/feed.csv (Google Ads needs a ".csv" URL).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return feedCsv(request);
}
