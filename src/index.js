#!/usr/bin/env node

const { buildAreaConfigSummary } = require("./seed_config");
const { runCombineSeedPreviewExport } = require("./combine_seed");
const { printHelp, runSeedPipeline } = require("./seed");
const { loadDotEnv } = require("./utils");

loadDotEnv();

async function main() {
  try {
    const command = process.argv.slice(2).join(" ").trim();

    if (command === "--help" || command === "-h") {
      printHelp();
      return;
    }

    if (command === "areas") {
      console.log(JSON.stringify(buildAreaConfigSummary(), null, 2));
      return;
    }

    if (command === "combine-seed") {
      const result = runCombineSeedPreviewExport();
      console.log(`[combined-seed-areas] ${result.areaCount}`);
      console.log(`[combined-seed-restaurants] ${result.restaurantCount}`);
      console.log(`[combined-seed-categories] ${result.categoryCount}`);
      console.log(`[combined-seed-menu-items] ${result.menuItemCount}`);
      console.log(`[combined-seed-duplicates] ${result.duplicateCount}`);
      console.log(`[combined-seed-menu-mapped] ${result.menuMappedCount}`);
      console.log(`[saved-restaurants-preview] ${result.restaurantsPreviewPath}`);
      console.log(
        `[saved-restaurant-categories-preview] ${result.categoriesPreviewPath}`
      );
      console.log(
        `[saved-restaurant-menu-items-preview] ${result.menuItemsPreviewPath}`
      );
      console.log(`[saved-tags-preview] ${result.tagsPreviewPath}`);
      console.log(
        `[saved-restaurant-tags-preview] ${result.restaurantTagsPreviewPath}`
      );
      console.log(
        `[saved-tag-validation-report] ${result.tagValidationReportPath}`
      );
      console.log(`[saved-duplicates] ${result.duplicatesPath}`);
      console.log(`[saved-summary] ${result.summaryPath}`);
      return;
    }

    if (command === "refresh-seed") {
      await runSeedPipeline();
      const result = runCombineSeedPreviewExport();
      console.log(`[combined-seed-areas] ${result.areaCount}`);
      console.log(`[combined-seed-restaurants] ${result.restaurantCount}`);
      console.log(`[combined-seed-categories] ${result.categoryCount}`);
      console.log(`[combined-seed-menu-items] ${result.menuItemCount}`);
      console.log(`[combined-seed-duplicates] ${result.duplicateCount}`);
      console.log(`[combined-seed-menu-mapped] ${result.menuMappedCount}`);
      console.log(`[saved-restaurants-preview] ${result.restaurantsPreviewPath}`);
      console.log(
        `[saved-restaurant-categories-preview] ${result.categoriesPreviewPath}`
      );
      console.log(
        `[saved-restaurant-menu-items-preview] ${result.menuItemsPreviewPath}`
      );
      console.log(`[saved-tags-preview] ${result.tagsPreviewPath}`);
      console.log(
        `[saved-restaurant-tags-preview] ${result.restaurantTagsPreviewPath}`
      );
      console.log(
        `[saved-tag-validation-report] ${result.tagValidationReportPath}`
      );
      console.log(`[saved-duplicates] ${result.duplicatesPath}`);
      console.log(`[saved-summary] ${result.summaryPath}`);
      return;
    }

    await runSeedPipeline();
  } catch (error) {
    console.error("[error]");
    console.error(error.message);
    process.exit(1);
  }
}

main();
