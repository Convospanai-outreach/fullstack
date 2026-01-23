/**
 * Hunter.io Integration
 * Provides email finding and verification using Hunter.io API
 */

import { hunterService } from "@/modules/hunter-email-finder/service/hunterService";

export interface EmailFindResult {
  email: string | null;
  score: number;
  firstName?: string;
  lastName?: string;
  company?: string;
}

export interface EmailVerifyResult {
  email: string;
  status: "valid" | "invalid" | "unknown";
  score: number;
}

/**
 * Find email address for a person at a company
 * @param firstName - Person's first name
 * @param lastName - Person's last name  
 * @param domain - Company domain (e.g., "company.com")
 * @param leadId - Optional lead ID to update in database
 */
export async function findEmailWithHunter(
  firstName: string,
  lastName: string,
  domain: string,
  leadId?: string
): Promise<EmailFindResult | null> {
  try {
    const result = await hunterService.findAndStoreEmail({
      firstName,
      lastName,
      domain,
      leadId: leadId || ""
    });

    return {
      email: result.email || null,
      score: result.score || 0,
      firstName,
      lastName,
      company: domain
    };
  } catch (error) {
    console.error("[Hunter Integration] Email find failed:", error);
    return null;
  }
}

/**
 * Verify if an email address is valid
 * @param email - Email address to verify
 * @param leadId - Optional lead ID to update status
 */
export async function verifyEmailWithHunter(
  email: string,
  leadId?: string
): Promise<EmailVerifyResult | null> {
  try {
    const result = await hunterService.verifyAndUpdateEmail(email, leadId);

    return {
      email: result.email,
      status: result.status as "valid" | "invalid" | "unknown",
      score: result.score || 0
    };
  } catch (error) {
    console.error("[Hunter Integration] Email verify failed:", error);
    return null;
  }
}

/**
 * Bulk find emails for multiple leads
 */
export async function bulkFindEmailsWithHunter(
  leads: Array<{ id: string; firstName: string; lastName: string; domain: string }>
) {
  return hunterService.bulkFindEmails(leads);
}
