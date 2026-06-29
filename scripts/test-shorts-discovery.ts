import { discoverShortIdsByNiche, fetchYouTubeOEmbed } from "../src/lib/real-discovery";

async function main() {
  console.log("1. Discovering Short IDs...");
  const ids = await discoverShortIdsByNiche("tech", 12);
  console.log(`Found ${ids.length} IDs:`, ids);

  console.log("\n2. Fetching oEmbed for each...");
  for (const id of ids.slice(0, 6)) {
    const meta = await fetchYouTubeOEmbed(id);
    if (meta) {
      console.log(`  ✓ ${id}: "${meta.title}" by ${meta.channelTitle}`);
    } else {
      console.log(`  ✗ ${id}: oEmbed failed`);
    }
  }
}
main().catch(console.error);
