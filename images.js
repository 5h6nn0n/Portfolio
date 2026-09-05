async function loadBase64Image(elementId, jsonFileName) {
  try {
    const response = await fetch(jsonFileName);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let rawText = await response.text();
    rawText = rawText.replace(/^\uFEFF/, '').trim();
    const result = JSON.parse(rawText);

    const imgElement = document.getElementById(elementId);
    if (imgElement && result.data) {
      imgElement.src = result.data.trim();
    }
  } catch (error) {
    console.error(`Error loading ${jsonFileName}:`, error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadBase64Image("img-profile", "imgs/selfie.json");
  loadBase64Image("img-award", "imgs/award.json");
  loadBase64Image("img-cat", "imgs/cat.json");
});
