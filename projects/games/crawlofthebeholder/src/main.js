(function () {
  const runtime = window.CotBRuntime;
  const context = runtime.createCoreContext(window.CotBResources, document);
  // Expeditions spend recovery supplies, not a hunger clock. Legacy hunger
  // scenarios can still exercise the isolated engine in the test harness.
  context.hungerDisabled = true;

  runtime.installMonsterTraits(context);
  runtime.installCombatMath(context);
  runtime.installMessagesAndVisibility(context);
  runtime.installFloorMarks(context);
  runtime.installClasses(context);
  runtime.installMapgen(context);
  runtime.installMonsterAi(context);
  runtime.installPartyCombat(context);
  runtime.installPartyMovement(context);
  runtime.installPartyTraversal(context);
  runtime.installPartyInteraction(context);
  runtime.installPartyFixtures(context);
  runtime.installPartyInventory(context);
  runtime.installItemElements(context);
  runtime.installPartyItems(context);
  runtime.installItemUse(context);
  runtime.installPartyTurn(context);
  runtime.installViewportRendering(context);
  runtime.installUiChrome(context);
  runtime.installPersistence(context);
  runtime.installDifficulty(context);
  runtime.installDeities(context);
  runtime.installPortraits(context);
  runtime.installReactions(context);
  runtime.installEconomy(context);
  runtime.installInventoryExtras(context);
  runtime.installTalents(context);
  runtime.installBossMonsters(context);
  runtime.installShops(context);
  runtime.installNpcs(context);
  runtime.installHiddenPassages(context);
  runtime.installSound(context);
  runtime.installBestiary(context);
  runtime.installWanderers(context);
  runtime.installQuests(context);
  runtime.installCampaign(context);
  runtime.installFishing(context);
  runtime.installGraves(context);
  runtime.installDelving(context);
  runtime.installCombatExtras(context);
  runtime.installMilestones(context);
  runtime.installLocks(context);
  runtime.installFloorHazards(context);
  runtime.installAllies(context);
  runtime.installEngineering(context);
  runtime.installEcology(context);
  runtime.installMastery(context);
  runtime.installExploration(context);
  runtime.installAlchemy(context);
  runtime.installWeather(context);
  runtime.installArcane(context);
  runtime.installEnchanting(context);
  runtime.installEvents(context);
  runtime.installCorruption(context);
  runtime.installRelics(context);
  runtime.installSiege(context);
  runtime.installBloodlines(context);
  runtime.installGadgets(context);
  runtime.installCartography(context);
  runtime.installLore(context);
  runtime.installMutations(context);
  runtime.installCamping(context);
  runtime.installLeyLines(context);
  runtime.installContracts(context);
  runtime.installHerbalism(context);
  runtime.installDivination(context);
  runtime.installNecromancy(context);
  runtime.installRunes(context);
  runtime.installHarvesting(context);
  runtime.installTotems(context);
  runtime.installResonance(context);
  runtime.installSpirits(context);
  runtime.installCooking(context);
  runtime.installBardic(context);
  runtime.installPsionics(context);
  runtime.installTimewarp(context);
  runtime.installMining(context);
  runtime.installSmithing(context);
  runtime.installMorale(context);
  runtime.installConstellations(context);
  runtime.installArtefacts(context);
  runtime.installCharms(context);
  runtime.installMobile(context);
  runtime.installVr(context);
  runtime.installDevOptions(context);
  runtime.installInput(context);

  window.CotBGame = context;
  const resumed = context.loadGame();
  // Startup options (URL query / forwarded launcher flags) can skip the menu and
  // drop the party at a chosen floor — see README for the full list.
  const startup = typeof context.parseStartupOptions === "function" ? context.parseStartupOptions() : {};
  if (!resumed && startup.autostart && typeof context.beginRun === "function") {
    // beginRun builds the world (curated or seeded), applies the party/difficulty
    // and hides the character-create modal, so bindInput never shows it.
    context.beginRun(startup);
  }
  context.bindInput();
  if (typeof context.bindMobile === "function") context.bindMobile();
  if (!resumed && !startup.autostart) {
    // Fresh run → play the hand-crafted DCSS campaign (descend to Zot:1, lift
    // the Orb, escape). normalizeCampaign wires the win arc onto the baked world.
    if (typeof context.normalizeCampaign === "function") context.normalizeCampaign();
    context.reveal();
  }
  // Dev navigation: jump to a chosen floor / tile, and optionally reveal the map.
  if (startup.floor != null && typeof context.goToFloor === "function") context.goToFloor(startup.floor);
  if (startup.pos && typeof context.applyStartPosition === "function") context.applyStartPosition(startup.pos);
  if (startup.reveal && typeof context.revealAll === "function") context.revealAll();
  context.render();
  if (resumed) {
    context.state.message = `${context.state.message ? `${context.state.message} ` : ""}Save resumed.`;
    context.renderChrome();
  }
  if (typeof context.showRotateHint === "function") {
    // Slight delay so the toast appears after the first paint.
    window.setTimeout(() => context.showRotateHint(), 600);
  }
}());
