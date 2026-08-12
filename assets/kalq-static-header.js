(() => {
  const tools = [
    ["Age Calculator", "Date & Time", "/age-calculator/"],
    ["Date Difference Calculator", "Date & Time", "/date-difference-calculator/"],
    ["Abacus Quest", "Games", "/abacus-quest/"],
    ["BMI Calculator", "Health", "/bmi-calculator/"],
    ["GPA Calculator", "Education", "/gpa-calculator/"],
    ["Periodic Table & Chemistry Calculator", "Education", "/periodic-table-chemistry-calculator/"],
    ["Ideal Weight Calculator", "Health", "/ideal-weight-calculator/"],
    ["Mental Math Rush", "Games", "/mental-math-rush/"],
    ["Percentage Calculator", "Math", "/percentage-calculator/"],
    ["Percentage Conversion Calculator", "Converters", "/percentage-conversion-calculator/"],
    ["Unit Converter", "Converters", "/unit-converters/"],
    ["Currency Converter & Comparison Calculator", "Converters", "/currency-converter-and-comparison-calculator/"],
    ["Polynomial Root Finder Calculator", "Math", "/polynomial-root-finder-calculator/"],
    ["Pregnancy Due Date Calculator", "Health", "/pregnancy-calculator/"],
    ["Retirement Savings Calculator", "Finance", "/retirement-calculator/"],
    ["Salary Increase Calculator", "Finance", "/salary-increase-calculator/"],
    ["Salary Payroll Calculator", "Finance", "/salary-payroll-calculator/"],
    ["Savings Calculator", "Finance", "/savings-calculator/"],
    ["Compound Interest Calculator", "Finance", "/compound-interest-calculator/"],
    ["Credit Card Payoff Calculator", "Finance", "/credit-card-payoff-calculator/"],
    ["APR Calculator", "Finance", "/apr-calculator/"],
    ["Tip Calculator", "Finance", "/tip-calculator/"]
  ];

  const searchModesByPath = {
    "/date-difference-calculator/": ["Calendar Difference", "Total Days", "Working Days", "Public Holiday Analysis", "Date Timeline"],
    "/age-calculator/": ["Exact Age", "Birthday Countdown", "Age Milestones", "Hijri Age", "Leap-Day Birthday"],
    "/bmi-calculator/": ["Adult BMI", "Child & Teen BMI"],
    "/gpa-calculator/": ["Course GPA", "Common 4.0 Scale", "Custom Grading Scale", "Grade Improvement"],
    "/periodic-table-chemistry-calculator/": ["Periodic Table", "Element Explorer", "Isotope Calculator", "Ion Calculator", "Electron Configuration"],
    "/ideal-weight-calculator/": ["Robinson Formula", "Miller Formula", "Devine Formula", "Hamwi Formula", "Healthy BMI Range"],
    "/abacus-quest/": ["Adventure", "Practice", "Daily Challenge", "Flash Anzan", "Number Builder", "Abacus Detective", "Soroban Calculator"],
    "/mental-math-rush/": ["Rush", "Survival", "Streak", "Practice", "Daily", "Addition", "Subtraction", "Multiplication", "Division"],
    "/percentage-calculator/": ["Percentage of a Number", "What Percent", "Whole from Percentage", "Percentage Increase", "Percentage Decrease", "Percentage Change", "Percentage Difference", "Percentage Point Change", "Original Value Before Increase", "Original Value Before Decrease", "Successive Percentage Change"],
    "/percentage-conversion-calculator/": ["Fraction to Percentage", "Decimal to Percentage", "Percentage to Fraction", "Percentage to Decimal", "Ratio to Percentage"],
    "/unit-converters/": [
      "Length Converter", "Weight Converter", "Temperature Converter", "Volume Converter", "Area Converter", "Time Unit Converter", "Angle Converter", "Speed Converter", "Fuel Economy Converter", "Acceleration Converter", "Pace Converter", "Frequency Converter", "Angular Velocity Converter", "Angular Acceleration Converter", "Pressure Converter", "Force Converter", "Torque Converter", "Moment of Inertia Converter", "Surface Tension Converter", "Linear Density Converter", "Surface Density Converter", "Permeability Converter", "Compressibility Converter", "Wavenumber Converter", "Density Converter", "Flow Rate Converter", "Mass Flow Rate Converter", "Dynamic Viscosity Converter", "Kinematic Viscosity Converter", "Specific Volume Converter", "Energy Converter", "Power Converter", "Specific Energy Converter", "Energy Density Converter", "Power Density Converter", "Heat Rate Converter", "Fuel Heating Value Converter", "Thermal Conductivity Converter", "Specific Heat Capacity Converter", "Heat Flux Converter", "Heat Transfer Coefficient Converter", "Thermal Resistance Converter", "Electric Current Converter", "Voltage Converter", "Electrical Resistance Converter", "Capacitance Converter", "Electrical Conductance Converter", "Electrical Resistivity Converter", "Electrical Conductivity Converter", "Inductance Converter", "Electric Charge Converter", "Electric Field Strength Converter", "Magnetic Flux Converter", "Magnetic Flux Density Converter", "Magnetomotive Force Converter", "Electrical Charge Density Converter", "Data Storage Converter", "Data Transfer Rate Converter", "Illuminance Converter", "Sound Pressure Level Converter", "Luminous Flux Converter", "Luminous Intensity Converter", "Luminance Converter", "Radiant Power Converter", "Irradiance Converter", "Solid Angle Converter", "Mass Concentration Converter", "Molar Concentration Converter", "Amount of Substance Converter", "Molar Mass Converter", "Catalytic Activity Converter", "Radioactivity Converter", "Absorbed Radiation Dose Converter", "Equivalent Radiation Dose Converter", "Radiation Exposure Converter"
    ],
    "/currency-converter-and-comparison-calculator/": ["Currency Converter", "Provider Comparison", "Historical Exchange Rates"],
    "/polynomial-root-finder-calculator/": ["Linear Roots", "Quadratic Roots", "Cubic Roots", "Quartic Roots", "Complex Roots", "Polynomial Graph"],
    "/pregnancy-calculator/": ["Last Menstrual Period Due Date", "Pregnancy Week", "Trimester Timeline"],
    "/retirement-calculator/": ["Retirement Savings Projection", "Retirement Spending Goal", "Required Monthly Contribution"],
    "/salary-increase-calculator/": ["Use Raise Percentage", "Use New Salary"],
    "/salary-payroll-calculator/": ["Quick Payroll", "Detailed Payroll"],
    "/savings-calculator/": ["Monthly Savings Projection", "Beginning-of-Month Deposits", "End-of-Month Deposits"],
    "/compound-interest-calculator/": ["Daily Compounding", "Weekly Compounding", "Monthly Compounding", "Yearly Compounding"],
    "/credit-card-payoff-calculator/": ["Minimum Payment Payoff", "Extra Monthly Payment", "Debt-Free Date", "Interest Savings"],
    "/apr-calculator/": ["Loan APR", "Fee Impact", "Monthly Payment", "Total Borrowing Cost", "Amortization Schedule"],
    "/tip-calculator/": ["Standard", "With Outlook", "Split Bill", "Tip Percentage"]
  };

  const getSearchEntries = (value = "", limit = 7) => {
    const query = value.trim().toLowerCase();
    const entries = tools.flatMap(([name, category, path]) => [
      { title: name, parentName: "", category, path, isMode: false },
      ...(searchModesByPath[path] || []).map((mode) => ({ title: mode, parentName: name, category, path, isMode: true }))
    ]);
    if (!query) return entries.filter((entry) => !entry.isMode).slice(0, limit);
    return entries
      .map((entry) => {
        const title = entry.title.toLowerCase();
        const parent = entry.parentName.toLowerCase();
        const category = entry.category.toLowerCase();
        let score = 99;
        if (title === query) score = 0;
        else if (title.startsWith(query)) score = 1;
        else if (title.includes(query)) score = 2;
        else if (parent.startsWith(query)) score = 3;
        else if (parent.includes(query)) score = 4;
        else if (category.includes(query)) score = 5;
        return { ...entry, score };
      })
      .filter((entry) => entry.score < 99)
      .sort((a, b) => a.score - b.score || Number(a.isMode) - Number(b.isMode) || a.title.localeCompare(b.title))
      .slice(0, limit);
  };

  const scriptUrl = document.currentScript?.src || document.baseURI;
  const siteRoot = new URL("../", scriptUrl);
  const localHref = (pathname) => {
    if (location.protocol !== "file:") return pathname;

    const original = String(pathname || "/");
    const hashIndex = original.indexOf("#");
    const queryIndex = original.indexOf("?");
    const suffixIndex = [hashIndex, queryIndex]
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? original.length;
    const pathPart = original.slice(0, suffixIndex).replace(/^\//, "");
    const suffix = original.slice(suffixIndex);
    const filePath = !pathPart
      ? "index.html"
      : pathPart.endsWith("/")
        ? `${pathPart}index.html`
        : pathPart;

    return new URL(`${filePath}${suffix}`, siteRoot).href;
  };

  const rewriteLocalLinks = (root = document) => {
    if (location.protocol !== "file:") return;
    root.querySelectorAll?.('a[href^="/"]').forEach((link) => {
      link.href = localHref(link.getAttribute("href"));
    });
  };

  rewriteLocalLinks();

  if (location.protocol === "file:") {
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.matches?.('a[href^="/"]')) {
            node.href = localHref(node.getAttribute("href"));
          }
          rewriteLocalLinks(node);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  const topbarInner = document.querySelector(".topbar-inner");
  const topnav = document.getElementById("topnav");
  const menuButton = document.getElementById("menuButton");
  const calculatorButton = document.getElementById("calculatorButton");
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
        <div class="kalq-quick-calc-tabs" role="tablist" aria-label="Calculator mode">
          <button id="kalqQuickCalcBasicTab" type="button" role="tab" aria-selected="true" aria-controls="kalqQuickCalcBasicKeys" data-calc-mode="basic">Basic</button>
          <button id="kalqQuickCalcScientificTab" type="button" role="tab" aria-selected="false" aria-controls="kalqQuickCalcScientificKeys" data-calc-mode="scientific">Scientific</button>
        </div>
        <div class="kalq-quick-calc-display" aria-live="polite"><small id="kalqQuickCalcExpression">0</small><strong id="kalqQuickCalcResult">0</strong></div>
        <div class="kalq-quick-calc-keys" id="kalqQuickCalcBasicKeys" role="tabpanel" aria-labelledby="kalqQuickCalcBasicTab" data-calc-panel="basic">
          <button type="button" data-key="clear" class="is-action">C</button><button type="button" data-key="backspace" aria-label="Backspace">&#9003;</button><button type="button" data-key="percent">%</button><button type="button" data-key="/" class="is-operator">&divide;</button>
          <button type="button" data-key="7">7</button><button type="button" data-key="8">8</button><button type="button" data-key="9">9</button><button type="button" data-key="*" class="is-operator">&times;</button>
          <button type="button" data-key="4">4</button><button type="button" data-key="5">5</button><button type="button" data-key="6">6</button><button type="button" data-key="-" class="is-operator">&minus;</button>
          <button type="button" data-key="1">1</button><button type="button" data-key="2">2</button><button type="button" data-key="3">3</button><button type="button" data-key="+" class="is-operator">+</button>
          <button type="button" data-key="negate">&plusmn;</button><button type="button" data-key="0">0</button><button type="button" data-key=".">.</button><button type="button" data-key="equals" class="is-equals">=</button>
        </div>
        <div class="kalq-quick-calc-keys is-scientific" id="kalqQuickCalcScientificKeys" role="tabpanel" aria-labelledby="kalqQuickCalcScientificTab" data-calc-panel="scientific" hidden>
          <button type="button" data-key="sin" class="is-function">sin</button><button type="button" data-key="cos" class="is-function">cos</button><button type="button" data-key="tan" class="is-function">tan</button><button type="button" data-key="ln" class="is-function">ln</button>
          <button type="button" data-key="log" class="is-function">log</button><button type="button" data-key="sqrt" class="is-function">&radic;</button><button type="button" data-key="square" class="is-function">x&sup2;</button><button type="button" data-key="^" class="is-function">x<sup>y</sup></button>
          <button type="button" data-key="pi" class="is-function">&pi;</button><button type="button" data-key="e" class="is-function">e</button><button type="button" data-key="(">(</button><button type="button" data-key=")">)</button>
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
    const modeTabs = panel.querySelectorAll("[data-calc-mode]");
    const modePanels = panel.querySelectorAll("[data-calc-panel]");
    const expressionDisplay = document.getElementById("kalqQuickCalcExpression");
    const resultDisplay = document.getElementById("kalqQuickCalcResult");
    let expression = "";
    let previousFocus = null;

    calculatorButton.setAttribute("aria-controls", panel.id);

    const render = () => {
      expressionDisplay.textContent = expression.replaceAll("*", "×").replaceAll("/", "÷") || "0";
    };

    const calculate = () => {
      if (!expression || !/^[0-9+\-*/^().\s]+$/.test(expression)) return null;
      try {
        const safeExpression = expression.replaceAll("^", "**");
        const value = Function(`"use strict"; return (${safeExpression})`)();
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
      if (/^[+\-*/^]$/.test(value)) {
        if (!expression && value !== "-") return;
        expression = expression.replace(/[+\-*/^]+$/, "") + value;
      } else if (value === ".") {
        const current = expression.split(/[+\-*/^()]/).pop();
        if (current.includes(".")) return;
        expression += current ? "." : "0.";
      } else if (value === "(") {
        expression += /[0-9)]$/.test(expression) ? "*(" : "(";
      } else if (value === ")") {
        const openCount = (expression.match(/\(/g) || []).length;
        const closeCount = (expression.match(/\)/g) || []).length;
        if (openCount > closeCount && /[0-9)]$/.test(expression)) expression += ")";
      } else {
        expression += value;
      }
      render();
      if (!/[+\-*/^.()]$/.test(expression)) calculate();
    };

    const useScientificFunction = (name) => {
      if (name === "pi" || name === "e") {
        const constant = name === "pi" ? Math.PI : Math.E;
        if (/[0-9)]$/.test(expression)) expression += "*";
        expression += String(Number(constant.toPrecision(12)));
        render();
        calculate();
        return true;
      }

      if (name === "square") {
        if (!expression || /[+\-*/^.(]$/.test(expression)) return true;
        expression = `(${expression})^2`;
        render();
        calculate();
        return true;
      }

      if (!new Set(["sin", "cos", "tan", "ln", "log", "sqrt"]).has(name)) return false;
      const value = calculate();
      if (value === null) return true;
      const radians = value * Math.PI / 180;
      const next = name === "sin" ? Math.sin(radians)
        : name === "cos" ? Math.cos(radians)
        : name === "tan" ? Math.tan(radians)
        : name === "ln" ? Math.log(value)
        : name === "log" ? Math.log10(value)
        : Math.sqrt(value);
      if (!Number.isFinite(next)) {
        resultDisplay.textContent = "Error";
        return true;
      }
      expression = String(Number(next.toPrecision(12)));
      render();
      calculate();
      return true;
    };

    const useKey = (value) => {
      if (useScientificFunction(value)) {
        return;
      } else if (value === "clear") {
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
      if (expression && !/[+\-*/^.()]$/.test(expression)) calculate();
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
    panel.addEventListener("click", (event) => {
      const modeButton = event.target.closest("button[data-calc-mode]");
      if (modeButton) {
        const mode = modeButton.dataset.calcMode;
        modeTabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab === modeButton)));
        modePanels.forEach((modePanel) => {
          modePanel.hidden = modePanel.dataset.calcPanel !== mode;
        });
        return;
      }
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
        : /^[0-9.+\-*/^()]$/.test(event.key) ? event.key
        : "";
      if (keyboardKey) {
        event.preventDefault();
        useKey(keyboardKey);
      }
    });

    return panel;
  };

  // Imported calculator pages may contain the index page's uninitialised
  // legacy panel markup. Remove that inert copy so the shared, fully wired
  // calculator opens consistently from the canonical header button.
  const legacyCalculatorPanel = document.getElementById("calculatorPanel");
  if (legacyCalculatorPanel) {
    legacyCalculatorPanel.remove();
    document.getElementById("panelBackdrop")?.remove();
  }

  createQuickCalculator();

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
    const matches = getSearchEntries(query, 7);
    if (!searchResults) return;
    searchResults.innerHTML = matches.length
      ? matches
          .map(
            (entry) =>
              `<a class="header-search-result" href="${localHref(entry.path)}"><span><strong>${entry.title}</strong><span>${entry.isMode ? `${entry.parentName} · ${entry.category}` : entry.category}</span></span><b>→</b></a>`
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
    const match = getSearchEntries(query, 1)[0];
    location.href = localHref(match?.path || "/calculators.html");
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
