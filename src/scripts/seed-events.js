const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const events = [
  {
    eventName: "New Year's Day",
    eventDate: "2026-01-01",
    category: "International Holiday",
    leadGenAngle: "Perfect time for a 'Fresh Start' outreach focusing on 2026 growth strategies and pipeline scaling.",
    newsletter: {
      subjectLine: "New Year, New Pipeline: Scaling ConvoSpan in 2026",
      emailBodyHtml: "<p><b>Happy New Year!</b></p><p>As we enter 2026, it's time to synchronize your AI agent army for the year ahead. ConvoSpan Edge is ready to amplify your outreach while keeping your data sovereign.</p><p>Is your 2026 growth strategy AI-powered?</p>",
      cta: "Reply 'STRATEGY' for a 2026 roadmap consultation"
    }
  },
  {
    eventName: "Republic Day",
    eventDate: "2026-01-26",
    category: "National Holiday (India)",
    leadGenAngle: "Celebrates progress and sovereignty—aligned with our 'Sovereign Core' value proposition for Indian enterprises.",
    newsletter: {
      subjectLine: "Celebrating Progress & Data Sovereignty this Republic Day",
      emailBodyHtml: "<p>Wishing you a <b>Happy Republic Day</b>.</p><p>Just as our nation values sovereignty, ConvoSpan values the sovereignty of your data. Our local SLM execution ensures your lead intelligence never leaves your control.</p>",
      cta: "Explore our Sovereign Core features"
    }
  },
  {
    eventName: "AI Impact Summit",
    eventDate: "2026-02-19",
    category: "Business/Tech Summit",
    leadGenAngle: "Direct tie-in to our core technology; ideal for engaging tech-forward founders and investors.",
    newsletter: {
      subjectLine: "ConvoSpan + AI Impact Summit: The Future of Agentic Growth",
      emailBodyHtml: "<p>The AI Impact Summit 2026 is here.</p><p>We are showcasing how <b>ConvoSpan Edge</b> bridges the gap between raw AI power and localized, secure execution. Don't let your growth be bottlenecked by cloud latency or data risks.</p>",
      cta: "Book a meeting at the Summit"
    }
  },
  {
    eventName: "Holi",
    eventDate: "2026-03-04",
    category: "Cultural Festival (India)",
    leadGenAngle: "A festive touchpoint to 'brighten up' the sales pipeline and re-engage dormant leads.",
    newsletter: {
      subjectLine: "Adding Color to Your 2026 Sales Pipeline",
      emailBodyHtml: "<p><b>Happy Holi!</b></p><p>May your business be as vibrant as the festival of colors. It's the perfect time to refresh your outreach campaigns with our new multi-channel strike capabilities.</p>",
      cta: "Refresh your campaigns now"
    }
  },
  {
    eventName: "Eid-ul-Fitr",
    eventDate: "2026-03-21",
    category: "Religious/Global Observance",
    leadGenAngle: "Crucial touchpoint for UAE and global market leads, focusing on community and shared success.",
    newsletter: {
      subjectLine: "Eid Mubarak: Synchronizing Growth across Regions",
      emailBodyHtml: "<p><b>Eid Mubarak</b> to you and your team.</p><p>As we celebrate this day of gratitude and community, ConvoSpan is proud to support your global growth with region-specific data sharding and compliance.</p>",
      cta: "Learn about our UAE Regional Lock"
    }
  },
  {
    eventName: "Independence Day",
    eventDate: "2026-08-15",
    category: "National Holiday (India)",
    leadGenAngle: "Focus on 'Independence from manual outreach' and the freedom of autonomous agent execution.",
    newsletter: {
      subjectLine: "Independence from Manual Outreach: Let the Agents Scale",
      emailBodyHtml: "<p>Happy Independence Day.</p><p>Achieve <b>freedom from the grind</b>. With ConvoSpan's Genkit flows, your prospecting runs at 10x scale while you focus on closing high-value deals.</p>",
      cta: "Enable Autonomous Mode"
    }
  },
  {
    eventName: "Diwali",
    eventDate: "2026-11-08",
    category: "Cultural Festival (India)",
    leadGenAngle: "The biggest gifting and business season; perfect for year-end deal-closing campaigns.",
    newsletter: {
      subjectLine: "Lighting up your Q4 Targets this Diwali",
      emailBodyHtml: "<p>Wishing you a prosperous <b>Diwali</b>.</p><p>As the festival of lights approaches, let ConvoSpan illuminate your path to exceeding Q4 targets with our Bulls-Eye RAG signal detection.</p>",
      cta: "Upgrade to Pro for Diwali Deals"
    }
  },
  {
    eventName: "Christmas",
    eventDate: "2026-12-25",
    category: "International Holiday",
    leadGenAngle: "A warm year-end thank you and a soft pitch for 2027 planning.",
    newsletter: {
      subjectLine: "Season's Greetings: A Sovereign Year in Review",
      emailBodyHtml: "<p><b>Merry Christmas and Season's Greetings!</b></p><p>Thank you for being part of the ConvoSpan ecosystem in 2026. Your AI agents are working through the holidays to ensure you start 2027 with a full pipeline.</p>",
      cta: "View your 2026 Performance Report"
    }
  }
];

async function seed() {
  console.log("🌱 Seeding 2026 Event Calendar...");
  
  for (const event of events) {
    try {
      await prisma.calendarEvent.create({
        data: {
          eventName: event.eventName,
          eventDate: new Date(event.eventDate),
          category: event.category,
          leadGenAngle: event.leadGenAngle,
          newsletter: {
            create: {
              subjectLine: event.newsletter.subjectLine,
              emailBodyHtml: event.newsletter.emailBodyHtml,
              cta: event.newsletter.cta,
            }
          }
        }
      });
      console.log(`✅ Seeded: ${event.eventName}`);
    } catch (err) {
      if (err.code === 'P2002') {
        console.log(`⚠️ Skipped (Duplicate): ${event.eventName}`);
      } else {
        throw err;
      }
    }
  }
  
  console.log("🏁 Seeding complete.");
}

seed()
  .catch(e => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
