function filterRecipes() {
  const params = new URLSearchParams({
    creator: document.getElementById('creator')?.value || "",
    ingredient: ingredientsTags.join(','),
    type: typeTags.join(','),
    name: document.getElementById('name')?.value || "",
    caloriesLessThan: document.getElementById('caloriesLessThan')?.value || "",
    caloriesGreaterThan: document.getElementById('caloriesGreaterThan')?.value || "",
    fatLessThan: document.getElementById('fatLessThan')?.value || "",
    fatGreaterThan: document.getElementById('fatGreaterThan')?.value || "",
    carbsLessThan: document.getElementById('carbsLessThan')?.value || "",
    carbsGreaterThan: document.getElementById('carbsGreaterThan')?.value || "",
    proteinLessThan: document.getElementById('proteinLessThan')?.value || "",
    proteinGreaterThan: document.getElementById('proteinGreaterThan')?.value || ""
  });

  // Use correct endpoint depending on the page
  const endpoint = window.filterEndpoint || "/find/filter";

  fetch(`${endpoint}?${params.toString()}`)
    .then(res => res.text())
    .then(html => {
      document.getElementById('recipes').innerHTML = html;
    })
    .catch(err => console.error(err));
}