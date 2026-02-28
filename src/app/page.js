export default function Home() {
  return (
    <main style={{ padding: "48px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ margin: 0, fontSize: "44px" }}>Bridgecoach Online</h1>

      <h2 style={{ marginTop: "8px", fontSize: "24px" }}>
        Podcast – Bieden les 1
      </h2>

      <div style={{ marginTop: "12px" }}>
        <audio controls preload="none" style={{ width: "360px" }}>
          <source src="/Audio/bieden-1.m4a" type="audio/mp4" />
          Je browser ondersteunt geen audio.
        </audio>
      </div>

      <h3 style={{ marginTop: "28px", fontSize: "22px" }}>Instructies</h3>

      <p style={{ maxWidth: "800px", fontSize: "16px", lineHeight: "1.5" }}>
        Welkom bij Bridgecoach. In deze les leer je de basis van het bieden.
        Luister eerst naar de podcast en oefen daarna in de chat.
      </p>
    </main>
  );
}