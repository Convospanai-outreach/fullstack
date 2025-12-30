import { getCompanyInsights } from '@/integrations/research.js';
import { scrapeLinkedInProfile } from '@/linkedin/scraper-bridge.js';

import { buildICP } from '@/icp/fuse.js';

export async function runCampaign(companyName: string, _contactName: string, link: string) {
  const insights = await getCompanyInsights(companyName);
  const profile = await scrapeLinkedInProfile(link);
  // await findEmailWithHunter(); // Needs domain and name split
  const icp = await buildICP({ name: companyName }, profile);

  return { status: "ok", insights, profile, icp };
}
