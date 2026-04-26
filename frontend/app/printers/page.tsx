"use client";

import { useState, useEffect, useRef } from "react";
import PageContainer from "@/components/layout/PageContainer";
import {
  CHAIN_PRICES,
  fetchPrinters,
  getPrinterEmoji,
  PRICE_LEVEL_LABEL,
  type Printer,
} from "@/lib/printers";

interface Suggestion {
  placeId: string;
  label: string;
  main: string;
  secondary: string;
}

export default function PrintersPage() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState("distance");
  const [searchInput, setSearchInput] = useState("");
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const coordCache = useRef<Record<string, { lat: number; lng: number }>>({});

  const searchBarStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    background: "#ffffff",
    border: "1px solid rgba(190,155,70,0.22)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  };

  const cardStyle: React.CSSProperties = {
    display: "flex",
    gap: 18,
    padding: "20px 22px",
    background: "#ffffff",
    border: "1px solid rgba(190,155,70,0.18)",
    borderRadius: 16,
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  };

  const buttonPrimary: React.CSSProperties = {
    padding: "10px 18px",
    borderRadius: 12,
    background: "#f5c842",
    color: "#1a1000",
    fontSize: 13,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(245,200,66,0.3)",
    whiteSpace: "nowrap",
  };

  const tagStyle: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 500,
    padding: "3px 10px",
    borderRadius: 8,
    background: "#fdf8ec",
    border: "1px solid rgba(190,155,70,0.22)",
    color: "#7a6a40",
  };

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchInput.trim() || searchInput.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/autocomplete?input=${encodeURIComponent(searchInput)}`);
      const data = await res.json();
      const list: Suggestion[] = data.suggestions ?? [];
      setSuggestions(list);
      setShowSuggestions(list.length > 0);
      setActiveSuggestion(-1);
      list.forEach((s) => {
        if (coordCache.current[s.placeId]) return;
        fetch(`/api/place?id=${s.placeId}`)
          .then((r) => r.json())
          .then((d) => { if (d.lat) coordCache.current[s.placeId] = d; })
          .catch(() => {});
      });
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  async function load(lat: number, lng: number, label: string) {
    setLoading(true);
    setError(null);
    setHasFetched(true);
    setLocationLabel(label);
    try {
      const results = await fetchPrinters(lat, lng);
      setPrinters(results);
      if (results.length === 0)
        setError("No print shops found within 10 km. Try a different location.");
    } catch {
      setError("Failed to fetch print shops. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function selectSuggestion(s: Suggestion) {
    setSearchInput(s.label);
    setShowSuggestions(false);
    setSuggestions([]);
    const cached = coordCache.current[s.placeId];
    if (cached) {
      load(cached.lat, cached.lng, s.main);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/place?id=${s.placeId}`);
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError("Couldn't resolve that location. Please try again.");
      return;
    }
    load(data.lat, data.lng, s.main);
  }

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => load(pos.coords.latitude, pos.coords.longitude, "your location"),
      () => {
        setLoading(false);
        setError("Location access denied. Try searching by address instead.");
      }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  const displayed =
    sort === "open247"
      ? printers.filter((p) => p.hours === "Open Now")
      : [...printers].sort((a, b) => a.distance - b.distance);

  return (
    <PageContainer>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>

        <div ref={wrapperRef} style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <div style={{ ...searchBarStyle, borderRadius: showSuggestions ? "12px 12px 0 0" : 12 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9a8a60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search by address or neighborhood…"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "#1a1600", width: "100%" }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setSuggestions([]); setShowSuggestions(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#b0a070", fontSize: 16, lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <ul style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
              background: "#ffffff", border: "1px solid rgba(190,155,70,0.22)",
              borderTop: "none", borderRadius: "0 0 12px 12px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              listStyle: "none", margin: 0, padding: "4px 0",
            }}>
              {suggestions.map((s, i) => (
                <li
                  key={s.placeId}
                  onMouseDown={() => selectSuggestion(s)}
                  onMouseEnter={() => setActiveSuggestion(i)}
                  style={{
                    padding: "10px 16px",
                    cursor: "pointer",
                    background: i === activeSuggestion ? "rgba(245,200,66,0.12)" : "transparent",
                    borderBottom: i < suggestions.length - 1 ? "1px solid rgba(190,155,70,0.1)" : "none",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1600" }}>{s.main}</div>
                  {s.secondary && <div style={{ fontSize: 11.5, color: "#9a8a60", marginTop: 2 }}>{s.secondary}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={handleUseLocation}
          disabled={loading}
          style={{ ...buttonPrimary, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
        >
          📍 Use My Location
        </button>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "#ffffff",
            border: "1px solid rgba(190,155,70,0.22)",
            color: "#5a4a20",
            fontSize: 13,
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="distance">Sort by Distance</option>
          <option value="open247">Open Now Only</option>
        </select>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9a8a60", fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          Finding print shops nearby…
        </div>
      )}

      {error && !loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#dc2626", fontSize: 14 }}>
          {error}
        </div>
      )}

      {!hasFetched && !loading && (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#b0a070", fontSize: 14 }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🖨️</div>
          <p style={{ fontWeight: 700, color: "#5a4a20", fontSize: 16, marginBottom: 6 }}>
            Find print shops near you
          </p>
          <p>Use your location or search by address to get started.</p>
        </div>
      )}

      {locationLabel && !loading && printers.length > 0 && (
        <p style={{ fontSize: 12, color: "#9a8a60", marginBottom: 14 }}>
          Showing <strong>{displayed.length}</strong> print shop{displayed.length !== 1 ? "s" : ""} near{" "}
          <strong>{locationLabel}</strong>
        </p>
      )}

      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {displayed.map((p, i) => {
            const chain = CHAIN_PRICES.find((c) => c.match.test(p.name));
            const level = p.priceLevel ? PRICE_LEVEL_LABEL[p.priceLevel] : null;
            return (
              <div key={p.id} className={`anim-fade-up d${Math.min(i + 1, 7)}`} style={cardStyle}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: "rgba(245,200,66,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, flexShrink: 0,
                }}>
                  {getPrinterEmoji(p.name)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
                    <div>
                      <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15.5, fontWeight: 700, color: "#1a1600", letterSpacing: "-0.3px" }}>
                        {p.name}
                      </h3>
                      <p style={{ fontSize: 12, color: "#9a8a60", marginTop: 3 }}>📍 {p.address}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                        background: p.hours === "Open Now" ? "#dcfce7" : p.hours === "Closed Now" ? "#fef2f2" : "#f3f0ea",
                        color: p.hours === "Open Now" ? "#15803d" : p.hours === "Closed Now" ? "#dc2626" : "#6b7280",
                      }}>
                        ● {p.hours}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, padding: "3px 12px", borderRadius: 10, background: "rgba(245,200,66,0.15)", color: "#92400e" }}>
                        {p.distance.toFixed(1)} mi
                      </span>
                    </div>
                  </div>

                  {chain && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#b0a070", marginBottom: 3 }}>Pricing</p>
                      <p style={{ fontSize: 12, color: "#5a4a20" }}>{chain.bw} · {chain.color}</p>
                    </div>
                  )}
                  {!chain && level && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#b0a070", marginBottom: 3 }}>Price Range</p>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 8, background: level.bg, color: level.color }}>
                        {level.label}
                      </span>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {p.tags.map((tag) => (
                      <span key={tag} style={tagStyle}>{tag}</span>
                    ))}
                    <div style={{ flex: 1 }} />
                    <a
                      href={`https://www.google.com/maps/place/?q=place_id:${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...buttonPrimary, textDecoration: "none" }}
                    >
                      View on Maps →
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
