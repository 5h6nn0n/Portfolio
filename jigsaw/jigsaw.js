// GLOBAL CONFIGURATION & STATE
let lightboxTitle = "My Jigsaw Photo Album";
let slidesTitle = "Photo Gallery";
let imgCount = 0;
let currentImg = 0; 
let lbCounter;
let lbImages;

// Stores the single, permanent Blob URLs
let preloadedBlobs = []; 

const encryptedSources = [
  { path: "https://my-portfolio.s-katolsky.workers.dev/jigsaw/bee.enc", key: "F71E5544AAF4EF0674D76D534BA82661DC36FF1D60CFAF061244912ACDEA3FB8" },
  { path: "https://my-portfolio.s-katolsky.workers.dev/jigsaw/deer.enc", key: "5D0112B955E0B4F0597D8F88F034E8F144D860CE3D6F421D0F3A57A8A70D26C3" },
  { path: "https://my-portfolio.s-katolsky.workers.dev/jigsaw/eclipse.enc", key: "9CAB60DDA632803C13792F9D8F1D1B017B57D9DAAD15829F61F78A89BFF2FE20" }
];

// BULK DECRYPTION
async function decryptImage(encUrl, hexKey) {
  const response = await fetch(encUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${encUrl}: ${response.status} ${response.statusText}`);
  }
  const buf = await response.arrayBuffer();
  const iv = new Uint8Array(buf.slice(0, 16));
  const ciphertext = buf.slice(16);
  const keyBytes = new Uint8Array(hexKey.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-CBC" }, false, ["decrypt"]
  );
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-CBC", iv: iv }, cryptoKey, ciphertext
  );

  return URL.createObjectURL(new Blob([decrypted], { type: 'image/jpg' }));
}

async function prepareImages() {
  imgCount = encryptedSources.length;
  if (imgCount === 0) return;

  // Load all images into memory exactly once up-front
  for (let i = 0; i < imgCount; i++) {
    const source = encryptedSources[i];
    preloadedBlobs[i] = await decryptImage(source.path, source.key);
  }

  createLightbox();
  setupGallery();
  currentImg = 0;
  await loadActiveImage(0);
}

async function loadActiveImage(index) {
  const activeUrl = preloadedBlobs[index];

  // Update Lightbox Counter
  if (lbCounter) {
    lbCounter.textContent = (index + 1) + " / " + imgCount;
  }

  // Sync Puzzle Engine w Metadata
  updatePuzzleImage(activeUrl);
  updateMetadataForImage(index);
  resetPuzzleBoard();
}

// PUZZLE BOARD INITIALIZATION, SVG GENERATION
let puzzleBoard = document.getElementById("puzzleBoard");
let zCounter = 1;

let activeGroup = null;
let dragAnchor = null;
let dragStartX = 0;
let dragStartY = 0;
let pointerX = 0;
let pointerY = 0;

function getSVGPoint(e) {
   let pt = puzzleBoard.createSVGPoint();
   pt.x = e.clientX;
   pt.y = e.clientY;
   let ctm = puzzleBoard.getScreenCTM();
   return ctm ? pt.matrixTransform(ctm.inverse()) : pt;
}

function getTranslate(el) {
   let tr = el.getAttribute("transform");
   let m = tr ? tr.match(/translate\s*\(\s*([-\d.]+)[,\s]\s*([-\d.]+)\s*\)/) : null;
   return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}

const cols = 8;
const rows = 6;
const pieceSize = 100;

let horizontalEdges = [];
for (let r = 0; r < rows - 1; r++) {
   let rowArray = [];
   for (let c = 0; c < cols; c++) rowArray.push(Math.random() > 0.5 ? 1 : -1);
   horizontalEdges.push(rowArray);
}

let verticalEdges = [];
for (let r = 0; r < rows; r++) {
   let colArray = [];
   for (let c = 0; c < cols - 1; c++) colArray.push(Math.random() > 0.5 ? 1 : -1);
   verticalEdges.push(colArray);
}

function getTopEdge(dir) {
   if (dir === 0) return ` l ${pieceSize} 0`;
   return ` l 38 0 c -5 0, -10 ${-22*dir}, 12 ${-22*dir} c 22 0, 17 ${22*dir}, 12 ${22*dir} l 38 0`;
}
function getRightEdge(dir) {
   if (dir === 0) return ` l 0 ${pieceSize}`;
   return ` l 0 38 c 0 -5, ${22*dir} -10, ${22*dir} 12 c 0 22, ${-22*dir} 17, ${-22*dir} 12 l 0 38`;
}
function getBottomEdge(dir) {
   if (dir === 0) return ` l -${pieceSize} 0`;
   return ` l -38 0 c 5 0, 10 ${22*dir}, -12 ${22*dir} c -22 0, -17 ${-22*dir}, -12 ${-22*dir} l -38 0`;
}
function getLeftEdge(dir) {
   if (dir === 0) return ` l 0 -${pieceSize}`;
   return ` l 0 -38 c 0 5, ${-22*dir} 10, ${-22*dir} -12 c 0 -22, ${22*dir} -17, ${22*dir} -12 l 0 -38`;
}

let intList = Array.from({length: 48}, (_, i) => i);
intList.sort(() => 0.5 - Math.random());

if (puzzleBoard) {
  for (let i = 0; i < 48; i++) {
     let origRow = Math.floor(i / cols);
     let origCol = i % cols;

     let topDir = origRow === 0 ? 0 : -horizontalEdges[origRow - 1][origCol];
     let rightDir = origCol === cols - 1 ? 0 : verticalEdges[origRow][origCol];
     let bottomDir = origRow === rows - 1 ? 0 : horizontalEdges[origRow][origCol];
     let leftDir = origCol === 0 ? 0 : -verticalEdges[origRow][origCol - 1];

     let d = `M ${origCol * pieceSize} ${origRow * pieceSize}` +
             getTopEdge(topDir) +
             getRightEdge(rightDir) +
             getBottomEdge(bottomDir) +
             getLeftEdge(leftDir) + " Z";

     let clipPathId = "clip-" + i;

     let piece = document.createElementNS("http://www.w3.org/2000/svg", "g");
     piece.cluster = [piece];
     piece.dataset.origRow = origRow;
     piece.dataset.origCol = origCol;
     piece.style.cursor = "grab";

     let scatterIdx = intList[i];
     let scatterCol = scatterIdx % cols;
     let scatterRow = Math.floor(scatterIdx / cols);
     let initTx = (scatterCol - origCol) * pieceSize;
     let initTy = (scatterRow - origRow) * pieceSize;

     piece.setAttribute("transform", `translate(${initTx}, ${initTy})`);

     let defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
     let clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
     clipPath.id = clipPathId;
     clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");

     let pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
     pathElement.setAttribute("d", d);

     clipPath.appendChild(pathElement);
     defs.appendChild(clipPath);
     piece.appendChild(defs);

     let svgImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
     svgImage.setAttribute("href", ""); 
     svgImage.setAttribute("width", "800");
     svgImage.setAttribute("height", "600");
     svgImage.setAttribute("clip-path", `url(#${clipPathId})`);
     piece.appendChild(svgImage);

     let seamHider = document.createElementNS("http://www.w3.org/2000/svg", "path");
     seamHider.setAttribute("d", d);
     seamHider.setAttribute("fill", "none");
     seamHider.setAttribute("stroke", "rgba(0,0,0,0.1)");
     seamHider.setAttribute("stroke-width", "0.5");
     piece.appendChild(seamHider);

     piece.addEventListener("pointerdown", grabPiece);
     puzzleBoard.appendChild(piece);
  }
}

// PIECE INTERACTION AND SNAP LOGIC
let svgScaleX = 1;
let svgScaleY = 1;

function grabPiece(e) {
   if (window.puzzleFinished) return;
   activeGroup = e.target.closest("g");
   if (!activeGroup) return;

   e.preventDefault();

   let rect = puzzleBoard.getBoundingClientRect();
   let viewBox = puzzleBoard.viewBox.baseVal;
   let vbWidth = (viewBox && viewBox.width > 0) ? viewBox.width : 800;
   let vbHeight = (viewBox && viewBox.height > 0) ? viewBox.height : 600;

   svgScaleX = vbWidth / rect.width;
   svgScaleY = vbHeight / rect.height;
   pointerX = e.clientX;
   pointerY = e.clientY;

   if (!activeGroup.cluster) activeGroup.cluster = [activeGroup];
   dragAnchor = activeGroup.cluster[0];
   let tr = getTranslate(dragAnchor);
   dragStartX = tr.x;
   dragStartY = tr.y;

   activeGroup.cluster.forEach(p => {
      p.dataset.savedFilter = p.style.filter;
      p.style.filter = "drop-shadow(0px 0px 0px transparent)";
      p.style.willChange = "transform";
      puzzleBoard.appendChild(p);
   });
   document.addEventListener("pointermove", movePiece);
   document.addEventListener("pointerup", dropPiece);
}

function movePiece(e) {
   if (!activeGroup) return;

   let diffX = (e.clientX - pointerX) * svgScaleX;
   let diffY = (e.clientY - pointerY) * svgScaleY;
   let newTx = dragStartX + diffX;
   let newTy = dragStartY + diffY;
   let transformStr = `translate(${newTx}, ${newTy})`;
   let cluster = activeGroup.cluster;

   for (let i = 0; i < cluster.length; i++) {
      cluster[i].setAttribute("transform", transformStr);
   }
}

function dropPiece(e) {
   if (!activeGroup) return;

   document.removeEventListener("pointermove", movePiece);
   document.removeEventListener("pointerup", dropPiece);

   activeGroup.cluster.forEach(p => {
      p.style.willChange = "";
      p.style.filter = "";
   });

   let allPieces = document.querySelectorAll("#puzzleBoard g");
   let tolerance = 40; 
   let docked = false;
   let finalTx = 0;
   let finalTy = 0;
   let targetCluster = null;
   let anchor = activeGroup.cluster[0];
   let tr = getTranslate(anchor);

   for (let cp of activeGroup.cluster) {
      let myRow = parseInt(cp.dataset.origRow);
      let myCol = parseInt(cp.dataset.origCol);

      for (let other of allPieces) {
         if (activeGroup.cluster.includes(other)) continue;
         if (!other.cluster) other.cluster = [other];

         let oRow = parseInt(other.dataset.origRow);
         let oCol = parseInt(other.dataset.origCol);

         let isNeighbor = (
            (oRow === myRow && Math.abs(oCol - myCol) === 1) ||
            (oCol === myCol && Math.abs(oRow - myRow) === 1)
         );

         if (isNeighbor) {
            let otherTr = getTranslate(other);
            if (Math.hypot(tr.x - otherTr.x, tr.y - otherTr.y) < tolerance) {
               finalTx = otherTr.x;
               finalTy = otherTr.y;
               targetCluster = other.cluster;
               docked = true;
               break;
            }
         }
      }
      if (docked) break;
   }

   if (!docked && Math.hypot(tr.x - 0, tr.y - 0) < tolerance) {
      finalTx = 0;
      finalTy = 0;
      docked = true;
      targetCluster = null; 
   }

   if (docked) {
      let combinedCluster = (!targetCluster || targetCluster === "ABSOLUTE_GRID")
         ? activeGroup.cluster
         : [...new Set([...activeGroup.cluster, ...targetCluster])];

      combinedCluster.forEach(p => {
         p.setAttribute("transform", `translate(${finalTx}, ${finalTy})`);
         p.cluster = combinedCluster;
      });

      checkPuzzleCompletion();
   } else {
      activeGroup.cluster.forEach(p => {
         let pPos = getTranslate(p);
         p.setAttribute("transform", `translate(${Math.round(pPos.x)}, ${Math.round(pPos.y)})`);
      });
   }
   activeGroup = null;
   dragAnchor = null;
}

// GRAND FINALE
function checkPuzzleCompletion() {
   let allPieces = document.querySelectorAll("#puzzleBoard g");
   if (allPieces.length === 0) return;

   let firstCluster = allPieces[0].cluster;
   if (!firstCluster || firstCluster.length !== 48) return;

   let isComplete = Array.from(allPieces).every(p => p.cluster === firstCluster);

   if (isComplete && !window.puzzleFinished) {
      window.puzzleFinished = true;

      allPieces.forEach(p => {
         p.style.transition = "transform 1s ease-in-out";
         p.setAttribute("transform", "translate(0, 0)");
      });

      setTimeout(() => {
         allPieces.forEach(p => { p.style.transition = ""; });
         triggerGrandFinale();
      }, 1000);
   }
}

function triggerGrandFinale() {
   let finaleGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
   finaleGroup.id = "grandFinaleGlow";
   finaleGroup.setAttribute("transform", "translate(0, 0)");

   let defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
   defs.innerHTML = `
      <filter id="intenseWhiteGlow" x="-30%" y="-30%" width="160%" height="160%">
         <feGaussianBlur stdDeviation="4" result="blur1" />
         <feGaussianBlur stdDeviation="8" result="blur2" />
         <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
         </feMerge>
      </filter>
   `;
   puzzleBoard.appendChild(defs);

   let combinedD = "";
   document.querySelectorAll("#puzzleBoard g path").forEach(pathEl => {
      let d = pathEl.getAttribute("d");
      if (d) combinedD += " " + d;
   });

   let weavePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
   weavePath.setAttribute("d", combinedD);
   weavePath.setAttribute("fill", "none");
   weavePath.setAttribute("stroke", "#ffffff");
   weavePath.setAttribute("stroke-width", "3.5");
   weavePath.setAttribute("stroke-linecap", "round");
   weavePath.setAttribute("stroke-linejoin", "round");
   weavePath.setAttribute("filter", "url(#intenseWhiteGlow)");

   finaleGroup.appendChild(weavePath);
   puzzleBoard.appendChild(finaleGroup);

   let totalWeaveLength = Math.ceil(weavePath.getTotalLength());

   weavePath.style.strokeDasharray = totalWeaveLength;
   weavePath.style.strokeDashoffset = totalWeaveLength;

   let styleSheet = document.createElement("style");
   styleSheet.id = "finaleAnimationStyle";
   styleSheet.textContent = `
      @keyframes weaveWhiteTrail {
         0% { stroke-dashoffset: ${totalWeaveLength}; opacity: 0; }
         5% { opacity: 1; }
         65% { stroke-dashoffset: 0; opacity: 1; }
         95% { stroke-dashoffset: 0; opacity: 1; }
         100% { stroke-dashoffset: 0; opacity: 0; }
      }
      #grandFinaleGlow path {
         animation: weaveWhiteTrail 10s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }
   `;
   document.head.appendChild(styleSheet);

   setTimeout(() => {
      puzzleBoard.style.transition = "filter 2s ease-in-out";
      puzzleBoard.style.filter = "drop-shadow(0 0 15px #00ffcc) drop-shadow(0 0 30px #ff00ff) drop-shadow(0 0 45px #0088ff)";
   }, 7800);

   setTimeout(() => {
      finaleGroup.remove();
      let st = document.getElementById("finaleAnimationStyle");
      if (st) st.remove();
   }, 10000);
}

function updatePuzzleImage(blobUrl) {
   let allImages = document.querySelectorAll("#puzzleBoard g image");
   allImages.forEach(img => {
      img.setAttribute("href", blobUrl);
   });
}

function resetPuzzleBoard() {
   window.puzzleFinished = false;
   if (puzzleBoard) puzzleBoard.style.filter = "";

   let finaleGlow = document.getElementById("grandFinaleGlow");
   if (finaleGlow) finaleGlow.remove();
   intList.sort(() => 0.5 - Math.random());

   let allPieces = document.querySelectorAll("#puzzleBoard g");
   allPieces.forEach((piece, i) => {
      let origRow = parseInt(piece.dataset.origRow);
      let origCol = parseInt(piece.dataset.origCol);
      piece.cluster = [piece];

      let scatterIdx = intList[i];
      let scatterCol = scatterIdx % cols;
      let scatterRow = Math.floor(scatterIdx / cols);
      let initTx = (scatterCol - origCol) * pieceSize;
      let initTy = (scatterRow - origRow) * pieceSize;

      piece.setAttribute("transform", `translate(${initTx}, ${initTy})`);
   });
}

// LIGHTBOX CONTROLS
function createLightbox() {
   let lightBox = document.getElementById("lightbox");
   if (!lightBox) return; 
   lightBox.innerHTML = "";

   let lbTitle = document.createElement("h1");
   lbCounter = document.createElement("div");
   let lbPrev = document.createElement("div");
   let lbNext = document.createElement("div");
   let lbPlay = document.createElement("div");
   lbImages = document.createElement("div");

   lightBox.appendChild(lbTitle);
   lbTitle.id = "lbTitle";  
   lbTitle.textContent = typeof lightboxTitle !== "undefined" ? lightboxTitle : "Lightbox";

   lightBox.appendChild(lbCounter);
   lbCounter.id = "lbCounter"; 
   lbCounter.textContent = (currentImg + 1) + " / " + imgCount;

   lightBox.appendChild(lbPrev);
   lbPrev.id = "lbPrev";
   lbPrev.innerHTML = "&#9664;";   
   lbPrev.onclick = showPrev;

   lightBox.appendChild(lbNext);
   lbNext.id = "lbNext";
   lbNext.innerHTML = "&#9654;";   
   lbNext.onclick = showNext;

   lightBox.appendChild(lbPlay);
   lbPlay.id = "lbPlay";
   lbPlay.innerHTML = "&#9199;";   
   let timeID;
   lbPlay.onclick = function() {
      if (timeID) {
         window.clearInterval(timeID);
         timeID = undefined;
      } else {
         showNext();
         timeID = window.setInterval(showNext, 1500); 
      }
   };

   lightBox.appendChild(lbImages);
   lbImages.id = "lbImages";   

   // Assign preloaded URLs directly 
   for (let i = 0; i < imgCount; i++) {
      let img = document.createElement("img");
      img.alt = `Puzzle ${i + 1}`;
      img.src = preloadedBlobs[i]; 
      lbImages.appendChild(img);
   }
}

async function showNext() {
  if (lbImages && lbImages.firstElementChild) {
    // rotate the node
    lbImages.appendChild(lbImages.firstElementChild);
  }
  currentImg = (currentImg + 1) % imgCount;
  await loadActiveImage(currentImg);
}

async function showPrev() {
  if (lbImages && lbImages.firstElementChild) {
    //  rotate the node
    lbImages.insertBefore(lbImages.lastElementChild, lbImages.firstElementChild);
  }
  currentImg = (currentImg - 1 + imgCount) % imgCount;
  await loadActiveImage(currentImg);
}

// GALLERY CONTROLS
function setupGallery() {
   let galleryBox = document.getElementById("gallery");
   if (!galleryBox) return; 

   galleryBox.innerHTML = "";
   let imageCount = imgCount;
   let currentSlide = 1;
   let runShow = true;
   let showRunning;

   let galleryTitle = document.createElement("h1");
   galleryTitle.id = "galleryTitle";
   galleryTitle.textContent = typeof slidesTitle !== "undefined" ? slidesTitle : "Gallery";
   galleryBox.appendChild(galleryTitle);

   let slideCounter = document.createElement("div");
   slideCounter.id = "slideCounter";
   slideCounter.textContent = currentSlide + "/" + imageCount;
   galleryBox.appendChild(slideCounter);

   let leftBox = document.createElement("div");
   leftBox.id = "leftBox";
   leftBox.innerHTML = "&#9664;";
   leftBox.onclick = moveToLeft;   
   galleryBox.appendChild(leftBox);

   let rightBox = document.createElement("div");
   rightBox.id = "rightBox";
   rightBox.innerHTML = "&#9654;";  
   rightBox.onclick = moveToRight;   
   galleryBox.appendChild(rightBox);

   let playPause = document.createElement("div");
   playPause.id = "playPause";
   playPause.innerHTML = "&#9199;";
   playPause.onclick = startStopShow;
   galleryBox.appendChild(playPause);

   let slideBox = document.createElement("div");
   slideBox.id = "slideBox";
   galleryBox.appendChild(slideBox);

   // Assign preloaded URLs directly 
   for (let i = 0; i < imageCount; i++) {
      let image = document.createElement("img");
      image.src = preloadedBlobs[i]; 
      image.alt = `Slide ${i + 1}`;
      slideBox.appendChild(image);
   }

   function moveToRight() { showNext(); }
   function moveToLeft() { showPrev(); }   

   function startStopShow() {
      if (runShow) {
         showRunning = window.setInterval(moveToRight, 2000);
         runShow = false;
      } else {
         window.clearInterval(showRunning);
         runShow = true;
      }
   }
}

// PROTECTION HANDLERS
document.addEventListener("contextmenu", e => {
   if (e.target.closest("#slideBox, #lbImages, #puzzleBoard")) {
      e.preventDefault();
   }
});
document.addEventListener("dragstart", e => {
   if (e.target.closest("#slideBox, #lbImages") || e.target.tagName.toLowerCase() === "image") {
      e.preventDefault();
   }
});

// METADATA LOADER
let allMetadata = [];

function loadMetadata() {
   fetch("meta_data.json")
      .then(res => {
         if (!res.ok) throw new Error("HTTP error " + res.status);
         return res.json();
      })
      .then(data => {
         allMetadata = Array.isArray(data) ? data : (Object.values(data)[0] || []);
         updateMetadataForImage(0);
      })
      .catch(err => console.error("Metadata load error:", err));
}

function updateMetadataForImage(imageIndex) {
   const container = document.getElementById("container");
   if (!container || !allMetadata.length) return;
   let currentData = allMetadata[imageIndex] || allMetadata[0];
   container.innerHTML = "";

   let entries = Object.entries(currentData).filter(([key]) => {
      let lowerKey = key.toLowerCase();
      return lowerKey !== "id" && lowerKey !== "image";
   });

   entries.slice(0, 8).forEach(([key, value]) => {
      let div = document.createElement("div");
      div.className = "meta-item";
      div.innerHTML = `
         <span class="meta-label">${key}</span>
         <span class="meta-value">${value}</span>
      `;
      container.appendChild(div);
   });
}

// APPLICATION INITIALIZATION
if (document.readyState === "loading") {
   document.addEventListener("DOMContentLoaded", () => {
      prepareImages();
      loadMetadata();
   });
} else {
   prepareImages();
   loadMetadata();
}
