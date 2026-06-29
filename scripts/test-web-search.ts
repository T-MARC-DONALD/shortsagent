import ZAI from "z-ai-web-dev-sdk";

async function main() {
  const zai = await ZAI.create();
  console.log("functions keys:", Object.keys(zai.functions));
  
  // Try invoke with web_search
  console.log("\n=== Test 1: zai.functions.invoke('web_search', {...}) ===");
  try {
    const result = await zai.functions.invoke("web_search", {
      query: "fifa world cup youtube.com/watch viral video",
      num: 10,
    });
    const text = typeof result === "string" ? result : JSON.stringify(result);
    console.log("Result length:", text.length);
    console.log("First 800 chars:", text.slice(0, 800));
    
    // Extract YouTube IDs
    const watchUrls = text.match(/youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}/g) ?? [];
    const shortUrls = text.match(/youtu\.be\/[a-zA-Z0-9_-]{11}/g) ?? [];
    console.log("\nWatch URLs found:", watchUrls.slice(0, 10));
    console.log("Short URLs found:", shortUrls.slice(0, 10));
  } catch (e) {
    console.error("invoke('web_search') failed:", e instanceof Error ? e.message : e);
  }

  // Try invoke with different function name
  console.log("\n=== Test 2: zai.functions.invoke('search', {...}) ===");
  try {
    const result = await zai.functions.invoke("search", { query: "fifa world cup youtube" });
    console.log("search result:", typeof result === "string" ? result.slice(0, 500) : JSON.stringify(result).slice(0, 500));
  } catch (e) {
    console.error("invoke('search') failed:", e instanceof Error ? e.message : e);
  }
}
main().catch(console.error);
