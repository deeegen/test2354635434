window.addEventListener("load", function () {
  const input = document.getElementById("input");
  input.addEventListener("keyup", function (e) {
    if (e.keyCode === 13) search();
  });
});

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
