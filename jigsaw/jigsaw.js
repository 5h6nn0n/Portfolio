let lightboxTitle = "My Jigsaw Photo Album";

// Declare these globally 
let imgFiles = [];
let imgCount = 0;

const encryptedSources = [
  { path: "imgs/bee.enc", key: "F71E5544AAF4EF0674D76D534BA82661DC36FF1D60CFAF061244912ACDEA3FB8" },
  { path: "imgs/deer.enc", key: "5D0112B955E0B4F0597D8F88F034E8F144D860CE3D6F421D0F3A57A8A70D26C3" },
  { path: "imgs/eclipse.enc", key: "9CAB60DDA632803C13792F9D8F1D1B017B57D9DAAD15829F61F78A89BFF2FE20" },
  { path: "imgs/flower.enc", key: "EE479A4C75104F66F928114C4C9892BF039870EEC130AE18BEED0886BA4DC698" },
  { path: "imgs/gator.enc", key: "21507F0E4D4113CC1CD1CBEE0712D87DEF65D3635C881D140701B2599C53E463" },
  { path: "imgs/hill.enc", key: "6EC2ABB2266D12C07627DC5082CFF59DCC88B85E2AB76D3F0F6A4E58392185B6" },
  { path: "imgs/leaf.enc", key: "5C2A6BB9B01F6E1A7C4E2E6083AA07887DB3264E95AD27D34A95F6CB6B44CA09" },
  { path: "imgs/tree.enc", key: "C4E62549E16AE3CB4EED8BABB9ED4456AC3B4C56A25FEB1233639F1CB8F719C7" },
  { path: "imgs/wheel.enc", key: "B41C90876AD55B3C8B160CC2C0B2C729E8FD8CBEEC300BE47F18EED8CE839307" }
];

async function decryptImage(encUrl, hexKey) {
  const response = await fetch(encUrl);
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
  
// Runs once when your app loads
async function prepareImages() {
  for (let i = 0; i < encryptedSources.length; i++) {
    let decryptedUrl = await decryptImage(encryptedSources[i].path, encryptedSources[i].key);
    imgFiles.push(decryptedUrl);
  }
  imgCount = imgFiles.length; 
  
  if (imgCount > 0) {
    setupGallery();
    createLightbox();

    updatePuzzleImage(imgFiles[0]);  // Forces the 1st Base64 image onto the puzzle board
    updateMetadataForImage(0);       // Loads the 1st metadata entry
  }
}

prepareImages().then(() => {
    console.log("Images successfully decrypted! Total:", imgCount);
    createLightbox();
});



let puzzleBoard = document.getElementById("puzzleBoard");

// Ensure puzzle board renders above the slideshow
puzzleBoard.style.position = "relative";
puzzleBoard.style.zIndex = "1000";

let zCounter = 1;

// Drag & cluster state variables
let activeGroup = null;
let dragAnchor = null;
let dragStartX = 0;
let dragStartY = 0;
let pointerX = 0;
let pointerY = 0;

// convert screen coordinates to SVG user space coordinates
function getSVGPoint(e) {
   let pt = puzzleBoard.createSVGPoint();
   pt.x = e.clientX;
   pt.y = e.clientY;
   let ctm = puzzleBoard.getScreenCTM();
   return ctm ? pt.matrixTransform(ctm.inverse()) : pt;
}

// get current translate coordinates of any element
function getTranslate(el) {
   let tr = el.getAttribute("transform");
   let m = tr ? tr.match(/translate\s*\(\s*([-\d.]+)[,\s]\s*([-\d.]+)\s*\)/) : null;
   return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}


// PART 1 -- JIGSAW PIECES 
const cols = 8;
const rows = 6;
const pieceSize = 100;

// Generate random interlocking tab directions: 1 (Out) or -1 (In)
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

// Edge drawing helpers using precise relative cubic bezier curves
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

// Create layout scattering array
let intList = Array.from({length: 48}, (_, i) => i);
intList.sort(() => 0.5 - Math.random());

let customPicture = imgFiles[0]; 
// Build the board
for (let i = 0; i < 48; i++) {
   let origRow = Math.floor(i / cols);
   let origCol = i % cols;
   
   // Determine tab profile based on the edge matrix
   let topDir = origRow === 0 ? 0 : -horizontalEdges[origRow - 1][origCol];
   let rightDir = origCol === cols - 1 ? 0 : verticalEdges[origRow][origCol];
   let bottomDir = origRow === rows - 1 ? 0 : horizontalEdges[origRow][origCol];
   let leftDir = origCol === 0 ? 0 : -verticalEdges[origRow][origCol - 1];
   
   // Generate perfectly scaled and aligned path
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

   // Calculate scatter placement relative to the absolute image map
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


// 1. Get the current puzzle data from your array
//let currentPuzzle = puzzleArray[currentIndex]; 

// 2. Decrypt it and assign to customPicture
//customPicture = await decryptImage(currentPuzzle.file, currentPuzzle.key);

   // The image remains unshifted because the path itself acts as a mapped coordinate window
   let svgImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
   svgImage.setAttribute("href", customPicture);
   svgImage.setAttribute("width", "800");
   svgImage.setAttribute("height", "600");
   svgImage.setAttribute("clip-path", `url(#${clipPathId})`);
   piece.appendChild(svgImage);
   
   // Apply stroke to hide microscopic sub-pixel SVG anti-aliasing seams
   let seamHider = document.createElementNS("http://www.w3.org/2000/svg", "path");
   seamHider.setAttribute("d", d);
   seamHider.setAttribute("fill", "none");
   seamHider.setAttribute("stroke", "rgba(0,0,0,0.1)");
   seamHider.setAttribute("stroke-width", "0.5");
   piece.appendChild(seamHider);

   piece.addEventListener("pointerdown", grabPiece);
   puzzleBoard.appendChild(piece);
}


// PART 2 -- PIECE MOVEMENT AND CONNECTIVITY
let svgScaleX = 1;
let svgScaleY = 1;

function grabPiece(e) {
   if (window.puzzleFinished) return;
   
   activeGroup = e.target.closest("g");
   if (!activeGroup) return;

   e.preventDefault();

   // Pre-calculate scale ratio ONCE on grab 
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

   // temporarily disable heavy shadow filters & enable GPU acceleration during move
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

   // Instant math delta - zero DOM reflow queries
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

   // Restore filters and clear hardware acceleration layer
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

   // CHECK ADJACENCY SNAP FIRST
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

   // CHECK ABSOLUTE GRID SNAP SECOND
   if (!docked && Math.hypot(tr.x - 0, tr.y - 0) < tolerance) {
      finalTx = 0;
      finalTy = 0;
      docked = true;
      targetCluster = null; 
   }

   // APPLY CLUSTER DOCKING & MERGING
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


///////////////////////////////////////


//   PART 3: GRAND FINALE UPON COMPLETION

function checkPuzzleCompletion() {
   let allPieces = document.querySelectorAll("#puzzleBoard g");
   if (allPieces.length === 0) return;

   let firstCluster = allPieces[0].cluster;
   if (!firstCluster || firstCluster.length !== 48) return;

   let isComplete = Array.from(allPieces).every(p => p.cluster === firstCluster);
   
   if (isComplete && !window.puzzleFinished) {
      window.puzzleFinished = true;

      // Smoothly animate the entire solved puzzle to the center home grid (0,0)
      allPieces.forEach(p => {
         p.style.transition = "transform 1s ease-in-out";
         p.setAttribute("transform", "translate(0, 0)");
      });

      // Wait 1 second for the centering transition to finish before starting the finale
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
         0% {
            stroke-dashoffset: ${totalWeaveLength};
            opacity: 0;
         }
         5% {
            opacity: 1;
         }
         65% {
            stroke-dashoffset: 0;
            opacity: 1;
         }
         95% {
            stroke-dashoffset: 0;
            opacity: 1;
         }
         100% {
            stroke-dashoffset: 0;
            opacity: 0;
         }
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

   // Clean up the white line animation elements after the first glow fully ends (10s)
   setTimeout(() => {
      finaleGroup.remove();
      let st = document.getElementById("finaleAnimationStyle");
      if (st) st.remove();
   }, 10000);
}

/////////////////////////////////////////

function updatePuzzleImage(base64Data) {
   let allImages = document.querySelectorAll("#puzzleBoard g image");
   allImages.forEach(img => {
      // Direct assignment of the Base64 Data URL
      img.setAttribute("href", base64Data);
   });
}

////////////////////////////////////////////////
function resetPuzzleBoard() {
   window.puzzleFinished = false;
   puzzleBoard.style.filter = "";
   
   // Clean up any grand finale remnants if reset mid-animation
   let finaleGlow = document.getElementById("grandFinaleGlow");
   if (finaleGlow) finaleGlow.remove();

   // Re-shuffle the 48 scatter positions
   intList.sort(() => 0.5 - Math.random());

   let allPieces = document.querySelectorAll("#puzzleBoard g");
   allPieces.forEach((piece, i) => {
      let origRow = parseInt(piece.dataset.origRow);
      let origCol = parseInt(piece.dataset.origCol);

      // Reset individual piece cluster tracking
      piece.cluster = [piece];

      // Assign new scattered coordinates
      let scatterIdx = intList[i];
      let scatterCol = scatterIdx % cols;
      let scatterRow = Math.floor(scatterIdx / cols);
      let initTx = (scatterCol - origCol) * pieceSize;
      let initTy = (scatterRow - origRow) * pieceSize;

      piece.setAttribute("transform", `translate(${initTx}, ${initTy})`);
   });
}

///////////////////////////////////////////////////


//   PART 4 -- LIGHTBOX
window.addEventListener("load", createLightbox);

function createLightbox(){
   let lightBox = document.getElementById("lightbox");
   if (!lightBox) return; 
   lightBox.innerHTML = "";
   let lbTitle = document.createElement("h1");
   let lbCounter = document.createElement("div");
   let lbPrev = document.createElement("div");
   let lbNext = document.createElement("div");
   let lbPlay = document.createElement("div");
   let lbImages = document.createElement("div");

   lightBox.appendChild(lbTitle);
   lbTitle.id = "lbTitle";  
   lbTitle.textContent = lightboxTitle;

   lightBox.appendChild(lbCounter);
   lbCounter.id = "lbCounter"; 
   let currentImg = 1;
   lbCounter.textContent = currentImg + " / " + imgCount;

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
      if(timeID) {
         window.clearInterval(timeID);
         timeID = undefined;
      } else {
         showNext();
         timeID = window.setInterval(showNext, 1500); 
      }
   }
   lightBox.appendChild(lbImages);
   lbImages.id = "lbImages";   

   function showNext() {
      lbImages.appendChild(lbImages.firstElementChild);
      (currentImg < imgCount) ? currentImg++ : currentImg = 1; 
      lbCounter.textContent = currentImg + " / " + imgCount;
	  updatePuzzleImage(imgFiles[currentImg - 1]); // Pass the Base64 string
	  updateMetadataForImage(currentImg - 1);       // Pass only the integer index
	  resetPuzzleBoard();  
   }

   function showPrev() {
      lbImages.insertBefore(lbImages.lastElementChild, lbImages.firstElementChild);
      (currentImg > 1) ? currentImg-- : currentImg = imgCount; 
      lbCounter.textContent = currentImg + " / " + imgCount;
	  updatePuzzleImage(imgFiles[currentImg - 1]); // Pass the Base64 string 
	  updateMetadataForImage(currentImg - 1);       // Pass only the integer index 
      resetPuzzleBoard();
   }

   function createOverlay() {
	   // empty
   }
   
   for(let i=0; i < imgCount; i++) {
      let image = document.createElement("img");
      image.src = imgFiles[i];
      image.onclick = createOverlay;
      lbImages.appendChild(image);
   }
}

// PART 5: GALLERY 
window.addEventListener("load", setupGallery);

function setupGallery() {
   let galleryBox = document.getElementById("gallery");
   if (!galleryBox) return; 

   let imageCount = imgFiles.length;
   let currentSlide = 1;
   let runShow = true;
   let showRunning;
   
   let galleryTitle = document.createElement("h1");
   galleryTitle.id = "galleryTitle";
   galleryTitle.textContent = slidesTitle;
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
   
   for (let i = 0; i < imageCount; i++) {
      let image = document.createElement("img");
      image.src = imgFiles[i];
      image.onclick = createModal;
      slideBox.appendChild(image);
   }

   function moveToRight() {
      let firstImage = slideBox.firstElementChild.cloneNode(true);
      firstImage.onclick = createModal;
      slideBox.appendChild(firstImage);
      slideBox.removeChild(slideBox.firstElementChild);
      currentSlide++;
      if (currentSlide > imageCount) {
         currentSlide = 1;
      }
      slideCounter.textContent = currentSlide + " / " + imageCount;
   }
   
   function moveToLeft() {
      let lastImage = slideBox.lastElementChild.cloneNode(true);
      lastImage.onclick = createModal;
      slideBox.removeChild(slideBox.lastElementChild);
      slideBox.insertBefore(lastImage, slideBox.firstElementChild);
      currentSlide--;
      if (currentSlide === 0) {
         currentSlide = imageCount;
      }
      slideCounter.textContent = currentSlide + " / " + imageCount;      
   }   
   
   function startStopShow() {
      if (runShow) {
         showRunning = window.setInterval(moveToRight, 2000);
         runShow = false;
      } else {
         window.clearInterval(showRunning);
         runShow = true;
      }
   }
   
   function createModal() {
      let modalWindow = document.createElement("div");
      modalWindow.id = "activeModal";
      let figureBox = document.createElement("figure");
      modalWindow.appendChild(figureBox); 
      let modalImage = this.cloneNode(true);
      figureBox.appendChild(modalImage);
      let figureCaption = document.createElement("figcaption");
      figureCaption.textContent = modalImage.alt;
      figureBox.appendChild(figureCaption);
      let closeBox = document.createElement("div");
      closeBox.id = "modalClose";
      closeBox.innerHTML = "&times;";
      closeBox.onclick = function() {
         document.body.removeChild(modalWindow);
      }
      modalWindow.appendChild(closeBox);
      document.body.appendChild(modalWindow);
   }
}
////////////////////

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

//////////////////


// PART 6: INSERT METADATA
let allMetadata = [];

function loadMetadata() {
   fetch("meta_data.json")
      .then(res => {
         if (!res.ok) throw new Error("HTTP error " + res.status);
         return res.json();
      })
      .then(data => {
         // Automatically unwraps nested array keys if present
         allMetadata = Array.isArray(data) ? data : (Object.values(data)[0] || []);
         // Initial render for the first slide (Index 0)
         updateMetadataForImage(0);
      })
      .catch(err => console.error("Metadata load error:", err));
}

function updateMetadataForImage(imageIndex) {
   const container = document.getElementById("container");
   if (!container || !allMetadata.length) return;

   // Safely retrieves the metadata object at the active index
   let currentData = allMetadata[imageIndex] || allMetadata[0];
   container.innerHTML = "";
   // Filters out both "id" and "image" keys (case-insensitive)
   let entries = Object.entries(currentData).filter(([key]) => {
      let lowerKey = key.toLowerCase();
      return lowerKey !== "id" && lowerKey !== "image";
   });
   // Renders up to 8 key-value pairs
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

// Ensure fetch runs automatically on page load
if (document.readyState === "loading") {
   document.addEventListener("DOMContentLoaded", loadMetadata);
} else {
   loadMetadata();
}