import * as THREE from "./vendor/three.module.mjs";
import {RULES} from "./types.mjs";
import {movingObstacle} from "./engine.mjs";
// Geometry, textures, and camera are independent of the simulation.
import {trackPoint,trackHeading} from "./track.mjs";
import {makeTextures,faceTexture,tileTexture} from "./textures.mjs";
import {createScenery} from "./scenery.mjs";

export {trackPoint} from "./track.mjs";

export function createRenderer(canvas) {
    const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:"high-performance"});
    renderer.setPixelRatio(1);
    renderer.setSize(640,480,false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    const scene=new THREE.Scene();
    scene.background=new THREE.Color("#302921");
    const camera=new THREE.OrthographicCamera(-7.3,7.3,5.475,-5.475,0.1,150);
    scene.add(new THREE.AmbientLight("#eee8d3",1.5));
    const sun=new THREE.DirectionalLight("#fff3d4",2.1);
    sun.position.set(-8,18,-10);scene.add(sun);
    const textures=makeTextures();
    const pieces=new Map();
    const breakRing=new THREE.Mesh(new THREE.RingGeometry(0.55,0.72,24),new THREE.MeshBasicMaterial({color:"#ff6045",side:THREE.DoubleSide}));
    breakRing.rotation.x=-Math.PI/2;breakRing.visible=false;scene.add(breakRing);
    const tileMeshes=[];
    const bodyGeometry=new THREE.BoxGeometry(0.72,1.6,0.25);
    const bodyMat=new THREE.MeshLambertMaterial({color:"#d4d6ca",flatShading:true});
    const frontMat=new THREE.MeshLambertMaterial({map:faceTexture("domino"),flatShading:true});
    const playerMat=new THREE.MeshLambertMaterial({map:faceTexture("player"),flatShading:true});
    const shadowMat=new THREE.MeshBasicMaterial({color:"#121712",transparent:true,opacity:0.28,depthWrite:false});
    const shadowGeometry=new THREE.CircleGeometry(0.45,12);
    let scenery=null;
    let moverMesh=null;
    let currentGame=null;
    let heading=Math.PI/2;
    let cameraHeading=Math.PI/2;
    let previousTime=0;
    let victoryTime=0;
    const cameraTarget=new THREE.Vector3();
    const cameraPosition=new THREE.Vector3();
    const tileMaterials=new Map();
    function faceMaterials(front) {return [bodyMat,bodyMat,bodyMat,bodyMat,front,front];}
    function makeDomino(player=false) {
        const root=new THREE.Group();
        const pivot=new THREE.Group();root.add(pivot);
        const body=new THREE.Mesh(bodyGeometry,faceMaterials(player ? playerMat : frontMat));
        body.position.y=0.8+(player ? 0.24 : 0);
        pivot.add(body);
        const shadow=new THREE.Mesh(shadowGeometry,shadowMat);
        shadow.rotation.x=-Math.PI/2;shadow.position.y=0.024;root.add(shadow);
        const limbs=[];
        if(player){
            for(const side of [-1,1]){
                const leg=new THREE.Group();leg.position.set(side*0.2,0.24,0);pivot.add(leg);
                const foot=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.12,0.3),bodyMat);
                foot.position.set(0,-0.12,0.09);leg.add(foot);limbs.push(leg);
                const arm=new THREE.Group();arm.position.set(side*0.40,1.0,0);pivot.add(arm);
                const hand=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.32,0.13),bodyMat);
                hand.position.set(side*0.045,-0.10,0);arm.add(hand);limbs.push(arm);
            }
        }else{
            root.scale.set(0.9,0.9,0.9);
        }
        scene.add(root);
        return {root,pivot,limbs};
    }
    const player=makeDomino(true);
    function marker(cell,lane,kind,label) {
        const key=kind+label;
        if(!tileMaterials.has(key)){
            tileMaterials.set(key,new THREE.MeshBasicMaterial({map:tileTexture(kind,String(label)),transparent:true,side:THREE.DoubleSide,depthWrite:false}));
        }else{
            tileMaterials.get(key).visible=true;
        }
        const mark=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.9),tileMaterials.get(key));
        const p=trackPoint(cell,lane);
        mark.position.set(p.x,0.05,p.z);mark.rotation.x=-Math.PI/2;
        mark.rotation.z=-trackHeading(cell,lane);
        scene.add(mark);tileMeshes.push(mark);
        return mark;
    }
    function clearStage() {
        if(moverMesh){moverMesh.removeFromParent();}else{moverMesh=null;}
        pieces.forEach(piece=>piece.root.removeFromParent());pieces.clear();
        tileMeshes.splice(0).forEach(mesh=>{
            mesh.geometry.dispose();mesh.removeFromParent();
            if(![...tileMaterials.values()].includes(mesh.material)){mesh.material.dispose();}else{mesh.material.needsUpdate=false;}
        });
        if(scenery){scenery.dispose();}else{currentGame=null;}
    }
    function buildStage(game) {
        clearStage();
        scenery=createScenery(scene,game.stage,textures);
        moverMesh=new THREE.Group();scene.add(moverMesh);
        const addMoverPart=(geometry,color,x,y,z)=>{
            const part=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color,flatShading:true}));
            part.position.set(x,y,z);moverMesh.add(part);tileMeshes.push(part);return part;
        };
        if(game.stage.theme==="casino"){
            const chip=addMoverPart(new THREE.CylinderGeometry(0.5,0.5,0.18,12),"#da3545",0,0.52,0);chip.rotation.z=Math.PI/2;
            const face=addMoverPart(new THREE.CylinderGeometry(0.3,0.3,0.2,12),"#fff0bb",0,0.52,0);face.rotation.z=Math.PI/2;
        }else if(game.stage.theme==="shop"){
            addMoverPart(new THREE.BoxGeometry(0.7,0.6,1),"#9aaea6",0,0.65,0);
            addMoverPart(new THREE.BoxGeometry(0.5,0.15,0.7),"#e6c979",0,1,0);
            for(const x of [-0.3,0.3]){for(const z of [-0.35,0.35]){addMoverPart(new THREE.SphereGeometry(0.14,6,4),"#252930",x,0.18,z);}}
        }else{
            addMoverPart(new THREE.BoxGeometry(0.4,0.4,0.9),"#d7964b",0,0.4,0);
            addMoverPart(new THREE.SphereGeometry(0.27,8,6),"#e8b065",0,0.65,0.42);
            for(const x of [-0.16,0.16]){addMoverPart(new THREE.ConeGeometry(0.12,0.3,4),"#bf783e",x,0.94,0.42);}
            addMoverPart(new THREE.BoxGeometry(0.1,0.15,0.5),"#a56332",0,0.55,-0.65);
        }
        game.stage.tricks.forEach((trick,i)=>{
            marker(trick.cell,trick.lane,"trick",i+1);
            if(trick.hint!==null){marker(trick.hint,trick.nextLane,"hint",i+2);}else{return;}
        });
        game.stage.resets.forEach(tile=>marker(tile.cell,tile.lane,"reset","R"));
        game.stage.health.forEach(tile=>marker(tile.cell,tile.lane,"health","+"));
        game.stage.hazards.forEach(tile=>{
            const p=trackPoint(tile.cell,tile.lane);
            marker(tile.cell,tile.lane,"hazard","!");
            for(let level=0;level<5;level+=1){
                const color=level%2===0 ? "#b92238" : "#f2dfbd";
                const mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.36,0.19,12),new THREE.MeshLambertMaterial({color}));
                mesh.position.set(p.x,0.12+level*0.19,p.z);scene.add(mesh);tileMeshes.push(mesh);
            }
        });
        // Subtle lane guides on bare floor. Printed casino mats remain readable.
        for(let cell=0;cell<RULES.cells;cell+=1){
            for(let lane=0;lane<3;lane+=1){
                const p=trackPoint(cell,lane);
                if(game.stage.theme!=="casino"){
                    const points=[[cell-0.49,lane-0.48],[cell+0.49,lane-0.48],[cell+0.49,lane+0.48],[cell-0.49,lane+0.48]].map(([c,l])=>trackPoint(c,l));
                    const positions=[0,1,2,0,2,3].flatMap(i=>[points[i].x,0.012,points[i].z]);
                    const geometry=new THREE.BufferGeometry();
                    geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
                    const color=game.stage.theme==="home" ? ((cell+lane)%2 ? "#ad9b63" : "#c5b682") : ((cell+lane)%2 ? "#737c71" : "#c8c5ad");
                    const tile=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
                    scene.add(tile);tileMeshes.push(tile);
                }else{
                    scenery.root.visible=true;
                }
                const dot=new THREE.Mesh(new THREE.PlaneGeometry(0.055,0.055),new THREE.MeshBasicMaterial({color:"#dfc587"}));
                dot.rotation.x=-Math.PI/2;dot.position.set(p.x,0.018,p.z);scene.add(dot);tileMeshes.push(dot);
            }
        }
        currentGame=game;
        heading=trackHeading(0,game.lane);cameraHeading=heading;previousTime=game.time;
        const p=trackPoint(game.position,game.displayLane);
        cameraTarget.set(p.x,0.35,p.z);
        cameraPosition.copy(cameraTarget).add(new THREE.Vector3(8,13,-12));
        camera.position.copy(cameraPosition);
    }
    function blendAngle(current,target,factor) {
        const difference=Math.atan2(Math.sin(target-current),Math.cos(target-current));
        return current+difference*factor;
    }
    function updatePieces(game) {
        for(const [key,piece] of pieces){
            if(!game.dominoes.has(key)){piece.root.removeFromParent();pieces.delete(key);}else{piece.root.visible=true;}
        }
        for(const [key,tile] of game.dominoes){
            let piece=pieces.get(key);
            if(!piece){piece=makeDomino();pieces.set(key,piece);}else{piece.root.visible=true;}
            const p=trackPoint(tile.cell,tile.lane);
            piece.root.position.set(p.x,0,p.z);piece.root.rotation.y=trackHeading(tile.cell,tile.lane);
            piece.pivot.rotation.x=tile.fallenAt===null ? 0 : Math.min(1,(game.time-tile.fallenAt)/RULES.fallDuration)*Math.PI*0.48;
        }
    }
    function updatePlayer(game,dt) {
        victoryTime=game.status==="won" ? victoryTime+(game.paused ? 0 : dt) : 0;
        const p=trackPoint(game.position+0.4,game.displayLane);
        heading=blendAngle(heading,trackHeading(game.position,game.displayLane),Math.min(1,dt*16));
        player.root.position.set(p.x,0,p.z);player.root.rotation.y=heading;
        const pushing=game.status==="chain" && game.time-game.pushTime<0.4;
        player.pivot.rotation.x=game.status==="lost" ? 1.5 : game.stun>0 ? -0.4 : pushing ? 0.4 : game.stamina<22 ? 0.18 : 0;
        player.root.visible=game.stun<=0 || Math.floor(game.time*18)%2===0;
        const running=game.status==="running" && !game.paused && game.stun<=0;
        player.pivot.position.y=game.status==="won" ? Math.abs(Math.sin(victoryTime*6))*0.35 : running ? Math.abs(Math.sin(game.time*(game.stamina<22 ? 9 : 14)))*0.08 : 0;
        player.limbs.forEach((limb,i)=>{
            const arm=i%2===1;
            limb.rotation.x=arm && (pushing || game.status==="won") ? -1.6 : running ? Math.sin(game.time*14+(i<2 ? 0 : Math.PI))*0.65 : 0;
            limb.rotation.z=arm && game.status==="won" ? (i===1 ? 1 : -1)*(0.65+Math.sin(victoryTime*8)*0.2) : game.stun>0 ? Math.sin(game.time*30)*0.3 : 0;
        });
    }
    function updateCamera(game,dt) {
        let focus=game.position;
        let lane=game.displayLane;
        if(game.status==="chain"){
            const last=[...game.dominoes.values()].filter(tile=>tile.fallenAt!==null).sort((a,b)=>b.fallenAt-a.fallenAt)[0];
            if(game.chainBreak){focus=game.chainBreak.cell;lane=game.chainBreak.lane;}
            else if(last){focus=last.cell;lane=last.lane;}else{focus=game.position;}
        }else{
            focus=game.position;
        }
        const p=trackPoint(focus,lane);
        const angle=trackHeading(focus,lane);
        const factor=Math.min(1,dt*5);
        cameraHeading=blendAngle(cameraHeading,angle,factor);
        const fx=Math.sin(cameraHeading),fz=Math.cos(cameraHeading);
        const ox=fz,oz=-fx;
        const look=new THREE.Vector3(p.x+fx*1.6,0.35,p.z+fz*1.6);
        const position=new THREE.Vector3(p.x+fx*7+ox*11,13,p.z+fz*7+oz*11);
        const stunt=scenery.shot(game);
        if(stunt){
            look.copy(stunt);position.copy(stunt).add(new THREE.Vector3(8,11,-10));
        }else{look.y=0.35;}
        cameraTarget.lerp(look,factor);cameraPosition.lerp(position,factor);
        camera.position.copy(cameraPosition);camera.lookAt(cameraTarget);
    }
    function render(game) {
        if(currentGame!==game){buildStage(game);}else{scene.visible=true;}
        const dt=game.time===previousTime ? 1/60 : Math.min(0.1,game.time-previousTime);
        previousTime=game.time;
        updatePlayer(game,dt);updatePieces(game);
        const obstacle=movingObstacle(game);const obstaclePoint=trackPoint(obstacle.cell,obstacle.lane);
        moverMesh.position.set(obstaclePoint.x,0,obstaclePoint.z);moverMesh.rotation.y=trackHeading(obstacle.cell,obstacle.lane)+Math.PI/2;
        moverMesh.rotation.x=game.stage.theme==="casino" ? Math.sin(game.time*4)*0.2 : 0;
        breakRing.visible=game.chainBreak!==null && game.time<game.chainBreak.until;
        if(breakRing.visible){
            const p=trackPoint(game.chainBreak.cell,game.chainBreak.lane);
            breakRing.position.set(p.x,0.09,p.z);breakRing.scale.setScalar(1+0.16*Math.sin(game.time*12));
        }else{breakRing.scale.setScalar(1);}
        scenery.animate(game);updateCamera(game,game.paused ? 0 : dt);
        renderer.render(scene,camera);
    }
    return {render};
}
