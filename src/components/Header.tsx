"use client";
import { useRef, useState } from "react";

export default function Header() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggleAudio = () => {
    if (!audioRef.current) return;

    if (audioRef.current.paused) {
      audioRef.current.play();
      setPlaying(true);
    } else {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  const handleEnded = () => {
    setPlaying(false);
  };

  return (
    <div className="flex items-center justify-between p-4">
      
      {/* Linker knoppen */}
      <div className="flex gap-3">
        <button className="px-4 py-2 bg-orange-500 text-white rounded-full">
          Bieden
        </button>
        <button className="px-4 py-2 bg-gray-200 rounded-full">
          Spel
        </button>
        <button className="px-4 py-2 bg-gray-200 rounded-full">
          Verdediging
        </button>
      </div>

      {/* Audio knop rechts */}
      <button
        onClick={toggleAudio}
        className={`px-4 py-2 rounded-full text-white transition 
        ${playing ? "bg-orange-600 animate-pulse" : "bg-orange-500 hover:bg-orange-600"}`}
      >
        🎧
      </button>

      {/* Verborgen audio */}
      <audio
        ref={audioRef}
        src="/audio/opening.mp3"
        onEnded={handleEnded}
      />
    </div>
  );
}