// If the background image is an ad, remove it.
function blockBackgroundImageAd() {
  var bgImage = getComputedStyle(document.body)["background-image"] || "";
  var match = bgImage.match(/^url\((.+)\)$/);
  if (!match)
    return;
  var hiddenImage = document.createElement("img");
    hiddenImage.src = match[1];
    hiddenImage.setAttribute("width", "0");
    hiddenImage.setAttribute("height", "0");
    hiddenImage.style.setProperty("display", "none");
    hiddenImage.style.setProperty("visibility", "hidden");
  document.body.appendChild(hiddenImage);
  window.setTimeout(function() {
    if (hiddenImage.style.opacity === "0") {
      document.body.style.setProperty("background-image", "none");
    }
    document.body.removeChild(hiddenImage);
  }, 1);
}

// Remove background images and purged elements.
// Return true if the element has been handled.
function weakDestroyElement(el, elType) {
  if (elType & ElementTypes.background) {
    el.style.setProperty("background-image", "none", "important");
    return true;
  }
  else if (elType == ElementTypes.script) {
    return true; // nothing to do
  }
  else {
    return false; // not handled by this function
  }
};

beforeLoadHandler = function(event) {
  // Since we don't block non-HTTP requests, return
  // without asking the background page.
  if (/^(?!https?:)[\w-]+:/.test(event.url))
    return;  
  var el = event.target;
  if (!el.nodeName) return; // issue 6256
  // Cancel the load if canLoad is false.
  var elType = typeForElement(el);
  var data = {
    url: relativeToAbsoluteUrl(event.url),
    elType: elType,
    referrer: document.referrer,
    isPopup: window.opener !== null,
    frameDomain: document.location.hostname,
    frameInfo: chrome._tabInfo.gatherFrameInfo()
  };
  if (!safari.self.tab.canLoad(event, data)) {

    // Work around bugs.webkit.org/show_bug.cgi?id=65412
    // Allow the resource to load, but hide it afterwards.
    // Probably a normal site will never reach 250.
    beforeLoadHandler.blockCount++;
    if (beforeLoadHandler.blockCount > 250) {
      log("ABORTING: blocked over 250 requests, probably an infinite loading loop");
      beforeLoadHandler.blockCount = 0;
    } else {
      event.preventDefault();
      // from ABP - content.js 
      // Safari doesn't dispatch the expected events for elements that have been
      // prevented from loading by having their "beforeload" event cancelled.
      // That is a "load" event for blocked frames, and an "error" event for
      // other blocked elements. We need to dispatch those events manually here
      // to avoid breaking element collapsing and pages that rely on those events.
      var eventName = "error";
      if (event.target.localName === "iframe") {
        eventName = "load";    
      }
      setTimeout(function() {
        var evt = document.createEvent("Event");
        evt.initEvent(eventName);
        event.target.dispatchEvent(evt);
      }, 0);      
    }
    if (!weakDestroyElement(el, elType))
      destroyElement(el, elType);
  }
}
beforeLoadHandler.blockCount = 0;

adblock_begin({
  startPurger: function() {
    document.addEventListener("beforeload", beforeLoadHandler, true);
  },
  stopPurger: function() {
    document.removeEventListener("beforeload", beforeLoadHandler, true);
  },
  handleHiding: function(data) {
    if (data.hiding)
      block_list_via_css(data.selectors);
  },
  success: function() {
    onReady(function() { blockBackgroundImageAd(); });

    // Add entries to right click menu of non-whitelisted pages.
    window.addEventListener("contextmenu", function(event) {
      safari.self.tab.setContextMenuEventUserInfo(event, true);
    }, false);
  }
});
