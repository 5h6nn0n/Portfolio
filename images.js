// images.js
async function loadBase64Image(elementId, jsonFilePath) {
  try {
    const response = await fetch(jsonFilePath);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    
    const result = await response.json();
    const imgElement = document.getElementById(elementId);
    if (imgElement) {
      imgElement.src = result.data;
    }
  } catch (error) {
    console.error(`Error loading ${jsonFilePath}:`, error);
  }
}

// Load all 3 images when the page is ready
document.addEventListener("DOMContentLoaded", () => {
  loadBase64Image("img-profile", "selfie.json");
  loadBase64Image("img-award", "award.json");
  loadBase64Image("img-cat", "cat.json");
});