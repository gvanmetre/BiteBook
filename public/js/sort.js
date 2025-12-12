  function applySort() {
    const sortBy = document.getElementById("sortOption").value;
    const container = document.getElementById("recipes");
  
    let cards = Array.from(container.children);
  
    cards.sort((a, b) => {
      let aName = a.dataset.name.toLowerCase();
      let bName = b.dataset.name.toLowerCase();
  
      let aLikes = parseInt(a.dataset.likes);
      let bLikes = parseInt(b.dataset.likes);
  
      let aDate = new Date(a.dataset.date);
      let bDate = new Date(b.dataset.date);
  
      if (sortBy === "alpha") {
        return aName.localeCompare(bName);
      }
  
      if (sortBy === "likes") {
        return bLikes - aLikes;
      }
  
      // default = most recent
      return bDate - aDate;
    });
  
    // re-render cards
    container.innerHTML = "";
    cards.forEach(card => container.appendChild(card));
  }