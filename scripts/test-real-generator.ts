import { generateRealShort, generateThumbnail } from "../src/lib/real-video-generator";

async function main() {
  console.log("Test 1: Complex title with apostrophe + em dash...");
  const r1 = await generateRealShort({
    youtubeId: "TEST1",
    title: "I Built an AI Agent in 48 Hours — Here's What Happened",
    hookType: "curiosity",
    audioTrack: "wave",
    durationSec: 15,
  });
  console.log("Result 1:", r1.ok ? "OK (" + r1.filePath + ")" : "FAIL: " + r1.error);

  console.log("\nTest 2: Shock hook + trap audio...");
  const r2 = await generateRealShort({
    youtubeId: "TEST2",
    title: "Why 90% of Startups Fail",
    hookType: "shock",
    audioTrack: "trap",
    durationSec: 20,
  });
  console.log("Result 2:", r2.ok ? "OK (" + r2.filePath + ")" : "FAIL: " + r2.error);

  console.log("\nTest 3: Repost with creator credit...");
  const r3 = await generateRealShort({
    youtubeId: "TEST3",
    title: "POV: When AI Writes Your Code",
    hookType: "fomo",
    audioTrack: "hype",
    durationSec: 12,
    creator: "@codingpov",
  });
  console.log("Result 3:", r3.ok ? "OK (" + r3.filePath + ")" : "FAIL: " + r3.error);

  if (r1.ok) {
    const t = await generateThumbnail(r1.absolutePath);
    console.log("Thumbnail:", t);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
