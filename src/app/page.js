export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        padding: "60px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          backgroundColor: "white",
          padding: "50px",
          borderRadius: "12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "42px" }}>
          Bridgecoach Online
        </h1>

        <h2 style={{ marginTop: "10px", fontSize: "22px", color: "#444" }}>
          Podcast – Bieden les 1
        </h2>

        <div style={{ marginTop: "20px" }}>
          <audio controls preload="none" style={{ width: "100%" }}>
            <source src="/Audio/bieden-1.m4a" type="audio/mp4" />
            Je browser ondersteunt geen audio.
          </audio>
        </div>

        <h3 style={{ marginTop: "40px", fontSize: "20px" }}>
          Instructies
        </h3>

        <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#333" }}>
          Welkom bij Bridgecoach. In deze les leer je de basis van het bieden.
          Luister eerst naar de podcast en oefen daarna in de chat.
        </p>
      </div>
    </main>
  );
}