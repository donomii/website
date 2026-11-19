(function initialiseEvilEmpires(root, factory) {
  "use strict";

  const game = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = game;
  } else {
    root.EvilEmpires = game;
  }
}(typeof globalThis === "undefined" ? this : globalThis, function createEvilEmpires() {
  "use strict";

  const decrees = [
    {
      doctrine: "Privatisation",
      title: "Auction the Crown Industries",
      command: "The Crown makes boots, coal, steel, and losses. Sell the workshops. Let owners fear ruin, and they shall discover efficiency.",
      briefing: "Selling state industries raises money now and may improve investment. Rural towns built around them will bear the disruption first.",
      choices: [
        {
          title: "Sell every forge before winter",
          description: "A rapid auction maximises revenue and infernal approval.",
          effects: { favour: 10, treasury: 14, prosperity: 7, peace: -7 },
          outcome: "Investors feast, obsolete furnaces close, and the Treasury enjoys its finest supper in years."
        },
        {
          title: "Sell gradually with worker shares",
          description: "Slower reform spreads ownership and cushions closures.",
          effects: { favour: 3, treasury: 7, prosperity: 4, peace: 1 },
          outcome: "The auctions are slower, but workers acquire shares and fewer towns wake to silent factory bells."
        },
        {
          title: "Declare the losses strategically vital",
          description: "Keep the industries and conceal their cost in the defence ledger.",
          effects: { favour: -18, treasury: -8, prosperity: -2, peace: 5 },
          outcome: "The furnaces stay lit. So does the enormous bonfire of public money beneath them."
        }
      ]
    },
    {
      doctrine: "Trade-union reform",
      title: "Bind the Guild Barons",
      command: "No guild shall close a kingdom by a show of hands in a smoky cellar. Require ballots. Forbid their flying pickets.",
      briefing: "Restricting union power makes firms easier to restructure. It also removes a counterweight to employers and the Crown.",
      choices: [
        {
          title: "Break the guilds in open battle",
          description: "Ban secondary action and stockpile coal before the inevitable strike.",
          effects: { favour: 10, treasury: 4, prosperity: 6, peace: -12 },
          outcome: "The strike fails after a bitter winter. Industry moves again; the mining valleys remember every mounted constable."
        },
        {
          title: "Require secret ballots and accounts",
          description: "Limit coercion while preserving collective bargaining.",
          effects: { favour: 3, treasury: 2, prosperity: 3, peace: -1 },
          outcome: "The guilds lose some magic and gain internal democracy. Neither side gets the glorious confrontation it wanted."
        },
        {
          title: "Name the guild masters peers of the realm",
          description: "Buy peace by preserving their power and granting ceremonial hats.",
          effects: { favour: -18, treasury: -5, prosperity: -4, peace: 6 },
          outcome: "The guild masters accept ermine, vetoes, and lunch. Productivity remains an impolite subject."
        }
      ]
    },
    {
      doctrine: "Monetarism",
      title: "Starve the Inflation Wyrm",
      command: "The wyrm grows fat on easy coin. Raise the rate of interest. Let weak enterprises burn so sound money may live.",
      briefing: "Tight money can suppress inflation and defend the currency. The immediate cost is failed firms, expensive mortgages, and unemployment.",
      choices: [
        {
          title: "Turn the monetary screw",
          description: "Raise rates sharply and accept a cleansing recession.",
          effects: { favour: 9, treasury: 7, prosperity: 4, peace: -8 },
          outcome: "Prices cool, the currency hardens, and shopkeepers learn that sound money makes a poor customer."
        },
        {
          title: "Tighten slowly and fund retraining",
          description: "Reduce inflation while helping displaced workers change trades.",
          effects: { favour: 2, treasury: 3, prosperity: 3, peace: 0 },
          outcome: "Inflation retreats without a rout. The Dismal God calls this sentimental, then quietly studies the figures."
        },
        {
          title: "Print coins bearing the God's face",
          description: "Finance growth with money creation and flatter your master with the design.",
          effects: { favour: -16, treasury: -7, prosperity: 2, peace: 4 },
          outcome: "Everyone has more coins. Unfortunately, the bakers now want several buckets of them for a loaf."
        }
      ]
    },
    {
      doctrine: "Tax reform",
      title: "Cut the Highest Tribute",
      command: "The most ambitious sorcerers surrender nearly all their final gold piece. Lower the highest tribute and let appetite become enterprise.",
      briefing: "Lower top income-tax rates can improve incentives and investment. Replacing the revenue with consumption taxes shifts more of the burden toward ordinary households.",
      choices: [
        {
          title: "Slash the top rate and tax consumption",
          description: "Reward high earners immediately and recover revenue at every shop counter.",
          effects: { favour: 8, treasury: 4, prosperity: 6, peace: -3 },
          outcome: "Entrepreneurs discover fresh enthusiasm. So do tax collectors stationed beside every loaf, boot, and candle."
        },
        {
          title: "Lower rates while closing exemptions",
          description: "Broaden the tax base and keep the change roughly funded.",
          effects: { favour: 2, treasury: 3, prosperity: 5, peace: 0 },
          outcome: "Rates fall, loopholes close, and the court accountants briefly experience the dangerous thrill of coherence."
        },
        {
          title: "Keep steep tribute on the great fortunes",
          description: "Preserve progressive rates and the intricate avoidance industry around them.",
          effects: { favour: -16, treasury: -4, prosperity: -2, peace: 3 },
          outcome: "The wealthy retain their tax alchemists. The Dismal God notes that even confiscation has become inefficient."
        }
      ]
    },
    {
      doctrine: "Right to Buy",
      title: "Sell the Council Keeps",
      command: "A tenant defends a door. An owner defends an order. Sell the public keeps to those who dwell within them.",
      briefing: "Discounted sales create homeowners and immediate revenue. Without replacement building, the remaining public housing becomes scarce.",
      choices: [
        {
          title: "Offer deep discounts to every tenant",
          description: "Create a property-owning constituency quickly.",
          effects: { favour: 8, treasury: 6, prosperity: 5, peace: 2 },
          outcome: "Hundreds receive keys to homes they already occupy. The housing rolls shrink today and lengthen tomorrow."
        },
        {
          title: "Sell, then build replacements",
          description: "Use every sale receipt to construct another public home.",
          effects: { favour: 2, treasury: 1, prosperity: 4, peace: 6 },
          outcome: "Ownership spreads and new keeps rise. The Treasury gains little, but fewer families vanish into private rents."
        },
        {
          title: "Keep every keep in public hands",
          description: "Preserve the housing stock and reject the cult of ownership.",
          effects: { favour: -17, treasury: -5, prosperity: -2, peace: 3 },
          outcome: "Rents stay low and repair queues stay long. Aspiring owners begin plotting against you over their garden fences."
        }
      ]
    },
    {
      doctrine: "Exchange controls",
      title: "Open the Capital Gates",
      command: "Gold imprisoned in the kingdom grows timid. Abolish the wardens at the border. Let every coin seek its highest return.",
      briefing: "Removing exchange controls lets firms invest and borrow internationally. It also allows wealth and financial trouble to leave or enter with little warning.",
      choices: [
        {
          title: "Abolish every capital control tonight",
          description: "Let money cross the border without permission or delay.",
          effects: { favour: 9, treasury: 5, prosperity: 8, peace: -2 },
          outcome: "Capital surges through the open gates in both directions. The clerks lose their stamps and the bankers gain the world."
        },
        {
          title: "Open the gates with reporting rules",
          description: "Permit free movement while making large transfers visible.",
          effects: { favour: 2, treasury: 3, prosperity: 6, peace: -1 },
          outcome: "Investment travels freely, carrying a small label for the auditors. The Dismal God calls the label cowardice."
        },
        {
          title: "Keep the gold safely behind the walls",
          description: "Require permission for foreign investment and currency transfers.",
          effects: { favour: -18, treasury: -3, prosperity: -5, peace: 2 },
          outcome: "The kingdom retains its gold and its paperwork. Foreign investors retain their distance."
        }
      ]
    },
    {
      doctrine: "Financial deregulation",
      title: "Unchain the City of Coin",
      command: "A gentleman's handshake is no match for a foreign algorithm. Tear down the old rules. Let capital move at the speed of greed.",
      briefing: "Opening the financial market attracts investment and modernises trading. It also concentrates wealth and makes distant failures arrive faster.",
      choices: [
        {
          title: "Stage the Big Infernal Bang",
          description: "End fixed commissions and admit foreign banks at once.",
          effects: { favour: 10, treasury: 8, prosperity: 12, peace: -6 },
          outcome: "The City erupts in gold, glass towers, and alarming new vocabulary. Provincial banks become historical attractions."
        },
        {
          title: "Deregulate with capital safeguards",
          description: "Welcome competition but require reserves and oversight.",
          effects: { favour: 2, treasury: 4, prosperity: 7, peace: -1 },
          outcome: "Finance grows quickly and keeps a modest fire bucket nearby. Traders complain until their bonuses arrive."
        },
        {
          title: "Preserve the ancient gentlemen's cartel",
          description: "Keep foreign banks and modern trading outside the walls.",
          effects: { favour: -19, treasury: -4, prosperity: -6, peace: 3 },
          outcome: "The old houses retain their manners and commissions. Global capital takes its vulgar business elsewhere."
        }
      ]
    },
    {
      doctrine: "Enterprise zones",
      title: "Consecrate the Abandoned Wards",
      command: "Where mills have died, suspend taxes and planning law. Mark the ruins as enterprise zones and command prosperity to appear.",
      briefing: "Targeted tax relief can attract development to declining districts. Without local hiring and infrastructure, it can simply move investment across a boundary.",
      choices: [
        {
          title: "Erase taxes inside the sacred boundary",
          description: "Offer developers maximum relief with few conditions.",
          effects: { favour: 8, treasury: 5, prosperity: 7, peace: 1 },
          outcome: "Warehouses and offices bloom on cheap land. Some employ the old residents; others employ their former landlords."
        },
        {
          title: "Tie relief to jobs and local transport",
          description: "Grant incentives only with hiring, training, and infrastructure commitments.",
          effects: { favour: 2, treasury: 2, prosperity: 5, peace: 1 },
          outcome: "The zones grow more slowly, but wages and buses arrive with the glass buildings."
        },
        {
          title: "Let the councils rebuild directly",
          description: "Fund municipal industry instead of private tax relief.",
          effects: { favour: -17, treasury: -6, prosperity: -1, peace: 4 },
          outcome: "The councils open workshops with excellent canteens and extremely patient business plans."
        }
      ]
    },
    {
      doctrine: "Community Charge",
      title: "Levy Every Hearth Alike",
      command: "Why should a palace pay more for refuse than a hut? Every adult soul consumes the realm. Charge every soul the same.",
      briefing: "A flat local charge makes the cost of councils visible. Requiring rich and poor residents to pay the same amount is fiercely regressive.",
      choices: [
        {
          title: "Count every head and send the bill",
          description: "Impose one uncompromising charge on every adult.",
          effects: { favour: 8, treasury: 9, prosperity: 1, peace: -16 },
          outcome: "The ledgers become transparent. So do the paving stones as a hundred thousand furious citizens lift them."
        },
        {
          title: "Scale the charge by household income",
          description: "Keep local accountability without the identical bill.",
          effects: { favour: 1, treasury: 5, prosperity: 1, peace: 1 },
          outcome: "The new levy is comprehensible and mostly paid. The Dismal God objects that fairness has contaminated the experiment."
        },
        {
          title: "Let property owners fund the councils",
          description: "Retain the old rates and their obscure valuations.",
          effects: { favour: -20, treasury: -4, prosperity: -1, peace: 5 },
          outcome: "The hated old system survives. No one understands the bill, which proves unexpectedly calming."
        }
      ]
    },
    {
      doctrine: "Pit closures",
      title: "Close the Black Pits",
      command: "The deep pits eat subsidies and miners. Close those that cannot profit. The kingdom cannot live forever in its glorious past.",
      briefing: "Closing uncompetitive mines reduces public losses and forces an energy transition. Whole communities depend on work that will not return.",
      choices: [
        {
          title: "Close every loss-making pit",
          description: "End subsidies quickly and import cheaper fuel.",
          effects: { favour: 9, treasury: 8, prosperity: 3, peace: -14 },
          outcome: "The balance sheet heals. Across the coalfields, clubs, shops, and futures close beside the pits."
        },
        {
          title: "Close pits with a regional compact",
          description: "Fund new industries, transport, and guaranteed retraining first.",
          effects: { favour: 2, treasury: 3, prosperity: 5, peace: 1 },
          outcome: "Coal declines, but the towns receive roads, colleges, and work before the last cage rises."
        },
        {
          title: "Subsidise coal until the mountains empty",
          description: "Protect every job and leave the reckoning to a future priest.",
          effects: { favour: -20, treasury: -10, prosperity: -3, peace: 6 },
          outcome: "The pits remain the heart of their towns. The Treasury develops a deep, persistent wheeze."
        }
      ]
    }
  ];

  const initialStats = Object.freeze({
    favour: 62,
    treasury: 48,
    prosperity: 42,
    peace: 68
  });

  function clamp(value) {
    return Math.max(0, Math.min(100, value));
  }

  function createGame() {
    return {
      turn: 0,
      stats: { ...initialStats },
      history: [],
      ended: false,
      ending: null
    };
  }

  function isReadout(value) {
    return Number.isFinite(value) && value >= 0 && value <= 100;
  }

  function isGameState(state) {
    return Boolean(
      state &&
      Number.isInteger(state.turn) &&
      state.turn >= 0 &&
      state.turn <= decrees.length &&
      state.stats &&
      isReadout(state.stats.favour) &&
      isReadout(state.stats.treasury) &&
      isReadout(state.stats.prosperity) &&
      isReadout(state.stats.peace) &&
      Array.isArray(state.history) &&
      (state.ended === true || state.ended === false) &&
      (state.ended || state.turn < decrees.length)
    );
  }

  function endingFor(state, completed) {
    let ending;
    if (state.stats.favour <= 0) {
      ending = {
        title: "Condemned to the Infernal Treasury",
        text: "The Dismal God tires of your heterodoxy. You are assigned to Hell's Office of Unreconciled Accounts, where every ledger differs by one penny."
      };
    } else if (state.stats.treasury <= 0) {
      ending = {
        title: "The Kingdom Is Repossessed",
        text: "The Crown defaults. Foreign moneylenders acquire the palace, the roads, and several strategic bishops. The Dismal God denies knowing you."
      };
    } else if (state.stats.peace <= 0) {
      ending = {
        title: "The People Amend the Constitution",
        text: "The crowd enters the palace carrying banners, grievances, and practical tools. Your office is abolished with unusual enthusiasm."
      };
    } else if (completed && state.stats.favour >= 90 && state.stats.prosperity >= 75 && state.stats.peace < 35) {
      ending = {
        title: "Infernal Orthodoxy",
        text: "The ledgers blaze with prosperity while the kingdom holds together by three remaining threads. The Dismal God promotes you from servant to precedent."
      };
    } else if (completed && state.stats.prosperity >= 65 && state.stats.peace >= 45) {
      ending = {
        title: "The Necessary Monster",
        text: "The realm is richer, leaner, and still recognisably a society. The Dismal God admits that your compromises worked, then claims they were its plan all along."
      };
    } else if (completed && state.stats.prosperity >= 60) {
      ending = {
        title: "No Alternative",
        text: "The numbers shine while old towns darken. Historians spend generations arguing whether you saved the kingdom or merely taught it to price everything."
      };
    } else if (completed) {
      ending = {
        title: "Managed Decline, Respectably Presented",
        text: "The realm survives, the ledgers balance after creative interpretation, and nobody is satisfied. This is judged a mature political settlement."
      };
    } else {
      ending = null;
    }
    return ending;
  }

  function applyChoice(state, choiceIndex) {
    if (isGameState(state)) {
      if (state.ended === false) {
        if (Number.isInteger(choiceIndex) && choiceIndex >= 0 && choiceIndex < 3) {
          const decree = decrees[state.turn];
          const choice = decree.choices[choiceIndex];
          const stats = {
            favour: clamp(state.stats.favour + choice.effects.favour),
            treasury: clamp(state.stats.treasury + choice.effects.treasury),
            prosperity: clamp(state.stats.prosperity + choice.effects.prosperity),
            peace: clamp(state.stats.peace + choice.effects.peace)
          };
          const turn = state.turn + 1;
          const completed = turn >= decrees.length;
          const nextState = {
            turn,
            stats,
            history: state.history.concat({
              decree: decree.title,
              choice: choice.title,
              outcome: choice.outcome
            }),
            ended: false,
            ending: null
          };
          const ending = endingFor(nextState, completed);
          if (ending === null) {
            return nextState;
          } else {
            return { ...nextState, ended: true, ending };
          }
        } else {
          throw new Error("Cannot apply policy choice: expected an integer choice from 0 to 2 for the current decree; received " + String(choiceIndex) + ".");
        }
      } else {
        throw new Error("Cannot apply policy choice: the reign has already ended; start a new game before choosing another policy.");
      }
    } else {
      throw new Error("Cannot apply policy choice: the supplied game state is incomplete or invalid; create the state with createGame().");
    }
  }

  return Object.freeze({
    decrees,
    createGame,
    applyChoice
  });
}));
