export class HubSpotService {
    private apiKey: string;
    private baseUrl = "https://api.hubapi.com";

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async request(endpoint: string, method: "GET" | "POST" | "PATCH", body?: any) {
        const fetchOptions: RequestInit = {
            method,
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json"
            }
        };

        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }

        const res = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions);

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`HubSpot API Error: ${res.statusText} - ${error}`);
        }
        return res.json();
    }

    async syncContact(lead: any) {
        // 1. Search if contact exists by Email
        let contactId = null;
        if (lead.email) {
            const search = await this.request("/crm/v3/objects/contacts/search", "POST", {
                filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: lead.email }] }]
            });
            if (search.results.length > 0) {
                contactId = search.results[0].id;
            }
        }

        const properties = {
            email: lead.email,
            firstname: lead.fullName?.split(" ")[0] || "",
            lastname: lead.fullName?.split(" ").slice(1).join(" ") || "",
            company: lead.company,
            jobtitle: lead.jobTitle,
            linkedin_url: lead.linkedIn,
            lifecyclestage: "lead", // Default
            craftmyfunnel_status: lead.status // Custom property
        };

        if (contactId) {
            // Update
            await this.request(`/crm/v3/objects/contacts/${contactId}`, "PATCH", { properties });
            return { action: "updated", id: contactId };
        } else {
            // Create
            const created = await this.request("/crm/v3/objects/contacts", "POST", { properties });
            return { action: "created", id: created.id };
        }
    }
}
