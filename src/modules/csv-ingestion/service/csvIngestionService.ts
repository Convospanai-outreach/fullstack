import Papa from "papaparse";
import { prisma } from "@/lib/db";
import { dataMappingAgent } from "@/modules/ai-content/agents/DataMappingAgent";

export interface CSVRow {
    email: string;
    fullName?: string;
    company?: string;
    jobTitle?: string;
    linkedIn?: string;
    location?: string;
}

class CSVIngestionService {
    /**
     * Get AI-suggested mapping for CSV headers
     */
    async suggestMapping(headers: string[]) {
        return dataMappingAgent.suggestMapping(headers);
    }

    /**
     * Simple client-side auto-detection fallback
     */
    autoDetectFieldMapping(headers: string[]): Record<string, string> {
        const mapping: Record<string, string> = {};
        headers.forEach(h => {
            const nh = h.toLowerCase().replace(/[\s_]+/g, '');
            if (nh.includes('email') || nh === 'mail') mapping[h] = 'email';
            else if (nh.includes('name') || nh === 'fullname' || nh === 'contactname') mapping[h] = 'fullName';
            else if (nh.includes('linkedin') || nh.includes('profile')) mapping[h] = 'linkedIn';
            else if (nh.includes('company') || nh === 'org') mapping[h] = 'company';
            else if (nh.includes('title') || nh.includes('role')) mapping[h] = 'jobTitle';
            else if (nh.includes('location') || nh.includes('city')) mapping[h] = 'location';
        });
        return mapping;
    }

    async processCSV(csvContent: string, teamId: string | null, mapping?: Record<string, string>) {
        if (!csvContent) throw new Error("No CSV content received");

        const parsed = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim() // Keep original case if mapping is provided
        });

        if (parsed.errors.length) {
            throw new Error(`CSV Parsing Error: ${parsed.errors[0]?.message || 'Unknown error'}`);
        }

        const rows = parsed.data as any[];
        const validLeads: any[] = [];
        const errors: string[] = [];

        // Normalize logic: Use mapping if provided, else fallback to auto-magic
        const getField = (row: any, field: string) => {
            if (mapping) {
                // Find CSV header mapped to this DB field
                // mapping is { "First Name": "firstName", "Email Addr": "email" }
                // So we need reverse lookup? 
                // Usually mapping is key=DBField, value=CSVHeader? Or key=CSVHeader, value=DBField?
                // dataMappingAgent returns { "CSV Header": "dbField" }

                // Find keys in mapping where value === field
                const csvHeader = Object.keys(mapping).find(key => mapping[key] === field);
                return csvHeader ? row[csvHeader] : null;
            } else {
                // Fallback Legacy Normalization
                // We need to re-normalize keys here since we removed transformHeader lowercasing
                // to support precise mapping.
                // Construct a normalized row map on the fly? Expensive.
                // Let's iterate keys.
                const normalizedRow: Record<string, any> = {};
                Object.keys(row).forEach(k => normalizedRow[k.toLowerCase().replace(/[\s_]+/g, '')] = row[k]);

                if (field === 'email') return normalizedRow['email'] || normalizedRow['contactemail'] || normalizedRow['mail'];
                if (field === 'fullName') return normalizedRow['fullname'] || normalizedRow['name'] || normalizedRow['contactname'] || `${normalizedRow['firstname'] || ''} ${normalizedRow['lastname'] || ''}`.trim();
                if (field === 'company') return normalizedRow['company'] || normalizedRow['companyname'] || normalizedRow['organization'];
                if (field === 'jobTitle') return normalizedRow['jobtitle'] || normalizedRow['title'] || normalizedRow['position'];
                if (field === 'linkedIn') return normalizedRow['linkedin'] || normalizedRow['linkedinurl'] || normalizedRow['profile'];
                if (field === 'location') return normalizedRow['location'] || normalizedRow['city'] || normalizedRow['country'];
                return null;
            }
        };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            const email = getField(row, 'email');
            const fullName = getField(row, 'fullName');
            const company = getField(row, 'company');
            const jobTitle = getField(row, 'jobTitle');
            const linkedIn = getField(row, 'linkedIn');
            const location = getField(row, 'location');

            if (!email || !email.includes('@')) {
                errors.push(`Row ${i + 1}: Invalid or missing email`);
                continue;
            }

            validLeads.push({
                email: email.toLowerCase(),
                fullName: fullName || null,
                company: company || null,
                jobTitle: jobTitle || null,
                linkedIn: linkedIn || null,
                location: location || null,
                teamId: teamId,
                status: "NEW",
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        if (validLeads.length === 0) {
            return { success: false, message: "No valid leads found", errors };
        }

        const result = await prisma.lead.createMany({
            data: validLeads,
            skipDuplicates: true
        });

        return {
            success: true,
            totalParsed: rows.length,
            inserted: result.count,
            skipped: validLeads.length - result.count,
            errors
        };
    }
}

export const csvIngestionService = new CSVIngestionService();
