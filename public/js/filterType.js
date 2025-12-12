const typeContainer = document.getElementById('type-container');
const typeInput = document.getElementById('type-input');
let typeTags = [];

function addTypeTag(value) {
  value = value.trim().toLowerCase();
  if (!value || typeTags.includes(value)) return;

  typeTags.push(value);
  typeInput.placeholder = "";

  const tagEl = document.createElement('span');
  tagEl.className = 'tag';
  tagEl.textContent = value;

  const removeBtn = document.createElement('span');
  removeBtn.className = 'remove-tag';
  removeBtn.textContent = '×';
  removeBtn.onclick = () => {
    typeTags = typeTags.filter(t => t !== value);
    typeContainer.removeChild(tagEl);

    if (typeTags.length === 0) {
      typeInput.placeholder = "Type a course and press Enter";
    }

    filterRecipes();
  };

  tagEl.appendChild(removeBtn);
  typeContainer.insertBefore(tagEl, typeInput);

  filterRecipes();
}

typeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && typeInput.value.trim() !== "") {
    e.preventDefault();
    addTypeTag(typeInput.value);
    typeInput.value = "";
  }
});