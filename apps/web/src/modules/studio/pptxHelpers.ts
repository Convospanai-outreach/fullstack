type ShapeFill = {
    transparency?: number;
};

type ElementData = {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    fill?: ShapeFill;
    line?: unknown;
    path?: string;
    chartType?: string;
    shape?: string;
    mediaType?: string;
    table?: unknown;
    rows?: unknown[];
    text?: string;
};

type SlideObject = {
    type?: string;
    text?: string;
    image?: unknown;
    data?: ElementData;
    options?: ElementData;
};

type SlideLike = {
    _slideObjects?: SlideObject[];
};

type PptxLike = {
    _slides?: SlideLike[];
    _presLayout?: { width?: number; height?: number };
    width?: number;
    height?: number;
};

type Bounds = {
    x: number;
    y: number;
    w: number;
    h: number;
    x2: number;
    y2: number;
};

function toData(object: SlideObject) {
    return object.data ?? object.options ?? {};
}

function inferElementType(object: SlideObject) {
    const data = toData(object);

    if (object.type === "line") return "line";
    if (typeof object.type === "string") return object.type;
    if (object.text || typeof data.text === "string") return "text";
    if (data.path || object.image) return "image";
    if (data.chartType) return "chart";
    if (data.shape || data.line) return "shape";
    if (data.mediaType) return "media";
    if (data.table || Array.isArray(data.rows)) return "table";

    return "unknown";
}

function getBounds(object: SlideObject): Bounds {
    const data = toData(object);
    const x = typeof data.x === "number" ? data.x : 0;
    const y = typeof data.y === "number" ? data.y : 0;
    const w = typeof data.w === "number" ? data.w : 0;
    const h = typeof data.h === "number" ? data.h : 0;

    return { x, y, w, h, x2: x + w, y2: y + h };
}

function overlaps(a: Bounds, b: Bounds) {
    return a.x < b.x2 && a.x2 > b.x && a.y < b.y2 && a.y2 > b.y;
}

function getSlideSize(pptx?: PptxLike) {
    const width = pptx?._presLayout?.width ?? pptx?.width ?? 13.333;
    const height = pptx?._presLayout?.height ?? pptx?.height ?? 7.5;
    return { width, height };
}

export function safeOuterShadow(
    color = "000000",
    opacity = 0.18,
    angle = 45,
    blur = 2,
    offset = 1,
) {
    return {
        type: "outer" as const,
        color,
        opacity,
        angle,
        blur,
        offset,
    };
}

export function svgToDataUri(svg: string) {
    const normalized = svg
        .replace(/<\?xml[^>]*>/g, "")
        .replace(/currentColor/g, "#0f172a")
        .replace(/<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ');

    return `data:image/svg+xml;base64,${Buffer.from(normalized).toString("base64")}`;
}

export function warnIfSlideHasOverlaps(slide: SlideLike, pptx?: PptxLike) {
    if (!Array.isArray(slide._slideObjects)) {
        return;
    }

    const slideIndex = Array.isArray(pptx?._slides) ? pptx._slides.indexOf(slide) + 1 : 0;

    for (let index = 0; index < slide._slideObjects.length; index += 1) {
        const current = slide._slideObjects[index];
        const currentBounds = getBounds(current);
        const currentType = inferElementType(current);

        for (let otherIndex = index + 1; otherIndex < slide._slideObjects.length; otherIndex += 1) {
            const other = slide._slideObjects[otherIndex];
            const otherBounds = getBounds(other);
            const otherType = inferElementType(other);

            if (currentType === "line" || otherType === "line") {
                continue;
            }

            if (overlaps(currentBounds, otherBounds)) {
                console.warn(
                    `[pptx] Slide ${slideIndex || "?"}: overlap between ${currentType}#${index} and ${otherType}#${otherIndex}`,
                );
            }
        }
    }
}

export function warnIfSlideElementsOutOfBounds(slide: SlideLike, pptx?: PptxLike) {
    if (!Array.isArray(slide._slideObjects)) {
        return;
    }

    const { width, height } = getSlideSize(pptx);
    const slideIndex = Array.isArray(pptx?._slides) ? pptx._slides.indexOf(slide) + 1 : 0;

    slide._slideObjects.forEach((object, index) => {
        const bounds = getBounds(object);
        const type = inferElementType(object);

        if (bounds.x < 0 || bounds.y < 0 || bounds.x2 > width || bounds.y2 > height) {
            console.warn(
                `[pptx] Slide ${slideIndex || "?"}: ${type}#${index} exceeds bounds (${bounds.x.toFixed(2)}, ${bounds.y.toFixed(2)}, ${bounds.x2.toFixed(2)}, ${bounds.y2.toFixed(2)})`,
            );
        }
    });
}
