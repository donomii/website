import * as THREE from "./vendor/three.module.js";
import {dieTexture,signTexture} from "./textures.js";
import {trackPoint} from "./track.js";
import {RULES} from "./types.js";

export function createScenery(scene,stage,textures) {
    const root=new THREE.Group();
    scene.add(root);
    const disposable=[];
    const material=(color,map=null)=>new THREE.MeshLambertMaterial({color,map,flatShading:true});
    function mesh(geometry,mat,x,y,z,parent=root) {
        const item=new THREE.Mesh(geometry,mat);
        item.position.set(x,y,z);parent.add(item);disposable.push(item);
        return item;
    }
    function box(x,y,z,w,h,d,color,parent=root,map=null) {
        return mesh(new THREE.BoxGeometry(w,h,d),material(color,map),x,y+h/2,z,parent);
    }
    function plane(x,y,z,w,d,map,parent=root) {
        const item=mesh(new THREE.PlaneGeometry(w,d),material("#ffffff",map),x,y,z,parent);
        item.rotation.x=-Math.PI/2;
        return item;
    }
    function cylinder(x,y,z,radius,height,color,parent=root) {
        return mesh(new THREE.CylinderGeometry(radius,radius,height,16),material(color),x,y+height/2,z,parent);
    }
    function label(text,x,y,z,w=3,h=0.7,color="#f3d363",bg="#412323",parent=root) {
        return mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:signTexture(text,bg,color),side:THREE.DoubleSide}),x,y,z,parent);
    }
    function chip(x,y,z,color,parent=root) {
        cylinder(x,y,z,0.48,0.13,color,parent);
        for(let n=0;n<8;n+=1){
            const a=n/8*Math.PI*2;
            const stripe=box(x+Math.sin(a)*0.38,y+0.015,z+Math.cos(a)*0.38,0.14,0.14,0.13,"#e6e6d5",parent);
            stripe.rotation.y=a;
        }
    }
    function die(x,y,z,size,color="#e5e3d7",parent=root) {
        const mats=[1,6,3,4,5,2].map(n=>material("#ffffff",dieTexture(n,color)));
        return mesh(new THREE.BoxGeometry(size,size,size),mats,x,y+size/2,z,parent);
    }
    function cards(x,z,parent=root) {
        for(let row=0;row<3;row+=1){
            for(let col=0;col<3-row;col+=1){
                for(const sign of [-1,1]){
                    const card=box(x+(col-(2-row)/2)*1.35+sign*0.35,row*1.25,z,0.075,1.55,0.95,"#fff4d9",parent);
                    card.rotation.z=sign*0.38;
                    const face=label(sign<0?"A ♥":"K ♠",card.position.x+sign*0.055,card.position.y,z+0.482,0.7,1.2,"#b72430","#e8dfcf",parent);
                    face.rotation.z=sign*0.38;
                }
            }
        }
    }
    const effects=[];
    const addEffect=(group,index)=>{root.add(group);effects.push({group,index,origin:group.position.clone(),rotation:group.rotation.clone(),parts:group.children.map(item=>({item,position:item.position.clone(),rotation:item.rotation.clone()}))});};
    const floorMap=stage.theme==="shop" ? textures.checker : textures.wood;
    plane(0,-0.04,0,80,70,floorMap);
    if(stage.theme==="casino"){
        casino();
    }else if(stage.theme==="shop"){
        shop();
    }else{
        home();
    }

    function casino() {
        plane(0,0.01,-8,23,4.1,textures.roulette).rotation.z=Math.PI;
        plane(12,0.015,0,4.5,15,textures.carpet);
        plane(0,0.01,8,23,4.4,textures.roulette);
        plane(-12,0.015,0,4.5,15,textures.carpet);
        for(const z of [-10.12,-5.88,5.77,10.23]){box(0,0,z,23,0.04,0.045,"#be9c37");}
        for(let i=0;i<15;i+=1){
            const x=-11+(i*7%23),z=i%2===0 ? -10.5 : -5.35;
            const color=["#b82035","#1d53a2","#238245"][i%3];
            for(let h=0;h<1+i%4;h+=1){chip(x,h*0.14,z,color);}
        }
        const dice=new THREE.Group();dice.position.set(9,0,-3.65);
        for(let i=0;i<4;i+=1){const d=die(0,i*1.05,0,1.02,"#b82532",dice);d.rotation.y=i*0.14;}
        addEffect(dice,0);
        die(11,0,-4,0.85);die(10,0,-5.1,0.75);die(8.5,0,-5,0.85);
        const wheel=new THREE.Group();wheel.position.set(6.8,0,5);
        cylinder(0,0,0,2,0.6,"#582d21",wheel);
        cylinder(0,0.6,0,1.8,0.12,"#b49348",wheel);
        for(let i=0;i<24;i+=1){
            const a=i/24*Math.PI*2;
            const wedge=box(Math.sin(a)*1.3,0.72,Math.cos(a)*1.3,0.3,0.03,0.72,i%2 ? "#1c2421" : "#b42b39",wheel);
            wedge.rotation.y=a;
        }
        cylinder(0,0.74,0,0.7,0.4,"#957a48",wheel);
        cylinder(0,1.14,0,0.1,0.7,"#ddc97f",wheel);
        const ball=mesh(new THREE.SphereGeometry(0.19,8,6),material("#fff4d5"),1.5,0.92,0,wheel);
        ball.userData.rouletteBall=true;
        addEffect(wheel,1);
        const house=new THREE.Group();house.position.set(-8,0,4.5);cards(0,0,house);addEffect(house,2);
        const slot=new THREE.Group();slot.position.set(-8,0,-3.8);
        box(0,0,0,2.3,3.6,1.5,"#982428",slot);
        box(0,0.6,0.8,2.45,0.18,0.45,"#b3a581",slot);
        label("777",0,2.1,0.77,1.9,1,"#9e252c","#eee4b3",slot);
        label("JACKPOT",0,3.15,0.78,2,0.55,"#ffe587","#7c1d20",slot);
        cylinder(1.4,1.5,0,0.07,1.2,"#c8ba9b",slot);
        mesh(new THREE.SphereGeometry(0.2,8,6),material("#b5292d"),1.4,2.8,0,slot);
        slot.rotation.y=-Math.PI/2;
        addEffect(slot,3);
        for(const x of [-18,18]){
            for(const z of [-12,0,12]){
                cylinder(x,0,z,0.32,3.2,"#785d31");
                mesh(new THREE.SphereGeometry(0.45,8,6),material("#c59f4d"),x,3.5,z);
            }
        }
        box(0,0,17,45,5,0.4,"#391b22");
        for(let x=-20;x<=20;x+=4){box(x,0,16.7,0.15,5,0.1,"#936c35");}
        label("PHAT TONY'S",0,3,16.4,8,1.5);
    }
    function shelf(x,z,rotation=0) {
        const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=rotation;root.add(group);
        box(0,0,0,5.5,3.8,1.25,"#b8b7a3",group);
        for(let level=0;level<3;level+=1){
            box(0,level*1.1+0.4,0.7,5.6,0.12,0.45,"#dbd9bf",group);
            for(let col=0;col<9;col+=1){
                box((col-4)*0.53,level*1.1+0.55,0.65,0.38,0.7,0.45,["#c83832","#daa02f","#416b31","#386b99"][(col+level)%4],group);
                box((col-4)*0.53,level*1.1+0.8,0.9,0.28,0.17,0.025,"#e3dcc1",group);
            }
        }
    }
    function shop() {
        for(const z of [-4.4,4.4]){for(const x of [-6.5,0,6.5]){shelf(x,z,z<0 ? Math.PI : 0);}}
        box(0,0,16,42,5,0.4,"#d6caa6");
        label("FRESH • FOOD • EVERY DAY",0,3.2,15.75,12,1.1,"#f5edd2","#973839");
        for(let i=0;i<4;i+=1){
            const group=new THREE.Group();const p=trackPoint(stage.tricks[i].cell,4);
            group.position.set(p.x,0,p.z);
            if(i===0){
                for(let row=0;row<3;row+=1){for(let col=0;col<3-row;col+=1){cylinder((col-(2-row)/2)*0.8,row*0.8,0,0.37,0.75,"#c53c35",group);}}
            }else if(i===1){
                box(0,0,0,1.8,0.5,1.3,"#b7b9a7",group);box(0,0.5,0,0.2,1,0.2,"#888e83",group);
                cylinder(0,1.4,0,1,0.12,"#cbd0c4",group);
                mesh(new THREE.SphereGeometry(0.4,8,6),material("#df8129"),0,1.9,0,group);
            }else if(i===2){
                box(0,0.6,0,2,1.3,1.3,"#909d96",group);box(0,0.75,0,1.6,0.4,1.05,"#bdd1a0",group);
                for(const x of [-0.7,0.7]){for(const z of [-0.4,0.4]){cylinder(x,0,z,0.2,0.25,"#282f2c",group);}}
            }else{
                box(0,0,0,2.6,1.2,1.6,"#855640",group);box(0,1.2,0,1.8,1,1.2,"#aeb29c",group);
                label("00.00",0,1.9,0.62,1.4,0.45,"#9af06f","#233e31",group);
            }
            addEffect(group,i);
        }
        for(const x of [-6.5,6.5]){shelf(x,0,x<0 ? -Math.PI/2 : Math.PI/2);}
    }
    function home() {
        plane(0,-0.02,0,34,26,textures.tatami);
        box(0,0,15,40,5,0.3,"#a78e6c");
        for(let x=-16;x<=16;x+=4){
            box(x,0,14.8,0.15,5,0.2,"#493e31");
            for(let y=0;y<5;y+=1){box(x+2,y,14.8,4,0.075,0.2,"#5b4b35");}
        }
        for(let i=0;i<4;i+=1){
            const group=new THREE.Group();const p=trackPoint(stage.tricks[i].cell,4);
            group.position.set(p.x,0,p.z);
            if(i===0){
                box(0,1.2,0,4,0.22,2.8,"#734e34",group);
                for(const x of [-1.6,1.6]){for(const z of [-1,1]){box(x,0,z,0.2,1.2,0.2,"#4d382b",group);}}
                cylinder(0,1.42,0,0.48,0.65,"#dbdcc7",group);cylinder(0,2.075,0,0.36,0.02,"#594d28",group);
            }else if(i===1){
                box(0,0.35,0,1.4,0.9,0.7,"#d39952",group);box(0.55,0.9,0,0.65,0.7,0.65,"#dda35c",group);
                for(const z of [-0.22,0.22]){mesh(new THREE.ConeGeometry(0.18,0.45,4),material("#c18444"),0.55,1.8,z,group);}
                box(-0.9,0.6,0,0.8,0.2,0.2,"#b77b3e",group);
            }else if(i===2){
                box(0,0,0,2.5,0.6,1.5,"#514532",group);box(0,0.6,0,2.3,1.9,1.2,"#655644",group);
                label("TV",0,1.6,0.61,1.6,1.2,"#a6b7a4","#314945",group);
                const antenna=box(0,2.5,0,0.07,1,0.07,"#444e47",group);antenna.rotation.z=0.5;
            }else{
                box(0,0,0,2.3,0.7,2,"#80533e",group);box(0,0.7,-0.8,2.3,1.8,0.4,"#b07551",group);
                box(0,0.7,0,1,1.1,0.65,"#527267",group);
                mesh(new THREE.SphereGeometry(0.45,8,6),material("#cba987"),0,2.25,0,group);
                for(const x of [-0.4,0.4]){box(x,0.6,0.7,0.3,0.4,1.1,"#666259",group);}
            }
            addEffect(group,i);
        }
        plane(0,0.02,0,7,5,textures.carpet);
    }
    // A visible relay travels from the struck switch through its prop to the next ring.
    const relays=effects.map(({index,origin})=>{
        const shape=stage.theme==="casino" && index===2 ? new THREE.BoxGeometry(0.6,0.08,0.9) : stage.theme==="shop" && index===0 ? new THREE.CylinderGeometry(0.23,0.23,0.5,8) : new THREE.SphereGeometry(0.23,8,6);
        const color=stage.theme==="shop" ? "#ff9d28" : stage.theme==="home" ? "#9ee8f0" : "#ffe7a0";
        const item=mesh(shape,new THREE.MeshBasicMaterial({color}),origin.x,1,origin.z);
        item.visible=false;return item;
    });
    function relayPosition(game,index) {
        const trick=stage.tricks[index];const origin=effects[index].origin;
        const elapsed=game.time-game.effectStarted[index];
        const switchPoint=trackPoint(trick.cell,trick.lane);
        const target=trick.hint===null ? origin : trackPoint(trick.hint,trick.nextLane);
        const impactTime=RULES.trickDelay*0.25;
        const incoming=elapsed<impactTime;
        const from=incoming ? switchPoint : origin;const to=incoming ? origin : target;
        const progress=Math.max(0,Math.min(1,incoming ? elapsed/impactTime : (elapsed-impactTime)/(RULES.trickDelay-impactTime)));
        return new THREE.Vector3(from.x+(to.x-from.x)*progress,0.25+Math.sin(progress*Math.PI)*2,from.z+(to.z-from.z)*progress);
    }
    function shot(game) {
        if(game.status==="chain" && game.effect!==null && game.time-game.effectStarted[game.effect]<RULES.trickDelay+0.25){
            const origin=effects[game.effect].origin;const relay=relayPosition(game,game.effect);
            return new THREE.Vector3(origin.x,1,origin.z).lerp(relay,0.65);
        }else{return null;}
    }
    const sparks=new THREE.Group();root.add(sparks);
    for(let i=0;i<24;i+=1){
        mesh(new THREE.BoxGeometry(0.11,0.11,0.11),new THREE.MeshBasicMaterial({color:i%2 ? "#ffe054" : "#f7735b"}),0,0,0,sparks);
    }
    function animate(game) {
        relays.forEach((item,index)=>{
            const started=game.effectStarted[index];
            item.visible=started!==null && game.time-started<=RULES.trickDelay;
            if(item.visible){item.position.copy(relayPosition(game,index));item.rotation.set(game.time*8,game.time*4,0);}else{item.rotation.set(0,0,0);}
        });
        effects.forEach(({group,index,origin,rotation,parts})=>{
            group.position.copy(origin);group.rotation.copy(rotation);
            group.scale.set(1,1,1);
            parts.forEach(({item,position,rotation})=>{item.position.copy(position);item.rotation.copy(rotation);});
            const active=game.activated.has(index);
            if(active){
                const elapsed=game.time-game.effectStarted[index];
                const recent=elapsed<2.5;
                const progress=Math.max(0,Math.min(1,(elapsed-RULES.trickDelay*0.25)/(RULES.trickDelay*0.75)));
                if(stage.theme==="casino" && index===0){
                    const target=trackPoint(stage.tricks[index].hint,stage.tricks[index].nextLane);
                    group.position.x=origin.x+(target.x-origin.x)*progress;
                    group.position.z=origin.z+(target.z-origin.z)*progress;
                    group.rotation.z=-progress*Math.PI/2;group.position.y=Math.sin(progress*Math.PI)*1.2;
                }else if(stage.theme==="casino" && index===1){
                    group.rotation.y=Math.min(elapsed,2.5)*9;
                    parts.filter(part=>part.item.userData.rouletteBall).forEach(({item})=>{
                        const angle=Math.min(elapsed,2.5)*12;const radius=1.5+progress;
                        item.position.set(Math.cos(angle)*radius,0.92+Math.sin(progress*Math.PI)*2,Math.sin(angle)*radius);
                    });
                }
                else if((stage.theme==="casino" && index===2) || (stage.theme==="shop" && index===0)){
                    parts.forEach(({item,position},i)=>{
                        item.position.set(position.x+Math.sin(i*2.4)*progress*2,position.y*(1-progress)+0.12,position.z+Math.cos(i*2.4)*progress*2);
                        item.rotation.z+=progress*(i%2 ? 1.45 : -1.45);
                    });
                }else if(stage.theme==="home" && index===1){group.position.y=Math.sin(progress*Math.PI)*3;group.position.x+=progress*3;}
                else if(stage.theme==="shop" && index===2){group.position.z+=progress*3;group.rotation.z=Math.sin(progress*Math.PI)*0.25;}
                else if(index===3){group.position.y=recent ? Math.abs(Math.sin(elapsed*9))*(1-progress)*1.3 : 0;group.rotation.z=recent ? Math.sin(elapsed*18)*0.12 : 0;}
                else {group.rotation.z=-progress*0.65;}
            }else{
                group.scale.set(1,1,1);
            }
        });
        sparks.visible=game.effectTime>0;
        if(sparks.visible){
            const origin=effects[game.effect].group.position;
            const t=2.5-game.effectTime;
            sparks.children.forEach((spark,i)=>{
                const a=i/24*Math.PI*2;
                spark.position.set(origin.x+Math.cos(a)*t*2,Math.max(0.15,1+t*(4+i%3)-3*t*t),origin.z+Math.sin(a)*t*2);
                spark.scale.setScalar(game.effect===3 ? 2.5 : 1.5);spark.rotation.set(t*4+i,t*3,0);
            });
        }else{
            sparks.position.set(0,0,0);
        }
    }
    return {root,animate,shot,dispose(){
        disposable.forEach(item=>{
            item.geometry.dispose();
            const mats=Array.isArray(item.material) ? item.material : [item.material];
            mats.forEach(mat=>{if(mat.map && !Object.values(textures).includes(mat.map)){mat.map.dispose();}else{mat.userData.reusable=true;}mat.dispose();});
        });
        root.removeFromParent();
    }};
}
