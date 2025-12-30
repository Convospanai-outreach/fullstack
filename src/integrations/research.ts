/**
 * Company Research Integration
 * Provides company insights using AI analysis
 */

import { aiService } from "@/modules/ai-content/service/aiService";

export interface CompanyInsights {
  name: string;
  summary: string;
  industry?: string;
  employees?: string;
  revenue?: string;
}

/**
 * Get insights about a company by name
 * Uses AI to research and summarize public information
 */
export async function getCompanyInsights(name: string): Promise<CompanyInsights> {
  try {
    const data = await aiService.researchCompany(name);
    return {
      name,
      summary: data.summary || "No summary available",
      industry: data.industry,
      employees: data.employees,
      revenue: data.revenue
    };
  } catch (error) {
    console.error("[Research Integration] Failed to research company:", error);
    return {
      name,
      summary: "Research unavailable"
    };
  }
}
