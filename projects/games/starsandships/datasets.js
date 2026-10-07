//Some madlibs-style planet and ship names

var planetstring = "OPTIOCEUS ZENSOFT MEPHUSS DANT ORIGIGION GURURIAN ZADICT HELIODEN SYNTHEBULB ORANGIMA GEOCATE THEOHONG BEP SYNCHREX GEGH HITBAT VENTOBEGH LATRUN PROGEN THEONSION SWEEPUP NAXFIN NAUTOS PETEND VENTOTICS VETRES BHANCE GNOMAX ZENSTER CHERIAN MELTMALON TRE PHOBOTOR TETRAQEP DEOFIRTH ABRATISM ZEROMALON SYNCHRICT LEGUE LONTIAL LEVITYPE GAULUGUE MONAMORPH LOCADE XEROGAGE SUBSAT BHASTRE EXOLAP SIPIA TETRALE PATAKREUZ ZENEST WETRUN VIRGUTE GIGAGION SULPHAGUE TIX ZEROCT NANOROPE THEATEN PATECYCA MEDITH NEBLE PROTODICE CANT GENET ETHEROX PASHELL CASANG GIGAPHER PORTANOID ARTISOFT XYLOZE XEPHACAL VIANG KINEDET EGOTIUM CANOLEROS VATYPE PROTORON MAVE NONSYSH CATHAMA BEPHIA SITAUR GANGET NIMRUS BABYLOLA AUDINT LOPE KILOSH HAVAL NEDTOX PENTRATE";

var shipstring = "Buccaneer's Howl,Plunderer's Executioner,Posideon's Hoard,Buccaneer's Treasure,Calypso's Hangman,Dragon's Anger,Hades' Rage,Neptune's Raider,Pirate's Plunder,Sea's Vile Grail,Battler Configurable Heavy Fortress,Experimental Sub-space Outer-System Siege Shipper,Experimental Variable Far-range Trans-dimensional, Special Interceptor,Long-range Light Wartime Carrier,Sub-space Atmospheric Battlecruiser,Galactic Strategic Transport Heavy Troop Battlecruiser,Long-range Wartime Super-Invader Medium-range Heavy Civilian Macro-Bomber,Medium-range Intergalactic Orbital, Wartime Mega-Spy, Multi-Function Spatial Medium Troop Probe,Multi-Function Stellar Atmospheric Heavy Fortress Orbital Light Bomber,Refittable Secret Macro-Dreadnaught, Striker Sub-space Medium Medical Probe,Variable Interstellar Heavy, Strategic Macro-Probe,Variable Long-range Stellar Outer-System Special Mega-Spy,Variable Sub-Orbital Civilian Invader,Midnight Transmitter (MT-995), Repair Trawler (RT-8224), Tesla Lynx (TL-39), Lightning Aegus Reaper (LIAR-7256), Dolemur Phoenix (DP-997), System Tanker (IT-704), Ice Ares (IA-279), Antimatter Feror (AF-483), Steam Laudus (SLAL-642), Light Ares (LA-39), Patrol Laudus (AUPAL-144), Quelete (QSH-625), Consular Wildcat, (CW-114),Extricor Trapper,Void Scavenger,Blockade Glider (BG-82),Medical Wasp (JMW-651),Ianthinis Barge (IAB-499),System Sentry (SS-580)";


var widgetstring = "infrabeam,chlefaot winch,ultracoil for the xenocortex,aedu macrotoggle,criaha purifier,ionic mortar,dual linear spanner";

var techstring = "Modular Management,Behavioral Chronology,Catastrophic Pyrodesign,Ancient Trigonometry, Ritualistic Discriminatory Astrology,Apocalyptic Archaeology,Speculative Arcana,Extrasensory Theology,Secondary Psionics,Experimental Cryptology,Humane Behavioral Analysis,Therapeutic Languages,Diverse Metaphysical Organisms,Nuclear Larceny,Eldritch Theocalculus,Necrotic Astrology,Unethical Mathematics";

planetNames = planetstring.split(" ");
shipNames = shipstring.split(",");
techNames = techstring.split(",");
function randomise(anArray) {
	anArray.sort(function() {return 0.5 - Math.random()});
}
randomise(planetNames);
randomise(shipNames);
randomise(techNames);

planetindex=0;
shipindex=0;
techindex=0;
function nextPlanet() {return planetNames[planetindex++]}
function nextShip() {return shipNames[shipindex++]}
function nextTech() {return techNames[techindex++]}
