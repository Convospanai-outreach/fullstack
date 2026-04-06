import {
    buildDeckSlides,
    buildPresentationNotes,
    getLanguageMeta,
    isRtlLanguage,
    listFromCommaSeparated,
    listFromMultiline,
    slugifyPresentationName,
    type StudioConfig,
} from "@/modules/studio/presentation";
import {
    safeOuterShadow,
    svgToDataUri,
    warnIfSlideElementsOutOfBounds,
    warnIfSlideHasOverlaps,
} from "@/modules/studio/pptxHelpers";

function buildHeroArtwork(accent: string, languageLabel: string, market: string) {
    return svgToDataUri(`
        <svg viewBox="0 0 640 760" fill="none">
            <defs>
                <linearGradient id="ink" x1="72" y1="56" x2="560" y2="660" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#${accent}" />
                    <stop offset="1" stop-color="#0F172A" />
                </linearGradient>
            </defs>
            <rect width="640" height="760" rx="44" fill="#F4EFE6"/>
            <circle cx="430" cy="180" r="150" fill="#${accent}" fill-opacity="0.14" />
            <circle cx="520" cy="420" r="120" fill="#0F172A" fill-opacity="0.08" />
            <path d="M102 236C168 120 332 82 460 144C558 190 590 290 550 370C506 458 398 512 292 496C168 478 78 360 102 236Z" fill="url(#ink)" fill-opacity="0.16"/>
            <path d="M160 560C244 462 404 430 520 496" stroke="#0F172A" stroke-opacity="0.18" stroke-width="18" stroke-linecap="round"/>
            <path d="M160 612C270 520 418 508 540 570" stroke="#${accent}" stroke-opacity="0.22" stroke-width="12" stroke-linecap="round"/>
            <text x="86" y="108" fill="#0F172A" fill-opacity="0.72" font-size="22" font-family="Aptos, Arial, sans-serif" letter-spacing="0.2em">${languageLabel}</text>
            <text x="86" y="146" fill="#0F172A" fill-opacity="0.52" font-size="18" font-family="Aptos, Arial, sans-serif">${market}</text>
            <text x="88" y="640" fill="#0F172A" fill-opacity="0.44" font-size="44" font-family="Aptos, Arial, sans-serif">Hello</text>
            <text x="224" y="688" fill="#0F172A" fill-opacity="0.32" font-size="38" font-family="Aptos, Arial, sans-serif">Bonjour</text>
            <text x="332" y="626" fill="#0F172A" fill-opacity="0.28" font-size="34" font-family="Aptos, Arial, sans-serif">Hola</text>
            <text x="130" y="718" fill="#0F172A" fill-opacity="0.28" font-size="30" font-family="Aptos, Arial, sans-serif">\u0928\u092e\u0938\u094d\u0924\u0947</text>
            <text x="364" y="726" fill="#0F172A" fill-opacity="0.28" font-size="30" font-family="Aptos, Arial, sans-serif">\u0645\u0631\u062d\u0628\u0627</text>
            <text x="422" y="678" fill="#0F172A" fill-opacity="0.24" font-size="28" font-family="Aptos, Arial, sans-serif">\u3053\u3093\u306b\u3061\u306f</text>
        </svg>
    `);
}

function addFrame(slide: any, accent: string, paper: string) {
    slide.background = { color: paper };
    slide.addShape("rect", {
        x: 0.5,
        y: 0.42,
        w: 12.32,
        h: 6.66,
        line: { color: "D7CCBE", pt: 1 },
        fill: { color: paper },
    });
    slide.addShape("rect", {
        x: 0.5,
        y: 0.42,
        w: 12.32,
        h: 0.18,
        line: { color: accent, transparency: 100, pt: 0 },
        fill: { color: accent, transparency: 0 },
    });
}

function addSectionLabel(slide: any, text: string, x: number, y: number, color: string) {
    slide.addText(text.toUpperCase(), {
        x,
        y,
        w: 2.4,
        h: 0.2,
        fontFace: "Aptos",
        fontSize: 8,
        bold: true,
        color,
        charSpace: 2.2,
        margin: 0,
    });
}

function addEditablePanel(slide: any, title: string, body: string, x: number, y: number, w: number, h: number, accent: string, rtlMode: boolean, lang: string) {
    slide.addShape("rect", {
        x,
        y,
        w,
        h,
        radius: 0.14,
        line: { color: "D7CCBE", pt: 1 },
        fill: { color: "FFFDFC" },
        shadow: safeOuterShadow("A38D76", 0.1, 45, 1.4, 0.6),
    });

    slide.addText(title, {
        x: x + 0.18,
        y: y + 0.16,
        w: w - 0.36,
        h: 0.26,
        fontFace: "Aptos",
        fontSize: 10,
        bold: true,
        color: "0F172A",
        margin: 0,
        lang,
        rtlMode,
    });

    slide.addText(body, {
        x: x + 0.18,
        y: y + 0.52,
        w: w - 0.36,
        h: h - 0.68,
        fontFace: "Aptos",
        fontSize: 11,
        color: "334155",
        margin: 0,
        valign: "top",
        breakLine: false,
        fit: "shrink",
        lang,
        rtlMode,
    });
}

function addMetric(slide: any, label: string, value: number, x: number, y: number, w: number, accent: string, lang: string) {
    slide.addText(`${label} ${Math.round(value)}%`, {
        x,
        y,
        w,
        h: 0.22,
        fontFace: "Aptos",
        fontSize: 10,
        bold: true,
        color: "0F172A",
        margin: 0,
        lang,
    });
    slide.addShape("rect", {
        x,
        y: y + 0.28,
        w,
        h: 0.14,
        line: { color: "E7DED2", pt: 0.5 },
        fill: { color: "E7DED2" },
    });
    slide.addShape("rect", {
        x,
        y: y + 0.28,
        w: Math.max(0.4, (w * value) / 100),
        h: 0.14,
        line: { color: accent, pt: 0.5 },
        fill: { color: accent },
    });
}

function addFooter(slide: any, text: string, lang: string, rtlMode: boolean) {
    slide.addText(text, {
        x: 0.78,
        y: 7.0,
        w: 11.5,
        h: 0.2,
        fontFace: "Aptos",
        fontSize: 8,
        color: "64748B",
        margin: 0,
        lang,
        rtlMode,
    });
}

export async function buildStudioPresentationBuffer(config: StudioConfig, preview?: string) {
    // Use npm pptxgenjs instead of vendored bundle
    const module = await import("pptxgenjs");
    const PptxGenJS = (module.default ?? module) as new () => any;
    const pptx = new PptxGenJS();
    const language = getLanguageMeta(config.language);
    const rtlMode = isRtlLanguage(config.language);
    const talkingPoints = listFromMultiline(config.talkingPoints);
    const avoidWords = listFromCommaSeparated(config.avoidWords);
    const slides = buildDeckSlides(config.slideOutline);
    const accent = language.direction === "rtl" ? "B45309" : "0F766E";
    const paper = "F4EFE6";
    const accentTwo = language.direction === "rtl" ? "E2A55D" : "8AC8C0";
    const fileName = `${slugifyPresentationName(config.deckTitle)}-${config.language.toLowerCase()}.pptx`;

    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "ConvoSpan";
    pptx.company = "ConvoSpan";
    pptx.subject = `${config.market} campaign deck`;
    pptx.title = config.deckTitle;
    pptx.theme = {
        headFontFace: "Aptos Display",
        bodyFontFace: "Aptos",
    };
    pptx.rtlMode = rtlMode;

    const cover = pptx.addSlide();
    addFrame(cover, accent, paper);
    cover.addImage({
        data: buildHeroArtwork(accent, language.label, config.market),
        x: 8.35,
        y: 0.72,
        w: 3.7,
        h: 5.52,
    });
    addSectionLabel(cover, "International campaign studio", 0.86, 0.84, accent);
    cover.addText(config.deckTitle, {
        x: 0.84,
        y: 1.16,
        w: 6.28,
        h: 1.18,
        fontFace: "Aptos Display",
        fontSize: 26,
        bold: true,
        color: "0F172A",
        margin: 0,
        valign: "mid",
        lang: config.language,
        rtlMode,
    });
    cover.addText(
        `Built for ${config.market} in ${language.label}. The structure stays editable so regional teams can rewrite tone, proof points, and CTA without rebuilding the deck.`,
        {
            x: 0.86,
            y: 2.58,
            w: 6.36,
            h: 1.02,
            fontFace: "Aptos",
            fontSize: 12,
            color: "334155",
            margin: 0,
            valign: "top",
            fit: "shrink",
            lang: config.language,
            rtlMode,
        },
    );
    addEditablePanel(cover, "Audience", config.audience, 0.86, 4.42, 3.92, 1.42, accent, rtlMode, config.language);
    addEditablePanel(cover, "Campaign objective", config.campaignObjective, 4.98, 4.42, 3.1, 1.42, accent, rtlMode, config.language);
    cover.addText(`${language.nativeLabel} - ${language.direction.toUpperCase()} - ${language.signal}`, {
        x: 0.86,
        y: 6.22,
        w: 7.2,
        h: 0.28,
        fontFace: "Aptos",
        fontSize: 9,
        color: accent,
        margin: 0,
        bold: true,
        lang: config.language,
        rtlMode,
    });
    cover.addNotes(buildPresentationNotes(config, preview));
    addFooter(cover, "Editable PowerPoint-native deck generated from Studio brief", config.language, rtlMode);

    const brief = pptx.addSlide();
    addFrame(brief, accent, paper);
    addSectionLabel(brief, "Campaign brief", 0.86, 0.82, accent);
    brief.addText("Regional framing and audience requirements", {
        x: 0.86,
        y: 1.08,
        w: 6.4,
        h: 0.5,
        fontFace: "Aptos Display",
        fontSize: 20,
        bold: true,
        color: "0F172A",
        margin: 0,
        lang: config.language,
        rtlMode,
    });
    addEditablePanel(brief, "Audience needs", config.audienceNeeds, 0.86, 1.8, 5.62, 2.06, accent, rtlMode, config.language);
    addEditablePanel(brief, "Content requirements", config.contentRequirements, 6.72, 1.8, 5.72, 2.06, accent, rtlMode, config.language);
    addEditablePanel(brief, "Presentation goal", config.presentationGoal, 0.86, 4.16, 5.62, 1.7, accent, rtlMode, config.language);
    addEditablePanel(brief, "Localization signal", `${language.signal}\nNative label: ${language.nativeLabel}\nDirection: ${language.direction.toUpperCase()}`, 6.72, 4.16, 5.72, 1.7, accent, rtlMode, config.language);
    addFooter(brief, `Market: ${config.market}`, config.language, rtlMode);

    const voice = pptx.addSlide();
    addFrame(voice, accent, paper);
    addSectionLabel(voice, "Voice calibration", 0.86, 0.82, accent);
    voice.addText("Tone controls and rewrite boundaries", {
        x: 0.86,
        y: 1.08,
        w: 6.2,
        h: 0.5,
        fontFace: "Aptos Display",
        fontSize: 20,
        bold: true,
        color: "0F172A",
        margin: 0,
        lang: config.language,
        rtlMode,
    });
    addMetric(voice, "Formality", config.formality, 0.86, 1.9, 4.9, accent, config.language);
    addMetric(voice, "Directness", config.directness, 0.86, 2.68, 4.9, accentTwo, config.language);
    addEditablePanel(voice, "Talking points", talkingPoints.join("\n") || "Add talk tracks here.", 0.86, 3.42, 5.02, 2.12, accent, rtlMode, config.language);
    addEditablePanel(voice, "Avoid words", avoidWords.join(", ") || "Add excluded words here.", 6.18, 1.9, 2.58, 1.34, accent, rtlMode, config.language);
    addEditablePanel(voice, "Language and market", `${language.label}\n${config.market}`, 8.96, 1.9, 3.48, 1.34, accent, rtlMode, config.language);
    addEditablePanel(voice, "Working instruction", "Keep every block editable. Rewrite examples, proof, and CTA to match the local buying committee before presenting.", 6.18, 3.42, 6.26, 2.12, accent, rtlMode, config.language);
    addFooter(voice, "Use these controls before local teams rewrite copy or slides", config.language, rtlMode);

    slides.forEach((slidePlan) => {
        const slide = pptx.addSlide();
        addFrame(slide, accent, paper);
        addSectionLabel(slide, `Slide ${slidePlan.index}`, 0.86, 0.82, accent);
        slide.addText(slidePlan.title, {
            x: 0.86,
            y: 1.06,
            w: 6.1,
            h: 0.62,
            fontFace: "Aptos Display",
            fontSize: 22,
            bold: true,
            color: "0F172A",
            margin: 0,
            lang: config.language,
            rtlMode,
        });
        slide.addShape("rect", {
            x: 0.86,
            y: 1.86,
            w: 6.2,
            h: 4.28,
            radius: 0.12,
            line: { color: accent, pt: 0.9 },
            fill: { color: "FFFDFC" },
        });
        slide.addText(slidePlan.body, {
            x: 1.12,
            y: 2.12,
            w: 5.68,
            h: 3.78,
            fontFace: "Aptos",
            fontSize: 15,
            color: "1E293B",
            margin: 0,
            valign: "top",
            fit: "shrink",
            lang: config.language,
            rtlMode,
        });
        addEditablePanel(slide, "Audience fit", config.audience, 7.44, 1.86, 4.98, 1.42, accent, rtlMode, config.language);
        addEditablePanel(slide, "Regional rewrite note", config.contentRequirements, 7.44, 3.48, 4.98, 1.52, accent, rtlMode, config.language);
        addEditablePanel(slide, "Proof or CTA to localize", `${config.campaignObjective}\n\nLocal proof owners can edit this panel before presenting.`, 7.44, 5.2, 4.98, 0.94, accent, rtlMode, config.language);
        slide.addNotes(buildPresentationNotes(config, preview));
        addFooter(slide, `Editable slide ${slidePlan.index} for ${config.market}`, config.language, rtlMode);
    });

    const checklist = pptx.addSlide();
    addFrame(checklist, accent, paper);
    addSectionLabel(checklist, "Handoff", 0.86, 0.82, accent);
    checklist.addText("Localization checklist before campaign launch", {
        x: 0.86,
        y: 1.08,
        w: 7.6,
        h: 0.5,
        fontFace: "Aptos Display",
        fontSize: 20,
        bold: true,
        color: "0F172A",
        margin: 0,
        lang: config.language,
        rtlMode,
    });
    addEditablePanel(checklist, "Review list", [
        "Confirm language is correct and still editable",
        "Replace generic proof with regional evidence",
        "Adjust CTA for market and buying committee",
        "Validate terms to avoid before external use",
    ].join("\n"), 0.86, 1.82, 5.58, 2.9, accent, rtlMode, config.language);
    addEditablePanel(checklist, "Support path", "If the team gets stuck, use the in-app Help Assistant or public /help center to get guidance before publishing campaign content.", 6.72, 1.82, 5.72, 1.42, accent, rtlMode, config.language);
    addEditablePanel(checklist, "Target audience", config.audience, 6.72, 3.48, 5.72, 1.24, accent, rtlMode, config.language);
    addEditablePanel(checklist, "Presentation goal", config.presentationGoal, 6.72, 4.96, 5.72, 1.18, accent, rtlMode, config.language);
    checklist.addText("This deck is deliberately structured with editable text boxes so campaign, regional, and sales teams can rewrite content in PowerPoint.", {
        x: 0.86,
        y: 5.2,
        w: 5.58,
        h: 0.82,
        fontFace: "Aptos",
        fontSize: 12,
        color: "334155",
        margin: 0,
        fit: "shrink",
        lang: config.language,
        rtlMode,
    });
    addFooter(checklist, "Need help? Use the Help Assistant and support flow from the app", config.language, rtlMode);

    for (const slide of pptx._slides ?? []) {
        warnIfSlideHasOverlaps(slide, pptx);
        warnIfSlideElementsOutOfBounds(slide, pptx);
    }

    const output = await pptx.write({
        outputType: "nodebuffer",
        compression: true,
    });

    const buffer = Buffer.isBuffer(output) ? output : Buffer.from(output as Uint8Array);
    return { buffer, fileName };
}
