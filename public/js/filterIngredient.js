  const ingredientsContainer = document.getElementById('ingredients-container');
  const ingredientsInput = document.getElementById('ingredients-input');
  let ingredientsTags = [];
  let allIngredients = [];

  function getIngredientCount(name) {
    const lower = name.toLowerCase();
    return allRecipes.filter(r =>
      r.ingredients?.some(i => i.toLowerCase() === lower)
    ).length;
  }
  function highlightItem(items, index) {
    items.forEach(i => i.style.background = '');
    items[index].style.background = '#666';
    items[index].scrollIntoView({ block: 'nearest' });
  }
  // Fetch all existing ingredients from server
  fetch('/find/all-ingredients')
    .then(res => res.json())
    .then(data => { allIngredients = data; });
  
  function addTag(value) {
    value = value.trim().toLowerCase();
    if (!value || ingredientsTags.includes(value)) return;
  
    ingredientsTags.push(value);

    ingredientsInput.placeholder = "";
  
    const tagEl = document.createElement('span');
    tagEl.className = 'tag';
    tagEl.textContent = value;
  
    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove-tag';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => {
      ingredientsTags = ingredientsTags.filter(t => t !== value);
      ingredientsContainer.removeChild(tagEl);


      if (ingredientsTags.length === 0) {
        ingredientsInput.placeholder = "Type an ingredient and press Enter";
      }

      filterRecipes();
    };
  
    tagEl.appendChild(removeBtn);
    ingredientsContainer.insertBefore(tagEl, ingredientsInput);
  
    filterRecipes();
  }
  
  const dropdown = document.createElement('div');
  dropdown.className = 'autocomplete-dropdown';
  dropdown.style.position = 'absolute';
  dropdown.style.background = '#505050';
  dropdown.style.border = '1px solid #777';
  dropdown.style.zIndex = '1000';
  dropdown.style.display = 'none';
  ingredientsContainer.appendChild(dropdown);
  
  let activeIndex = -1; // for keyboard navigation

  ingredientsInput.addEventListener('input', () => {
    const val = ingredientsInput.value.toLowerCase().trim();
    dropdown.innerHTML = '';
    activeIndex = -1;

    if (!val) {
      dropdown.style.display = 'none';
      return;
    }

    // Find matches (exclude already selected tags)
    let matches = allIngredients
      .filter(i => i.toLowerCase().includes(val) && !ingredientsTags.includes(i))
      .map(name => ({
        name,
        count: getIngredientCount(name)
      }));

    // Sort by highest count
    matches.sort((a, b) => b.count - a.count);

    // No matches message
    if (matches.length === 0) {
      const noItem = document.createElement('div');
      noItem.textContent = 'No matches found';
      noItem.style.padding = '8px 10px';
      noItem.style.opacity = '0.7';
      dropdown.appendChild(noItem);
      dropdown.style.display = 'block';
      return;
    }

    // Build dropdown items
    matches.forEach((m, index) => {
      const item = document.createElement('div');
      item.textContent = `${m.name} (${m.count})`;
      item.classList.add('autocomplete-item');
      item.dataset.index = index;

      item.onclick = () => {
        addTag(m.name);
        ingredientsInput.value = '';
        dropdown.style.display = 'none';
      };

      dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
  });
  document.addEventListener('click', (e) => {
    if (!ingredientsContainer.contains(e.target)) dropdown.style.display = 'none';
  });