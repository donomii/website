(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installContracts = function installContracts(context) {
    with (context) {
      const CONTRACT_TYPES = ["hunt", "survive", "explore", "clear"];
      const MAX_ACTIVE     = 2;

      context.CONTRACT_TYPES = CONTRACT_TYPES;

      // ── State ──────────────────────────────────────────────────────────────
      if (!state.activeContracts)   state.activeContracts   = [];
      if (!state.completedContracts) state.completedContracts = [];
      if (!state.contractIdSeq)     state.contractIdSeq     = 1;

      // ── Helpers ────────────────────────────────────────────────────────────
      function _goalForType(type, floorIndex) {
        const depth = Math.max(1, floorIndex || 0);
        switch (type) {
          case "hunt":    return { type, n: 3 + depth, progress: 0,  label: `Kill ${3 + depth} monsters` };
          case "survive": return { type, n: 15,        progress: 0,  label: "Survive 15 turns" };
          case "explore": return { type, pct: 70,      discovered: 0, total: 1, label: "Discover 70% of the floor" };
          case "clear":   return { type,               label: "Clear all monsters from the floor" };
          default:        return { type, n: 5,         progress: 0,  label: "Complete objective" };
        }
      }

      function _rewardForDepth(floorIndex) {
        const gold = 20 + (floorIndex || 0) * 10 + Math.floor(Math.random() * 15);
        return { gold };
      }

      function _isMet(contract) {
        const g = contract.goal;
        switch (g.type) {
          case "hunt":    return g.progress >= g.n;
          case "survive": return g.progress >= g.n;
          case "explore": return g.total > 0 && (g.discovered / g.total) * 100 >= g.pct;
          case "clear": {
            const fs = currentFloorState ? currentFloorState() : null;
            return !fs || (fs.monsters || []).every((m) => (m.hp || 0) <= 0);
          }
          default: return false;
        }
      }

      // ── Public API ─────────────────────────────────────────────────────────
      function generateContract(floorIndex) {
        if (context.contractsDisabled) return null;
        const type   = CONTRACT_TYPES[Math.floor(Math.random() * CONTRACT_TYPES.length)];
        const goal   = _goalForType(type, floorIndex);
        const reward = _rewardForDepth(floorIndex);
        const id     = `contract-${state.contractIdSeq++}`;
        return { id, type, goal, reward, floorIndex: floorIndex || 0, status: "open" };
      }

      function acceptContract(id, messages) {
        if (context.contractsDisabled) return false;
        if (!state.pendingContracts) state.pendingContracts = [];
        const contract = state.pendingContracts.find((c) => c.id === id);
        if (!contract) {
          messages.push("Contract not found.");
          return false;
        }
        if (state.activeContracts.length >= MAX_ACTIVE) {
          messages.push("You already have the maximum number of active contracts.");
          return false;
        }
        state.pendingContracts = state.pendingContracts.filter((c) => c.id !== id);
        contract.status = "active";
        state.activeContracts.push(contract);
        messages.push(`Contract accepted: ${contract.goal.label}.`);
        return true;
      }

      function abandonContract(id) {
        if (context.contractsDisabled) return false;
        const before = state.activeContracts.length;
        state.activeContracts = state.activeContracts.filter((c) => c.id !== id);
        return state.activeContracts.length < before;
      }

      function claimContract(id, messages) {
        if (context.contractsDisabled) return false;
        const contract = state.activeContracts.find((c) => c.id === id);
        if (!contract) {
          messages.push("Contract not found in active list.");
          return false;
        }
        if (!_isMet(contract)) {
          messages.push("Contract objective not yet complete.");
          return false;
        }
        // Pay out.
        state.gold = (state.gold || 0) + (contract.reward.gold || 0);
        contract.status = "complete";
        state.completedContracts.push(contract);
        state.activeContracts = state.activeContracts.filter((c) => c.id !== id);
        messages.push(`Contract complete! Reward: ${contract.reward.gold} gold.`);
        return true;
      }

      // ── Turn hook: auto-update progress ───────────────────────────────────
      function checkContracts(messages) {
        if (context.contractsDisabled) return;
        const fs = currentFloorState ? currentFloorState() : null;
        for (const c of state.activeContracts) {
          const g = c.goal;
          switch (g.type) {
            case "survive":
              g.progress = (g.progress || 0) + 1;
              break;
            case "explore":
              if (fs) {
                const cells  = fs.cells || state.floor || [];
                let total = 0;
                let seen  = 0;
                for (const row of cells) {
                  for (const cell of (row || [])) {
                    if (cell !== "x" && cell !== "X") {
                      total += 1;
                      seen  += 1; // In harness all cells are visible by default.
                    }
                  }
                }
                if (typeof discoveredCount === "function") {
                  seen = discoveredCount();
                }
                g.total      = total || 1;
                g.discovered = seen;
              }
              break;
            // hunt and clear progress is updated externally (kill events / real-time).
          }
          if (_isMet(c) && c.status === "active") {
            c.status = "complete-ready";
            messages.push(`Contract ready to claim: ${g.label}.`);
          }
        }
      }

      // Expose a helper for external systems (e.g. killMonster) to tick hunt progress.
      function notifyContractKill() {
        for (const c of state.activeContracts) {
          if (c.goal.type === "hunt") {
            c.goal.progress = (c.goal.progress || 0) + 1;
          }
        }
      }

      context.generateContract  = generateContract;
      context.acceptContract    = acceptContract;
      context.abandonContract   = abandonContract;
      context.claimContract     = claimContract;
      context.checkContracts    = checkContracts;
      context.notifyContractKill = notifyContractKill;

      turnHooks.push(checkContracts);
    }
  };
}());
