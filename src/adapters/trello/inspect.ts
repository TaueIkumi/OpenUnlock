import type { InputSource } from "../../core/input.js";
import type { InspectionResult } from "../../core/adapter.js";
import { detectTrello } from "./detect.js";
import { findBoardFile, isPlausibleTrelloBoard } from "./parse-source.js";

export async function inspectTrello(input: InputSource): Promise<InspectionResult> {
  const detection = await detectTrello(input);

  const boardFile = await findBoardFile(input);
  if (!boardFile) {
    return {
      source: "trello",
      confidence: detection.confidence,
      contents: [],
      potentialIssues: ["no file matching the expected Trello board export structure was found"],
    };
  }

  const data: unknown = JSON.parse(await input.readText(boardFile));
  if (!isPlausibleTrelloBoard(data)) {
    return {
      source: "trello",
      confidence: detection.confidence,
      contents: [],
      potentialIssues: [`${boardFile} did not match the expected structure`],
    };
  }

  const potentialIssues: string[] = [];
  const lists = data.lists ?? [];
  const cards = data.cards ?? [];
  const members = data.members ?? [];
  const actions = data.actions ?? [];
  const comments = actions.filter((a) => a.type === "commentCard");
  const otherActionCount = actions.length - comments.length;

  const cardsWithAttachments = cards.filter((c) => (c.attachments?.length ?? 0) > 0).length;
  if (cardsWithAttachments > 0) {
    potentialIssues.push(`${cardsWithAttachments} cards reference attachments that will not be copied`);
  }
  if (otherActionCount > 0) {
    potentialIssues.push(`${otherActionCount} non-comment activity events will not be converted`);
  }

  return {
    source: "trello",
    confidence: detection.confidence,
    contents: [
      { label: "Lists", count: lists.length },
      { label: "Cards", count: cards.length },
      { label: "Members", count: members.length },
      { label: "Comments", count: comments.length },
    ],
    potentialIssues,
  };
}
