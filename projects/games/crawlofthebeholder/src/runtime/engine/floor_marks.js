(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installFloorMarks = function (context) {
    with (context) {
      function floorMarksAt(x, y) {
        return currentFloorState().floorMarks.filter((mark) => mark.x === x && mark.y === y);
      }

      function floorMarkKindForElement(element) {
        if (element === "fire" || element === "elec") return "scorch";
        if (element === "acid" || element === "poison") return "poison";
        if (element === "cold") return "ice";
        return "blood";
      }

      function addFloorMark(kind, x, y, intensity = 1) {
        if (!mapContains(x, y) || mapKind(x, y) !== "floor") return null;
        const floorState = currentFloorState();
        const existing = floorState.floorMarks.find((mark) => mark.x === x && mark.y === y && mark.kind === kind);
        if (existing) {
          existing.intensity = Math.min(4, existing.intensity + Math.max(1, intensity));
          existing.turn = state.turnCount;
          return existing;
        }

        const mark = { kind, x, y, intensity: Math.max(1, Math.min(4, intensity)), turn: state.turnCount };
        floorState.floorMarks.push(mark);
        floorState.floorMarks = floorState.floorMarks.slice(-80);
        return mark;
      }

      function addDamageMark(cell, element, damage = 1) {
        if (!cell || damage <= 0) return null;
        const intensity = damage >= 14 ? 3 : damage >= 7 ? 2 : 1;
        return addFloorMark(floorMarkKindForElement(element), cell.x, cell.y, intensity);
      }

      Object.assign(context, {
        floorMarksAt,
        floorMarkKindForElement,
        addFloorMark,
        addDamageMark,
      });
    }
  };
}());
