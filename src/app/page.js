export default function Home() {
  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Bridgecoach Online</h1>

      <h2>Podcast – Bieden les 1</h2>
      <audio controls preload="none" src="/Audio/bieden-1.m4a" />

      <h2>Instructies</h2>
      <p>
        Welkom bij Bridgecoach. In deze les leer je de basis van het bieden.
        Luister eerst naar de podcast en oefen daarna in de chat.
      </p>
    </main>
  );
}