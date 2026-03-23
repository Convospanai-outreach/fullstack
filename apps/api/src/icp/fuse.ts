export async function buildICP(company: any, profile: any, assets: any[] = []) {
  return {
    company: company.name,
    name: profile?.name || "Unknown",
    icp_data: { pain_points: ["Scaling challenges"], assetsCount: assets.length }
  };
}
