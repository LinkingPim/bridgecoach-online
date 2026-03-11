import fs from "fs";
import path from "path";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CONTENT_DIR = path.join(process.cwd(), "public", "content");
const AUDIO_DIR = path.join(process.cwd(), "public", "audio");

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (error) {
    console.error("Fout bij lezen van JSON:", error);
    return {};
  }
}

function readTextSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf8").trim();
  } catch (error) {
    console.error("Fout bij lezen van tekstbestand:", error);
    return "";
  }
}

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFaqData() {
  const faqPath = path.join(CONTENT_DIR, "faq.json");
  return readJsonSafe(faqPath);
}

function getMarkdownFiles() {
  if (!fs.existsSync(CONTENT_DIR)) return [];

  return fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const fullPath = path.join(CONTENT_DIR, file);
      return {
        filename: file,
        slug: file.replace(".md", ""),
        content: readTextSafe(fullPath),
      };
    })
    .filter((file) => file.content);
}

function getAudioForSlug(slug) {
  const fullPath = path.join(AUDIO_DIR, `${slug}.m4a`);
  if (fs.existsSync(fullPath)) {
    return `/audio/${slug}.m4a`;
  }
  return null;
}

function findFaqAnswer(message, faqData) {
  const question = normalizeText(message);

  for (const key of Object.keys(faqData)) {
    const normalizedKey = normalizeText(key);

    if (question.includes(normalizedKey)) {
      const item = faqData[key];

      if (typeof item === "string") {
        return {
          answer: item,
          audio: null,
          source: "faq",
        };
      }

      return {
        answer: item.answer || "",
        audio: item.audio || null,
        source: "faq",
      };
    }
  }

  return null;
}

function splitIntoChunks(content) {
  return content
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function scoreChunk(question, chunk) {
  const qWords = normalizeText(question).split(" ").filter(Boolean);
  const normalizedChunk = normalizeText(chunk);

  let score = 0;

  for (const word of qWords) {
    if (word.length < 3) continue;
    if (normalizedChunk.includes(word)) {
      score += 1;
    }
  }

  return score;
}

function findMarkdownAnswer(message, markdownFiles, tab) {
  const tabToSlugMap = {
    bieden: ["opening", "antwoorden"],
    spel: [],
    verdediging: ["uitkomst"],
  };

  const preferredSlugs = tabToSlugMap[tab] || [];

  let candidates = markdownFiles;

  if (preferredSlugs.length > 0) {
    const filtered = markdownFiles.filter((file) =>
      preferredSlugs.includes(file.slug)
    );
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  let bestMatch = null;

  for (const file of candidates) {
    const chunks = splitIntoChunks(file.content);

    for (const chunk of chunks) {
      const score = scoreChunk(message, chunk);

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          score,
          answer: chunk,
          slug: file.slug,
          source: "markdown",
        };
      }
    }
  }

  if (!bestMatch || bestMatch.score < 2) {
    return null;
  }

  return {
    answer: bestMatch.answer,
    audio: getAudioForSlug(bestMatch.slug),
    source: "markdown",
  };
}

function buildKnowledgeContext(markdownFiles, tab) {
  const tabToSlugMap = {
    bieden: ["opening", "antwoorden"],
    spel: [],
    verdediging: ["uitkomst"],
  };

  const preferredSlugs = tabToSlugMap[tab] || [];

  let files = markdownFiles;

  if (preferredSlugs.length > 0) {
    const filtered = markdownFiles.filter((file) =>
      preferredSlugs.includes(file.slug)
    );
    if (filtered.length > 0) {
      files = filtered;
    }
  }

  return files
    .map((file) => `BESTAND: ${file.filename}\n${file.content}`)
    .join("\n\n--------------------\n\n");
}

function getFallbackAudioByTab(tab) {
  if (tab === "bieden") return getAudioForSlug("opening");
  if (tab === "verdediging") return getAudioForSlug("uitkomst");
  return null;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const message = body?.message || "";
    const tab = body?.tab || "bieden";

    if (!message.trim()) {
      return Response.json(
        { error: "Geen vraag ontvangen." },
        { status: 400 }
      );
    }

    const faqData = getFaqData();
    const markdownFiles = getMarkdownFiles();

    // 1. Eerst FAQ
    const faqMatch = findFaqAnswer(message, faqData);
    if (faqMatch) {
      return Response.json({
        answer: faqMatch.answer,
        audio: faqMatch.audio,
        source: faqMatch.source,
      });
    }

    // 2. Daarna zoeken in markdown
    const markdownMatch = findMarkdownAnswer(message, markdownFiles, tab);
    if (markdownMatch) {
      return Response.json({
        answer: markdownMatch.answer,
        audio: markdownMatch.audio,
        source: markdownMatch.source,
      });
    }

    // 3. Alleen dan OpenAI
    const knowledgeContext = buildKnowledgeContext(markdownFiles, tab);

    const systemPrompt = `
Jij bent Bridgecoach, een rustige en duidelijke bridgecoach voor beginners.

Regels:
- Antwoord altijd in het Nederlands.
- Gebruik B1-taal.
- Geef korte, duidelijke en vriendelijke uitleg.
- Gebruik waar passend deze opmaak:
  - korte introzin
  - duidelijke kopjes met ##
  - korte alinea's
  - opsommingstekens met -
  - klein voorbeeld als dat helpt
  - afsluiten met ## Samengevat
- Blijf bij bridge.
- Geef geen onnodig ingewikkelde theorie.
- Gebruik eerst de meegeleverde kennis.
- Als iets niet zeker is, zeg dat eerlijk.
- Houd de stijl rustig en didactisch.

De gebruiker zit in tabblad: ${tab}
`;

    const userPrompt = `
Gebruik deze bridgekennis als belangrijkste bron:

${knowledgeContext}

Vraag van de gebruiker:
${message}

Geef een kort en duidelijk antwoord in de stijl van Bridgecoach.
`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const answer =
      response.output_text || "Er ging iets mis. Probeer het opnieuw.";

    return Response.json({
      answer,
      audio: getFallbackAudioByTab(tab),
      source: "openai",
    });
  } catch (error) {
    console.error("API /api/chat error:", error);

    return Response.json(
      { error: "Er ging iets mis. Probeer het opnieuw." },
      { status: 500 }
    );
  }
}