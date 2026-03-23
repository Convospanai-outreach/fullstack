export type ScrapeTarget = "linkedin" | "twitter" | "generic";

export type ScrapeRequest = {
    target: ScrapeTarget;
    url: string;
    options?: {
        waitForSelector?: string;
        timeout?: number;
        screenshot?: boolean;
        extractFields?: string[];
    };
};

export type ScrapeResult = {
    success: boolean;
    data: any;
    screenshot?: string;  // base64 encoded
    metadata: {
        url: string;
        scrapedAt: string;
        duration: number;
    };
};

export type LinkedInProfile = {
    name: string;
    headline: string;
    location: string;
    about: string;
    experience: Array<{
        title: string;
        company: string;
        duration: string;
        description: string;
    }>;
    education: Array<{
        school: string;
        degree: string;
        field: string;
        years: string;
    }>;
    skills: string[];
    connections: string;
};

export interface ScraperAdapter {
    scrape(url: string, page: any, options?: any): Promise<any>;
    validate(url: string): boolean;
}
