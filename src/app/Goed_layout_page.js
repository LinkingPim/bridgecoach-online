"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

function renderSuits(text) {
  const parts = text.split(/(♠|♥|♦|♣)/g);
  return parts.map((p, i) => {
    if (p === "♥") return <span key={i} className="suit suit-h">♥</span>;
    if (p === "♦") return <span key={i} className="suit suit-d">♦</span>;
    if (p === "♠") return <span key={i} className="suit suit-s">♠</span>;
    if (p === "♣") return <span key={i} className="suit suit-c">♣</span>;
    return <span key={i}>{p}</span>;
  });
}

export default function Home() {
  const [mode, setMode] = useState("bieden");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hoi! Ik ben jouw Bridgecoach. Waar wil je hulp bij?" },
  ]);
  const [loading, setLoading] = useState(false);
  const [showAudio, setShowAudio] = useState(true);

  const boxRef = useRef(null);
  const audioRef = useRef(null);

  const AUDIO = {
    bieden: {
      title: "Basis van openingsbiedingen (1:12)",
      src: "/audio/bieden-intro.m4a",
    },
    spel: {
      title: "Speelplan maken (1:05)",
      src: "/audio/spel-intro.m4a",
    },
    verdediging: {
      title: "Goed uitkomen en signaleren (1:18)",
      src: "/audio/verdediging-intro.m4a",
    },
  };

  const audio = AUDIO[mode];

  useEffect(() => {
    boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    // Stop audio als gebruiker iets vraagt
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          mode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");

      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Er ging iets mis. Probeer het opnieuw." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <section className="card">
        <div className="header">
          <div className="logoWrap">
            <Image
              src="/bridgecoach-logo.png"
              alt="Bridgecoach"
              width={44}
              height={44}
            />
          </div>
          <div>
            <h1 className="title">BRIDGECOACH</h1>
            <p className="subtitle">Kort en duidelijk bridge-advies</p>
          </div>
        </div>

        {/* TABS */}
        <div className="tabs">
          <button
            className={`tab ${mode === "bieden" ? "active" : ""}`}
            onClick={() => {
              setMode("bieden");
              setShowAudio(true);
            }}
          >
            Bieden
          </button>

          <button
            className={`tab ${mode === "spel" ? "active" : ""}`}
            onClick={() => {
              setMode("spel");
              setShowAudio(true);
            }}
          >
            Spel
          </button>

          <button
            className={`tab ${mode === "verdediging" ? "active" : ""}`}
            onClick={() => {
              setMode("verdediging");
              setShowAudio(true);
            }}
          >
            Verdediging
          </button>
        </div>

        {/* AUDIO BLOK */}
        {audio && showAudio && (
          <div className="audioCard">
            <div className="audioHead">
              <div className="audioTitle">
                🎧 Luistertip: <b>{audio.title}</b>
              </div>
              <button
                className="audioHideBtn"
                type="button"
                onClick={() => setShowAudio(false)}
              >
                Verbergen
              </button>
            </div>

            <audio
              ref={audioRef}
              className="audioPlayer"
              controls
              preload="none"
              src={audio.src}
            />
          </div>
        )}

        {audio && !showAudio && (
          <button
            className="audioShowBtn"
            type="button"
            onClick={() => setShowAudio(true)}
          >
            🎧 Toon luistertip
          </button>
        )}

        {/* CHAT */}
        <div ref={boxRef} className="chatBox">
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div key={i} className="row">
                <div className={`bubble ${isUser ? "bubbleUser" : "bubbleAi"}`}>
                  <div className="name">
                    {isUser ? "Jij" : "Bridgecoach"}
                  </div>
                  {renderSuits(m.content)}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="row">
              <div className="bubble bubbleAi">
                <div className="name">Bridgecoach</div>
                <div className="typingDots">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* INPUT */}
        <div className="inputBar">
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Bijv: Partner opent 1SA, ik heb 8 punten…"
          />
          <button
            className="button"
            onClick={sendMessage}
            disabled={loading}
          >
            {loading ? "…" : "SEND"}
          </button>
        </div>
      </section>

      <footer className="footer">
        Bridgecoach · beta · kort en duidelijk bridge-advies
      </footer>
    </main>
  );
}
