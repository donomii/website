(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installInput = function (context) {
    with (context) {
      function dispatchUiAction(action) {
        if (action === "help") {
          toggleHelpModal();
          return true;
        }
        if (action === "legend") {
          showModal("legendModal");
          return true;
        }
        if (action === "settings") {
          showModal("settingsModal");
          return true;
        }
        if (action === "achievements") {
          showModal("achievementsModal");
          return true;
        }
        if (action === "history") {
          showModal("historyModal");
          return true;
        }
        if (action === "character") {
          showModal("characterModal");
          return true;
        }
        if (action === "talents") {
          showModal("talentsModal");
          return true;
        }
        if (action === "markers") {
          showModal("markersModal");
          return true;
        }
        if (action === "saveSlots") {
          showModal("saveSlotsModal");
          return true;
        }
        if (action === "moreActions") {
          showModal("moreActionsModal");
          return true;
        }
        if (action === "bestiary") {
          showModal("bestiaryModal");
          return true;
        }
        if (action === "stats") {
          showModal("statsModal");
          return true;
        }
        if (action === "quests") {
          showModal("questsModal");
          return true;
        }
        if (action === "newRun") {
          if (typeof newRun === "function") newRun();
          return true;
        }
        if (action === "confirmNewRun") {
          if (typeof window?.confirm === "function") {
            if (!window.confirm("Wipe your save and start a new run?")) return true;
          }
          if (typeof newRun === "function") newRun();
          return true;
        }
        return false;
      }

      function bindInput() {
        document.querySelector(".command-strip").addEventListener("click", (event) => {
          const button = event.target.closest("button[data-action]");
          if (!button) return;
          const action = button.dataset.action;
          if (dispatchUiAction(action)) return;
          handleAction(action);
        });

        els.inventory.addEventListener("click", (event) => {
          const button = event.target.closest("button[data-item]");
          if (button) useItem(button.dataset.item);
        });

        document.querySelectorAll("[data-modal-close]").forEach((node) => {
          node.addEventListener("click", () => hideAllModals());
        });
        if (els.endModalNewRun?.addEventListener) {
          els.endModalNewRun.addEventListener("click", () => {
            if (typeof newRun === "function") newRun();
          });
        }
        const shareBtn = document.getElementById("endModalShare");
        if (shareBtn?.addEventListener) {
          shareBtn.addEventListener("click", () => {
            if (typeof copyRunSummary === "function") copyRunSummary();
          });
        }
        if (els.shopList?.addEventListener) {
          els.shopList.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-shop-buy]");
            if (button && typeof buyShopItem === "function") { buyShopItem(button.dataset.shopBuy); return; }
            const enchant = event.target.closest("button[data-shop-enchant]");
            if (enchant && typeof enchantInventoryItem === "function") {
              enchantInventoryItem();
            }
          });
        }
        if (els.talentsList?.addEventListener) {
          els.talentsList.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-talent]");
            if (!button) return;
            const idx = Number.parseInt(button.dataset.member, 10);
            if (typeof spendTalentPoint === "function") spendTalentPoint(idx, button.dataset.talent);
          });
        }
        if (els.markersModal?.addEventListener) {
          els.markersModal.addEventListener("click", (event) => {
            const drop = event.target.closest("button[data-marker-kind]");
            if (drop && typeof dropMapMarker === "function") {
              dropMapMarker(drop.dataset.markerKind);
              return;
            }
            const clear = event.target.closest("button[data-marker-clear]");
            if (clear && typeof clearMapMarkerHere === "function") {
              clearMapMarkerHere();
            }
          });
        }
        if (els.mapZoomIn?.addEventListener) {
          els.mapZoomIn.addEventListener("click", () => zoomMap(0.25));
        }
        if (els.mapZoomOut?.addEventListener) {
          els.mapZoomOut.addEventListener("click", () => zoomMap(-0.25));
        }
        if (els.mapZoomReset?.addEventListener) {
          els.mapZoomReset.addEventListener("click", () => resetMapZoom());
        }
        // Ctrl/⌘ + wheel zooms the map on desktops.
        if (els.mapScroller?.addEventListener) {
          els.mapScroller.addEventListener("wheel", (event) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            zoomMap(event.deltaY < 0 ? 0.25 : -0.25);
          }, { passive: false });
          // Pinch zoom: track two-finger touch movement.
          let pinchStartDistance = 0;
          let pinchStartZoom = 1;
          els.mapScroller.addEventListener("touchstart", (event) => {
            if (event.touches.length !== 2) return;
            const a = event.touches[0];
            const b = event.touches[1];
            pinchStartDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            pinchStartZoom = state.mapZoom || 1;
          }, { passive: true });
          els.mapScroller.addEventListener("touchmove", (event) => {
            if (event.touches.length !== 2 || !pinchStartDistance) return;
            const a = event.touches[0];
            const b = event.touches[1];
            const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            const ratio = distance / pinchStartDistance;
            setMapZoom(pinchStartZoom * ratio);
          }, { passive: true });
        }
        if (els.saveSlotList?.addEventListener) {
          els.saveSlotList.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-save-slot]");
            if (!button) return;
            if (typeof setActiveSlot === "function") setActiveSlot(button.dataset.saveSlot);
            els.saveSlotsModal?.classList.add("hidden");
            render();
          });
        }

        if (els.characterCreateList?.addEventListener) {
          els.characterCreateList.addEventListener("change", (event) => {
            const select = event.target.closest("select[data-member-index]");
            if (!select) return;
            const index = Number.parseInt(select.dataset.memberIndex, 10);
            const member = state.party[index];
            if (!member) return;
            const klass = (typeof CLASSES === "object") ? CLASSES[select.value] : null;
            member.classKey = select.value;
            member.signatureCooldown = 0;
            const desc = els.characterCreateList.querySelector(`[data-desc-for="${index}"]`);
            if (desc) desc.textContent = klass ? klass.description : "";
          });
        }
        if (els.characterCreateDifficulty?.addEventListener) {
          els.characterCreateDifficulty.addEventListener("change", () => {
            if (typeof setDifficulty === "function") setDifficulty(els.characterCreateDifficulty.value);
          });
        }
        if (els.characterCreateDeity?.addEventListener) {
          // Populate the patron list from the pantheon so new gods need no HTML.
          if (typeof getDeityDefinitions === "function" && typeof els.characterCreateDeity.replaceChildren === "function" && typeof document.createElement === "function") {
            const options = getDeityDefinitions().map((god) => {
              const option = document.createElement("option");
              option.value = god.key;
              option.textContent = god.name;
              if (god.key === "none") option.selected = true;
              return option;
            });
            if (options.every((o) => o && typeof o.value !== "undefined")) {
              els.characterCreateDeity.replaceChildren(...options);
            }
          }
          els.characterCreateDeity.addEventListener("change", () => {
            if (typeof setDeity === "function") setDeity(els.characterCreateDeity.value);
            if (els.characterCreateDailyDesc && typeof deityDescription === "function" && els.characterCreateDeity.value !== "none") {
              els.characterCreateDailyDesc.textContent = deityDescription(els.characterCreateDeity.value);
            }
          });
        }
        if (els.characterCreateDaily?.addEventListener) {
          if (els.characterCreateDailyDesc && typeof dailySeed === "function") {
            els.characterCreateDailyDesc.textContent = `Today's seed is ${dailySeed()}.`;
          }
          els.characterCreateDaily.addEventListener("change", () => {
            state.dailySeed = els.characterCreateDaily.checked && typeof dailySeed === "function" ? dailySeed() : null;
          });
        }
        if (els.characterCreateStart?.addEventListener) {
          els.characterCreateStart.addEventListener("click", () => {
            state.tutorialSeen = true;
            state.characterCreated = true;
            if (typeof applyClassStartingStats === "function") applyClassStartingStats();
            if (typeof applyDifficultyToFloors === "function") applyDifficultyToFloors();
            if (typeof applyNewGamePlus === "function") {
              const tier = applyNewGamePlus();
              if (tier > 0 && typeof showToast === "function") showToast(`New Game+ tier ${tier}: tougher foes, +${tier * 50} gold.`);
            }
            els.characterCreateModal?.classList.add("hidden");
            if (typeof saveGame === "function") saveGame();
            render();
          });
        }
        if (els.characterCreateRandom?.addEventListener) {
          els.characterCreateRandom.addEventListener("click", () => {
            const klasses = typeof getClassDefinitions === "function" ? getClassDefinitions() : [];
            for (const member of state.party) {
              member.classKey = klasses[Math.floor(Math.random() * klasses.length)]?.key || member.classKey;
            }
            renderCharacterCreate();
          });
        }
        if (els.dialogueChoices?.addEventListener) {
          els.dialogueChoices.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-dialogue-idx]");
            if (!button) return;
            const idx = Number.parseInt(button.dataset.dialogueIdx, 10);
            const choices = context.dialogueChoices || [];
            const choice = choices[idx];
            hideDialogue();
            if (choice?.onSelect) choice.onSelect();
          });
        }
        for (const name of ["helpModal", "legendModal", "settingsModal", "achievementsModal", "historyModal", "tutorialModal", "characterModal", "talentsModal", "markersModal", "saveSlotsModal", "shopModal", "dialogueModal", "moreActionsModal", "bestiaryModal", "questsModal", "statsModal"]) {
          const modal = els[name];
          if (modal?.addEventListener) {
            modal.addEventListener("click", (event) => {
              if (event.target === modal) hideAllModals();
            });
          }
        }
        if (els.settingsModal) {
          const settings = typeof readSettings === "function" ? readSettings() : {};
          const runModeCheck = document.getElementById("settingRunMode");
          const highContrastCheck = document.getElementById("settingHighContrast");
          const hideFlashCheck = document.getElementById("settingHideFlash");
          if (runModeCheck) {
            runModeCheck.checked = !!settings.runMode;
            state.runMode = !!settings.runMode;
            runModeCheck.addEventListener("change", () => {
              settings.runMode = runModeCheck.checked;
              state.runMode = runModeCheck.checked;
              writeSettings(settings);
            });
          }
          if (highContrastCheck) {
            highContrastCheck.checked = !!settings.highContrast;
            if (settings.highContrast) document.body.classList?.add("high-contrast");
            highContrastCheck.addEventListener("change", () => {
              settings.highContrast = highContrastCheck.checked;
              document.body.classList?.toggle?.("high-contrast", highContrastCheck.checked);
              writeSettings(settings);
            });
          }
          if (hideFlashCheck) {
            hideFlashCheck.checked = !!settings.hideFlash;
            if (settings.hideFlash) document.body.classList?.add("hide-crit-flash");
            hideFlashCheck.addEventListener("change", () => {
              settings.hideFlash = hideFlashCheck.checked;
              document.body.classList?.toggle?.("hide-crit-flash", hideFlashCheck.checked);
              writeSettings(settings);
            });
          }
          const hapticsCheck = document.getElementById("settingHaptics");
          if (hapticsCheck) {
            hapticsCheck.checked = settings.haptics !== false;
            hapticsCheck.addEventListener("change", () => {
              settings.haptics = hapticsCheck.checked;
              writeSettings(settings);
            });
          }
          const soundCheck = document.getElementById("settingSound");
          if (soundCheck) {
            soundCheck.checked = settings.sound !== false;
            soundCheck.addEventListener("change", () => {
              settings.sound = soundCheck.checked;
              writeSettings(settings);
              if (soundCheck.checked && typeof resumeAudio === "function") resumeAudio();
            });
          }
          const autoPickupCheck = document.getElementById("settingAutoPickup");
          if (autoPickupCheck) {
            autoPickupCheck.checked = state.autoPickup !== false;
            autoPickupCheck.addEventListener("change", () => {
              state.autoPickup = autoPickupCheck.checked;
              if (typeof saveGame === "function") saveGame();
            });
          }
          const colorblindCheck = document.getElementById("settingColorblind");
          if (colorblindCheck) {
            colorblindCheck.checked = !!settings.colorblind;
            if (settings.colorblind) document.body.classList?.add("colorblind");
            colorblindCheck.addEventListener("change", () => {
              settings.colorblind = colorblindCheck.checked;
              document.body.classList?.toggle?.("colorblind", colorblindCheck.checked);
              writeSettings(settings);
            });
          }
        }
        // First-launch flow: character creation supersedes the welcome screen.
        if (!state.characterCreated && els.characterCreateModal) {
          showModal("characterCreateModal");
        } else if (els.tutorialModal && !state.tutorialSeen) {
          els.tutorialModal.classList?.remove("hidden");
          state.tutorialSeen = true;
          if (typeof saveGame === "function") saveGame();
        }

        window.addEventListener("keydown", (event) => {
          if (els.tutorialModal && !els.tutorialModal.classList.contains("hidden")) {
            els.tutorialModal.classList.add("hidden");
            // Let the keypress proceed normally afterwards.
          }
          if (event.key === "Escape") {
            if (els.helpModal && !els.helpModal.classList.contains("hidden")) {
              event.preventDefault();
              hideHelpModal();
              return;
            }
          }
          if (event.key === "?") {
            event.preventDefault();
            toggleHelpModal();
            return;
          }

          const inventoryIndex = inventoryIndexForKey(event.key);
          if (inventoryIndex >= 0) {
            const item = state.inventory[inventoryIndex];
            if (!item) return;
            event.preventDefault();
            useItem(item.id);
            return;
          }

          // Inventory sort + filter toggles
          if (event.key === "[") {
            event.preventDefault();
            const next = cycleInventorySort();
            setMessage(`Inventory sort: ${next}.`);
            render();
            return;
          }
          if (event.key === "]") {
            event.preventDefault();
            const next = cycleInventoryFilter();
            setMessage(`Inventory filter: ${next}.`);
            render();
            return;
          }

          const keyMap = {
            ArrowLeft: "turnLeft",
            a: "turnLeft",
            A: "turnLeft",
            ArrowRight: "turnRight",
            d: "turnRight",
            D: "turnRight",
            q: "moveLeft",
            Q: "moveLeft",
            e: "moveRight",
            E: "moveRight",
            ArrowUp: "moveForward",
            w: "moveForward",
            W: "moveForward",
            ArrowDown: "moveBack",
            s: "moveBack",
            S: "moveBack",
            " ": "attack",
            ">": "interact",
            "<": "interact",
            Enter: "interact",
            u: "interact",
            U: "interact",
            ",": "pickup",
            g: "pickup",
            G: "pickup",
            x: "disarm",
            X: "disarm",
            ".": "wait",
            r: "wait",
            "5": "rest",
            R: "rest",
            o: "autoExplore",
            O: "autoExplore",
            t: "travelToStairs",
            T: "travelToStairs",
            f: "cycleFormation",
            F: "cycleFormation",
            c: "charge",
            C: "charge",
            y: "sweep",
            Y: "sweep",
            p: "dropItem",
            P: "dropItem",
            i: "examine",
            I: "examine",
            l: "legend",
            L: "legend",
            b: "signature",
            B: "signature",
            v: "ultimate",
            V: "ultimate",
            k: "character",
            K: "character",
            n: "search",
            N: "search",
            j: "talents",
            J: "talents",
            m: "markers",
            M: "markers"
          };
          const action = keyMap[event.key];
          if (!action) return;
          event.preventDefault();
          if (dispatchUiAction(action)) return;
          handleAction(action);
        });

        if ("ResizeObserver" in window) {
          const viewportObserver = new ResizeObserver(() => renderViewport());
          viewportObserver.observe(els.viewport);
        } else {
          window.addEventListener("resize", () => renderViewport());
        }

      }
      Object.assign(context, {
        bindInput,
        dispatchUiAction,
      });
    }
  };
}());
