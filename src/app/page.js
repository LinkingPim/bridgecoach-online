"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

function renderSuits(text) {
  const parts = String(text).split(/(♠|♥|♦|♣)/g);
  return parts.map((p, i) => {
    if (p === "♥") return <span key={i} className="suit-h">♥</span>;
    if (p === "♦") return <span key={i} className="suit-d">♦</span>;
    if (p === "♠") return <span key={i} className="suit-s">♠</span>;
    if (p === "♣") return <span key={i} className="suit-c">♣</span>;
    return <span key={i}>{p}</span>;
  });
}

const AUDIO_BY_MODE = {
  bieden: "/audio/bieden-1.m4a",
  spel: "/audio/spel-1.m4a",
  verdediging: "/audio/verdediging-1.m4a",
};

export default function Home() {
  const [mode, setMode] = useState("bieden");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hoi! Ik ben jouw Bridgecoach. Waar wil je hulp bij?" },
  ]);
  const [loading, setLoading] = useState(false);

  const boxRef = useRef(null);

  // audio
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  // autoscroll
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.scrollTo(0, box.scrollHeight);
  }, [messages, loading]);

  function stopAudio() {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setPlaying(false);
  }

  // bij tab wisselen: stop + laad nieuwe source
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    a.load();
    setPlaying(false);
  }, [mode]);

  function changeMode(nextMode) {
    stopAudio();
    setMode(nextMode);
  }

  async function toggleAudio() {
    const a = audioRef.current;
    if (!a) return;

    if (a.paused) {
      try {
        await a.play();
        setPlaying(true);
      } catch (err) {
        setPlaying(false);
        console.log("Audio kon niet starten:", err);
      }
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, mode }),
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
        {/* HEADER */}
        <div className="header">
          <div className="logoWrap">
            <Image
              src="/bridgecoach-logo.png"
              alt="Bridgecoach"
              width={44}
              height={44}
              priority
            />
          </div>
          <div>
            <h1 className="title">BRIDGECOACH</h1>
            <p className="subtitle">Kort en duidelijk bridge-advies</p>
          </div>
        </div>

        {/* TABS + AUDIO */}
        <div className="tabsRow">
          <div className="tabs">
            <button
              type="button"
              className={`tab ${mode === "bieden" ? "active" : ""}`}
              onClick={() => changeMode("bieden")}
            >
              Bieden
            </button>

            <button
              type="button"
              className={`tab ${mode === "spel" ? "active" : ""}`}
              onClick={() => changeMode("spel")}
            >
              Spel
            </button>

            <button
              type="button"
              className={`tab ${mode === "verdediging" ? "active" : ""}`}
              onClick={() => changeMode("verdediging")}
            >
              Verdediging
            </button>
          </div>

          <button
            type="button"
            className={`audioBtn ${playing ? "on" : ""}`}
            onClick={toggleAudio}
            aria-label={playing ? "Pauze" : "Luister"}
            title={playing ? "Pauze" : "Luister"}
          >
            {playing ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
) : (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
    <path d="M12 3a9 9 0 0 0-9 9v4a3 3 0 0 0 3 3h2v-8H6a6 6 0 0 1 12 0h-2v8h2a3 3 0 0 0 3-3v-4a9 9 0 0 0-9-9z"/>
  </svg>
)}
          </button>

          <audio
            ref={audioRef}
            onEnded={() => setPlaying(false)}
            preload="none"
          >
            <source src={AUDIO_BY_MODE[mode]} />
            Je browser ondersteunt geen audio.
          </audio>
        </div>

        {/* CHAT */}
        <div ref={boxRef} className="chatBox">
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div key={i} className="row">
                <div className={`bubble ${isUser ? "bubbleUser" : "bubbleAi"}`}>
                  <div className="name">{isUser ? "Jij" : "Bridgecoach"}</div>
                  {renderSuits(m.content)}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="row">
              <div className="bubble bubbleAi">
                <div className="name">Bridgecoach</div>
                <div className="typingDots" aria-label="Bridgecoach is aan het typen">
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
            disabled={loading}
          />

          <button className="button" onClick={sendMessage} disabled={loading}>
            {loading ? "…" : "Verstuur"}
          </button>
        </div>
      </section>

      <footer className="footer">Bridgecoach · beta · kort en duidelijk bridge-advies</footer>
    </main>
  );
}