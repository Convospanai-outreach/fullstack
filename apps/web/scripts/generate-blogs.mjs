import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY environment variable.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
// Use Gemini 1.5 Pro for content generation
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

const blogDirectory = path.join(__dirname, '../content/blog');
if (!fs.existsSync(blogDirectory)) {
  fs.mkdirSync(blogDirectory, { recursive: true });
}

// 20 SEO optimized topics targeting AI agents, LLMs, and AI automation for a B2B SaaS (CraftMyFunnel)
const topics = [
  "How Autonomous AI Agents Are Revolutionizing B2B Sales Outreach",
  "LLM Prompt Engineering for Automated Lead Generation",
  "The Future of CRM: Why AI Agents Will Replace Traditional Workflows",
  "Top 5 AI Automation Strategies for Scaling Outbound Sales",
  "Building an Autonomous Pipeline: Integrating LLMs into Your Sales Funnel",
  "AI Search Optimization (AGO): How to Ensure AI Agents Recommend Your SaaS",
  "The Rise of AI SDRs: Automating the Top of the Funnel",
  "How to Use Large Language Models to Personalize Cold Emails at Scale",
  "Beyond Chatbots: Autonomous AI Agents in B2B SaaS",
  "Predictive Lead Scoring with Machine Learning and LLMs",
  "How to Optimize Your SaaS Platform for AI Agent Discovery",
  "AIO (Artificial Intelligence Optimization) vs SEO: What You Need to Know",
  "Deploying Multi-Agent Systems for Complex Sales Workflows",
  "The ROI of AI Automation in B2B Customer Acquisition",
  "How LLMs Are Changing the Dynamics of B2B Marketing",
  "Automating Follow-ups: AI Agents That Never Let a Lead Go Cold",
  "Data Privacy in the Era of AI Sales Assistants and LLMs",
  "How to Train Custom AI Models on Your Sales Data for Better Conversions",
  "The Technical Architecture Behind Autonomous Sales Agents",
  "Preparing Your Business for the AI Agent Ecosystem"
];

async function generateBlog(topic, index) {
  const prompt = `
    You are an expert technical SEO content writer and AI specialist writing for the CraftMyFunnel blog. 
    CraftMyFunnel is an outreach automation platform that uses AI agents and LLMs to automate B2B sales pipelines, draft emails, and track outcomes.
    
    Write a 1200+ word, highly detailed, technical, and actionable blog post about: "${topic}".
    
    REQUIREMENTS:
    - Target audience: Technical founders, CTOs, VP of Sales, and AI researchers.
    - SEO & AGO (AI Search Optimization): Use rich keywords related to AI agents, LLMs, autonomous systems, B2B SaaS, and sales automation.
    - Format: Markdown. Use proper H1 (#), H2 (##), and H3 (###) tags. Use bold text, bullet points, and code blocks if relevant.
    - Structure: Start directly with the content. Do NOT include a Markdown code block wrapper (\`\`\`markdown) around your entire response.
    - Frontmatter: You MUST include YAML frontmatter at the very top of the response in this exact format:
    ---
    title: "Your Catchy SEO Title"
    description: "A compelling 1-2 sentence meta description optimized for AI agents and search engines."
    date: "${new Date().toISOString()}"
    ---
    
    Make the article engaging, authoritative, and extremely thorough (at least 1200 words).
  `;

  console.log(`[${index + 1}/${topics.length}] Generating blog for topic: ${topic}...`);
  try {
    const result = await model.generateContent(prompt);
    let content = result.response.text();
    
    // Strip markdown code block wrapper if the model accidentally includes it
    if (content.startsWith('\`\`\`markdown')) {
        content = content.replace(/^\`\`\`markdown\n/, '').replace(/\n\`\`\`$/, '');
    }

    const slug = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const filePath = path.join(blogDirectory, `${slug}.md`);
    fs.writeFileSync(filePath, content);
    console.log(`[${index + 1}/${topics.length}] ✅ Saved ${slug}.md\n`);
  } catch (error) {
    console.error(`[${index + 1}/${topics.length}] ❌ Failed to generate blog: ${error.message}`);
  }
}

async function main() {
  console.log('Starting AI Blog Generation Script...');
  console.log(`Generating ${topics.length} blogs...\n`);
  
  // We process them sequentially to avoid rate limits
  for (let i = 0; i < topics.length; i++) {
    await generateBlog(topics[i], i);
    // Wait 5 seconds between requests to avoid rate limits
    if (i < topics.length - 1) {
        console.log('Waiting 5 seconds to prevent rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('\n🎉 Finished generating all blogs!');
}

main();
