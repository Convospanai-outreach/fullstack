import { HELP_ARTICLES, type HelpArticle, searchHelpArticles } from "@/modules/help/content";

class HelpService {
    async search(query: string): Promise<HelpArticle[]> {
        return searchHelpArticles(query);
    }

    async getTopic(slug: string): Promise<HelpArticle | null> {
        return HELP_ARTICLES.find((article) => article.slug === slug) || null;
    }

    async downloadAll(): Promise<HelpArticle[]> {
        return HELP_ARTICLES;
    }
}

export const helpService = new HelpService();
