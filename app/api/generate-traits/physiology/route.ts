"use server";

import { NextResponse } from "next/server";
import { generateObject } from "ai";
import path from "path";
import { getOpenAiProvider } from "@/lib/openaiServer";

import {
  ResponseSchema,
  loadPromptTemplate,
  parseTraitsRequest,
  renderPromptTemplate,
} from "../shared";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "app/api/generate-traits/physiology/generate_traits_physiology.yaml",
);

export async function POST(request: Request) {
  try {
    const openaiProvider = getOpenAiProvider(request);
    if (!openaiProvider) {
      return NextResponse.json(
        { error: "Missing OpenAI API key" },
        { status: 401 },
      );
    }

    const parsed = parseTraitsRequest(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const template = await loadPromptTemplate(TEMPLATE_PATH);
    const prompt = renderPromptTemplate(template, parsed.data);

    const { object } = await generateObject({
      model: openaiProvider("gpt-4.1"),
      schema: ResponseSchema,
      prompt,
      temperature: 0.7,
    });

    if (!object?.traits || object.traits.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate brainstorm traits" },
        { status: 500 },
      );
    }

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error brainstorming physiology traits:", error);
    return NextResponse.json(
      { error: "Unable to brainstorm physiology traits" },
      { status: 500 },
    );
  }
}
