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

  const createQuickCalculator = () => {
    if (!calculatorButton || document.getElementById("calculatorPanel")) return null;

    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="kalq-quick-calc-backdrop" id="kalqQuickCalcBackdrop" hidden></div>
      <aside class="kalq-quick-calc-panel" id="kalqQuickCalculatorPanel" role="dialog" aria-modal="true" aria-labelledby="kalqQuickCalculatorTitle" aria-hidden="true">
        <div class="kalq-quick-calc-head">
          <div><span>Quick calculator</span><h2 id="kalqQuickCalculatorTitle">Calculate without leaving the page</h2></div>
          <button class="kalq-quick-calc-close" id="kalqQuickCalcClose" type="button" aria-label="Close calculator">&times;</button>
        </div>
        <div class="kalq-quick-calc-display" aria-live="polite"><small id="kalqQuickCalcExpression">0</small><strong id="kalqQuickCalcResult">0</strong></div>
        <div class="kalq-quick-calc-keys" id="kalqQuickCalcKeys">
          <button type="button" data-key="clear" class="is-action">C</button><button type="button" data-key="backspace" aria-label="Backspace">&#9003;</button><button type="button" data-key="percent">%</button><button type="button" data-key="/" class="is-operator">&divide;</button>
          <button type="button" data-key="7">7</button><button type="button" data-key="8">8</button><button type="button" data-key="9">9</button><button type="button" data-key="*" class="is-operator">&times;</button>
          <button type="button" data-key="4">4</button><button type="button" data-key="5">5</button><button type="button" data-key="6">6</button><button type="button" data-key="-" class="is-operator">&minus;</button>
          <button type="button" data-key="1">1</button><button type="button" data-key="2">2</button><button type="button" data-key="3">3</button><button type="button" data-key="+" class="is-operator">+</button>
          <button type="button" data-key="negate">&plusmn;</button><button type="button" data-key="0">0</button><button type="button" data-key=".">.</button><button type="button" data-key="equals" class="is-equals">=</button>
        </div>
        <p>Keyboard input is supported. Calculations stay in this browser.</p>
      </aside>`
    );

    const panel = document.getElementById("kalqQuickCalculatorPanel");
    const backdrop = document.getElementById("kalqQuickCalcBackdrop");
    const closeButton = document.getElementById("kalqQuickCalcClose");
    const keys = document.getElementById("kalqQuickCalcKeys");
    const expressionDisplay = document.getElementById("kalqQuickCalcExpression");
    const resultDisplay = document.getElementById("kalqQuickCalcResult");
    let expression = "";
    let previousFocus = null;

    calculatorButton.setAttribute("aria-controls", panel.id);

    const render = () => {
      expressionDisplay.textContent = expression.replaceAll("*", "×").replaceAll("/", "÷") || "0";
    };

    const calculate = () => {
      if (!expression || !/^[0-9+\-*/().\s]+$/.test(expression)) return null;
      try {
        const value = Function(`"use strict"; return (${expression})`)();
        if (!Number.isFinite(value)) return null;
        const result = Number(value.toPrecision(12));
        resultDisplay.textContent = String(result);
        return result;
      } catch {
        resultDisplay.textContent = "Error";
        return null;
      }
    };

    const append = (value) => {
      if (/^[+\-*/]$/.test(value)) {
        if (!expression && value !== "-") return;
        expression = expression.replace(/[+\-*/]+$/, "") + value;
      } else if (value === ".") {
        const current = expression.split(/[+\-*/()]/).pop();
        if (current.includes(".")) return;
        expression += current ? "." : "0.";
      } else {
        expression += value;
      }
      render();
      if (!/[+\-*/.]$/.test(expression)) calculate();
    };

    const useKey = (value) => {
      if (value === "clear") {
        expression = "";
        resultDisplay.textContent = "0";
      } else if (value === "backspace") {
        expression = expression.slice(0, -1);
        if (!expression) resultDisplay.textContent = "0";
      } else if (value === "percent") {
        if (expression && /[0-9)]$/.test(expression)) expression = `(${expression})/100`;
      } else if (value === "negate") {
        if (expression) expression = `-(${expression})`;
      } else if (value === "equals") {
        const result = calculate();
        if (result !== null) expression = String(result);
      } else {
        append(value);
        return;
      }
      render();
      if (expression && !/[+\-*/.]$/.test(expression)) calculate();
    };

    const open = () => {
      previousFocus = document.activeElement;
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      backdrop.hidden = false;
      calculatorButton.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      closeButton.focus();
    };

    const close = () => {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      backdrop.hidden = true;
      calculatorButton.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      previousFocus?.focus?.();
    };

    calculatorButton.addEventListener("click", open);
    closeButton.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    keys.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-key]");
      if (button) useKey(button.dataset.key);
    });
    document.addEventListener("keydown", (event) => {
      if (!panel.classList.contains("is-open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      const keyboardKey = event.key === "Enter" || event.key === "=" ? "equals"
        : event.key === "Backspace" ? "backspace"
        : /^[0-9.+\-*/]$/.test(event.key) ? event.key
        : "";
      if (keyboardKey) {
        event.preventDefault();
        useKey(keyboardKey);
      }
    });

    return panel;
  };

  createQuickCalculator();

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
