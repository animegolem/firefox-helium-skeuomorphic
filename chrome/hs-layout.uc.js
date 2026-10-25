/* helium-slate layout switcher — loaded into each browser window by the
 * autoconfig stub (app-patch/hs-config.js). `this` is the window.
 *
 * Three layouts, all driven by prefs so they survive restarts:
 *   vertical  — sidebar.verticalTabs = true
 *   compact   — horizontal tabs sharing one row with the url field (Helium)
 *   classic   — horizontal tabs on their own row above the nav bar
 * The chosen horizontal layout is kept in hs.layout.horizontal, so turning
 * vertical tabs off (from here or Firefox's own menu) returns to it.
 *
 * Compact mode overlays #TabsToolbar on the nav bar's "tab slot": the first
 * flexible space after the url field (or, if there is none, the gap the
 * stylesheet opens after it). Customize Toolbar still works on the real
 * nav bar; moving the flexible space moves the tabs.
 */
(function (win) {
  "use strict";
  const { document, Services, CustomizableUI } = win;
  if (document.documentElement.hasAttribute("hs-loaded")) {
    return;
  }
  document.documentElement.setAttribute("hs-loaded", "");

  const PREF_VERTICAL = "sidebar.verticalTabs";
  const PREF_HORIZONTAL = "hs.layout.horizontal";
  const LAYOUTS = [
    ["classic", "Classic", "c"],
    ["compact", "Compact (single row)", "o"],
    ["vertical", "Vertical Tabs", "v"],
  ];

  const root = document.documentElement;
  const toolbox = document.getElementById("navigator-toolbox");
  const navTarget = document.getElementById("nav-bar-customization-target");

  function horizontalLayout() {
    const v = Services.prefs.getStringPref(PREF_HORIZONTAL, "compact");
    return v === "classic" ? "classic" : "compact";
  }

  function currentLayout() {
    return Services.prefs.getBoolPref(PREF_VERTICAL, false) ? "vertical" : horizontalLayout();
  }

  function setLayout(layout) {
    if (layout === "vertical") {
      Services.prefs.setBoolPref(PREF_VERTICAL, true);
      return;
    }
    Services.prefs.setStringPref(PREF_HORIZONTAL, layout);
    Services.prefs.setBoolPref(PREF_VERTICAL, false);
  }

  /* ---------- compact: place the tab strip in the nav bar's tab slot ---- */

  function isFlexibleSpace(el) {
    return el.localName === "toolbarspring" || el.id?.startsWith("customizableui-special-spring");
  }

  function visible(el) {
    return !el.hidden && !el.collapsed && el.getBoundingClientRect().width > 0;
  }

  function findSlot() {
    const items = [...navTarget.children];
    const url = items.indexOf(document.getElementById("urlbar-container"));
    const after = url >= 0 ? items.slice(url + 1) : items;
    const slot = after.find(isFlexibleSpace);
    for (const el of items) {
      el.toggleAttribute("hs-tab-slot", el === slot);
      el.removeAttribute("hs-tab-push");
    }
    if (slot) {
      return slot;
    }
    // No flexible space: open a gap before the first item after the url field.
    const next = after.find(visible);
    next?.setAttribute("hs-tab-push", "");
    return null;
  }

  let frame = 0;
  function placeTabs() {
    frame = 0;
    if (root.getAttribute("hs-layout") !== "compact" || root.hasAttribute("customizing")) {
      return;
    }
    const slot = findSlot();
    const box = toolbox.getBoundingClientRect();
    let start, end;
    if (slot) {
      const r = slot.getBoundingClientRect();
      start = r.left;
      end = r.right;
    } else {
      const url = document.getElementById("urlbar-container");
      const next = navTarget.querySelector("[hs-tab-push]");
      start = url ? url.getBoundingClientRect().right : box.left;
      end = next ? next.getBoundingClientRect().left : navTarget.getBoundingClientRect().right;
    }
    toolbox.style.setProperty("--hs-tabs-start", `${Math.round(start - box.left)}px`);
    toolbox.style.setProperty("--hs-tabs-width", `${Math.max(0, Math.round(end - start))}px`);
  }

  function schedulePlace() {
    if (!frame) {
      frame = win.requestAnimationFrame(placeTabs);
    }
  }

  const resizeObserver = new win.ResizeObserver(schedulePlace);
  const mutationObserver = new win.MutationObserver(() => onNavChanged());

  function observeNavItems() {
    resizeObserver.disconnect();
    resizeObserver.observe(toolbox);
    resizeObserver.observe(navTarget);
    for (const el of navTarget.children) {
      resizeObserver.observe(el);
    }
  }

  /* ---------- apply ------------------------------------------------------ */

  /* ---------- vertical: tab-strip buttons stay with the tabs -------------
   * Turning vertical tabs on makes Firefox move the horizontal tab strip's
   * buttons (new tab, list all tabs, ...) to the end of the nav bar, which
   * shoves the toolbar buttons out of the corner. It remembers them in
   * browser.uiCustomization.horizontalTabstrip so it can move them back.
   * While vertical, mark them so the stylesheet keeps them out of the nav
   * bar; the vertical strip has its own New Tab row. */

  const PREF_TABSTRIP_SNAPSHOT = "browser.uiCustomization.horizontalTabstrip";
  const TABSTRIP_WIDGETS = ["new-tab-button", "alltabs-button", "firefox-view-button"];

  function markTabstripWidgets() {
    let moved = TABSTRIP_WIDGETS;
    try {
      moved = moved.concat(JSON.parse(Services.prefs.getStringPref(PREF_TABSTRIP_SNAPSHOT, "[]")));
    } catch (e) {}
    const vertical = root.getAttribute("hs-layout") === "vertical";
    for (const el of navTarget.children) {
      el.toggleAttribute("hs-tabstrip-widget", vertical && moved.includes(el.id));
    }
  }

  function onNavChanged() {
    markTabstripWidgets();
    if (root.getAttribute("hs-layout") === "compact") {
      observeNavItems();
      schedulePlace();
    }
  }

  /* Compact has no room for the sidebar launcher: hide it the way the
   * sidebar button would. Vertical tabs live in the launcher, so make sure
   * it is back when returning to vertical. Runs after Firefox has finished
   * its own tab-orientation switch. */
  function syncSidebar(layout) {
    win.setTimeout(() => {
      const sc = win.SidebarController;
      if (!sc?.sidebarRevampEnabled || currentLayout() !== layout) {
        return;
      }
      if (layout === "compact" && !sc.sidebarVerticalTabsEnabled && sc.launcherVisible) {
        sc.handleToolbarButtonClick();
      } else if (layout === "vertical" && sc.sidebarVerticalTabsEnabled && !sc.launcherVisible) {
        sc._state.updateVisibility(true);
        sc.updateToolbarButton();
      }
    }, 250);
  }

  let lastLayout = null;
  function apply() {
    const layout = currentLayout();
    root.setAttribute("hs-layout", layout);
    if (layout !== lastLayout) {
      if (lastLayout !== null) {
        syncSidebar(layout);
      }
      lastLayout = layout;
    }
    markTabstripWidgets();
    if (layout === "compact") {
      observeNavItems();
      schedulePlace();
    } else {
      resizeObserver.disconnect();
    }
  }

  /* ---------- menus ------------------------------------------------------ */

  function buildMenu(idPrefix) {
    const menu = document.createXULElement("menu");
    menu.id = `${idPrefix}-hs-layout-menu`;
    menu.setAttribute("label", "Tab Layout");
    menu.setAttribute("accesskey", "y");
    const popup = document.createXULElement("menupopup");
    for (const [value, label, key] of LAYOUTS) {
      const item = document.createXULElement("menuitem");
      item.setAttribute("type", "radio");
      item.setAttribute("name", `${idPrefix}-hs-layout`);
      item.setAttribute("label", label);
      item.setAttribute("accesskey", key);
      item.setAttribute("hs-value", value);
      item.addEventListener("command", () => setLayout(value));
      popup.append(item);
    }
    popup.addEventListener("popupshowing", () => {
      const layout = currentLayout();
      for (const item of popup.children) {
        item.toggleAttribute("checked", item.getAttribute("hs-value") === layout);
      }
    });
    menu.append(popup);
    return menu;
  }

  // Toolbar right-click menu, next to Firefox's own vertical-tabs toggle.
  const contextAnchor = document.getElementById("toolbar-context-toggle-vertical-tabs");
  contextAnchor?.after(buildMenu("toolbar-context"));

  // Menu bar: View > Tab Layout, right under View > Toolbars.
  document.getElementById("viewToolbarsMenu")?.after(buildMenu("view"));

  /* ---------- author-level styles (::part() needs them) ------------------ */

  win.windowUtils.loadSheetUsingURIString(
    "chrome://hslate/content/hs-author.css", win.windowUtils.AUTHOR_SHEET);

  /* ---------- wiring ----------------------------------------------------- */

  const prefObserver = { observe: apply };
  Services.prefs.addObserver(PREF_VERTICAL, prefObserver);
  Services.prefs.addObserver(PREF_HORIZONTAL, prefObserver);
  Services.prefs.addObserver(PREF_TABSTRIP_SNAPSHOT, prefObserver);
  mutationObserver.observe(navTarget, { childList: true });

  const customizeListener = {
    onCustomizeStart: () => root.setAttribute("hs-customizing", ""),
    onCustomizeEnd: () => {
      root.removeAttribute("hs-customizing");
      apply();
    },
    onWidgetAfterDOMChange: onNavChanged,
    onAreaNodeRegistered: schedulePlace,
  };
  CustomizableUI.addListener(customizeListener);

  win.addEventListener("unload", () => {
    Services.prefs.removeObserver(PREF_VERTICAL, prefObserver);
    Services.prefs.removeObserver(PREF_HORIZONTAL, prefObserver);
    Services.prefs.removeObserver(PREF_TABSTRIP_SNAPSHOT, prefObserver);
    CustomizableUI.removeListener(customizeListener);
    resizeObserver.disconnect();
    mutationObserver.disconnect();
  }, { once: true });

  apply();
})(this);
