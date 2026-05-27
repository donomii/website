(function () {
  const runtime = window.CotBRuntime;
  const context = runtime.createCoreContext(window.CotBResources, document);

  runtime.installMonsterTraits(context);
  runtime.installCombatMath(context);
  runtime.installMessagesAndVisibility(context);
  runtime.installFloorMarks(context);
  runtime.installMonsterAi(context);
  runtime.installPartyActions(context);
  runtime.installViewportRendering(context);
  runtime.installUiChrome(context);
  runtime.installInput(context);

  window.CotBGame = context;
  context.bindInput();
  context.reveal();
  context.render();
}());
