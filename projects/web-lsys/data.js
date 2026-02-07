/**
 * data.js - Rule sets and constants
 * Ported from LSystemRules.java and Galleries.java
 */

const DATA = (() => {
    const PLANT_GALLERY = [
        "s s s s [ [ [ A1.5707 Colour255,0,0 [ Tetrahedron ] P [ P P HR Circle ] [ P HR Circle ] HR Tetrahedron ] ] ]",
        "s s s s HR HR HR HR [ s F F A1.5707 Colour255,0,0 LightsOn Icosahedron LightsOff ]",
        "s s s s s s s s Koch2",
        "A0.7 R Y Y s s s s s s s s s s Koch3",
        "A0.7 s s s s s s s s Sierpinksi",
        "Scale(0.1,0.1,0.1) A0.7 s s s s s s s Gosper",
        "s s s s s s s Tree3",
        "HR s s s s s s 3DTreeLeafy",
        "A1.57 s s s s leaf",
        "A1.57 s s s s leaf2",
        "A1.5707 s s s s R R A1.57 P Flower",
        "A1.5707 s s s s R R A1.57 P Flower10",
        "A1.5707 s s s s R R A1.57 P Flower11",
        "A1.57 s s s s lineStar",
        "Scale(0.25,0.25,0.25) s s s s s s s starburst"
    ];

    const PLANT_LABELS = [
        "TETRAHEDRON", "ICOSAHEDRON", "KOCH2", "KOCH3", "SIERPINSKI",
        "GOSPER", "TREE3", "TREE3LEAFY", "LEAF", "LEAF2",
        "FLOWER", "FLOWER10", "FLOWER11", "LINESTAR", "STARBURST"
    ];

    const PLANT_COMPENSATIONS = [
        [4.04, 0, 0], [6.81, 0, -0.76], [2.70, -2.05, -0.83], [6.07, 0.36, -0.79], [2.25, 1.18, -1.70],
        [9.03, 2.13, 0.12], [4.58, -0.73, -2.85], [3.74, 0.02, -1.06], [5.08, 0, -2.02], [4.77, 0, -0.82],
        [1.66, 0.03, 0.03], [10.0, 0.03, -1.41], [4.16, 0, 0], [3.06, 0, 0], [10.0, 0, 0]
    ];

    const GLOBAL_RULE_BOOK = {
        "Quad": { "Quad": ["Q"] },
        "Koch3": { "Koch3": ["R", "A1.57", "TF", "y", "TF", "y", "TF", "y", "TF"], "TF": ["TF", "TF", "y", "TF", "y", "TF", "y", "TF", "y", "TF", "Y", "TF"] },
        "Tree3": { "Tree3": ["A0.3926991", "TF"], "TF": ["TF", "TF", "y", "[", "y", "TF", "Y", "TF", "Y", "TF", "]", "Y", "[", "Y", "TF", "y", "TF", "y", "TF", "]"] },
        "3DTree3": { "3DTree3": ["Colour255,233,155", "A0.3926991", "TF"], "TF": ["TF", "TF", "y", "r", "[", "y", "TF", "Y", "TF", "Y", "TF", "]", "Y", "[", "Y", "TF", "y", "TF", "y", "TF", "]"] },
        "3DTreeLeafy": { "3DTreeLeafy": ["Colour0,255,255", "A0.3926991", "TF"], "TF": ["TF", "TF", "y", "r", "le", "Colour0,255,255", "[", "y", "TF", "Y", "TF", "Y", "TF", "[", "s", "s", "s", "s", "s", "s", "leaf", "]", "Colour0,255,255", "]", "Y", "[", "Y", "TF", "y", "TF", "y", "TF", "[", "s", "s", "s", "s", "s", "s", "leaf", "]", "Colour0,255,255", "]", "Colour0,255,255"] },
        "starburst": { "starburst": ["A0.35", "[", "lA", "]", "[", "lB", "]"], "lA": ["[", "y", "lA", "]", "lC"], "lB": ["[", "Y", "lB", "]", "lC"], "lC": ["TF", "lC"] },
        "leaf": { "leaf": ["A0.35", "Colour0,255,0", "[", "lA", "]", "[", "lB", "]"], "lB": ["[", "Y", "lB", "{", "Colour0,155,0", ".", "]", "Colour0,255,0", ".", "lC", "Colour0,155,0", ".", "}"], "lA": ["[", "y", "lA", "{", "Colour0,155,0", ".", "]", "Colour0,255,0", ".", "lC", "Colour0,255,0", ".", "reverseTriangle", "}"], "lC": ["F", "lC"] },
        "leaf2": { "leaf2": ["A0.35", "Colour0,255,0", ".", "[", "lA", "]", "[", "lB", "]"], "lA": ["[", "y", "lA", "]", "lC", "."], "lB": ["[", "Y", "lB", "]", "lC", "."], "lC": ["F", "lC"] },
        "KIomega": { "KIomega": ["A1.57", "s", "s", "s", "s", "s", "TF", "y", "TF", "y", "TF", "y", "TF", "y"], "TF": ["TF", "y", "TF", "Y", "TF", "Y", "TF", "TF", "y", "TF", "y", "TF", "Y", "TF"] },
        "Gosper": { "Gosper": ["Colour255,255,255", "A1.0472", "Gosperl"], "Gosperl": [".", "F", "Gosperl", "Y", "Gosperr", "Y", "Y", "Gosperr", "y", "Gosperl", "y", "y", "Gosperl", "Gosperl", "y", "Gosperr", "Y"], "Gosperr": [".", "F", "y", "Gosperr", "Y", "Gosperr", "Gosperr", "Y", "Y", "Gosperr", "Y", "Gosperl", "y", "y", "Gosperl", "y", "Gosperr"] },
        "Sierpinksi": { "Sierpinksi": ["A1.0472", "Sierpr"], "Sierpl": [".", "F", "Sierpr", "Y", "Sierpl", "Y", "Sierpr"], "Sierpr": [".", "F", "Sierpl", "y", "Sierpr", "y", "Sierpl"] },
        "Koch2": { "Koch2": ["A1.57", "y", "TF"], "TF": ["TF", "Y", "TF", "y", "TF", "y", "TF", "Y", "TF", "T", "F"] },
        "Flower": { "Flower": ["A0.314159", "Colour139,69,19", "[", "Pedicel", "RotateColour", "Y", "Wedge", "Y", "Y", "Y", "Y", "Wedge", "Y", "Y", "Y", "Y", "Wedge", "Y", "Y", "Y", "Y", "Wedge", "Y", "Y", "Y", "Y", "Wedge", "]"], "Pedicel": ["TF", "TF"], "Wedge": ["[", "Colour0,255,0", "P", "TF", "]", "[", "WedgeLeaf", "]"] },
        "Flower10": { "Flower10": ["A0.523598", "Colour139,69,19", "[", "Pedicel", "RotateColour", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "]"], "Pedicel": ["TF", "TF"], "Wedge": ["[", "Colour0,255,0", "P", "TF", "]", "[", "WedgeLeaf", "]"] },
        "Flower11": { "Flower11": ["A0.523598", "Colour139,69,19", "[", "Pedicel", "RotateColour", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "Y", "Wedge", "]"], "Pedicel": ["TF", "TF"], "Wedge": ["[", "Colour0,255,0", "P", "TF", "]", "[", "WedgeLeaf", "]"] },
        "WedgeLeaf": { "WedgeLeaf": ["p", "p", "A0.6", "y", "Colour255,255,255", ".", "[", "F", "Y", ".", "F", "A1.5708", "Y", "Y", "A0.6", "y", "Colour255,255,255", ".", ".", "F", "Y", "Colour255,255,255", "Colour255,200,200", ".", "F", "]", "Colour255,255,255", "."] },
        "Tetrahedron": { "Tetrahedron": ["A1.5707", "Colour255,0,0", "[", "c1", "c2", "c3", "]", "Colour0,255,0", "[", "c1", "c3", "c4", "]", "Colour0,0,255", "[", "c1", "c2", "c4", "]", "Colour255,255,255", "[", "c4", "c3", "c2", "]"], "c1": ["[", "F", "P", "F", "Y", "F", ".", "]"], "c2": ["[", "f", "P", "f", "Y", "F", ".", "]"], "c3": ["[", "f", "P", "F", "Y", "f", ".", "]"], "c4": ["[", "F", "P", "f", "Y", "f", ".", "]"] },
        "Circle": { "Circle": ["A0.71", "spoke"], "spoke": ["spoke", "Y", "[", "F", "F", "s", "s", "s", "Tetrahedron", "]"] },
        "Icosahedron": { "Icosahedron": ["A1.5707", "[", "Y", "Y", "p", "R", "R", "p", "Colour255,255,255", "patch1", "]", "[", "ring", "]", "[", "Y", "P", "ring", "]", "[", "Y", "R", "ring", "]", "[", "Colour255,255,0", "patch1", "R", "R", "Colour255,0,255", "patch1", "P", "P", "Colour0,255,255", "patch1", "]"], "patch1": ["[", "F", "F", "Y", "F", ".", "]", "[", "P", "F", "F", "p", "F", ".", "]", "[", "Y", "F", "F", "P", "F", ".", "]", "reverseTriangle", "[", "F", "F", "y", "F", ".", "]", "[", "P", "F", "F", "p", "F", ".", "]", "[", "y", "F", "F", "P", "F", ".", "]"], "ring": ["Colour255,0,0", "[", "F", "[", "F", "[", "Y", "F", ".", "]", "[", "y", "F", ".", "]", "]", "[", "P", "F", "F", ".", "]", "]", "reverseTriangle", "Colour0,255,0", "[", "F", "[", "F", "[", "Y", "F", ".", "]", "[", "y", "F", ".", "]", "]", "[", "p", "F", "F", ".", "]", "]", "Y", "Y", "Colour0,0,255", "[", "F", "[", "F", "[", "Y", "F", ".", "]", "[", "y", "F", ".", "]", "]", "[", "P", "F", "F", ".", "]", "]", "reverseTriangle", "Colour255,0,255", "[", "F", "[", "F", "[", "Y", "F", ".", "]", "[", "y", "F", ".", "]", "]", "[", "p", "F", "F", ".", "]", "]"] },
        "Prism": { "Prism": ["Colour0,255,0", "A1.5707", "hs", "y", "F", "Y", "p", "F", "P", "hS", "[", "c1", "c2", "c3", "]", "[", "c1", "c4", "c2", "]", "[", "c1", "c3", "c4", "]", "[", "c4", "c6", "c5", "]", "[", "c4", "c5", "c2", "]", "[", "c4", "c3", "c6", "]", "[", "c2", "c5", "c6", "]", "[", "c6", "c3", "c2", "]", "hs", "F", "Y", "F", "y", "hS", "p"], "c1": ["[", ".", "]"], "c2": ["[", "F", ".", "]"], "c3": ["[", "P", "F", ".", "]"], "c4": ["[", "Y", "F", "y", ".", "]"], "c5": ["[", "Y", "F", "y", "F", ".", "]"], "c6": ["[", "Y", "F", "y", "P", "F", ".", "]"] },
        "Prism1": { "Prism1": ["Colour255,0,0", "A1.5707", "hs", "y", "F", "Y", "p", "F", "P", "hS", "[", "c1", "c2", "c3", "]", "[", "c1", "c4", "c2", "]", "[", "c1", "c3", "c4", "]", "[", "c4", "c6", "c5", "]", "[", "c4", "c5", "c2", "]", "[", "c4", "c3", "c6", "]", "[", "c2", "c5", "c6", "]", "[", "c6", "c3", "c2", "]", "hs", "F", "Y", "F", "y", "hS", "p"], "c1": ["[", ".", "]"], "c2": ["[", "F", ".", "]"], "c3": ["[", "P", "F", ".", "]"], "c4": ["[", "Y", "F", "y", ".", "]"], "c5": ["[", "Y", "F", "y", "F", ".", "]"], "c6": ["[", "Y", "F", "y", "P", "F", ".", "]"] },
        "lineStar": { "lineStar": ["A0.35", "Colour0,255,0", "[", "lA", "]", "[", "lB", "]"], "lA": ["[", "y", "lA", "{", ".", "]", ".", "lC", ".", "}"], "lB": ["[", "Y", "lB", "{", ".", "]", ".", "lC", ".", "}"], "lC": ["F", "lC"] }
    };

    const META_DATA = {
        "Quad": { iterations: 3, style: "TRIANGLES", useLighting: false },
        "Koch3": { iterations: 4, style: "LINES", useLighting: false },
        "Koch2": { iterations: 4, style: "TRIANGLES", useLighting: false },
        "Tree3": { iterations: 4, style: "LINE_LOOP", useLighting: false },
        "3DTree3": { iterations: 4, style: "TRIANGLES", useLighting: false },
        "3DTreeLeafy": { iterations: 3, style: "TRIANGLES", useLighting: false },
        "starburst": { iterations: 10, style: "TRIANGLES", useLighting: false },
        "leaf": { iterations: 7, style: "TRIANGLES", useLighting: false },
        "leaf2": { iterations: 7, style: "TRIANGLE_FAN", useLighting: false },
        "KIomega": { iterations: 3, style: "TRIANGLES", useLighting: false },
        "Gosper": { iterations: 6, style: "LINE_LOOP", useLighting: false },
        "Sierpinksi": { iterations: 7, style: "LINE_LOOP", useLighting: false },
        "Flower": { iterations: 5, style: "TRIANGLES", useLighting: false },
        "Flower10": { iterations: 5, style: "TRIANGLES", useLighting: false },
        "Flower11": { iterations: 5, style: "TRIANGLES", useLighting: false },
        "Tetrahedron": { iterations: 2, style: "TRIANGLES", useLighting: false },
        "Circle": { iterations: 10, style: "TRIANGLES", useLighting: false },
        "Icosahedron": { iterations: 4, style: "TRIANGLES", useLighting: true, backfaceCull: true },
        "Prism": { iterations: 3, style: "TRIANGLES", useLighting: true, backfaceCull: true },
        "Prism1": { iterations: 3, style: "TRIANGLES", useLighting: true, backfaceCull: true },
        "lineStar": { iterations: 8, style: "LINE_STRIP", useLighting: false }
    };

    const SNEK_L_SYSTEM = "[ mirrorOff noRtt LightsOn Colour255,0,0 f A0.35 R HR [ s s Arrow F Arrow Prism [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] A1.5707 hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(0) Prism1 [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(1) Prism  [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(2) Prism1 [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(3) Prism  [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(4) Prism1 [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(5) Prism  [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(6) Prism1 [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(7) Prism  [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(8) Prism1 [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(9) Prism  [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(10) Prism1 [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(11) Prism  [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(12) Prism1 [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(13) Prism  [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(14) Prism1 [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(15) Prism  [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(16) Prism1 [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(17) Prism  [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(18) Prism1 [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(19) Prism  [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(20) Prism1 [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(21) Prism  [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] hs F Scale(1.2,1.2,1.2) p F Scale(0.8333,0.8333,0.8333) hS Hinge(22) Prism1 [ hs F  A2.356 P  Scale(1.0,1.2,1.0) ] ] ]";

    const SNEK_PATTERNS = {
        "snek": [0, 1, 0, 2, 2, 0, 2, 2, 0, 1, 0, 0, 0, 2, -1, -1, 2, -1, 0, 0, 2, 1, -1],
        "frog": [-1, 0, -1, 1, 1, 2, -1, 1, 0, 0, 1, 2, -1, 0, 0, -1, 1, 2, -1, -1, 1, 0, 1],
        "tapering": [0, 1, 0, 2, 2, 0, -1, 2, -1, -1, 0, 0, 0, 1, -1, 2, -1, 0, 2, 2, 0, -1, 0],
        "snowflake": [-1, -1, -1, -1, 1, 1, 1, 1, -1, -1, -1, -1, 1, 1, 1, 1, -1, -1, -1, -1, 1, 1, 1, 1],
        "rooster": [2, 0, -1, 0, -1, 1, 2, 1, 0, 2, 2, 0, 1, 2, 1, -1, 0, -1, 0, 2, 2, 0, 0],
        "ball": [-1, 1, 1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1],
        "snowman": [0, -2, 2, 0, 2, -2, 0, 0, 0, -2, 2, 0, 2, -2, 0, 0, 0, -2, 2, 0, 2, -2, 0, 0],
        "mask": [1, 0, 1, 0, 0, 0, 0, -1, 0, -1, 1, 0, 1, -2, 0, -2, 0, 0, 2, 0, 2, -1, 0, 0],
        "ostrich": [0, 0, 2, -2, 0, 1, 0, -2, 2, 0, 2, -2, 0, -1, 0, -2, 2, 0, 0, 0, 0, 0, 2, 0],
        "triangle": [0, 0, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0, 0, 0, 1, 0],
        "transport": [0, 0, 2, 0, 0, 0, 0, -2, 2, 0, 0, 0, 2, -2, 0, 0, 0, -2, 2, 0, 0, 0, 0, 0]
    };

    const SNEK_PITCH = {
        "snek": 180, "rooster": -45, "mask": 45, "ostrich": 45
    };

    const POT_COMPENSATION = [0.74, 0.02, -4.0];

    return {
        PLANT_GALLERY, PLANT_LABELS, PLANT_COMPENSATIONS,
        GLOBAL_RULE_BOOK, META_DATA,
        SNEK_L_SYSTEM, SNEK_PATTERNS, SNEK_PITCH,
        POT_COMPENSATION
    };
})();

const POT_GEN = (() => {
    const TRUNKS = [
        "F T F T F T", "F T F T F T F T", "F T F T F T F T F T"
    ];
    const FORKS = [
        "[ y MyBranch ] [ Y MyBranch ] [ r p MyBranch ] [ R p MyBranch ]",
        "[ y MyBranch ] [ Y MyBranch ] [ r p MyBranch ]",
        "[ y MyBranch ] [ Y MyBranch ] [ r p MyBranch ] [ R p MyBranch ] [ P MyBranch ]"
    ];
    const BRANCHES = [
        "s F T [ y MyBranch [ p S S MyLeaf ] ] [ Y MyBranch [ p S S MyLeaf ] ] [ p S S MyLeaf ] ",
        "s F T F T [ y MyBranch [ p S S MyLeaf ] ] [ Y MyBranch [ p S S MyLeaf ] ] [ P S S MyLeaf ]",
        "s F T [ y MyBranch ] [ r MyBranch ] [ Y S S MyLeaf ]",
        "s F T [ MyLeaf ] [ y MyBranch ] [ Y MyBranch ]"
    ];
    const LEAVES = [
        "[ T ]", "[ r p T r p T r p T ]", "[ Y T y T Y T ]", "[ p T P T p T ]"
    ];

    function randomColor() {
        const r = 50 + Math.floor(Math.random() * 206);
        const g = 50 + Math.floor(Math.random() * 206);
        const b = 50 + Math.floor(Math.random() * 206);
        return `Colour${r},${g},${b}`;
    }

    function generate() {
        const trunkColor = randomColor();
        const leafColor = randomColor();
        const angle = (0.3 + Math.random() * 0.3).toFixed(2);
        const trunk = TRUNKS[Math.floor(Math.random() * TRUNKS.length)];
        const fork = FORKS[Math.floor(Math.random() * FORKS.length)];
        const branch = BRANCHES[Math.floor(Math.random() * BRANCHES.length)];
        const leaf = LEAVES[Math.floor(Math.random() * LEAVES.length)];

        return {
            "RandomBonsai": ["A" + angle, trunkColor, trunk, fork].join(" ").split(" "),
            "MyBranch": branch.split(" "),
            "MyLeaf": [leafColor, leaf].join(" ").split(" ")
        };
    }

    return { generate };
})();
