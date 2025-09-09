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
    // Open frame.html and pass target via window.name
    const frameWin = window.open("/frame.html", "_self");
    frameWin.name = url;

    // Also store in history state to persist for back/forward
    history.replaceState({ targetUrl: url }, "", "/frame.html");
  } else {
    window.location.href = "/app/gateway?url=" + encodeURIComponent(url);
  }
}
