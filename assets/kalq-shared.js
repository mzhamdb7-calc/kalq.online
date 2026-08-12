(() => {
  "use strict";

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    const menuButton = document.getElementById("menuButton");
    const navigation = document.getElementById("topnav");
    if (navigation?.classList.contains("is-open")) {
      navigation.classList.remove("is-open");
      menuButton?.setAttribute("aria-expanded", "false");
      menuButton?.focus();
    }

    const languageMenu = document.getElementById("languageMenu");
    const languageButton = document.getElementById("languageButton");
    if (languageMenu && !languageMenu.hidden) {
      languageMenu.hidden = true;
      languageButton?.setAttribute("aria-expanded", "false");
    }

    const searchWrap = document.getElementById("headerSearchWrap");
    const searchButton = document.getElementById("searchOpenButton");
    if (searchWrap?.classList.contains("is-open")) {
      searchWrap.classList.remove("is-open");
      document.querySelector(".topbar-inner")?.classList.remove("search-open");
      searchButton?.setAttribute("aria-expanded", "false");
    }
  });
})();
