"use client";

import { useState } from "react";
import { SlateUtils } from "@/lib/utils/slateUtils";
import { CoreferenceUtils } from "@/lib/utils/coreferenceUtils";
import { type SentenceCache } from "@/lib/stores/sentenceCacheStore";
import { type Character } from "@/lib/stores/characterStore";
import { useRelationshipStore } from "@/lib/stores/relationshipStore";

interface ToolbarProps {
  value: any;
  sentenceCaches: SentenceCache[];
  cachedCharacterNames: string[];
  existingCharacters: Character[];
  onExtractComplete: (result: {
    characters: any[];
    sentenceCaches: SentenceCache[];
  }) => void;
}

export function Toolbar({
  value,
  sentenceCaches,
  cachedCharacterNames,
  existingCharacters,
  onExtractComplete,
}: ToolbarProps) {
  const { setRelationships, setIsLoading } = useRelationshipStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleExtractCharacters = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    const story = SlateUtils.stateToText(value as any);
    console.log("Extracting characters from story:", story);

    try {
      // Step 1: Extract character names
      const charResponse = await fetch("/api/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story }),
      });

      const charData = await charResponse.json();

      if (charData.error) {
        alert(`Error: ${charData.error}`);
        return;
      }

      const characterNames: string[] = charData.characters || [];
      console.log("Extracted character names:", characterNames);

      if (characterNames.length === 0) {
        alert("No characters found in the story");
        return;
      }

      // Step 2: Extract coreferences using smart caching
      const startTime = Date.now();

      const result = await CoreferenceUtils.extractAllCoreferencesWithCache(
        story,
        characterNames,
        sentenceCaches.length > 0 ? sentenceCaches : undefined,
        cachedCharacterNames.length > 0 ? cachedCharacterNames : undefined,
        existingCharacters.length > 0 ? existingCharacters : undefined,
      );

      const extractionTime = Date.now() - startTime;
      console.log(`Extraction completed in ${extractionTime}ms`);
      console.log(
        "Characters with coreferences and indicators:",
        result.characters,
      );

      // Step 3: Notify parent component
      onExtractComplete(result);

      // Step 4: Analyze relationships
      if (characterNames.length >= 2) {
        console.log("Analyzing relationships...");
        setIsLoading(true);
        try {
          const relResponse = await fetch("/api/relationships", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ story, characters: characterNames }),
          });

          if (relResponse.ok) {
            const relData = await relResponse.json();
            setRelationships(relData.relationships || []);
            console.log("Relationships analyzed:", relData.relationships);
          }
        } catch (relError) {
          console.error("Relationship analysis failed:", relError);
        } finally {
          setIsLoading(false);
        }
      }

      // Show summary
      const summary = result.characters
        .map((char) => {
          const attributes = char.attributes || [];
          const grouped = {
            physiology: attributes.filter((a) => a.category === "physiology")
              .length,
            psychology: attributes.filter((a) => a.category === "psychology")
              .length,
            sociology: attributes.filter((a) => a.category === "sociology")
              .length,
          };
          const totalEvidence = attributes.reduce(
            (sum, attr) => sum + attr.evidence.length,
            0,
          );
          return `${char.name}: ${char.coreferenceMatches.length} refs | ${attributes.length} attributes (Phys: ${grouped.physiology}, Psych: ${grouped.psychology}, Soc: ${grouped.sociology}) | ${totalEvidence} evidence`;
        })
        .join("\n");

      alert(
        `Extraction complete in ${(extractionTime / 1000).toFixed(
          1,
        )}s!\n\n${summary}`,
      );
    } catch (err) {
      console.error("Extraction error:", err);
      alert(
        `Request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <button
      type="button"
      className="w-full btn btn-primary btn-sm"
      onClick={handleExtractCharacters}
      disabled={isAnalyzing}
    >
      {isAnalyzing ? "Analyzing…" : "Analyze Characters"}
    </button>
  );
}
