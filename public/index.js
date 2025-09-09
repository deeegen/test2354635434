window.addEventListener("load", function () {
  const input = document.getElementById("input");
  const bookmarkBtn = document.querySelector(".bookmark-btn");
  const bookmarksList = document.getElementById("bookmarksList");

  // Load existing bookmarks on startup
  loadBookmarks();

  // Enter key triggers search
  input.addEventListener("keyup", function (e) {
    if (e.keyCode === 13) search();
  });

  // Bookmark button click
  bookmarkBtn.addEventListener("click", function () {
    const url = input.value.trim();
    if (!url) return;

    saveBookmark(url);
    loadBookmarks();
  });

  // Save bookmark to localStorage
  function saveBookmark(url) {
    let bookmarks = JSON.parse(localStorage.getItem("bookmarks")) || [];

    // Prevent duplicates
    if (!bookmarks.includes(url)) {
      bookmarks.push(url);
      localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
    }
  }

  // Delete bookmark
  function deleteBookmark(url) {
    let bookmarks = JSON.parse(localStorage.getItem("bookmarks")) || [];
    bookmarks = bookmarks.filter((b) => b !== url);
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
    loadBookmarks();
  }

  // Open a URL using the same logic as search()
  function openProxied(url) {
    const iframeMode = document.getElementById("iframeToggle").checked;

    if (iframeMode) {
      // Open in frame with proxied URL
      const frameWin = window.open("/frame", "_self");
      frameWin.name = url;

      history.replaceState({ targetUrl: url }, "", "/frame");
    } else {
      window.location.href = "/app/gateway?url=" + encodeURIComponent(url);
    }
  }

  // Render bookmarks into DOM
  function loadBookmarks() {
    bookmarksList.innerHTML = "";
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks")) || [];

    bookmarks.forEach((url) => {
      const bookmarkDiv = document.createElement("div");
      bookmarkDiv.className = "bookmark-item";

      const link = document.createElement("a");
      link.href = "#";
      link.textContent = url;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        openProxied(url);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "×";
      deleteBtn.className = "delete-bookmark-btn";
      deleteBtn.addEventListener("click", () => deleteBookmark(url));

      bookmarkDiv.appendChild(link);
      bookmarkDiv.appendChild(deleteBtn);
      bookmarksList.appendChild(bookmarkDiv);
    });
  }
});

// Existing search logic
function search() {
  const url = document.getElementById("input").value.trim();
  if (!url) return;

  const iframeMode = document.getElementById("iframeToggle").checked;

  if (iframeMode) {
    // Open the /frame route (renders frame.ejs) and pass target via window.name
    const frameWin = window.open("/frame", "_self");
    frameWin.name = url;

    // Store in history state to persist for back/forward navigation
    history.replaceState({ targetUrl: url }, "", "/frame");
  } else {
    window.location.href = "/app/gateway?url=" + encodeURIComponent(url);
  }
}
