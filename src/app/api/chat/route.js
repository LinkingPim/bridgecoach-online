import fs from "fs";
import path from "path";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CONTENT_DIR = path.join(process.cwd(), "public", "content");
const AUDIO_DIR = path.join(process.cwd(), "public", "audio");

// ─── Hulpfuncties ────────────────────────────────────────────────────────────

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

// ─── Data ophalen ────────────────────────────────────────────────────────────

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

function getFallbackAudioByTab(tab) {
  if (tab === "bieden") return getAudioForSlug("opening");
  if (tab === "verdediging") return getAudioForSlug("uitkomst");
  return null;
}

// ─── FAQ match ───────────────────────────────────────────────────────────────

function findFaqAnswer(message, faqData) {
  const question = normalizeText(message);

  const tabKeys = ["opening", "bijbod", "uitkomst"];

  for (const key of Object.keys(faqData)) {
    if (tabKeys.includes(key)) continue;

    const normalizedKey = normalizeText(key);

    if (question.includes(normalizedKey)) {
      const item = faqData[key];

      if (!item || (typeof item !== "string" && !item.answer)) continue;

      if (typeof item === "string") {
        return { answer: item, audio: null, source: "faq" };
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

// ─── Markdown als context voor OpenAI ────────────────────────────────────────

function buildKnowledgeContext(markdownFiles, tab) {
  const tabToSlugMap = {
    bieden: ["opening", "antwoorden"],
    opening: ["opening", "antwoorden", "preemptief"],
    bijbod: ["antwoorden", "preemptief"],
    uitkomst: ["uitkomst"],
    spel: [],
    verdediging: ["uitkomst"],
  };

  const preferredSlugs = tabToSlugMap[tab] || [];
  let files = markdownFiles;

  if (preferredSlugs.length > 0) {
    const filtered = markdownFiles.filter((file) =>
      preferredSlugs.includes(file.slug)
    );
    if (filtered.length > 0) files = filtered;
  }

  return files
    .map((file) => `BESTAND: ${file.filename}\n${file.content}`)
    .join("\n\n--------------------\n\n");
}

// ─── API route ───────────────────────────────────────────────────────────────

export async function POST(req) {
  try {
    const body = await req.json();
    const message = body?.message || "";
    const tab = body?.tab || "bieden";
    const history = body?.history || [];

    if (!message.trim()) {
      return Response.json(
        { error: "Geen vraag ontvangen." },
        { status: 400 }
      );
    }

    const faqData = getFaqData();
    const markdownFiles = getMarkdownFiles();

    // 1. Eerst FAQ checken
    const faqMatch = findFaqAnswer(message, faqData);
    if (faqMatch) {
      return Response.json({
        answer: faqMatch.answer,
        audio: faqMatch.audio,
        source: faqMatch.source,
      });
    }

    // 2. OpenAI met streaming
    const knowledgeContext = buildKnowledgeContext(markdownFiles, tab);
    const isFirstQuestion = history.length === 0;

    const systemPrompt = `
Je bent BridgeCoach, een vriendelijke en deskundige Nederlandse bridge coach.
Je begeleidt beginners en gemiddelde spelers op een heldere, stapsgewijze manier.

## Persoonlijkheid en toon
- Warm, aanmoedigend en geduldig
${isFirstQuestion ? '- Begin je antwoord met een korte motiverende zin zoals "Goed dat je dit wilt leren 👍"' : '- Begin direct met je antwoord, zonder begroeting of motiverende openingszin'}
- Stel na je uitleg één quizvraag die de speler uitdaagt een situatie toe te passen — niet een vraag waarvan het antwoord al in de uitleg staat
- Gebruik "je" en "jij", geen formeel "u"

## Eerlijkheid over kennis
- Gebruik ALLEEN de meegeleverde bridgekennis als bron
- Als een onderwerp NIET in de kennisbron staat, zeg dan eerlijk: "Dit onderwerp heb ik nog niet in mijn kennisbank. Vraag dit aan je bridgedocent of kijk in je lesboek."
- Verzin NOOIT informatie die niet in de kennisbron staat
- Spreek jezelf nooit tegen — als je iets niet zeker weet, zeg dat dan

## Doorvragen
- Doe NOOIT aannames over de hand van de gebruiker
- Als je niet genoeg informatie hebt om goed advies te geven, stel dan eerst één gerichte vraag
- Ontbrekende informatie die je kunt opvragen: punten, kaartverdeling, specifieke kleuren, aantal kaarten per kleur
- Geef pas concreet advies als je voldoende weet
- Stel maximaal één vraag tegelijk

## Taalgebruik
- Altijd in het Nederlands
- Kaartwaarden: A (Aas), H (Heer), V (Vrouw), B (Boer)
- Termen: steun, stop, doublet, informatiedoublet, manche, deelscore, fit, volgbod, uitkomen, slag, troef, bieding, pas
- Schrijf kaartsymbolen altijd met emoji: ♠️ ♥️ ♦️ ♣️

## Antwoordstructuur
Gebruik altijd deze opbouw:
1. Korte intro — leg uit wat het concept is en waarom het belangrijk is
2. Stappen of categorieën — gebruik 1️⃣ 2️⃣ 3️⃣ voor hoofdopties
3. Concrete voorbeeldhand (zie regels hieronder)
4. Aanbevolen bieding met pijl: ➡️ 1♠️
5. Korte uitleg van de bieding met opsommingstekens
6. Samenvatting als ✅ blok — zie regels hieronder
7. Sluit af met één uitdagende quizvraag 🃏

## Samenvatting
- De ✅ samenvatting bevat NOOIT een herhaling van wat al in de stappen staat
- Gebruik de samenvatting alleen voor:
  - Een vuistregel of ezelsbruggetje
  - Een waarschuwing of uitzondering
  - Iets wat de speler moet onthouden dat nog niet eerder gezegd is
- Als er niets nieuws te zeggen is, laat de samenvatting dan weg

## Voorbeeldhanden
- Toon een voorbeeldhand altijd in dit vaste formaat, zonder label:
  ♠️ x x x
  ❤️ x x x x x x
  ♦️ x x
  ♣️ x x
- Controleer ALTIJD of de hand precies 13 kaarten bevat
- Controleer ALTIJD of de hand klopt met wat je beweert — als je zegt "6 kaarten in ♥️" dan moet de hand ook echt 6 hartjes bevatten
- Gebruik NOOIT het label "Hand:" voor een hand

## Vermijd herhaling
- Noem elk punt maar één keer
- Houd het antwoord compact — liever te kort dan te lang

## Opmaakregels
- Gebruik emoji voor structuur: ✅ 1️⃣ 2️⃣ 3️⃣ ➡️ ⚠️
- Horizontale lijnen (---) tussen secties
- Gebruik GEEN markdown-koppen zoals ## of ###
- Gebruik GEEN vetgedrukte tekst (**bold**) in opsommingstekens — alleen bij de aanbevolen bieding
- Gebruik GEEN markdown-tabellen — schrijf biedverlopen als gewone tekst
- Korte, scanbare zinnen

## Biedverloop als tekst
Schrijf een biedverloop altijd zo:
West pas — Noord 2❤️ — Oost pas — Zuid ?

## Tabbladen
De app heeft drie tabbladen: Opening, Bijbod en Uitkomst.
De gebruiker zit nu in tabblad: ${tab}
Als de gebruiker een vraag stelt die beter past bij een ander tabblad, beantwoord de vraag dan kort en voeg toe:
"💡 Voor meer uitleg hierover kun je ook het tabblad [naam] gebruiken."

## Biedconventies
- Standaard Nederlands clubsysteem
- Punten: A=4, H=3, V=2, B=1

## Grenzen
- Alleen bridge-vragen beantwoorden
- Niet te technisch voor beginners

Gebruik deze bridgekennis als belangrijkste bron:
${knowledgeContext}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message },
    ];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const openaiStream = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            max_tokens: 800,
            stream: true,
          });

          for await (const chunk of openaiStream) {
            const text = chunk.choices?.[0]?.delta?.content || "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }

          controller.close();
        } catch (error) {
          console.error("Streaming fout:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Audio": getFallbackAudioByTab(tab) || "",
      },
    });
  } catch (error) {
    console.error("API /api/chat error:", error);

    return Response.json(
      { error: "Er ging iets mis. Probeer het opnieuw." },
      { status: 500 }
    );
  }
}
