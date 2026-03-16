"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [tab, setTab] = useState("opening");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hoi! Ik ben jouw Bridgecoach. Waar wil je hulp bij?",
      source: "system",
    },
  ]);

  const [history, setHistory] = useState([]);
  const [faqTree, setFaqTree] = useState(null);
  const [faqOptions, setFaqOptions] = useState(null);
  const [faqPath, setFaqPath] = useState([]);

  const chatEndRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, faqOptions]);

  async function ensureFaqLoaded() {
    if (faqTree) return faqTree;
    const res = await fetch("/content/faq.json");
    if (!res.ok) throw new Error("faq.json kon niet worden geladen.");
    const data = await res.json();
    setFaqTree(data);
    return data;
  }

  function getTopicAudio(tabName) {
    if (tabName === "opening") return "/audio/opening.m4a";
    if (tabName === "bijbod") return "/audio/antwoorden.m4a";
    if (tabName === "uitkomst") return "/audio/uitkomen.m4a";
    return null;
  }

  function getPlaceholder(tabName) {
    if (tabName === "opening") return "Bijv: Ik heb 13 punten en 5 harten, wat open ik?";
    if (tabName === "bijbod") return "Bijv: Partner opent 1SA, ik heb 8 punten...";
    if (tabName === "uitkomst") return "Bijv: Wat is een goede uitkomst tegen 3SA?";
    return "Stel je bridgevraag...";
  }

  function getIntro(tabName) {
    if (tabName === "opening") return "Hoi! Ik ben jouw Bridgecoach. Stel gerust een vraag over openingen.";
    if (tabName === "bijbod") return "Hoi! Ik ben jouw Bridgecoach. Stel gerust een vraag over bijbiedingen.";
    if (tabName === "uitkomst") return "Hoi! Ik ben jouw Bridgecoach. Stel gerust een vraag over uitkomsten.";
    return "Hoi! Ik ben jouw Bridgecoach. Waar wil je hulp bij?";
  }

  function stopAudio() {
    if (audioRef.current) audioRef.current.pause();
    setIsAudioPlaying(false);
  }

  function playTopicAudio() {
    const file = getTopicAudio(tab);
    if (!file) return;

    if (!audioRef.current) {
      const audio = new Audio(file);
      audio.addEventListener("ended", () => setIsAudioPlaying(false));
      audioRef.current = audio;
    }

    const currentAudio = audioRef.current;
    const wantedSrc = window.location.origin + file;

    if (currentAudio.src !== wantedSrc) {
      currentAudio.pause();
      const audio = new Audio(file);
      audio.addEventListener("ended", () => setIsAudioPlaying(false));
      audioRef.current = audio;
      audio.play()
        .then(() => setIsAudioPlaying(true))
        .catch((err) => { console.error("Audio fout:", err); setIsAudioPlaying(false); });
      return;
    }

    if (currentAudio.paused) {
      currentAudio.play()
        .then(() => setIsAudioPlaying(true))
        .catch((err) => { console.error("Audio fout:", err); setIsAudioPlaying(false); });
    } else {
      currentAudio.pause();
      setIsAudioPlaying(false);
    }
  }

  async function loadFaq() {
    try {
      setLoading(true);
      const data = await ensureFaqLoaded();
      const topicFaq = data?.[tab];
      if (!topicFaq || !topicFaq.options) throw new Error("Geen FAQ gevonden.");
      setFaqOptions(topicFaq.options);
      setFaqPath([]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Er ging iets mis bij het laden van de FAQ.", source: "error" }]);
    } finally {
      setLoading(false);
    }
  }

  function findNodeByPath(rootOptions, path) {
    let currentOptions = rootOptions;
    for (const step of path) {
      const found = currentOptions.find((item) => item.label === step);
      if (!found || !found.children) return currentOptions;
      currentOptions = found.children;
    }
    return currentOptions;
  }

  async function handleFaqChoice(option) {
    try {
      const data = await ensureFaqLoaded();
      const topicFaq = data?.[tab];
      if (!topicFaq || !topicFaq.options) return;

      if (option.children) {
        setFaqPath((prev) => [...prev, option.label]);
        setFaqOptions(option.children);
        return;
      }

      if (option.answer) {
        setMessages((prev) => [...prev, { role: "assistant", text: option.answer, source: "faq" }]);
        setFaqOptions(null);
        setFaqPath([]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Er ging iets mis bij de FAQ.", source: "error" }]);
    }
  }

  async function handleFaqBack() {
    try {
      const data = await ensureFaqLoaded();
      const topicFaq = data?.[tab];
      if (!topicFaq || !topicFaq.options) return;

      if (faqPath.length === 0) {
        setFaqOptions(topicFaq.options);
        return;
      }

      const newPath = faqPath.slice(0, -1);
      setFaqPath(newPath);
      setFaqOptions(findNodeByPath(topicFaq.options, newPath));
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Er ging iets mis bij teruggaan.", source: "error" }]);
    }
  }

  function resetFaq() {
    setFaqOptions(null);
    setFaqPath([]);
  }

  function switchTab(newTab) {
    stopAudio();
    resetFaq();
    setTab(newTab);
    setInput("");
    setHistory([]);
    setMessages([{ role: "assistant", text: getIntro(newTab), source: "system" }]);
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    resetFaq();
    setMessages((prev) => [...prev, { role: "user", text: trimmed, source: "user" }]);
    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "assistant", text: "", source: "openai", streaming: true }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, tab, history }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Er ging iets mis.");
      }

      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        const answerText = data.answer || "Ik kon geen antwoord maken.";

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            text: answerText,
            source: data.source || "faq",
            streaming: false,
          };
          return updated;
        });

        setHistory((prev) => [
          ...prev,
          { role: "user", content: trimmed },
          { role: "assistant", content: answerText },
        ]);
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          fullText += decoder.decode(value, { stream: true });

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              text: fullText,
              source: "openai",
              streaming: true,
            };
            return updated;
          });
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            streaming: false,
          };
          return updated;
        });

        setHistory((prev) => [
          ...prev,
          { role: "user", content: trimmed },
          { role: "assistant", content: fullText },
        ]);
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          text: "Er ging iets mis. Probeer het opnieuw.",
          source: "error",
          streaming: false,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Responsive styles via <style> tag */}
      <style>{`
        * { box-sizing: border-box; }
        .bc-page {
          min-height: 100vh;
          background: #f2f2f2;
          padding: 20px 12px;
          font-family: Inter, system-ui, Arial, sans-serif;
        }
        .bc-wrapper {
          max-width: 580px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 20px;
          padding: 20px 16px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.05);
        }
        .bc-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .bc-logo {
          width: 36px;
          height: 36px;
          object-fit: contain;
          flex-shrink: 0;
        }
        .bc-title {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.4px;
        }
        .bc-subtitle {
          margin: 2px 0 0 0;
          font-size: 12px;
          color: #6b7280;
        }
        .bc-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .bc-tab {
          flex: 1;
          min-width: 80px;
          padding: 10px 8px;
          border-radius: 999px;
          border: 1px solid #ddd;
          background: #eeeeee;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          white-space: nowrap;
        }
        .bc-tab-active {
          background: #f48c00;
          color: white;
          border-color: #f48c00;
        }
        .bc-topicrow {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .bc-audiobtn {
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid #ddd;
          background: #ffffff;
          padding: 8px 14px;
          font-size: 14px;
          cursor: pointer;
          white-space: nowrap;
        }
        .bc-faqbtn {
          border-radius: 999px;
          border: 1px solid #ddd;
          background: #ffffff;
          padding: 8px 14px;
          font-size: 14px;
          cursor: pointer;
        }
        .bc-faqpanel {
          margin-bottom: 12px;
        }
        .bc-faqoptions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .bc-faqoptionbtn {
          border-radius: 999px;
          border: 1px solid #ddd;
          background: #ffffff;
          padding: 6px 12px;
          font-size: 13px;
          cursor: pointer;
        }
        .bc-faqbackbtn {
          border-radius: 999px;
          border: 1px solid #ddd;
          background: #ffffff;
          padding: 6px 10px;
          font-size: 12px;
          margin-bottom: 8px;
          cursor: pointer;
        }
        .bc-chatbox {
          min-height: 300px;
          max-height: 400px;
          overflow-y: auto;
          background: #f7f7f7;
          border: 1px solid #d8d8d8;
          border-radius: 18px;
          padding: 12px;
        }
        .bc-messagerow {
          display: flex;
          margin-bottom: 12px;
        }
        .bc-bubble {
          max-width: 80%;
          border-radius: 14px;
          padding: 10px 12px;
        }
        .bc-assistant {
          background: #e9eaec;
        }
        .bc-user {
          background: #f3e2c8;
        }
        .bc-label {
          font-size: 11px;
          color: #6b7280;
          margin-bottom: 5px;
        }
        .bc-text {
          font-size: 15px;
          line-height: 1.5;
        }
        .bc-cursor {
          display: inline-block;
          color: #f48c00;
          font-weight: bold;
        }
        .bc-inputrow {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          align-items: flex-end;
        }
        .bc-input {
          flex: 1;
          border-radius: 20px;
          border: 1px solid #ddd;
          padding: 10px 14px;
          font-size: 14px;
          background: #ffffff;
          resize: none;
          font-family: inherit;
          min-width: 0;
        }
        .bc-sendbtn {
          border-radius: 999px;
          border: none;
          background: #f48c00;
          color: white;
          font-weight: 600;
          padding: 10px 16px;
          cursor: pointer;
          white-space: nowrap;
          font-size: 14px;
          flex-shrink: 0;
        }
        .bc-footer {
          text-align: center;
          margin-top: 16px;
          font-size: 11px;
          color: #9ca3af;
        }
        @media (max-width: 400px) {
          .bc-title { font-size: 17px; }
          .bc-tab { font-size: 14px; padding: 9px 6px; }
          .bc-text { font-size: 14px; }
          .bc-bubble { max-width: 90%; }
        }
      `}</style>

      <main className="bc-page">
        <div className="bc-wrapper">

          <div className="bc-header">
            <img src="/logo.png" alt="Bridgecoach logo" className="bc-logo" />
            <div>
              <h1 className="bc-title">BRIDGECOACH</h1>
              <p className="bc-subtitle">Kort en duidelijk bridge-advies</p>
            </div>
          </div>

          <div className="bc-tabs">
            <button
              className={`bc-tab${tab === "opening" ? " bc-tab-active" : ""}`}
              onClick={() => switchTab("opening")}
            >Opening</button>
            <button
              className={`bc-tab${tab === "bijbod" ? " bc-tab-active" : ""}`}
              onClick={() => switchTab("bijbod")}
            >Bijbod</button>
            <button
              className={`bc-tab${tab === "uitkomst" ? " bc-tab-active" : ""}`}
              onClick={() => switchTab("uitkomst")}
            >Uitkomst</button>
          </div>

          <div className="bc-topicrow">
            <button onClick={playTopicAudio} className="bc-audiobtn">
              {isAudioPlaying ? <PauseIcon size={16} /> : <HeadphoneIcon size={16} />}
              <span>{isAudioPlaying ? "Pauzeer" : "Luister uitleg"}</span>
            </button>
            <button onClick={loadFaq} className="bc-faqbtn">FAQ</button>
          </div>

          {faqOptions && (
            <div className="bc-faqpanel">
              {faqPath.length > 0 && (
                <button onClick={handleFaqBack} className="bc-faqbackbtn">← Terug</button>
              )}
              <div className="bc-faqoptions">
                {faqOptions.map((option, index) => (
                  <button key={index} onClick={() => handleFaqChoice(option)} className="bc-faqoptionbtn">
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bc-chatbox">
            {messages.map((msg, index) => (
              <div
                key={index}
                className="bc-messagerow"
                style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
              >
                <div className={`bc-bubble ${msg.role === "user" ? "bc-user" : "bc-assistant"}`}>
                  <div className="bc-label">{msg.role === "user" ? "Jij" : "Bridgecoach"}</div>
                  <div className="bc-text">
                    {msg.streaming && msg.text === ""
                      ? <span className="bc-cursor">Even denken...</span>
                      : renderMarkdown(msg.text)
                    }
                    {msg.streaming && msg.text !== "" && (
                      <span className="bc-cursor">▋</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="bc-inputrow">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder(tab)}
              className="bc-input"
              rows={1}
            />
            <button onClick={sendMessage} className="bc-sendbtn" disabled={loading}>
              Verstuur
            </button>
          </div>

          <div className="bc-footer">
            Bridgecoach · beta · bridgecoach@ziggo.nl · 2026
          </div>
        </div>
      </main>
    </>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text) {
  const parts = text.split(/(\*\*.*?\*\*|[♠♥♦♣])/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ fontWeight: "700" }}>{renderInline(part.slice(2, -2))}</strong>;
    }
    if (part === "♥" || part === "♦") {
      return <span key={i} style={{ color: "#e11d48", fontWeight: "600" }}>{part}</span>;
    }
    if (part === "♠" || part === "♣") {
      return <span key={i} style={{ color: "#111827", fontWeight: "600" }}>{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function isTableRow(line) {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isSeparatorRow(line) {
  return /^\|[\s\-|]+\|$/.test(line.trim());
}

function parseTableRows(lines, startIndex) {
  const rows = [];
  let i = startIndex;
  while (i < lines.length && isTableRow(lines[i])) {
    if (!isSeparatorRow(lines[i])) {
      const cells = lines[i].trim().slice(1, -1).split("|").map((c) => c.trim());
      rows.push(cells);
    }
    i++;
  }
  return { rows, endIndex: i };
}

function renderMarkdown(text) {
  const lines = text.split("\n");
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      result.push(<div key={i} style={{ height: "8px" }} />);
      i++; continue;
    }

    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      result.push(<hr key={i} style={{ border: "none", borderTop: "1px solid #d1d5db", margin: "8px 0" }} />);
      i++; continue;
    }

    if (isTableRow(trimmed)) {
      const { rows, endIndex } = parseTableRows(lines, i);
      result.push(
        <div key={i} style={{ overflowX: "auto", margin: "8px 0" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "13px", width: "100%" }}>
            <thead>
              <tr>{rows[0]?.map((cell, ci) => (
                <th key={ci} style={{ background: "#e5e7eb", padding: "6px 10px", textAlign: "left", fontWeight: "600", border: "1px solid #d1d5db" }}>{renderInline(cell)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => (
                  <td key={ci} style={{ padding: "5px 10px", border: "1px solid #d1d5db" }}>{renderInline(cell)}</td>
                ))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = endIndex; continue;
    }

    if (trimmed.startsWith("### ")) {
      result.push(<div key={i} style={{ fontSize: "15px", fontWeight: "700", margin: "6px 0 2px 0", color: "#374151" }}>{renderInline(trimmed.slice(4))}</div>);
      i++; continue;
    }

    if (trimmed.startsWith("## ")) {
      result.push(<div key={i} style={{ fontSize: "16px", fontWeight: "700", margin: "8px 0 4px 0" }}>{renderInline(trimmed.slice(3))}</div>);
      i++; continue;
    }

    if (trimmed.startsWith("# ")) {
      result.push(<div key={i} style={{ fontSize: "18px", fontWeight: "700", margin: "10px 0 4px 0" }}>{renderInline(trimmed.slice(2))}</div>);
      i++; continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      result.push(<div key={i} style={{ margin: "3px 0", paddingLeft: "4px" }}>• {renderInline(trimmed.slice(2))}</div>);
      i++; continue;
    }

    result.push(<div key={i} style={{ margin: "4px 0" }}>{renderInline(trimmed)}</div>);
    i++;
  }

  return result;
}

// ─── Subcomponenten ───────────────────────────────────────────────────────────

function HeadphoneIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12a8 8 0 0 1 16 0" />
      <rect x="2" y="12" width="4" height="7" rx="2" />
      <rect x="18" y="12" width="4" height="7" rx="2" />
    </svg>
  );
}

function PauseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="10" y1="6" x2="10" y2="18" />
      <line x1="14" y1="6" x2="14" y2="18" />
    </svg>
  );
}
