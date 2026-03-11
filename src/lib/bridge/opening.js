// src/lib/bridge/opening.js

// Ondersteunt NL kaarten: A, H (Koning), V (Vrouw), B (Boer), T (10)
// Ondersteunt ook ENG: A, K, Q, J, T
const HCP = {
  A: 4,
  K: 3,
  H: 3, // Koning (NL)
  Q: 2,
  V: 2, // Vrouw (NL)
  J: 1,
  B: 1, // Boer (NL)
};

function normalizeRanks(str) {
  return (str || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/10/g, "T"); // 10 → T
}

// Probeert kaarten te vinden in een suit-regel, bv "♠ HV985" of "S: HV985"
function extractSuit(line, suitKeys) {
  const upper = line.toUpperCase();

  // Zoek naar suit-symbool of letter
  const hasSuit = suitKeys.some((k) => upper.includes(k));
  if (!hasSuit) return null;

  // Haal alles na : of na het suit-symbool/letter
  let part = upper;

  if (part.includes(":")) part = part.split(":").slice(1).join(":");

  // Verwijder suit-tekens
  suitKeys.forEach((k) => (part = part.replaceAll(k, "")));

  // Laat alleen kaarttekens over
  part = part.replace(/[^AKQJHVB T98765432]/g, "");
  part = normalizeRanks(part);

  return part;
}

// Parse hand uit een tekst (hele chat-invoer)
export function parseHandFromText(text) {
  const lines = (text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Keys per kleur
  const spadeKeys = ["♠", "S", "SPADES"];
  const heartKeys = ["♥", "H", "HEARTS"];
  const diamondKeys = ["♦", "D", "DIAMONDS"];
  const clubKeys = ["♣", "C", "CLUBS"];

  let S = "";
  let H = "";
  let D = "";
  let C = "";

  for (const line of lines) {
    const s = extractSuit(line, spadeKeys);
    const h = extractSuit(line, heartKeys);
    const d = extractSuit(line, diamondKeys);
    const c = extractSuit(line, clubKeys);

    if (s !== null) S = s;
    if (h !== null) H = h;
    if (d !== null) D = d;
    if (c !== null) C = c;
  }

  // Alleen geldig als we minstens 3 kleuren gevonden hebben (meestal 4)
  const countFound = [S, H, D, C].filter((x) => x && x.length > 0).length;
  if (countFound < 3) return null;

  return { S, H, D, C };
}

export function countHCP(hand) {
  const all = `${hand.S}${hand.H}${hand.D}${hand.C}`;
  let points = 0;
  for (const ch of all) points += HCP[ch] || 0;
  return points;
}

export function shape(hand) {
  return {
    S: hand.S.length,
    H: hand.H.length,
    D: hand.D.length,
    C: hand.C.length,
  };
}

export function isBalanced(sh) {
  const arr = [sh.S, sh.H, sh.D, sh.C].sort((a, b) => b - a); // groot → klein

  // 4-3-3-3
  if (arr.join("-") === "4-3-3-3") return true;
  // 4-4-3-2
  if (arr.join("-") === "4-4-3-2") return true;
  // 5-3-3-2
  if (arr.join("-") === "5-3-3-2") return true;

  return false;
}

// Jouw schema: opening kiezen + uitleg
export function openingAdviceFromHand(hand) {
  const pts = countHCP(hand);
  const sh = shape(hand);
  const balanced = isBalanced(sh);

  // Stap 1
  if (pts <= 11) {
    return {
      opening: "Pas",
      uitleg: `Je hebt ${pts} punten. Bij 0–11 punten: pas.`,
      punten: pts,
      verdeling: sh,
      evenwichtig: balanced,
    };
  }

  // Stap 5 (zeer sterk) - volgens jouw schema
  if (pts >= 22) {
    return {
      opening: "2♣",
      uitleg: `Je hebt ${pts} punten. Bij ±22+ punten: 2♣ (sterk).`,
      punten: pts,
      verdeling: sh,
      evenwichtig: balanced,
    };
  }

  // Stap 4 (1SA check) - in jouw schema vóór kleuren
  if (pts >= 15 && pts <= 17 && balanced) {
    return {
      opening: "1SA",
      uitleg: `Je hebt ${pts} punten en een evenwichtige verdeling (${sh.S}-${sh.H}-${sh.D}-${sh.C}). Dan is 1SA beter.`,
      punten: pts,
      verdeling: sh,
      evenwichtig: balanced,
    };
  }

  // Stap 2: 5-kaart hoog
  if (sh.H >= 5) {
    return {
      opening: "1♥",
      uitleg: `Je hebt ${pts} punten en ${sh.H} harten. Bij 5+ ♥ open je 1♥.`,
      punten: pts,
      verdeling: sh,
      evenwichtig: balanced,
    };
  }
  if (sh.S >= 5) {
    return {
      opening: "1♠",
      uitleg: `Je hebt ${pts} punten en ${sh.S} schoppen. Bij 5+ ♠ open je 1♠.`,
      punten: pts,
      verdeling: sh,
      evenwichtig: balanced,
    };
  }

  // Stap 3: lage kleur
  if (sh.D >= 4) {
    return {
      opening: "1♦",
      uitleg: `Je hebt ${pts} punten en geen 5-kaart hoog. Met ${sh.D} ruiten (4+): open 1♦.`,
      punten: pts,
      verdeling: sh,
      evenwichtig: balanced,
    };
  }

  return {
    opening: "1♣",
    uitleg: `Je hebt ${pts} punten en geen 5-kaart hoog. Geen 4+ ♦, dus open 1♣.`,
    punten: pts,
    verdeling: sh,
    evenwichtig: balanced,
  };
}