(function () {
  const runtime = window.CotBRuntime;
  const context = runtime.createCoreContext(window.CotBResources, document);

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
  runtime.installMobile(context);
  runtime.installInput(context);

  window.CotBGame = context;
  const resumed = context.loadGame();
  context.bindInput();
  if (typeof context.bindMobile === "function") context.bindMobile();
  if (!resumed) {
    // Fresh run → generate the dungeon procedurally. (newRun() clears the save
    // and reloads, so every run re-enters here and gets a new layout.)
    if (typeof context.regenerateWorld === "function") context.regenerateWorld();
    context.reveal();
  }
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
