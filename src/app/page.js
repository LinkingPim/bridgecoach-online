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
    if (!res.ok) {
      throw new Error("faq.json kon niet worden geladen.");
    }

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
    if (tabName === "opening") {
      return "Bijv: Ik heb 13 punten en 5 harten, wat open ik?";
    }
    if (tabName === "bijbod") {
      return "Bijv: Partner opent 1SA, ik heb 8 punten...";
    }
    if (tabName === "uitkomst") {
      return "Bijv: Wat is een goede uitkomst tegen 3SA?";
    }
    return "Stel je bridgevraag...";
  }

  function getIntro(tabName) {
    if (tabName === "opening") {
      return "Hoi! Ik ben jouw Bridgecoach. Stel gerust een vraag over openingen.";
    }
    if (tabName === "bijbod") {
      return "Hoi! Ik ben jouw Bridgecoach. Stel gerust een vraag over bijbiedingen.";
    }
    if (tabName === "uitkomst") {
      return "Hoi! Ik ben jouw Bridgecoach. Stel gerust een vraag over uitkomsten.";
    }
    return "Hoi! Ik ben jouw Bridgecoach. Waar wil je hulp bij?";
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsAudioPlaying(false);
  }

  function playTopicAudio() {
    const file = getTopicAudio(tab);
    if (!file) return;

    if (!audioRef.current) {
      const audio = new Audio(file);

      audio.addEventListener("ended", () => {
        setIsAudioPlaying(false);
      });

      audioRef.current = audio;
    }

    const currentAudio = audioRef.current;
    const wantedSrc = window.location.origin + file;

    if (currentAudio.src !== wantedSrc) {
      currentAudio.pause();

      const audio = new Audio(file);
      audio.addEventListener("ended", () => {
        setIsAudioPlaying(false);
      });

      audioRef.current = audio;

      audio
        .play()
        .then(() => setIsAudioPlaying(true))
        .catch((err) => {
          console.error("Audio kon niet starten:", err);
          setIsAudioPlaying(false);
        });

      return;
    }

    if (currentAudio.paused) {
      currentAudio
        .play()
        .then(() => setIsAudioPlaying(true))
        .catch((err) => {
          console.error("Audio kon niet starten:", err);
          setIsAudioPlaying(false);
        });
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

      if (!topicFaq || !topicFaq.options) {
        throw new Error("Geen FAQ gevonden voor dit onderwerp.");
      }

      setFaqOptions(topicFaq.options);
      setFaqPath([]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Er ging iets mis bij het laden van de FAQ.",
          source: "error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function findNodeByPath(rootOptions, path) {
    let currentOptions = rootOptions;

    for (const step of path) {
      const found = currentOptions.find((item) => item.label === step);
      if (!found || !found.children) {
        return currentOptions;
      }
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
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: option.answer,
            source: "faq",
          },
        ]);

        setFaqOptions(null);
        setFaqPath([]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Er ging iets mis bij de FAQ.",
          source: "error",
        },
      ]);
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
      const newOptions = findNodeByPath(topicFaq.options, newPath);

      setFaqPath(newPath);
      setFaqOptions(newOptions);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Er ging iets mis bij teruggaan in de FAQ.",
          source: "error",
        },
      ]);
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
    setMessages([
      {
        role: "assistant",
        text: getIntro(newTab),
        source: "system",
      },
    ]);
  }

  async function sendMessage() {
    const trimmed = input.trim();

    if (!trimmed || loading) return;

    resetFaq();

    const userMessage = {
      role: "user",
      text: trimmed,
      source: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          tab,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Er ging iets mis.");
      }

      const botMessage = {
        role: "assistant",
        text: data.answer || "Ik kon geen antwoord maken.",
        source: data.source || "unknown",
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Er ging iets mis. Probeer het opnieuw.",
          source: "error",
        },
      ]);
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
    <main style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.header}>
          <div style={styles.brandBlock}>
            <img src="/logo.png" alt="Bridgecoach logo" style={styles.logo} />
            <div>
              <h1 style={styles.title}>BRIDGECOACH</h1>
              <p style={styles.subtitle}>Kort en duidelijk bridge-advies</p>
            </div>
          </div>
        </div>

        <div style={styles.tabsRow}>
          <TabButton
            label="Opening"
            active={tab === "opening"}
            onClick={() => switchTab("opening")}
          />
          <TabButton
            label="Bijbod"
            active={tab === "bijbod"}
            onClick={() => switchTab("bijbod")}
          />
          <TabButton
            label="Uitkomst"
            active={tab === "uitkomst"}
            onClick={() => switchTab("uitkomst")}
          />
        </div>

        <div style={styles.topicRow}>
          <button onClick={playTopicAudio} style={styles.topicAudioBtn}>
            {isAudioPlaying ? (
              <PauseIcon size={16} />
            ) : (
              <HeadphoneIcon size={16} dark />
            )}
            <span>{isAudioPlaying ? "Pauzeer uitleg" : "Luister uitleg"}</span>
          </button>

          <button onClick={loadFaq} style={styles.faqBtn}>
            FAQ
          </button>
        </div>

        {faqOptions && (
          <div style={styles.faqPanel}>
            {faqPath.length > 0 && (
              <button onClick={handleFaqBack} style={styles.faqBackBtn}>
                ← Terug
              </button>
            )}

            <div style={styles.faqOptions}>
              {faqOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleFaqChoice(option)}
                  style={styles.faqOptionBtn}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={styles.chatBox}>
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                ...styles.messageRow,
                justifyContent:
                  msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  ...styles.bubble,
                  ...(msg.role === "user"
                    ? styles.userBubble
                    : styles.assistantBubble),
                }}
              >
                <div style={styles.label}>
                  {msg.role === "user" ? "Jij" : "Bridgecoach"}
                </div>

                <div style={styles.text}>{renderSimpleMarkdown(msg.text)}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div style={styles.messageRow}>
              <div style={{ ...styles.bubble, ...styles.assistantBubble }}>
                <div style={styles.label}>Bridgecoach</div>
                <div style={styles.text}>Even denken...</div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div style={styles.inputRow}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder(tab)}
            style={styles.input}
            rows={1}
          />

          <button onClick={sendMessage} style={styles.sendButton}>
            Verstuur
          </button>
        </div>

        <div style={styles.footer}>
          Bridgecoach · beta · bridgecoach@ziggo.nl · 2026
        </div>
      </div>
    </main>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.tab,
        ...(active ? styles.tabActive : {}),
      }}
    >
      {label}
    </button>
  );
}

function HeadphoneIcon({ size = 22, dark = false }) {
  const stroke = dark ? "#111827" : "white";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12a8 8 0 0 1 16 0" />
      <rect x="2" y="12" width="4" height="7" rx="2" />
      <rect x="18" y="12" width="4" height="7" rx="2" />
    </svg>
  );
}

function PauseIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#111827"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="10" y1="6" x2="10" y2="18" />
      <line x1="14" y1="6" x2="14" y2="18" />
    </svg>
  );
}

function renderSimpleMarkdown(text) {
  function renderCards(line) {
    return line.split(/(♠|♥|♦|♣)/g).map((part, i) => {
      if (part === "♥" || part === "♦") {
        return (
          <span key={i} style={{ color: "#e11d48", fontWeight: "600" }}>
            {part}
          </span>
        );
      }

      if (part === "♠" || part === "♣") {
        return (
          <span key={i} style={{ color: "#111827", fontWeight: "600" }}>
            {part}
          </span>
        );
      }

      return <span key={i}>{part}</span>;
    });
  }

  const lines = text.split("\n");

  return lines.map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={index} style={{ height: "8px" }} />;
    }

    if (trimmed.startsWith("## ")) {
      return (
        <div key={index} style={styles.h2}>
          {renderCards(trimmed.replace("## ", ""))}
        </div>
      );
    }

    if (trimmed.startsWith("- ")) {
      return (
        <div key={index} style={styles.listItem}>
          • {renderCards(trimmed.replace("- ", ""))}
        </div>
      );
    }

    return (
      <div key={index} style={styles.paragraph}>
        {renderCards(trimmed)}
      </div>
    );
  });
}

const styles = {

page: {
  minHeight: "100vh",
  background: "#f2f2f2",
  padding: "40px 20px",
  fontFamily: "Inter, system-ui, Arial, sans-serif",
},

wrapper: {
  maxWidth: "580px",
  margin: "0 auto",
  background: "#ffffff",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 8px 30px rgba(0,0,0,0.05)",
},

header: {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "20px",
  background: "#ffffff",
  padding: "16px",
  borderRadius: "14px",
 
},

brandBlock: {
  display: "flex",
  alignItems: "center",
  gap: "12px",
},

logo: {
  width: "40px",
  height: "40px",
  objectFit: "contain",
},

title: {
  margin: 0,
  fontSize: "22px",
  fontWeight: "700",
  letterSpacing: "0.4px",
},

subtitle: {
  margin: "2px 0 0 0",
  fontSize: "13px",
  color: "#6b7280",
},

tabsRow: {
  display: "flex",
  gap: "10px",
  marginBottom: "16px",
},

tab: {
  padding: "10px 18px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "#eeeeee",
  fontSize: "16px",
  fontWeight: "600",
  cursor: "pointer",
},

tabActive: {
  background: "#f48c00",
  color: "white",
  border: "1px solid #f48c00",
},

topicRow: {
  display: "flex",
  gap: "10px",
  marginBottom: "12px",
},

topicAudioBtn: {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "#ffffff",
  padding: "8px 14px",
  fontSize: "14px",
  cursor: "pointer",
},

faqBtn: {
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "#ffffff",
  padding: "8px 14px",
  fontSize: "13px",
  cursor: "pointer",
},

faqPanel: {
  marginBottom: "12px",
},

faqOptions: {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
},

faqOptionBtn: {
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "#ffffff",
  padding: "6px 12px",
  fontSize: "13px",
  cursor: "pointer",
},

faqBackBtn: {
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "#ffffff",
  padding: "6px 10px",
  fontSize: "12px",
  marginBottom: "8px",
  cursor: "pointer",
},

chatBox: {
  minHeight: "360px",
  maxHeight: "360px",
  overflowY: "auto",
  background: "#f7f7f7",
  border: "1px solid #d8d8d8",
  borderRadius: "18px",
  padding: "14px",
},

messageRow: {
  display: "flex",
  marginBottom: "12px",
},

bubble: {
  maxWidth: "70%",
  borderRadius: "14px",
  padding: "12px 14px",
},

assistantBubble: {
  background: "#e9eaec",
},

userBubble: {
  background: "#f3e2c8",
},

label: {
  fontSize: "11px",
  color: "#6b7280",
  marginBottom: "6px",
},

text: {
  fontSize: "15px",
  lineHeight: 1.5,
},

inputRow: {
  display: "flex",
  gap: "10px",
  marginTop: "14px",
},

input: {
  flex: 1,
  borderRadius: "999px",
  border: "1px solid #ddd",
  padding: "12px 16px",
  fontSize: "14px",
  background: "#ffffff",
  resize: "none",
},

sendButton: {
  borderRadius: "999px",
  border: "none",
  background: "#f48c00",
  color: "white",
  fontWeight: "600",
  padding: "12px 20px",
  cursor: "pointer",
},

footer: {
  textAlign: "center",
  marginTop: "18px",
  fontSize: "12px",
  color: "#9ca3af",
},

h2: {
  fontSize: "16px",
  fontWeight: "700",
  margin: "6px 0",
},

paragraph: {
  margin: "4px 0",
},

listItem: {
  margin: "4px 0",
}

};