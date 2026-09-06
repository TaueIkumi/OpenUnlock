import type { InputSource } from "../../core/input.js";
import type { DetectionResult } from "../../core/adapter.js";
import { findBoardFile, isPlausibleTrelloBoard, type TrelloBoard } from "./parse-source.js";

export async function detectTrello(input: InputSource): Promise<DetectionResult> {
  const files = await input.listFiles();
  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));

  if (jsonFiles.length === 0) {
    return { adapter: "trello", confidence: 0, evidence: ["no .json file found"] };
  }

  const boardFile = await findBoardFile(input);
  if (!boardFile) {
    return {
      adapter: "trello",
      confidence: 0,
      evidence: [
        "no JSON file matched the expected Trello board export structure " +
          '(object with "id", "name", "lists", and "cards")',
      ],
    };
  }

  const evidence = [`found board export: ${boardFile}`];
  let confidence = 0.6;

  const data = JSON.parse(await input.readText(boardFile)) as TrelloBoard;
  if (!isPlausibleTrelloBoard(data)) {
    // Unreachable given findBoardFile already checked this, but keeps the
    // narrowing explicit for the field access below.
    return { adapter: "trello", confidence: 0, evidence };
  }

  const cards = data.cards ?? [];
  const cardsHaveIdList = cards.length === 0 || cards.every((c) => typeof c?.idList === "string");
  if (cardsHaveIdList) {
    evidence.push('cards reference "idList" (Trello-specific field naming)');
    confidence += 0.3;
  } else {
    evidence.push('cards are missing the expected "idList" field');
  }

  if (Array.isArray(data.actions)) {
    evidence.push("found actions array (Trello activity log)");
    confidence += 0.05;
  }
  if (Array.isArray(data.members)) {
    evidence.push("found members array");
    confidence += 0.05;
  }

  return { adapter: "trello", confidence: Math.min(confidence, 1), evidence };
}
