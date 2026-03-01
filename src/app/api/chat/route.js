import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    // 1) Input lezen
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const mode = body?.mode || "bieden";

    // 2) Simpele guard
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY ontbreekt in .env.local" },
        { status: 500 }
      );
    }

    // 3) Systeemtekst
    const systemText = `You are Bridgecoach.
Mode: ${mode}.

Rules:
- Use suit symbols ♠ ♥ ♦ ♣ (not words).
- Be concise (max 6–8 sentences).
- Ask 1 short clarifying question if needed.

Mode guidance:
- bieden: focus on bidding, conventions, points, shape, next bid.
- spel: focus on declarer play, plan, entries, safety.
- verdediging: focus on opening lead, signals, counting, defense plan.`;

    // 4) Call OpenAI Responses API
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemText },
        ...messages,
      ],
      max_output_tokens: 300,
    });

    // 5) Antwoord terug
    return NextResponse.json({ reply: response.output_text || "" });
  } catch (err) {
    console.error("API /api/chat error:", err);
    return NextResponse.json(
      { error: "Er ging iets mis met Bridgecoach." },
      { status: 500 }
    );
  }
}