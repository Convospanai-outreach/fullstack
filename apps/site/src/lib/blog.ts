import fs from 'fs';
import path from 'path';
import { parseFrontmatter } from './frontmatter';

const blogDirectory = path.join(process.cwd(), 'content/blog');

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  content: string;
};

export function getBlogPosts(): BlogPost[] {
  if (!fs.existsSync(blogDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(blogDirectory);
  const allPostsData = fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, '');
      const fullPath = path.join(blogDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');

      const { data, content } = parseFrontmatter(fileContents);

      return {
        slug,
        title: data['title'] || 'Untitled',
        description: data['description'] || '',
        date: data['date'] || new Date().toISOString(),
        category: data['category'] || '',
        content,
      };
    });

  return allPostsData.sort((a, b) => {
    if (a.date < b.date) {
      return 1;
    } else {
      return -1;
    }
  });
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  const fullPath = path.join(blogDirectory, `${slug}.md`);
  if (!fs.existsSync(fullPath)) {
    return undefined;
  }
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = parseFrontmatter(fileContents);

  return {
    slug,
    title: data['title'] || 'Untitled',
    description: data['description'] || '',
    date: data['date'] || new Date().toISOString(),
    category: data['category'] || '',
    content,
  };
}
