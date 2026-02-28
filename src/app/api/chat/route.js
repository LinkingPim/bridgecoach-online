import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, mode } = await req.json();

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `You are Bridgecoach.
Mode: ${mode || "bieden"}.

Rules:
- Use suit symbols ♠ ♥ ♦ ♣ (not words).
- Be concise (max 6–8 sentences).
- Ask 1 short clarifying question if needed.

Mode guidance:
- bieden: focus on bidding, conventions, points, shape, next bid.
- spel: focus on declarer play, plan, entries, safety.
- verdediging: focus on opening lead, signals, counting, defense plan.
`,
        },
        ...messages,
      ],
      max_output_tokens: 300,
    });

    return Response.json({ reply: response.output_text });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "Er ging iets mis met Bridgecoach." },
      { status: 500 }
    );
  }
}
