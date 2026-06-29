import { discoverYouTubeIdsByNiche, fetchYouTubeOEmbed } from "../src/lib/real-discovery";

async function main() {
  console.log("1. Discovering IDs for 'tech' niche...");
  const ids = await discoverYouTubeIdsByNiche("tech", 12);
  console.log(`LLM returned ${ids.length} IDs:`);
  ids.forEach((id, i) => console.log(`  ${i+1}. ${id}`));

  console.log("\n2. Checking oEmbed for each...");
  let valid = 0;
  for (const id of ids) {
    const meta = await fetchYouTubeOEmbed(id);
    if (meta) {
      valid++;
      console.log(`  ✓ ${id}: "${meta.title.slice(0, 50)}" by ${meta.channelTitle}`);
    } else {
      console.log(`  ✗ ${id}: oEmbed failed (invalid ID or video removed)`);
    }
  }
  console.log(`\n${valid}/${ids.length} IDs are valid`);
}
main().catch(console.error);
