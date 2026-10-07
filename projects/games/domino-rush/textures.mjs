import * as THREE from "./vendor/three.module.mjs";

function texture(width,height,paint) {
    const canvas=document.createElement("canvas");
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext("2d");
    paint(ctx,width,height);
    const map=new THREE.CanvasTexture(canvas);
    map.magFilter=THREE.NearestFilter;
    map.minFilter=THREE.NearestFilter;
    map.generateMipmaps=false;
    map.colorSpace=THREE.SRGBColorSpace;
    return map;
}
function grain(ctx,w,h,strength=18) {
    let seed=83;
    const image=ctx.getImageData(0,0,w,h);
    for(let i=0;i<image.data.length;i+=4) {
        seed=(seed*1664525+1013904223)>>>0;
        const n=(seed/4294967296-0.5)*strength;
        for(let c=0;c<3;c+=1) { image.data[i+c]=Math.max(0,Math.min(255,image.data[i+c]+n)); }
    }
    ctx.putImageData(image,0,0);
}
export function makeTextures() {
    const wood=texture(128,128,(c,w,h)=>{
        c.fillStyle="#3d302b";c.fillRect(0,0,w,h);
        for(let y=0;y<h;y+=2) {
            c.strokeStyle=y%6===0 ? "#171b1a" : "#655247";
            c.beginPath();c.moveTo(0,y);
            for(let x=0;x<=w;x+=4) { c.lineTo(x,y+Math.sin(x*0.08+y)*1.8); }
            c.stroke();
        }
        c.fillStyle="#141718";c.fillRect(0,0,w,2);c.fillRect(3,0,2,h);
        grain(c,w,h,25);
    });
    wood.wrapS=wood.wrapT=THREE.RepeatWrapping;wood.repeat.set(10,8);
    const carpet=texture(128,128,(c,w,h)=>{
        for(let y=0;y<8;y+=1) { for(let x=0;x<8;x+=1) {
            c.fillStyle=(x+y)%2 ? "#a62a50" : "#cb4861";c.fillRect(x*16,y*16,16,16);
        }}
        c.strokeStyle="#d9ad48";c.lineWidth=3;c.strokeRect(2,2,w-4,h-4);grain(c,w,h,30);
    });
    const roulette=texture(512,128,(c,w,h)=>{
        c.fillStyle="#175c35";c.fillRect(0,0,w,h);
        c.strokeStyle="#cdd5a3";c.lineWidth=1;c.strokeRect(2,2,w-4,h-4);
        for(let col=0;col<12;col+=1) { for(let row=0;row<3;row+=1) {
            const n=col*3+row+1,x=col*40+14,y=row*31+18;
            c.fillStyle=n%2 ? "#d62935" : "#161818";c.fillRect(x,y,38,29);
            c.strokeStyle="#d8d9ac";c.strokeRect(x,y,38,29);
            c.fillStyle="#f9dc70";c.font="italic bold 22px Georgia";c.textAlign="center";c.fillText(String(n),x+19,y+23);
        }}
        c.fillStyle="#ecce61";c.font="bold 10px serif";c.fillText("1st 12",90,12);c.fillText("2nd 12",250,12);c.fillText("3rd 12",410,12);
        grain(c,w,h,22);
    });
    const checker=texture(128,128,(c,w,h)=>{
        for(let x=0;x<8;x+=1) { for(let y=0;y<8;y+=1) {
            c.fillStyle=(x+y)%2 ? "#d6c29d" : "#524c50";c.fillRect(x*16,y*16,16,16);
        }}
        grain(c,w,h,25);
    });
    checker.wrapS=checker.wrapT=THREE.RepeatWrapping;checker.repeat.set(5,4);
    const tatami=texture(128,128,(c,w,h)=>{
        c.fillStyle="#929361";c.fillRect(0,0,w,h);
        for(let y=0;y<h;y+=2){c.fillStyle="#b3ac76";c.fillRect(0,y,w,1);}
        c.fillStyle="#344f3f";c.fillRect(0,0,6,h);c.fillRect(w-6,0,6,h);grain(c,w,h,16);
    });
    tatami.wrapS=tatami.wrapT=THREE.RepeatWrapping;tatami.repeat.set(6,5);
    return {wood,carpet,roulette,checker,tatami};
}
export function faceTexture(kind,number=1) {
    return texture(64,128,(c,w,h)=>{
        c.fillStyle="#e9e9db";c.fillRect(0,0,w,h);
        c.strokeStyle="#a4a39b";c.lineWidth=2;c.strokeRect(1,1,w-2,h-2);
        c.fillStyle="#42433f";c.fillRect(5,64,54,2);
        const pip=(x,y,r=6)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
        if(kind==="player") {
            c.fillStyle="#252b28";pip(18,29,6);pip(46,29,6);
            c.fillStyle="#fff";pip(16,26,2);pip(44,26,2);
            c.strokeStyle="#353833";c.lineWidth=3;c.beginPath();c.arc(32,42,12,0.15,Math.PI-0.15);c.stroke();
            c.fillStyle="#30342e";pip(17,83);pip(47,108);pip(32,96);
        } else {
            c.fillStyle="#242925";
            for(const [x,y] of [[16,18],[48,47],[32,32],[16,82],[48,111],[32,96]]){pip(x,y,5);}
        }
        grain(c,w,h,8);
    });
}
export function signTexture(text,background="#203519",color="#ffe28a",width=256,height=64) {
    return texture(width,height,(c,w,h)=>{
        c.fillStyle=background;c.fillRect(0,0,w,h);
        c.strokeStyle=color;c.lineWidth=3;c.strokeRect(3,3,w-6,h-6);
        c.fillStyle=color;c.font="bold "+Math.floor(h*0.52)+"px Georgia";c.textAlign="center";c.textBaseline="middle";
        c.fillText(text,w/2,h/2,w-15);grain(c,w,h,10);
    });
}
export function tileTexture(kind,label) {
    return texture(64,64,(c,w,h)=>{
        c.clearRect(0,0,w,h);
        if(kind==="hazard") {
            c.fillStyle="#f1c536";c.fillRect(0,0,w,h);
            c.strokeStyle="#38281e";c.lineWidth=7;
            for(let x=-64;x<128;x+=16){c.beginPath();c.moveTo(x,0);c.lineTo(x+64,64);c.stroke();}
            c.fillStyle="#30271c";c.fillRect(12,12,40,40);
            c.fillStyle="#ffe29b";c.font="bold 39px monospace";c.textAlign="center";c.fillText("!",32,47);
        } else if(kind==="hint") {
            c.strokeStyle="#ff253e";c.lineWidth=7;c.beginPath();c.arc(32,32,23,0,Math.PI*2);c.stroke();
            c.fillStyle="#ffccd0";c.font="bold 26px serif";c.textAlign="center";c.fillText(label,32,41);
        } else if(kind==="trick") {
            c.fillStyle="#d32032";c.fillRect(1,1,62,62);c.strokeStyle="#ffd753";c.lineWidth=3;c.strokeRect(2,2,60,60);
            c.fillStyle="#ffe78b";c.font="bold 40px Georgia";c.textAlign="center";c.fillText(label,32,47);
        } else if(kind==="health") {
            c.fillStyle="#237f66";c.fillRect(0,0,w,h);c.fillStyle="#d9ffe8";c.fillRect(26,10,12,44);c.fillRect(10,26,44,12);
        } else {
            c.fillStyle="#d8891c";c.fillRect(0,0,w,h);c.fillStyle="#ffec60";c.font="bold 45px monospace";c.textAlign="center";c.fillText("R",32,49);
        }
    });
}
export function dieTexture(n,color="#e5e3d7") {
    return texture(64,64,(c,w,h)=>{
        c.fillStyle=color;c.fillRect(0,0,w,h);
        c.strokeStyle="#b5aaa0";c.strokeRect(0,0,63,63);
        c.fillStyle=n===1 ? "#d22632" : "#21292a";
        const positions={1:[[32,32]],2:[[17,17],[47,47]],3:[[17,17],[32,32],[47,47]],4:[[17,17],[47,17],[17,47],[47,47]],5:[[17,17],[47,17],[32,32],[17,47],[47,47]],6:[[17,14],[47,14],[17,32],[47,32],[17,50],[47,50]]};
        positions[n].forEach(([x,y])=>{c.beginPath();c.arc(x,y,6,0,Math.PI*2);c.fill();});grain(c,w,h,10);
    });
}
