(() => {
  "use strict";

  const currencyApi = "https://api.frankfurter.dev/v2";
  const fallbackCurrencies = [
    ["USD", "US Dollar"], ["MYR", "Malaysian Ringgit"], ["EUR", "Euro"],
    ["GBP", "British Pound"], ["JPY", "Japanese Yen"], ["AUD", "Australian Dollar"],
    ["CAD", "Canadian Dollar"], ["CHF", "Swiss Franc"], ["CNY", "Chinese Yuan"],
    ["SGD", "Singapore Dollar"], ["HKD", "Hong Kong Dollar"], ["NZD", "New Zealand Dollar"],
    ["INR", "Indian Rupee"], ["KRW", "South Korean Won"], ["THB", "Thai Baht"],
    ["IDR", "Indonesian Rupiah"], ["PHP", "Philippine Peso"], ["BRL", "Brazilian Real"],
    ["MXN", "Mexican Peso"], ["ZAR", "South African Rand"], ["SEK", "Swedish Krona"],
    ["NOK", "Norwegian Krone"], ["DKK", "Danish Krone"], ["PLN", "Polish Zloty"],
    ["CZK", "Czech Koruna"], ["HUF", "Hungarian Forint"], ["RON", "Romanian Leu"],
    ["TRY", "Turkish Lira"], ["ILS", "Israeli New Shekel"], ["ISK", "Icelandic Krona"]
  ];
  const currencyNames = new Map(fallbackCurrencies);
  const storageKey = "kalqCurrency";
  const rateCacheKey = "kalqLiveCurrencyRates";
  let activeCurrency = "USD";
  let pageCurrencyOverride = null;
  let syncingCalculatorCurrency = false;

  /* KALQ now uses one light presentation only. Remove any stored legacy
     preference and prevent older page-local theme code from restoring it. */
  const enforceLightPresentation = () => {
    if (document.documentElement.hasAttribute("data-theme")) {
      document.documentElement.removeAttribute("data-theme");
    }
    document.querySelectorAll("#themeButton").forEach((button) => button.remove());
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0f2c3d");
    try {
      window.localStorage.removeItem("kalqTheme");
      window.localStorage.removeItem("kalq-theme");
    } catch {
      // Local file previews can disable storage; the light presentation remains.
    }
  };

  enforceLightPresentation();
  new MutationObserver(enforceLightPresentation).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });

  function normalizeCurrency(value) {
    const currency = String(value || "").trim().toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : "";
  }

  function readCurrency() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return normalizeCurrency(saved) || "USD";
    } catch {
      return "USD";
    }
  }

  function saveCurrency(currency) {
    try {
      window.localStorage.setItem(storageKey, currency);
    } catch {
      // Local file previews can disable storage; the current page still works.
    }
  }

  function setSelectValue(id, currency) {
    const select = document.getElementById(id);
    if (!(select instanceof HTMLSelectElement)) return;
    if (!Array.from(select.options).some((option) => option.value === currency)) return;
    if (select.value === currency) return;

    syncingCalculatorCurrency = true;
    select.value = currency;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    syncingCalculatorCurrency = false;
  }

  function syncConverterBase(currency) {
    const from = document.getElementById("fromCurrency");
    const to = document.getElementById("toCurrency");
    if (!(from instanceof HTMLSelectElement)) return;
    if (!Array.from(from.options).some((option) => option.value === currency)) return;
    if (from.value === currency) return;

    const previousFrom = from.value;
    if (to instanceof HTMLSelectElement && to.value === currency) {
      const replacement = previousFrom !== currency && Array.from(to.options).some((option) => option.value === previousFrom)
        ? previousFrom
        : Array.from(to.options).find((option) => option.value !== currency)?.value;
      if (replacement) setSelectValue("toCurrency", replacement);
    }
    setSelectValue("fromCurrency", currency);
  }

  function clickCurrencyButton(usdId, myrId, currency) {
    if (currency !== "USD" && currency !== "MYR") return;
    const button = document.getElementById(currency === "MYR" ? myrId : usdId);
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.classList.contains("is-active") || button.getAttribute("aria-pressed") === "true") return;
    button.click();
  }

  function syncCalculatorCurrency(currency, forceGeneral = false) {
    setSelectValue("currency", currency);
    setSelectValue("currencySelect", currency);
    clickCurrencyButton("usdBtn", "myrBtn", currency);
    clickCurrencyButton("usdToggle", "myrToggle", currency);
    if (forceGeneral || !pageCurrencyOverride) syncConverterBase(currency);
  }

  function currencyName(currency) {
    return currencyNames.get(currency) || currency;
  }

  function currencySymbol(currency) {
    try {
      const parts = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).formatToParts(0);
      return parts.find((part) => part.type === "currency")?.value || currency;
    } catch {
      return currency;
    }
  }

  function renderCurrencyOptions() {
    const menu = document.getElementById("currencyMenu");
    if (!menu) return;
    const priority = new Map([["USD", 0], ["MYR", 1], ["EUR", 2], ["GBP", 3], ["JPY", 4]]);
    const entries = Array.from(currencyNames.entries()).sort(([codeA], [codeB]) => {
      const rankA = priority.has(codeA) ? priority.get(codeA) : 100;
      const rankB = priority.has(codeB) ? priority.get(codeB) : 100;
      return rankA - rankB || codeA.localeCompare(codeB);
    });

    const fragment = document.createDocumentFragment();
    entries.forEach(([code, name]) => {
      const option = document.createElement("button");
      option.type = "button";
      option.setAttribute("role", "radio");
      option.setAttribute("data-site-currency", code);
      option.innerHTML = `<span>${currencySymbol(code)}</span><span><strong>${code}</strong><small>${name}</small></span>`;
      fragment.append(option);
    });
    menu.replaceChildren(fragment);
    updateHeaderCurrency(activeCurrency);
  }

  function normalizeCurrencyResponse(data) {
    const entries = [];
    if (Array.isArray(data)) {
      data.forEach((item) => {
        const code = normalizeCurrency(item?.iso_code || item?.code || item?.currency || item?.id);
        const name = item?.name || item?.currency_name || item?.title;
        if (code && name) entries.push([code, String(name)]);
      });
    } else if (data && typeof data === "object") {
      Object.entries(data).forEach(([rawCode, value]) => {
        const code = normalizeCurrency(rawCode);
        const name = typeof value === "string" ? value : value?.name || value?.currency_name;
        if (code && name) entries.push([code, String(name)]);
      });
    }
    return entries;
  }

  function extendConverterCurrencyLists() {
    ["fromCurrency", "toCurrency"].forEach((id) => {
      const select = document.getElementById(id);
      if (!(select instanceof HTMLSelectElement)) return;
      const selected = select.value;
      const existing = new Set(Array.from(select.options).map((option) => option.value));
      Array.from(currencyNames.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([code, name]) => {
        if (existing.has(code)) return;
        select.add(new Option(`${code} — ${name}`, code));
      });
      if (existing.has(selected)) select.value = selected;
    });
    if (!pageCurrencyOverride) syncConverterBase(activeCurrency);
  }

  async function loadInternationalCurrencies() {
    try {
      const response = await fetch(`${currencyApi}/currencies`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Currency list request failed: ${response.status}`);
      normalizeCurrencyResponse(await response.json()).forEach(([code, name]) => currencyNames.set(code, name));
      renderCurrencyOptions();
      extendConverterCurrencyLists();
    } catch {
      // The complete fallback list remains usable when the live service is unavailable.
    }
  }

  function cachedRates(base) {
    try {
      const cached = JSON.parse(window.sessionStorage.getItem(rateCacheKey) || "null");
      if (!cached || cached.base !== base || Date.now() - cached.savedAt > 21600000) return null;
      return cached;
    } catch {
      return null;
    }
  }

  function normalizeRates(data, base) {
    const rates = { [base]: 1 };
    let date = "";
    if (Array.isArray(data)) {
      data.forEach((row) => {
        const quote = normalizeCurrency(row?.quote || row?.quote_currency || row?.currency);
        const rate = Number(row?.rate);
        if (quote && Number.isFinite(rate)) rates[quote] = rate;
        if (!date && row?.date) date = String(row.date);
      });
    } else if (data?.rates && typeof data.rates === "object") {
      Object.entries(data.rates).forEach(([quote, rawRate]) => {
        const code = normalizeCurrency(quote);
        const rate = Number(rawRate);
        if (code && Number.isFinite(rate)) rates[code] = rate;
      });
      date = String(data.date || "");
    }
    return { base, rates, date, source: "Frankfurter", savedAt: Date.now() };
  }

  function announceRates(snapshot) {
    document.dispatchEvent(new CustomEvent("kalq:currencyrates", { detail: snapshot }));
  }

  async function loadLiveRates(base) {
    const cached = cachedRates(base);
    if (cached) {
      announceRates(cached);
      return cached;
    }
    try {
      const response = await fetch(`${currencyApi}/rates?base=${encodeURIComponent(base)}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Rate request failed: ${response.status}`);
      const snapshot = normalizeRates(await response.json(), base);
      if (Object.keys(snapshot.rates).length < 2) throw new Error("No live rates returned");
      try { window.sessionStorage.setItem(rateCacheKey, JSON.stringify(snapshot)); } catch {}
      announceRates(snapshot);
      return snapshot;
    } catch {
      return null;
    }
  }

  function updateHeaderCurrency(currency) {
    const label = document.getElementById("currencyButtonLabel");
    const button = document.getElementById("currencyButton");
    if (label) label.textContent = currency;
    button?.setAttribute(
      "aria-label",
      `Currency: ${currencyName(currency)}`
    );

    document.querySelectorAll("[data-site-currency]").forEach((option) => {
      const isActive = option.getAttribute("data-site-currency") === currency;
      option.classList.toggle("is-active", isActive);
      option.setAttribute("aria-checked", String(isActive));
    });
  }

  function dispatchCurrencyChange(currency, source = "global") {
    document.dispatchEvent(new CustomEvent("kalq:currencychange", {
      detail: { currency, generalCurrency: activeCurrency, source }
    }));
  }

  function applyCurrency(rawCurrency, persist = true) {
    const currency = normalizeCurrency(rawCurrency);
    if (!currency) return;
    if (!currencyNames.has(currency)) currencyNames.set(currency, currency);
    activeCurrency = currency;
    if (persist) saveCurrency(currency);
    updateHeaderCurrency(currency);
    pageCurrencyOverride = null;
    syncCalculatorCurrency(currency, true);
    dispatchCurrencyChange(currency);
    loadLiveRates(currency);
  }

  function buildCurrencyControl() {
    const actions = document.querySelector(".topbar .header-actions");
    if (!actions) return;

    let wrapper = actions.querySelector(".header-currency-wrap");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "header-currency-wrap";
      wrapper.innerHTML = `
        <button class="icon-button currency-button" id="currencyButton" type="button"
          aria-label="Currency: US Dollar" aria-controls="currencyMenu" aria-expanded="false">
          <span id="currencyButtonLabel">USD</span>
        </button>
        <div class="currency-menu" id="currencyMenu" role="radiogroup" aria-label="Currency" hidden>
          <button type="button" role="radio" data-site-currency="USD"><span>$</span>USD · US Dollar</button>
          <button type="button" role="radio" data-site-currency="MYR"><span>RM</span>MYR · Malaysian Ringgit</button>
        </div>`;

      const languageWrapper = actions.querySelector(".header-popover-wrap");
      if (languageWrapper) languageWrapper.insertAdjacentElement("afterend", wrapper);
      else actions.prepend(wrapper);
    }

    const button = wrapper.querySelector("#currencyButton");
    const menu = wrapper.querySelector("#currencyMenu");
    if (!button || !menu || wrapper.dataset.kalqCurrencyBound === "true") return;
    wrapper.dataset.kalqCurrencyBound = "true";
    renderCurrencyOptions();

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      button.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) {
        const languageMenu = document.getElementById("languageMenu");
        const languageButton = document.getElementById("languageButton");
        if (languageMenu) languageMenu.hidden = true;
        languageButton?.setAttribute("aria-expanded", "false");
      }
    });

    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-site-currency]");
      if (!option) return;
      applyCurrency(option.getAttribute("data-site-currency"));
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
      button.focus();
    });

    document.addEventListener("click", (event) => {
      if (wrapper.contains(event.target)) return;
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    });
  }

  buildCurrencyControl();
  activeCurrency = readCurrency();
  applyCurrency(activeCurrency, false);
  loadInternationalCurrencies();

  document.querySelectorAll("#currency, #currencySelect, #fromCurrency").forEach((control) => {
    control.addEventListener("change", () => {
      if (syncingCalculatorCurrency) return;
      const currency = normalizeCurrency(control.value);
      if (!currency) return;
      pageCurrencyOverride = currency;
      document.dispatchEvent(new CustomEvent("kalq:pagecurrencychange", {
        detail: { currency, generalCurrency: activeCurrency, source: "page" }
      }));
      loadLiveRates(currency);
    });
  });

  requestAnimationFrame(() => syncCalculatorCurrency(activeCurrency));
  window.addEventListener("load", () => syncCalculatorCurrency(activeCurrency), { once: true });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button, input[type='reset']");
    if (!button) return;
    const resetMarker = `${button.id} ${button.className} ${button.getAttribute("name") || ""}`;
    if (/reset/i.test(resetMarker)) {
      window.setTimeout(() => {
        pageCurrencyOverride = null;
        syncCalculatorCurrency(activeCurrency, true);
        dispatchCurrencyChange(activeCurrency, "global-reset");
      }, 0);
    }
  });

  window.KALQCurrency = Object.freeze({
    getGeneralCurrency: () => activeCurrency,
    getPageCurrency: () => pageCurrencyOverride || activeCurrency,
    getName: currencyName,
    getSymbol: currencySymbol,
    refreshRates: (currency = pageCurrencyOverride || activeCurrency) => loadLiveRates(normalizeCurrency(currency) || activeCurrency)
  });

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

    const currencyMenu = document.getElementById("currencyMenu");
    const currencyButton = document.getElementById("currencyButton");
    if (currencyMenu && !currencyMenu.hidden) {
      currencyMenu.hidden = true;
      currencyButton?.setAttribute("aria-expanded", "false");
      currencyButton?.focus();
    }

    const searchWrap = document.getElementById("headerSearchWrap");
    const searchButton = document.getElementById("searchOpenButton");
    if (searchWrap?.classList.contains("is-open")) {
      searchWrap.classList.remove("is-open");
      document.querySelector(".topbar-inner")?.classList.remove("search-open");
      searchButton?.setAttribute("aria-expanded", "false");
    }
  });

  /* Keep report previews on their own scroll surface. The report's existing
     open/close code varies by calculator, so visibility is observed instead
     of replacing any calculator-specific report behavior. */
  const reportRoot = document.getElementById("reportRoot");
  if (reportRoot) {
    let reportScrollLocked = false;
    let reportSyncFrame = 0;
    let reportPrintPending = false;

    const reportIsVisible = () => {
      if (reportRoot.hidden || reportRoot.getAttribute("aria-hidden") === "true") return false;
      const style = window.getComputedStyle(reportRoot);
      return style.display !== "none" && style.visibility !== "hidden";
    };

    const syncReportScrollLock = () => {
      reportSyncFrame = 0;
      const shouldLock = reportIsVisible();
      if (shouldLock === reportScrollLocked) return;
      reportScrollLocked = shouldLock;
      document.documentElement.classList.toggle("kalq-report-open", shouldLock);
      document.body.classList.toggle("kalq-report-open", shouldLock);
      reportRoot.toggleAttribute("data-kalq-report-scroll", shouldLock);
    };

    const scheduleReportScrollSync = () => {
      if (reportSyncFrame) cancelAnimationFrame(reportSyncFrame);
      reportSyncFrame = requestAnimationFrame(syncReportScrollLock);
    };

    const closeVisibleReport = () => {
      if (!reportIsVisible()) return false;

      const closeButton = reportRoot.querySelector(
        "#closePreviewBtn, #previewCloseBtn, #closeReportBtn, [data-close-report]"
      );
      if (closeButton instanceof HTMLElement && !closeButton.hasAttribute("disabled")) {
        closeButton.click();
      }

      /* All report pages use is-preview today. The fallback keeps Escape
         dependable if an individual calculator's close control changes. */
      if (reportIsVisible()) {
        reportRoot.classList.remove("is-preview", "is-open", "open");
        reportRoot.setAttribute("aria-hidden", "true");
        document.body.style.removeProperty("overflow");
      }

      reportRoot.removeAttribute("data-kalq-print-preview");
      scheduleReportScrollSync();
      return true;
    };

    const printVisibleReport = () => {
      if (!reportIsVisible() || reportPrintPending) return;
      reportPrintPending = true;
      reportRoot.setAttribute("data-kalq-print-preview", "");
      document.body.classList.add("print-report", "kalq-printing-report");
      reportRoot.scrollTop = 0;
      scheduleReportScrollSync();
      requestAnimationFrame(() => window.print());
    };

    /* Capture Escape before calculator-specific keyboard handlers so every
       report closes through one consistent path. */
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !reportIsVisible()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeVisibleReport();
    }, true);

    /* Printing always starts from the visible preview. This prevents a main
       page Print button from switching to a separate print-only state. */
    document.addEventListener("click", (event) => {
      const printButton = event.target.closest(
        "#printReportBtn, #childPrintReportBtn, #previewPrintBtn"
      );
      if (!printButton) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if (reportIsVisible()) {
        printVisibleReport();
        return;
      }

      const previewButtonId = printButton.id === "childPrintReportBtn"
        ? "childPreviewReportBtn"
        : "previewReportBtn";
      const previewButton = document.getElementById(previewButtonId);
      if (!(previewButton instanceof HTMLElement) || previewButton.hasAttribute("disabled")) return;

      previewButton.click();
      requestAnimationFrame(() => requestAnimationFrame(printVisibleReport));
    }, true);

    const reportObserver = new MutationObserver(scheduleReportScrollSync);
    reportObserver.observe(reportRoot, {
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"]
    });
    reportObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style"]
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("button, a")) {
        scheduleReportScrollSync();
        window.setTimeout(scheduleReportScrollSync, 40);
      }
    });
    window.addEventListener("pageshow", scheduleReportScrollSync);
    window.addEventListener("beforeprint", () => {
      if (!reportIsVisible()) return;
      reportRoot.setAttribute("data-kalq-print-preview", "");
      document.body.classList.add("print-report", "kalq-printing-report");
    });
    window.addEventListener("afterprint", () => {
      reportPrintPending = false;
      reportRoot.removeAttribute("data-kalq-print-preview");
      document.body.classList.remove("print-report", "kalq-printing-report");
      scheduleReportScrollSync();
    });
    scheduleReportScrollSync();
  }

  document.addEventListener("click", (event) => {
    const todayButton = event.target.closest("[data-kalq-today-target]");
    if (!(todayButton instanceof HTMLButtonElement)) return;

    const targetId = todayButton.getAttribute("data-kalq-today-target");
    const dateInput = targetId ? document.getElementById(targetId) : null;
    if (!(dateInput instanceof HTMLInputElement) || dateInput.type !== "date") return;

    const now = new Date();
    const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    dateInput.value = localToday;
    dateInput.dispatchEvent(new Event("input", { bubbles: true }));
    dateInput.dispatchEvent(new Event("change", { bubbles: true }));
    dateInput.focus({ preventScroll: true });
  });

  /* Standard non-game calculator actions. Sample values are inserted through
     the existing form controls, then the page's own submit handler performs
     the calculation. No formula or result code is duplicated here. */
  const calculatorPathParts = decodeURIComponent(location.pathname || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  const calculatorPathTail = calculatorPathParts.at(-1) || "";
  const calculatorSlug = /\.html?$/i.test(calculatorPathTail)
    ? (calculatorPathParts.at(-2) || "")
    : calculatorPathTail;
  const excludedSamplePages = new Set(["abacus-quest", "mental-math-rush"]);

  if (document.body.classList.contains("kalq-compact-input-boxes") &&
      !excludedSamplePages.has(calculatorSlug)) {
    const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const subjectNames = ["Mathematics", "Biology", "English", "Chemistry", "History", "Economics", "Physics", "Design"];
    const elementNames = ["Carbon", "Oxygen", "Sodium", "Magnesium", "Silicon", "Chlorine", "Iron", "Copper"];
    const polynomialSamples = [
      "x^2 - 5x + 6",
      "x^3 - 6x^2 + 11x - 6",
      "2x^3 + x^2 - 8x - 4",
      "x^4 - 5x^2 + 4"
    ];

    const emitControlChange = (control) => {
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const setControlValue = (control, value) => {
      control.value = value;
      emitControlChange(control);
    };

    const isVisibleControl = (control) => {
      if (!(control instanceof HTMLElement) || control.hidden) return false;
      if (control.closest("[hidden], [aria-hidden='true'], details:not([open]), .report-root, .report-preview")) return false;
      return control.getClientRects().length > 0;
    };

    const optionChoices = (select) => Array.from(select.options).filter((option) =>
      !option.disabled && option.value !== "" && !/choose|select .*first/i.test(option.textContent || "")
    );

    const selectRandomOption = (select, avoidValue = "") => {
      const choices = optionChoices(select).filter((option) => option.value !== avoidValue);
      if (!choices.length) return;
      setControlValue(select, randomItem(choices).value);
    };

    /* A Sample button may fill values inside the mode that is already open,
       but it must never choose a different calculator, converter, profile or
       age interpretation. Several pages use different names for those mode
       controls, so keep the test semantic instead of relying on one ID. */
    const protectedModeControlIds = new Set([
      "adultAgeGroupSelect",
      "calculatorType",
      "categorySelect",
      "childAgeGroupSelect",
      "converterSelect",
      "modeSelect",
      "profileSelect"
    ]);

    const isModeControl = (control) => {
      if (!(control instanceof HTMLElement)) return false;
      if (protectedModeControlIds.has(control.id)) return true;
      const signature = [
        control.id,
        control.getAttribute("name"),
        control.className,
        control.getAttribute("aria-label"),
        control.getAttribute("data-mode-control")
      ].filter(Boolean).join(" ").toLowerCase();
      return /(?:calculator[-_ ]?type|category[-_ ]?select|converter[-_ ]?select|age[-_ ]?group|profile[-_ ]?select|input[-_ ]?mode|mode[-_ ]?select)/.test(signature);
    };

    const captureModeState = (form) => Array.from(form.querySelectorAll("select, input[type='radio'], input[type='checkbox']"))
      .filter(isModeControl)
      .map((control) => ({
        control,
        value: "value" in control ? control.value : "",
        checked: "checked" in control ? control.checked : undefined
      }));

    const restoreModeState = (states) => {
      let restored = false;
      states.forEach(({ control, value, checked }) => {
        const valueChanged = "value" in control && control.value !== value;
        const checkedChanged = checked !== undefined && "checked" in control && control.checked !== checked;
        if (!valueChanged && !checkedChanged) return;
        if (valueChanged) control.value = value;
        if (checkedChanged) control.checked = checked;
        emitControlChange(control);
        restored = true;
      });
      return restored;
    };

    const labelForControl = (control) => {
      const label = control.id ? document.querySelector(`label[for="${CSS.escape(control.id)}"]`) : null;
      return `${control.id || ""} ${control.name || ""} ${control.placeholder || ""} ${control.getAttribute("aria-label") || ""} ${label?.textContent || ""}`.toLowerCase();
    };

    const decimalPlacesForStep = (step) => {
      const text = String(step || "");
      return text.includes(".") ? Math.min(6, text.split(".")[1].length) : 0;
    };

    const numericAttribute = (input, name, fallback) => {
      const raw = input.getAttribute(name);
      if (raw === null || raw.trim() === "") return fallback;
      const value = Number(raw);
      return Number.isFinite(value) ? value : fallback;
    };

    const cleanNumericSamples = {
      hijriDay: [5, 10, 15, 20, 25],
      hijriYear: [1400, 1410, 1420, 1430, 1440],
      loanAmount: [10000, 15000, 25000, 35000, 50000],
      interestRate: [4.5, 5.75, 6.5, 7.5, 9.25],
      loanTerm: [24, 36, 48, 60, 72],
      loanFees: [150, 300, 500, 750, 1200],
      heightCm: [155, 162, 168, 175, 182, 188],
      weightKg: [52, 60, 68, 75, 84, 96],
      heightFt: [5, 5, 5, 6, 6],
      heightIn: [1, 4, 7, 9, 11],
      weightLb: [115, 132, 150, 165, 185, 210],
      childAgeYears: [4, 6, 8, 10, 12, 15, 17],
      childAgeMonths: [0, 2, 4, 6, 8, 10],
      childHeightCm: [95, 110, 125, 140, 155, 170],
      childWeightKg: [15, 20, 28, 38, 50, 65],
      childHeightFt: [3, 4, 4, 5, 5],
      childHeightIn: [0, 2, 5, 8, 10],
      childWeightLb: [33, 44, 62, 84, 110, 143],
      startingInvestment: [5000, 10000, 15000, 25000, 50000],
      monthlyContribution: [100, 250, 500, 750, 1000],
      annualReturn: [4.5, 5.5, 6.5, 7.5, 9],
      investmentPeriodDisplay: [5, 10, 15, 20, 25],
      balance: [2500, 5000, 7500, 10000, 15000],
      apr: [14.9, 17.9, 19.9, 22.9, 26.9],
      payment: [125, 200, 300, 450, 650],
      extraPayment: [25, 50, 75, 100, 150],
      amount: [100, 250, 500, 1000, 2500, 5000],
      customMarkup: [0.5, 1, 1.5, 2, 3],
      targetRate: [1.05, 1.25, 3.75, 4.25, 4.65],
      massNumberInput: [12, 16, 23, 24, 28, 35, 56, 64],
      chargeInput: [-2, -1, 0, 1, 2],
      graphMin: [-20, -10, -5],
      graphMax: [5, 10, 20],
      cycleLength: [26, 27, 28, 29, 30, 32],
      currentAge: [25, 30, 35, 40, 45, 50],
      retirementAge: [60, 62, 65, 67, 70],
      currentSavings: [5000, 10000, 25000, 50000, 100000],
      monthlyDeposit: [100, 250, 500, 750, 1000],
      desiredSpending: [2500, 3500, 4500, 6000, 8000],
      otherIncome: [500, 750, 1000, 1500, 2000],
      preReturn: [4.5, 5.5, 6.5, 7.5, 9],
      inflation: [2, 2.5, 3, 3.5, 4],
      retReturn: [3.5, 4.5, 5, 5.5, 6],
      retirementYears: [20, 25, 30, 35, 40],
      currentSalary: [36000, 48000, 60000, 75000, 90000, 120000],
      raisePercent: [3, 5, 7, 8, 10, 12],
      knownNewSalary: [42000, 54000, 64200, 81000, 99000, 132000],
      grossSalary: [48000, 60000, 75000, 90000, 120000, 150000],
      combinedDeductionRate: [15, 18, 20, 23, 25, 28],
      taxRate: [10, 15, 18, 20, 22, 25],
      preTaxDeduction: [50, 100, 150, 200, 300],
      postTaxDeduction: [25, 50, 75, 100, 150],
      employerContributionRate: [5, 6, 7, 8, 10],
      apy: [2.5, 3, 3.5, 4, 4.5, 5],
      periodValue: [3, 5, 7, 10, 15, 20],
      billAmount: [50, 80, 100, 150, 200, 300],
      peopleCount: [2, 3, 4, 5, 6, 8],
      customRate: [10, 12, 15, 18, 20, 22, 25],
      monthlyVisits: [1, 2, 3, 4, 6, 8],
      inputValue: [1, 5, 10, 25, 50, 100, 250, 500]
    };

    const percentageSamples = {
      percentage: [5, 10, 12, 15, 18, 20, 25, 30, 40],
      number: [50, 100, 200, 250, 500, 750, 1000],
      part: [15, 25, 40, 45, 60, 75, 90],
      whole: [100, 120, 180, 200, 250, 500],
      original: [80, 100, 150, 200, 250, 500],
      newValue: [90, 120, 180, 275, 400, 780],
      valueA: [40, 60, 80, 100, 120, 200],
      valueB: [50, 75, 100, 125, 150, 250],
      oldRate: [5, 10, 15, 20, 25],
      newRate: [8, 12, 18, 24, 30],
      final: [100, 150, 220, 280, 500],
      start: [100, 200, 250, 500],
      first: [5, 10, 15, 20],
      second: [-15, -10, 5, 10, 20],
      numerator: [1, 2, 3, 5, 7, 9],
      denominator: [2, 4, 5, 8, 10, 20],
      decimal: [0.125, 0.25, 0.375, 0.5, 0.75, 1.25]
    };

    const sampleWithinLimits = (input, samples) => {
      const min = numericAttribute(input, "min", -Infinity);
      const max = numericAttribute(input, "max", Infinity);
      const valid = samples.filter((value) => value >= min && value <= max);
      return randomItem(valid.length ? valid : samples);
    };

    const normaliseNumberForInput = (input, rawValue) => {
      const min = numericAttribute(input, "min", -Infinity);
      const max = numericAttribute(input, "max", Infinity);
      const step = input.step && input.step !== "any" ? Number(input.step) : 0;
      let value = Number(rawValue);
      if (Number.isFinite(step) && step > 0) {
        const base = Number.isFinite(min) ? min : 0;
        value = base + Math.round((value - base) / step) * step;
      }
      value = Math.max(min, Math.min(max, value));
      const places = Number.isFinite(step) && step > 0 ? decimalPlacesForStep(input.step) : 2;
      return places ? Number(value.toFixed(places)) : Math.round(value);
    };

    const randomNumberFor = (input) => {
      const key = labelForControl(input);
      const id = input.id || "";
      const semanticName = (input.name || id.replace(/^field_/, "")).trim();
      const min = numericAttribute(input, "min", -Infinity);
      const max = numericAttribute(input, "max", Infinity);
      const currentText = String(input.value || input.placeholder || "").replace(/,/g, "").trim();
      const current = currentText && !/blank|auto/i.test(currentText) ? Number(currentText) : NaN;

      if (cleanNumericSamples[id]) return normaliseNumberForInput(input, sampleWithinLimits(input, cleanNumericSamples[id]));
      if (percentageSamples[semanticName]) return normaliseNumberForInput(input, sampleWithinLimits(input, percentageSamples[semanticName]));

      let samples;
      if (/height.*cm|centimet/.test(key)) samples = [155, 162, 168, 175, 182, 188];
      else if (/height.*(ft|feet)/.test(key)) samples = [5, 6];
      else if (/inch/.test(key)) samples = [1, 4, 7, 9, 11];
      else if (/weight.*kg|kilogram/.test(key)) samples = [52, 60, 68, 75, 84, 96];
      else if (/weight.*(lb|pound)/.test(key)) samples = [115, 132, 150, 165, 185, 210];
      else if (/course.*credit|credits?/.test(key)) samples = [1, 2, 3, 4, 5, 6];
      else if (/people|persons|party/.test(key)) samples = [2, 3, 4, 5, 6, 8];
      else if (/age/.test(key)) samples = [21, 25, 30, 35, 40, 45, 50, 60];
      else if (/months?/.test(key)) samples = [6, 12, 18, 24, 36, 48, 60];
      else if (/years?|term|period|duration/.test(key)) samples = [3, 5, 10, 15, 20, 25, 30];
      else if (/rate|percent|apy|interest|return|tax|deduction|increase|tip/.test(key)) samples = [3, 5, 7.5, 10, 12, 15, 18, 20, 25];
      else if (/fee/.test(key)) samples = [50, 100, 250, 500, 750, 1000];
      else if (/salary|income|wage/.test(key)) samples = [36000, 48000, 60000, 75000, 90000, 120000];
      else if (/amount|balance|saving|investment|payment|deposit|bill|principal|contribution/.test(key)) samples = [100, 250, 500, 1000, 2500, 5000, 10000, 25000];
      else if (Number.isFinite(current) && Math.abs(current) >= 1) {
        const magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.abs(current))) - 1));
        samples = [.75, 1, 1.25, 1.5].map((factor) => Math.max(magnitude, Math.round(current * factor / magnitude) * magnitude));
      } else if (Number.isFinite(min) && Number.isFinite(max)) {
        const low = min;
        const high = max;
        samples = [0.25, 0.4, 0.55, 0.7, 0.85].map((ratio) => low + (high - low) * ratio);
      } else {
        samples = [5, 10, 20, 25, 50, 75, 100];
      }

      return normaliseNumberForInput(input, sampleWithinLimits(input, samples));
    };

    const formatLocalDate = (date) => {
      const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return shifted.toISOString().slice(0, 10);
    };

    const setDateSamples = (form) => {
      const dates = Array.from(form.querySelectorAll('input[type="date"]')).filter(isVisibleControl);
      if (!dates.length) return;
      const today = new Date();
      const days = (count) => count * 86400000;

      if (calculatorSlug === "age-calculator") {
        const years = 18 + Math.floor(Math.random() * 48);
        const birthDate = new Date(today.getFullYear() - years, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27));
        dates.forEach((input) => setControlValue(input, /birth/i.test(labelForControl(input)) ? formatLocalDate(birthDate) : formatLocalDate(today)));
        return;
      }

      if (calculatorSlug === "pregnancy-calculator") {
        const start = new Date(today.getTime() - days(28 + Math.floor(Math.random() * 70)));
        dates.forEach((input, index) => setControlValue(input, formatLocalDate(index ? today : start)));
        return;
      }

      if (dates.length === 1) {
        const key = labelForControl(dates[0]);
        const offset = /effective|future|appointment/i.test(key)
          ? 1 + Math.floor(Math.random() * 90)
          : -(1 + Math.floor(Math.random() * 365));
        setControlValue(dates[0], formatLocalDate(new Date(today.getTime() + days(offset))));
        return;
      }

      const start = new Date(today.getTime() - days(30 + Math.floor(Math.random() * 720)));
      const end = new Date(start.getTime() + days(7 + Math.floor(Math.random() * 720)));
      dates.forEach((input, index) => setControlValue(input, formatLocalDate(index === 0 ? start : end)));
    };

    const setTextSample = (input, index) => {
      const key = labelForControl(input);
      if (/polynomial/.test(key)) setControlValue(input, randomItem(polynomialSamples));
      else if (/element|symbol|atomic/.test(key)) setControlValue(input, randomItem(elementNames));
      else if (/course.*name|subject/.test(key)) setControlValue(input, subjectNames[index % subjectNames.length]);
      else if (/holiday|closure/.test(key)) setControlValue(input, `Sample holiday ${1 + Math.floor(Math.random() * 9)}`);
      else if (/provider|company/.test(key)) setControlValue(input, `Provider ${String.fromCharCode(65 + index % 6)}`);
      else if (/decimal|numeric|amount|rate|value/.test(key) || input.inputMode === "decimal" || input.inputMode === "numeric") {
        setControlValue(input, String(randomNumberFor(input)));
      } else if (!input.value) {
        setControlValue(input, `Sample ${1 + Math.floor(Math.random() * 99)}`);
      }
    };

    const normaliseSampleRelationships = (form) => {
      const control = (id) => form.querySelector(`#${CSS.escape(id)}`);
      const setIfEditable = (id, value) => {
        const input = control(id);
        if (!(input instanceof HTMLInputElement) || input.disabled || input.readOnly || !isVisibleControl(input)) return;
        setControlValue(input, String(value));
      };

      if (calculatorSlug === "credit-card-payoff-calculator") {
        const profiles = [
          { balance: 2500, apr: 17.9, payment: 125, extraPayment: 25 },
          { balance: 5000, apr: 22, payment: 200, extraPayment: 50 },
          { balance: 7500, apr: 19.9, payment: 300, extraPayment: 75 },
          { balance: 10000, apr: 24.9, payment: 450, extraPayment: 100 }
        ];
        const profile = randomItem(profiles);
        Object.entries(profile).forEach(([id, value]) => setIfEditable(id, value));
      }

      if (calculatorSlug === "retirement-calculator") {
        const currentAge = randomItem([25, 30, 35, 40, 45, 50]);
        const retirementAge = Math.min(70, currentAge + randomItem([15, 20, 25, 30]));
        setIfEditable("currentAge", currentAge);
        setIfEditable("retirementAge", retirementAge);
      }

      if (calculatorSlug === "salary-increase-calculator") {
        const currentSalary = randomItem([36000, 48000, 60000, 75000, 90000, 120000]);
        const raisePercent = randomItem([3, 5, 7, 8, 10, 12]);
        setIfEditable("currentSalary", currentSalary);
        setIfEditable("raisePercent", raisePercent);
        setIfEditable("knownNewSalary", Math.round(currentSalary * (1 + raisePercent / 100)));
      }

      if (calculatorSlug === "polynomial-root-finder-calculator") {
        const ranges = [[-5, 5], [-10, 10], [-20, 20]];
        const [minimum, maximum] = randomItem(ranges);
        setIfEditable("graphMin", minimum);
        setIfEditable("graphMax", maximum);
      }

      if (calculatorSlug === "periodic-table-chemistry-calculator") {
        const isotopeByElement = {
          Carbon: 12,
          Oxygen: 16,
          Sodium: 23,
          Magnesium: 24,
          Silicon: 28,
          Chlorine: 35,
          Iron: 56,
          Copper: 64
        };
        const element = control("elementInput");
        const massNumber = isotopeByElement[element?.value];
        if (massNumber) setIfEditable("massNumberInput", massNumber);
      }
    };

    const populateSample = async (form, sampleButton) => {
      sampleButton.disabled = true;
      const modeState = captureModeState(form);
      try {
        if (calculatorSlug === "periodic-table-chemistry-calculator") {
          const element = form.querySelector("#elementInput");
          if (element instanceof HTMLInputElement) {
            setControlValue(element, randomItem(elementNames));
            await nextFrame();
          }
        }

        const selects = Array.from(form.querySelectorAll("select")).filter((select) =>
          isVisibleControl(select) && !isModeControl(select)
        );
        selects.forEach((select) => selectRandomOption(select));

        const fromCurrency = form.querySelector("#fromCurrency");
        const toCurrency = form.querySelector("#toCurrency");
        if (fromCurrency instanceof HTMLSelectElement && toCurrency instanceof HTMLSelectElement) {
          selectRandomOption(fromCurrency);
          selectRandomOption(toCurrency, fromCurrency.value);
        }

        const fromUnit = form.querySelector("#fromUnit");
        const toUnit = form.querySelector("#toUnit");
        if (fromUnit instanceof HTMLSelectElement && toUnit instanceof HTMLSelectElement) {
          selectRandomOption(fromUnit);
          selectRandomOption(toUnit, fromUnit.value);
        }

        setDateSamples(form);

        const radioGroups = new Map();
        form.querySelectorAll('input[type="radio"]').forEach((radio) => {
          if (!isVisibleControl(radio) || radio.disabled || isModeControl(radio)) return;
          const name = radio.name || `radio-${radio.id}`;
          if (!radioGroups.has(name)) radioGroups.set(name, []);
          radioGroups.get(name).push(radio);
        });
        radioGroups.forEach((radios) => {
          const chosen = randomItem(radios);
          chosen.checked = true;
          emitControlChange(chosen);
        });

        form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
          if (!isVisibleControl(checkbox) || checkbox.disabled || isModeControl(checkbox)) return;
          checkbox.checked = Math.random() > .45;
          emitControlChange(checkbox);
        });

        let textIndex = 0;
        form.querySelectorAll("input, textarea").forEach((input) => {
          if (!isVisibleControl(input) || input.disabled || input.readOnly) return;
          if (input instanceof HTMLInputElement && ["date", "radio", "checkbox", "hidden", "button", "submit", "reset", "file", "color", "range"].includes(input.type)) return;
          if (input.classList.contains("grade-point-input")) return;
          if (input instanceof HTMLInputElement && input.type === "number") setControlValue(input, String(randomNumberFor(input)));
          else setTextSample(input, textIndex++);
        });

        normaliseSampleRelationships(form);

        await nextFrame();
        if (restoreModeState(modeState)) await nextFrame();
        updateCalculatorActionLabels(form);

        const submitButton = form.querySelector("button.calculate-btn[type='submit']:not([disabled]), button[type='submit']:not([disabled])");
        if (submitButton instanceof HTMLButtonElement) {
          if (typeof form.requestSubmit === "function") form.requestSubmit(submitButton);
          else submitButton.click();
        }
      } finally {
        sampleButton.disabled = false;
      }
    };

    const actionLabels = {
      "age-calculator": "Calculate age",
      "compound-interest-calculator": "Calculate compound interest",
      "credit-card-payoff-calculator": "Calculate payoff",
      "apr-calculator": "Calculate APR",
      "date-difference-calculator": "Calculate date difference",
      "gpa-calculator": "Calculate GPA",
      "ideal-weight-calculator": "Calculate ideal weight",
      "periodic-table-chemistry-calculator": "Calculate element",
      "polynomial-root-finder-calculator": "Find polynomial roots",
      "pregnancy-calculator": "Calculate due date",
      "retirement-calculator": "Calculate retirement outlook",
      "salary-increase-calculator": "Calculate salary increase",
      "salary-payroll-calculator": "Calculate payroll",
      "savings-calculator": "Calculate savings",
      "tip-calculator": "Calculate tip"
    };

    function updateCalculatorActionLabels(form) {
      const buttons = Array.from(form.querySelectorAll("button.calculate-btn"));
      if (!buttons.length) return;

      if (calculatorSlug === "currency-converter-and-comparison-calculator") {
        buttons.forEach((button) => {
          button.textContent = button.id === "compareProvidersBtn" ? "Compare providers" : "Convert currency";
        });
        return;
      }

      let label = actionLabels[calculatorSlug] || "Calculate result";
      if (calculatorSlug === "bmi-calculator") {
        label = form.id === "childBmiForm" ? "Calculate BMI-for-age" : "Calculate BMI";
      } else if (calculatorSlug === "percentage-calculator") {
        const mode = document.getElementById("calculatorType");
        const modeName = mode instanceof HTMLSelectElement ? mode.selectedOptions[0]?.textContent?.trim() : "";
        label = modeName && mode?.value !== "general" ? `Calculate ${modeName}` : "Calculate percentage";
      } else if (calculatorSlug === "percentage-conversion-calculator") {
        const mode = document.getElementById("calculatorType");
        const modeName = mode instanceof HTMLSelectElement ? mode.selectedOptions[0]?.textContent?.trim() : "";
        label = modeName && mode?.value !== "general" ? `Convert ${modeName}` : "Convert percentage";
      } else if (calculatorSlug === "unit-converters") {
        const mode = document.getElementById("converterSelect");
        const modeName = mode instanceof HTMLSelectElement ? mode.selectedOptions[0]?.textContent?.trim() : "";
        label = modeName && mode?.value ? `Convert ${modeName.replace(/\s+(calculator|converter)$/i, "")}` : "Convert units";
      }

      buttons[0].textContent = label;
      buttons[0].setAttribute("aria-label", label);
    }

    document.querySelectorAll("#calculator-page form:not(.header-search)").forEach((form) => {
      if (!(form instanceof HTMLFormElement) || !form.querySelector(".calculate-btn, button[type='submit']")) return;
      const calculateButtons = Array.from(form.querySelectorAll("button.calculate-btn"));
      const primaryButton = calculateButtons.find((button) => button.type === "submit") || calculateButtons[0];
      if (!(primaryButton instanceof HTMLButtonElement)) return;

      form.dataset.kalqStandardActions = "";
      let actionParent = primaryButton.parentElement;
      if (!(actionParent instanceof HTMLElement)) return;
      if (actionParent === form) {
        const stack = document.createElement("div");
        form.insertBefore(stack, primaryButton);
        stack.appendChild(primaryButton);
        actionParent = stack;
      }
      actionParent.classList.add("kalq-input-action-stack");

      const sampleButton = document.createElement("button");
      sampleButton.type = "button";
      sampleButton.className = "kalq-sample-btn";
      sampleButton.textContent = "Sample";
      sampleButton.setAttribute("aria-label", "Fill random sample values");
      actionParent.insertBefore(sampleButton, primaryButton);
      sampleButton.addEventListener("click", () => populateSample(form, sampleButton));

      calculateButtons.forEach((button, index) => {
        button.classList.add(index === 0 ? "kalq-primary-input-action" : "kalq-secondary-calculate-action");
        if (button.parentElement !== actionParent) actionParent.appendChild(button);
      });

      form.querySelectorAll(".reset-btn").forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        if (button.id === "exampleBtn" || /use example/i.test(button.textContent || "")) {
          button.setAttribute("data-kalq-replaced-example", "");
          button.hidden = true;
          return;
        }
        if (/swap/i.test(button.id) || /swap/i.test(button.textContent || "")) {
          button.classList.add("kalq-auxiliary-input-action");
        } else {
          button.classList.add("kalq-reset-input-action");
          button.textContent = "Reset";
        }
        if (button.parentElement !== actionParent) actionParent.appendChild(button);
      });

      form.querySelectorAll("#exampleBtn, [aria-label*='example' i]").forEach((button) => {
        if (button === sampleButton || button.classList.contains("kalq-reset-input-action")) return;
        button.setAttribute("data-kalq-replaced-example", "");
        button.hidden = true;
      });

      Array.from(actionParent.children).forEach((button) => {
        if (button instanceof HTMLButtonElement &&
            !button.classList.contains("kalq-sample-btn") &&
            !button.classList.contains("calculate-btn") &&
            !button.classList.contains("reset-btn")) {
          button.classList.add("kalq-auxiliary-input-action");
        }
      });

      updateCalculatorActionLabels(form);
    });

    document.addEventListener("change", (event) => {
      const form = event.target instanceof Element ? event.target.closest("form[data-kalq-standard-actions]") : null;
      if (form instanceof HTMLFormElement) window.setTimeout(() => updateCalculatorActionLabels(form), 0);
    });
  }

  /* Standard calculator forms recalculate two seconds after the last edit.
     Existing submit/click handlers still own every formula and result update. */
  if (document.body.classList.contains("kalq-compact-input-boxes")) {
    const autoCalculateDelay = 2000;
    const autoCalculateTimers = new WeakMap();

    const clearAutoCalculate = (form) => {
      const timer = autoCalculateTimers.get(form);
      if (timer) window.clearTimeout(timer);
      autoCalculateTimers.delete(form);
    };

    const isEditableCalculatorControl = (control) => {
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
        return false;
      }
      if (control.disabled || control.readOnly || control.closest(".header-search")) return false;
      if (control instanceof HTMLInputElement && ["hidden", "button", "submit", "reset"].includes(control.type)) return false;
      return true;
    };

    const scheduleAutoCalculate = (control) => {
      if (!isEditableCalculatorControl(control)) return;
      const form = control.closest("#calculator-page form:not(.header-search)");
      if (!(form instanceof HTMLFormElement)) return;

      const calculateButton = form.querySelector(
        ".calculate-btn:not([disabled]), button[type='submit']:not([disabled])"
      );
      if (!(calculateButton instanceof HTMLButtonElement)) return;

      clearAutoCalculate(form);
      const timer = window.setTimeout(() => {
        autoCalculateTimers.delete(form);
        if (!form.isConnected || !calculateButton.isConnected || calculateButton.disabled) return;

        if ((calculateButton.getAttribute("type") || "submit").toLowerCase() === "submit") {
          if (typeof form.requestSubmit === "function") form.requestSubmit(calculateButton);
          else calculateButton.click();
        } else {
          calculateButton.click();
        }
      }, autoCalculateDelay);
      autoCalculateTimers.set(form, timer);
    };

    document.addEventListener("input", (event) => {
      scheduleAutoCalculate(event.target);
    });

    document.addEventListener("change", (event) => {
      const control = event.target;
      if (control instanceof HTMLSelectElement ||
          (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type))) {
        scheduleAutoCalculate(control);
      }
    });

    document.addEventListener("submit", (event) => {
      if (event.target instanceof HTMLFormElement) clearAutoCalculate(event.target);
    }, true);

    document.addEventListener("reset", (event) => {
      if (event.target instanceof HTMLFormElement) clearAutoCalculate(event.target);
    }, true);
  }

  /* Give every date field one visible, reliable calendar button. The button
     calls the browser's native picker and does not change calculator logic. */
  document.querySelectorAll('#calculator-page form:not(.header-search) input[type="date"]').forEach((input) => {
    if (input.closest(".kalq-date-control")) return;

    const control = document.createElement("span");
    control.className = "kalq-date-control";
    input.parentNode.insertBefore(control, input);
    control.appendChild(input);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "kalq-date-picker-button";
    const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    const fieldName = (label?.childNodes?.[0]?.textContent || input.getAttribute("aria-label") || "date").trim();
    trigger.setAttribute("aria-label", `Choose ${fieldName}`);
    trigger.setAttribute("title", `Choose ${fieldName}`);
    trigger.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="1.5"/><path d="M8 3v4M16 3v4M4 9h16"/></svg>';
    trigger.addEventListener("click", () => {
      if (input.disabled || input.readOnly) return;
      input.focus({ preventScroll: true });
      try {
        if (typeof input.showPicker === "function") input.showPicker();
        else input.click();
      } catch {
        input.click();
      }
    });
    control.appendChild(trigger);
  });

  /* Keep every accordion title visible. Remove only calculator/page names from
     the heading so the section hierarchy stays consistent across tools. */
  const accordionTitleReplacements = new Map([
    ["BMI formula", "Formula"],
    ["Currency conversion and comparison terminology", "Terminology"],
    ["Date difference formula and method", "Formula and method"],
    ["GPA formula", "Formula"],
    ["Ideal-weight formulas", "Formulas"],
    ["Mental Math Performance Calculator", "Performance summary"],
    ["Payroll frequency breakdown", "Frequency breakdown"],
    ["Percentage calculations included", "Calculations included"],
    ["Percentage conversion formulas", "Formulas"],
    ["Percentage conversions included", "Conversions included"],
    ["Percentage formulas", "Formulas"],
    ["Polynomial root formula and method", "Formula and method"],
    ["Pregnancy due date formula", "Formula"],
    ["Retirement savings formula", "Formula"],
    ["Salary increase formulas", "Formulas"],
    ["Salary Payroll Calculator FAQs", "Frequently asked questions"],
    ["Salary payroll formulas", "Formulas"],
    ["Savings Calculator formula", "Formula"],
    ["Tip Calculator formula", "Formula"],
    ["Unit conversion formula and method", "Formula and method"],
    ["Unit conversion references", "References"],
    ["Unit conversion tips and common mistakes", "Tips and common mistakes"],
    ["Unit Converter disclaimer", "Disclaimer"],
    ["Unit converter FAQs", "Frequently asked questions"],
    ["What this Age Calculator includes", "What this calculator includes"],
    ["What your BMI result means", "What your result means"],
    ["What your retirement result means", "What your result means"],
    ["What your tip result means", "What your result means"],
    ["What the payroll result explains", "What the result explains"],
    ["Understanding the conversion and comparison", "Understanding the result"],
    ["Understanding the pregnancy timeline", "Understanding the timeline"],
    ["Understanding your savings results", "Understanding your results"]
  ]);

  document.querySelectorAll(".section-dropdown").forEach((accordion) => {
    const summary = accordion.querySelector(":scope > summary");
    const title = summary?.querySelector(".section-dropdown-title");
    if (!summary || !title) return;

    const originalTitle = (title.textContent || "").replace(/\s+/g, " ").trim();
    title.textContent = /^How\s+to\s+use\b/i.test(originalTitle)
      ? "How to use"
      : (accordionTitleReplacements.get(originalTitle) || originalTitle);
    title.hidden = false;
    summary.classList.remove("kalq-accordion-title-hidden", "kalq-accordion-how-to-use");
  });

  let sharedGoUpButtons = [...document.querySelectorAll(".go-up-button")];
  if (!sharedGoUpButtons.length) {
    const button = document.createElement("button");
    button.className = "go-up-button";
    button.id = "goUpButton";
    button.type = "button";
    button.setAttribute("aria-label", "Go to top");
    button.setAttribute("data-shared-go-up", "");
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"></path></svg><span data-i18n="goUp">Top</span>';
    document.body.appendChild(button);
    sharedGoUpButtons = [button];
  }
  if (sharedGoUpButtons.length) {
    const updateSharedGoUp = () => {
      const visible = window.scrollY > Math.max(420, window.innerHeight * .65);
      sharedGoUpButtons.forEach((button) => button.classList.toggle("is-visible", visible));
    };
    window.addEventListener("scroll", updateSharedGoUp, { passive: true });
    sharedGoUpButtons.forEach((button) => {
      if (button.dataset.kalqGoUpBound === "true") return;
      button.dataset.kalqGoUpBound = "true";
      button.addEventListener("click", () => {
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
      });
    });
    updateSharedGoUp();
  }
})();
