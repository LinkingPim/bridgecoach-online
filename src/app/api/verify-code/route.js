export async function POST(req) {
  try {
    const body = await req.json();
    const { code } = body;

    const correct = process.env.ACCESS_CODE;

    if (!correct) {
      return Response.json({ success: false, error: "Geen toegangscode ingesteld." }, { status: 500 });
    }

    if (code === correct) {
      return Response.json({ success: true });
    }

    return Response.json({ success: false });
  } catch (error) {
    return Response.json({ success: false, error: "Er ging iets mis." }, { status: 500 });
  }
}
