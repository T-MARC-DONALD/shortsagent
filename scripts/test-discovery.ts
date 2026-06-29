import ZAI from "z-ai-web-dev-sdk";

async function main() {
  const zai = await ZAI.create();
  console.log("Available keys:", Object.keys(zai));
  if (zai.functions) {
    console.log("functions keys:", Object.keys(zai.functions));
  }
  // Try different methods
  console.log("\nTrying zai.chat.completions...");
  try {
    const r = await zai.chat.completions.create({
      messages: [{ role: "user", content: "Search YouTube for viral tech videos. Return 5 video URLs in format https://youtube.com/watch?v=VIDEO_ID, one per line." }],
    });
    console.log("LLM response:", r.choices?.[0]?.message?.content?.slice(0, 800));
  } catch (e) {
    console.error("LLM error:", e);
  }
}
main().catch(console.error);
