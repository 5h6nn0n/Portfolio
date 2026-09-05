// images.js
async function loadBase64Image(elementId, textFilePath) {
  try {
    // 1. Read the .txt file from your project folder
    const response = await fetch(textFilePath);
    const base64String = await response.text();
    
    // 2. Set the image source automatically
    const imgElement = document.getElementById(elementId);
    if (imgElement) {
      imgElement.src = base64String.trim();
    }
  } catch (error) {
    console.error(`Failed to load ${textFilePath}:`, error);
  }
}

// Load all 3 images when the page is ready
document.addEventListener("DOMContentLoaded", () => {
  loadBase64Image("img-profile", "imgs/selfie.txt");
  loadBase64Image("img-award", "imgs/award.txt");
  loadBase64Image("img-cat", "imgs/cat.txt");
});
