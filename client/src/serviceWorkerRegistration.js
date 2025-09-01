// Simple service worker registration helper

// Register the service worker (called in index.js)
export function register() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log("✅ Service Worker registered:", registration);

          // Optional: listen for updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === "installed") {
                  if (navigator.serviceWorker.controller) {
                    console.log("🔄 New content is available; please refresh.");
                  } else {
                    console.log("🎉 Content cached for offline use.");
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.error("❌ SW registration failed:", error);
        });
    });
  }
}

// Unregister (optional helper, if you ever want to disable SWs)
export function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.unregister();
    });
  }
}
