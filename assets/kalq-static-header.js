(() => {
  const tools = [
    ["Age Calculator", "Health", "/age-calculator/"],
    ["Abacus Quest", "Education", "/abacus-quest/"],
    ["BMI Calculator", "Health", "/bmi-calculator/"],
    ["GPA Calculator", "Education", "/gpa-calculator/"],
    ["Periodic Table & Chemistry Calculator", "Education", "/periodic-table-chemistry-calculator/"],
    ["Ideal Weight Calculator", "Health", "/ideal-weight-calculator/"],
    ["Mental Math Rush", "Mathematics", "/mental-math-rush/"],
    ["Percentage Calculator", "Mathematics", "/percentage-calculator/"],
    ["Percentage Conversion Calculator", "Converter", "/percentage-conversion-calculator/"],
    ["Unit Converter", "Converter", "/unit-converters/"],
    ["Polynomial Root Finder Calculator", "Mathematics", "/polynomial-root-finder-calculator/"],
    ["Pregnancy Due Date Calculator", "Health", "/pregnancy-calculator/"],
    ["Retirement Savings Calculator", "Finance", "/retirement-calculator/"],
    ["Salary Increase Calculator", "Finance", "/salary-increase-calculator/"],
    ["Salary Payroll Calculator", "Finance", "/salary-payroll-calculator/"],
    ["Savings Calculator", "Finance", "/savings-calculator/"],
    ["Tip Calculator", "Finance", "/tip-calculator/"]
  ];

  const scriptUrl = document.currentScript?.src || document.baseURI;
  const siteRoot = new URL("../", scriptUrl);
  const localHref = (pathname) =>
    location.protocol === "file:"
      ? new URL(pathname.replace(/^\//, ""), siteRoot).href
      : pathname;

  const topbarInner = document.querySelector(".topbar-inner");
  const topnav = document.getElementById("topnav");
  const menuButton = document.getElementById("menuButton");
  const calculatorButton = document.getElementById("calculatorButton");
  const themeButton = document.getElementById("themeButton");
  const languageButton = document.getElementById("languageButton");
  const languageMenu = document.getElementById("languageMenu");
  const searchOpenButton = document.getElementById("searchOpenButton");
  const searchWrap = document.getElementById("headerSearchWrap");
  const searchForm = document.getElementById("headerSearchForm");
  const searchInput = document.getElementById("headerSearchInput");
  const searchCloseButton = document.getElementById("headerSearchCloseButton");
  const searchResults = document.getElementById("headerSearchResults");

  const closeMenu = () => {
    topnav?.classList.remove("is-open");
    menuButton?.setAttribute("aria-expanded", "false");
  };

  menuButton?.addEventListener("click", () => {
    const open = topnav?.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(Boolean(open)));
  });

  topnav?.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", closeMenu)
  );

  calculatorButton?.addEventListener("click", () => {
    location.href = localHref("/#home");
  });

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    themeButton?.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
  };

  try {
    applyTheme(localStorage.getItem("kalqTheme") || "light");
  } catch {
    applyTheme("light");
  }

  themeButton?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem("kalqTheme", next);
    } catch {}
  });

  languageButton?.addEventListener("click", () => {
    const willOpen = languageMenu?.hidden ?? true;
    if (languageMenu) languageMenu.hidden = !willOpen;
    languageButton.setAttribute("aria-expanded", String(willOpen));
  });

  languageMenu?.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      document.documentElement.lang = button.dataset.lang || "en";
      languageMenu.querySelectorAll("[data-lang]").forEach((item) =>
        item.classList.toggle("is-active", item === button)
      );
      languageMenu.hidden = true;
      languageButton?.setAttribute("aria-expanded", "false");
    });
  });

  const renderSearch = () => {
    const query = (searchInput?.value || "").trim().toLowerCase();
    const matches = tools
      .filter(([name, category]) => `${name} ${category}`.toLowerCase().includes(query))
      .slice(0, 7);
    if (!searchResults) return;
    searchResults.innerHTML = matches.length
      ? matches
          .map(
            ([name, category, path]) =>
              `<a class="header-search-result" href="${localHref(path)}"><span><strong>${name}</strong><span>${category}</span></span><b>→</b></a>`
          )
          .join("")
      : '<div class="header-search-empty">No matching calculator. Try a broader term.</div>';
    searchResults.hidden = false;
  };

  const openSearch = () => {
    searchWrap?.classList.add("is-open");
    topbarInner?.classList.add("search-open");
    searchOpenButton?.setAttribute("aria-expanded", "true");
    searchInput?.focus();
    renderSearch();
  };

  const closeSearch = () => {
    searchWrap?.classList.remove("is-open");
    topbarInner?.classList.remove("search-open");
    searchOpenButton?.setAttribute("aria-expanded", "false");
    if (searchResults) searchResults.hidden = true;
  };

  searchOpenButton?.addEventListener("click", openSearch);
  searchCloseButton?.addEventListener("click", closeSearch);
  searchInput?.addEventListener("input", renderSearch);
  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = (searchInput?.value || "").trim().toLowerCase();
    const match = tools.find(([name, category]) =>
      `${name} ${category}`.toLowerCase().includes(query)
    );
    location.href = localHref(match?.[2] || "/calculators.html");
  });

  document.addEventListener("click", (event) => {
    if (
      languageMenu &&
      !event.target.closest("#languageMenu") &&
      !event.target.closest("#languageButton")
    ) {
      languageMenu.hidden = true;
      languageButton?.setAttribute("aria-expanded", "false");
    }
    if (
      searchWrap?.classList.contains("is-open") &&
      !event.target.closest("#headerSearchWrap") &&
      !event.target.closest("#searchOpenButton")
    ) {
      closeSearch();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSearch();
      closeMenu();
      if (languageMenu) languageMenu.hidden = true;
      languageButton?.setAttribute("aria-expanded", "false");
    }
  });
})();
