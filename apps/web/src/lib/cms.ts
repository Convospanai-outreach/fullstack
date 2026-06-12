import fs from 'fs';
import path from 'path';

const CONTENT_DIR = path.join(process.cwd(), 'content');

export interface ParsedContent {
  metadata: Record<string, string>;
  content: string;
}

/**
 * Reads and parses a markdown file with optional frontmatter support.
 */
export function getContent(filePath: string): ParsedContent {
  const fullPath = path.join(CONTENT_DIR, filePath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const raw = fs.readFileSync(fullPath, 'utf8');

  // Simple frontmatter parser
  if (raw.startsWith('---')) {
    const parts = raw.split('---');
    if (parts.length >= 3) {
      const frontmatterRaw = parts[1];
      const content = parts.slice(2).join('---').trim();
      const metadata: Record<string, string> = {};

      frontmatterRaw.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > -1) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
          if (key) metadata[key] = value;
        }
      });

      return { metadata, content };
    }
  }

  return { metadata: {}, content: raw };
}

/**
 * Lists all markdown files recursively in the content directory.
 */
export function listContentFiles(dir = ''): string[] {
  const targetDir = path.join(CONTENT_DIR, dir);
  if (!fs.existsSync(targetDir)) return [];

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  let files: string[] = [];

  for (const entry of entries) {
    const relPath = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      files = files.concat(listContentFiles(relPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(relPath);
    }
  }

  return files;
}
