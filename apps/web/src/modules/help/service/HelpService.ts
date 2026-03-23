
export interface HelpArticle {
    slug: string;
    title: string;
    category: string;
    content: string; // Markdown
}

const ARTICLES: HelpArticle[] = [
    {
        slug: "getting-started",
        title: "Getting Started with ConvoSpan",
        category: "General",
        content: `
# Welcome to ConvoSpan

ConvoSpan is your intelligent email outreach platform.

## Key Concepts
- **Campaigns**: Your email sequences.
- **Agents**: AI workers that personalize content.
- **Automations**: Rules to handle replies automatically.

## First Steps
1. Go to Settings and add your API Keys.
2. Import Leads via CSV.
3. Create your first Campaign.
        `
    },
    {
        slug: "api-keys",
        title: "Managing API Keys",
        category: "Settings",
        content: `
# API Keys

To use AI features, you need to bring your own keys.

1. Go to **Settings > API Keys**.
2. Enter your OpenAI Key (sk-...) for content generation.
3. Enter your Gemini Key for analysis and automations.
        `
    },
    {
        slug: "automations",
        title: "Setting up Automations",
        category: "Features",
        content: `
# Automations

Automate your workflow with "If This, Then That" rules.

## Triggers
- **Lead Replied**: Fired when a lead responds.
- **Email Opened**: Fired when a lead opens an email.

## Actions
- **Stop Campaign**: Remove lead from sequence.
- **AI Reply**: Draft or send a reply using AI.
        `
    }
];

class HelpService {
    async search(query: string): Promise<HelpArticle[]> {
        const q = query.toLowerCase();
        return ARTICLES.filter(a =>
            a.title.toLowerCase().includes(q) ||
            a.content.toLowerCase().includes(q)
        );
    }

    async getTopic(slug: string): Promise<HelpArticle | null> {
        return ARTICLES.find(a => a.slug === slug) || null;
    }

    async downloadAll(): Promise<HelpArticle[]> {
        return ARTICLES;
    }
}

export const helpService = new HelpService();
