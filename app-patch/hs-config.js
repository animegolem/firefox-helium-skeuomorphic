// helium-slate autoconfig stub (Firefox skips this first line).
// Registers <profile>/chrome as chrome://hslate/content/ (via the
// chrome.manifest there) and loads hs-layout.uc.js into every browser
// window. Deliberately tiny: all behaviour lives in the profile, so this
// file only needs re-copying when a Firefox update wipes it.
try {
  const S = globalThis.Services ||
    ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs").Services;
  let registered = false;
  S.obs.addObserver(win => {
    try {
      if (!registered) {
        const manifest = S.dirsvc.get("UChrm", Components.interfaces.nsIFile);
        manifest.append("chrome.manifest");
        if (!manifest.exists()) {
          return;
        }
        Components.manager
          .QueryInterface(Components.interfaces.nsIComponentRegistrar)
          .autoRegister(manifest);
        registered = true;
      }
      S.scriptloader.loadSubScript("chrome://hslate/content/hs-layout.uc.js", win);
    } catch (e) {
      Components.utils.reportError(e);
    }
  }, "browser-delayed-startup-finished");
} catch (e) {
  Components.utils.reportError(e);
}
