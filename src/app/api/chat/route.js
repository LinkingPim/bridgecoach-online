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
      return { filename: file, slug: file.replace(".md", ""), content: readTextSafe(fullPath) };
    })
    .filter((file) => file.content);
}

function getAudioForSlug(slug) {
  const fullPath = path.join(AUDIO_DIR, `${slug}.m4a`);
  if (fs.existsSync(fullPath)) return `/audio/${slug}.m4a`;
  return null;
}

function getFallbackAudioByTab(tab) {
  if (tab === "bieden") return getAudioForSlug("opening");
  if (tab === "verdediging") return getAudioForSlug("uitkomst");
  return null;
}

function findFaqAnswer(message, faqData) {
  const question = normalizeText(message);
  const tabKeys = ["opening", "bijbod", "uitkomst"];

  for (const key of Object.keys(faqData)) {
    if (tabKeys.includes(key)) continue;
    const normalizedKey = normalizeText(key);
    if (question.includes(normalizedKey)) {
      const item = faqData[key];
      if (!item || (typeof item !== "string" && !item.answer)) continue;
      if (typeof item === "string") return { answer: item, audio: null, source: "faq" };
      return { answer: item.answer || "", audio: item.audio || null, source: "faq" };
    }
  }
  return null;
}

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
    const filtered = markdownFiles.filter((file) => preferredSlugs.includes(file.slug));
    if (filtered.length > 0) files = filtered;
  }

  return files.map((file) => `BESTAND: ${file.filename}\n${file.content}`).join("\n\n--------------------\n\n");
}

export async function POST(req) {
  try {
    const body = await req.json();
    const message = body?.message || "";
    const tab = body?.tab || "bieden";
    const history = body?.history || [];

    if (!message.trim()) {
      return Response.json({ error: "Geen vraag ontvangen." }, { status: 400 });
    }

    const faqData = getFaqData();
    const markdownFiles = getMarkdownFiles();

    const faqMatch = findFaqAnswer(message, faqData);
    if (faqMatch) {
      return Response.json({ answer: faqMatch.answer, audio: faqMatch.audio, source: faqMatch.source });
    }

    const knowledgeContext = buildKnowledgeContext(markdownFiles, tab);
    const isFirstQuestion = history.length === 0;

    const systemPrompt = `
Je bent BridgeCoach, een vriendelijke en deskundige Nederlandse bridge coach.
Je begeleidt beginners en gemiddelde spelers op een heldere, stapsgewijze manier.

## Persoonlijkheid en toon
- Warm, aanmoedigend en geduldig
${isFirstQuestion ? '- Begin je antwoord met een korte motiverende zin zoals "Goed dat je dit wilt leren 👍"' : '- Begin direct met je antwoord, zonder begroeting of motiverende openingszin'}
- Gebruik "je" en "jij", geen formeel "u"

## Eerlijkheid over kennis
- Gebruik ALLEEN de meegeleverde bridgekennis als bron
- Als een onderwerp NIET in de kennisbron staat, zeg dan: "Dit onderwerp heb ik nog niet in mijn kennisbank. Vraag dit aan je bridgedocent of kijk in je lesboek."
- Verzin NOOIT informatie die niet in de kennisbron staat

## Doorvragen
- Doe NOOIT aannames over de hand van de gebruiker
- Als informatie ontbreekt (punten, verdeling, kleuren), stel dan eerst één gerichte vraag
- Geef pas advies als je voldoende weet
- Stel maximaal één vraag tegelijk

## Taalgebruik
- Altijd in het Nederlands
- Kaartwaarden: A (Aas), H (Heer), V (Vrouw), B (Boer)
- Schrijf kaartsymbolen altijd met emoji: ♠️ ♥️ ♦️ ♣️

## Antwoordstructuur
1. Korte intro
2. Stappen met 1️⃣ 2️⃣ 3️⃣
3. Voorbeeldhand (zie regels hieronder)
4. Aanbevolen bieding: ➡️ 1♠️
5. Korte uitleg met opsommingstekens
6. Samenvatting (zie regels hieronder)
7. Één uitdagende quizvraag 🃏

## Voorbeeldhanden — STRIKT VOLGEN

REGEL 1: Een hand bevat ALTIJD precies 13 kaarten. Tel ze na voordat je antwoordt.
REGEL 2: De hand moet kloppen met wat je beweert.
REGEL 3: Gebruik NOOIT het label "Hand:" voor een hand.
REGEL 4: Gebruik altijd dit vaste formaat:
♠️ x x x
❤️ x x x x x x
♦️ x x
♣️ x x

FOUT:
Hand:
• ♠️ A V 10 9 8 7   ← slechts 6 schoppen, maar je beweert 7
• ❤️ 4 3
• ♦️ 2
• ♣️ 3             ← totaal 12 kaarten

GOED:
♠️ A V 10 9 8 7 2
❤️ 4 3
♦️ 8 5
♣️ 6 4            ← precies 13 kaarten, 7 schoppen

## Samenvatting — STRIKT VOLGEN

REGEL: De ✅ samenvatting bevat NOOIT een herhaling van wat al in de stappen staat.

FOUT:
✅ Samenvatting:
• 6-10 punten          ← al gezegd
• Minimaal 7 kaarten   ← al gezegd

GOED:
✅ Onthoud: Controleer altijd de kwetsbaarheid voor je preëmptief biedt.

Of: laat de samenvatting helemaal weg als er niets nieuws te zeggen is.

## Quizvraag
FOUT: "Hoeveel kaarten heb je minimaal nodig?" ← antwoord staat al in de uitleg
GOED: "Je hebt ♠️ A V 10 9 8 7 2, ❤️ 4 3, ♦️ 8 5, ♣️ 6 4 en bent kwetsbaar. Wat open je?"

## Opmaakregels
- Gebruik emoji voor structuur: ✅ 1️⃣ 2️⃣ 3️⃣ ➡️ ⚠️ 🃏
- Gebruik ALLEEN 🃏 voor de quizvraag
- Horizontale lijnen (---) tussen secties
- Gebruik GEEN ## of ### koppen
- Gebruik GEEN **bold** in opsommingstekens
- Gebruik GEEN markdown-tabellen
- Biedverloop als tekst: West pas — Noord 2❤️ — Oost pas — Zuid ?

## Tabbladen
De app heeft drie tabbladen: Opening, Bijbod en Uitkomst.
De gebruiker zit nu in tabblad: ${tab}
Als een vraag beter past bij een ander tabblad: beantwoord kort en voeg toe:
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
            model: "gpt-4o",
            messages,
            max_tokens: 800,
            stream: true,
          });

          for await (const chunk of openaiStream) {
            const text = chunk.choices?.[0]?.delta?.content || "";
            if (text) controller.enqueue(encoder.encode(text));
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
    return Response.json({ error: "Er ging iets mis. Probeer het opnieuw." }, { status: 500 });
  }
}
