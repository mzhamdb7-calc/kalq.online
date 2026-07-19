(function () {
  "use strict";

  const calculators = [
    ["BMI Calculator", "bmi-calculator.html", "Health"],
    ["Compound Interest Calculator", "compound-interest.html", "Finance"],
    ["Currency Converter", "currency-exchange.html", "Converters"],
    ["Currency Comparison Calculator", "currency-comparison.html", "Finance"],
    ["Loan Calculator", "loan-calculator.html", "Finance"],
    ["Mortgage Calculator", "mortgage-calculator.html", "Finance"],
    ["Mortgage Refinance Calculator", "mortgage-refinance.html", "Finance"],
    ["Mortgage Comparison Calculator", "mortgage-comparison.html", "Finance"],
    ["Age Calculator", "age-calculator.html", "Date & Time"],
    ["Abacus Trainer Game", "abacus-trainer.html", "Games"],
    ["Unit Converter", "unit-converter.html", "Converters"],
    ["GraphScope Calculator", "graph-calculator.html", "Math"],
    ["PDF Converter", "pdf-converter.html", "Converters"],
    ["Image Converter & Compressor", "image-converter.html", "Converters"]
  ];

  const MARKETS = {
    "United States": { iso: "USA", currency: "USD", symbol: "$", policyRate: 3.63, policyLabel: "Effective federal funds rate", taxRate: 15, providers: ["Wise", "Western Union", "Remitly", "Xoom"], banks: ["Chase", "Wells Fargo", "Bank of America", "U.S. Bank"], references: [["Federal Reserve", "https://www.federalreserve.gov/"], ["IRS", "https://www.irs.gov/"], ["CFPB", "https://www.consumerfinance.gov/"], ["USA.gov", "https://www.usa.gov/"]] },
    "United Kingdom": { iso: "GBR", currency: "GBP", symbol: "£", policyRate: 3.75, policyLabel: "Bank Rate", taxRate: 20, providers: ["Wise", "Western Union", "Revolut", "OFX"], banks: ["Barclays", "HSBC UK", "Lloyds Bank", "NatWest"], references: [["Bank of England", "https://www.bankofengland.co.uk/"], ["HMRC", "https://www.gov.uk/government/organisations/hm-revenue-customs"], ["FCA", "https://www.fca.org.uk/"], ["GOV.UK", "https://www.gov.uk/"]] },
    Malaysia: { iso: "MYS", currency: "MYR", symbol: "RM", policyRate: 2.75, policyLabel: "BNM OPR", taxRate: 15, providers: ["Wise", "Instarem", "BigPay", "Western Union"], banks: ["Maybank", "CIMB", "Public Bank", "RHB Bank"], references: [["Bank Negara Malaysia", "https://www.bnm.gov.my/"], ["LHDN Malaysia", "https://www.hasil.gov.my/"], ["KWSP", "https://www.kwsp.gov.my/"], ["Malaysia.gov.my", "https://www.malaysia.gov.my/"]] },
    Singapore: { iso: "SGP", currency: "SGD", symbol: "S$", policyRate: 3.0, policyLabel: "Indicative SORA planning rate", taxRate: 15, providers: ["Wise", "Instarem", "Revolut", "Western Union"], banks: ["DBS", "OCBC", "UOB", "Standard Chartered Singapore"], references: [["Monetary Authority of Singapore", "https://www.mas.gov.sg/"], ["IRAS", "https://www.iras.gov.sg/"], ["MoneySense", "https://www.moneysense.gov.sg/"], ["Singapore Government", "https://www.gov.sg/"]] },
    Indonesia: { iso: "IDN", currency: "IDR", symbol: "Rp", policyRate: 5.75, policyLabel: "BI-Rate", taxRate: 20, providers: ["Wise", "Western Union", "Remitly", "Topremit"], banks: ["Bank Mandiri", "BCA", "BNI", "BRI"], references: [["Bank Indonesia", "https://www.bi.go.id/en/default.aspx"], ["DJP Indonesia", "https://www.pajak.go.id/"], ["OJK", "https://www.ojk.go.id/"], ["Indonesia.go.id", "https://indonesia.go.id/"]] },
    India: { iso: "IND", currency: "INR", symbol: "₹", policyRate: 5.25, policyLabel: "RBI policy repo rate", taxRate: 20, providers: ["Wise", "Western Union", "Remitly", "BookMyForex"], banks: ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank"], references: [["Reserve Bank of India", "https://www.rbi.org.in/"], ["Income Tax India", "https://www.incometax.gov.in/"], ["SEBI", "https://www.sebi.gov.in/"], ["India.gov.in", "https://www.india.gov.in/"]] },
    China: { iso: "CHN", currency: "CNY", symbol: "¥", policyRate: 3.1, policyLabel: "1-year loan prime rate", taxRate: 20, providers: ["Wise", "Western Union", "Remitly", "Panda Remit"], banks: ["ICBC", "China Construction Bank", "Bank of China", "Agricultural Bank of China"], references: [["People's Bank of China", "https://www.pbc.gov.cn/en/3688006/index.html"], ["State Taxation Administration", "https://www.chinatax.gov.cn/eng/"], ["SAFE", "https://www.safe.gov.cn/en/"], ["China Government", "https://english.www.gov.cn/"]] }
  };
  const MARKET_NAMES = Object.keys(MARKETS);
  const CURRENCIES = Object.fromEntries(MARKET_NAMES.map((name) => [MARKETS[name].currency, name]));
  const MARKET_ALIASES = Object.fromEntries(MARKET_NAMES.flatMap((name) => [[name, name], [MARKETS[name].iso, name]]));
  const fxCache = new Map();

  window.KalQMarkets = { markets: MARKETS, names: MARKET_NAMES.slice(), currencies: { ...CURRENCIES } };

  const sprite = `
    <svg class="icon-sprite" aria-hidden="true" focusable="false">
      <symbol id="icon-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.8-3.8"></path></symbol>
      <symbol id="icon-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1.3"></rect><rect x="14" y="4" width="6" height="6" rx="1.3"></rect><rect x="4" y="14" width="6" height="6" rx="1.3"></rect><rect x="14" y="14" width="6" height="6" rx="1.3"></rect></symbol>
      <symbol id="icon-gamepad" viewBox="0 0 24 24"><path d="M7.5 10.5h3M9 9v3M15.2 10.5h.1M18 10.5h.1"></path><path d="M6.7 6.5h10.6a4.2 4.2 0 0 1 4 3.1l1.1 4.4a3.2 3.2 0 0 1-5.6 2.8l-1.6-1.9H8.8l-1.6 1.9A3.2 3.2 0 0 1 1.6 14l1.1-4.4a4.2 4.2 0 0 1 4-3.1Z"></path></symbol>
      <symbol id="icon-history" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2"></path></symbol>
      <symbol id="icon-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a13.5 13.5 0 0 1 0 18M12 3a13.5 13.5 0 0 0 0 18"></path></symbol>
      <symbol id="icon-moon" viewBox="0 0 24 24"><path d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a7 7 0 1 0 10.8 10.8Z"></path></symbol>
      <symbol id="icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></symbol>
      <symbol id="icon-calculator" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 7h8M8 11h.1M12 11h.1M16 11h.1M8 15h.1M12 15h.1M16 15h.1"></path></symbol>
      <symbol id="icon-chevron-down" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"></path></symbol>
      <symbol id="icon-up" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"></path></symbol>
    </svg>`;

  const header = `
    <header class="site-header">
      <div class="nav-shell">
        <a class="brand" href="index.html" aria-label="KalQ home"><span class="brand-mark" aria-hidden="true"><span>+</span><span>-</span><span>x</span><span>/</span></span><span class="brand-name">KalQ</span></a>
        <form class="top-search" role="search"><svg class="icon" aria-hidden="true"><use href="#icon-search"></use></svg><input type="search" placeholder="Search calculators, converters, and more..." aria-label="Search calculators" autocomplete="off"><kbd>/</kbd></form>
        <nav class="nav-actions" aria-label="Primary navigation">
          <a class="nav-link" href="index.html#category-title"><svg class="icon" aria-hidden="true"><use href="#icon-grid"></use></svg><span>Categories</span><svg class="icon" aria-hidden="true"><use href="#icon-chevron-down"></use></svg></a>
          <span class="nav-divider" aria-hidden="true"></span>
          <a class="nav-link" href="abacus-trainer.html"><svg class="icon" aria-hidden="true"><use href="#icon-gamepad"></use></svg><span>Games</span></a>
          <a class="nav-link" href="history.html"><svg class="icon" aria-hidden="true"><use href="#icon-history"></use></svg><span>History</span></a>
          <a class="language-button" href="#"><svg class="icon" aria-hidden="true"><use href="#icon-globe"></use></svg><span>English</span><svg class="icon" aria-hidden="true"><use href="#icon-chevron-down"></use></svg></a>
          <button class="theme-button" type="button" data-shell-theme aria-label="Switch to dark mode"><svg class="icon moon-icon" aria-hidden="true"><use href="#icon-moon"></use></svg><svg class="icon sun-icon" aria-hidden="true"><use href="#icon-sun"></use></svg></button>
          <button class="open-calculator" type="button" data-shell-calculator aria-expanded="false" aria-controls="calculatorPanel"><svg class="icon" aria-hidden="true"><use href="#icon-calculator"></use></svg><span>Open Calculator</span></button>
        </nav>
      </div>
      <button class="mobile-theme-toggle" type="button" data-shell-theme aria-label="Switch to dark mode"><svg class="icon moon-icon" aria-hidden="true"><use href="#icon-moon"></use></svg></button>
      <button class="mobile-calculator-toggle" type="button" data-shell-calculator aria-label="Open calculator" aria-expanded="false" aria-controls="calculatorPanel"><svg class="icon" aria-hidden="true"><use href="#icon-calculator"></use></svg></button>
    </header>`;

  const panel = `
    <aside class="calculator-panel" id="calculatorPanel" aria-label="Calculator" hidden>
      <div class="calculator-card">
        <div class="calculator-topbar"><div class="calculator-mode" role="tablist" aria-label="Calculator mode"><button class="mode-button active" type="button" data-mode="basic" role="tab" aria-selected="true">Basic</button><button class="mode-button" type="button" data-mode="scientific" role="tab" aria-selected="false">Scientific</button></div><button class="calculator-close" type="button" aria-label="Close calculator">x</button></div>
        <output class="calculator-display" aria-live="polite"><span class="calculator-expression">0</span><span class="calculator-result">0</span></output>
        <div class="calculator-keys" aria-label="Calculator keys">
          <button class="calc-key scientific-key" type="button" data-value="sin(">sin</button><button class="calc-key scientific-key" type="button" data-value="cos(">cos</button><button class="calc-key scientific-key" type="button" data-value="tan(">tan</button><button class="calc-key scientific-key" type="button" data-value="sqrt(">sqrt</button>
          <button class="calc-key scientific-key" type="button" data-value="ln(">ln</button><button class="calc-key scientific-key" type="button" data-value="log(">log</button><button class="calc-key scientific-key" type="button" data-value="^2">x²</button><button class="calc-key scientific-key" type="button" data-value="^">xʸ</button>
          <button class="calc-key scientific-key" type="button" data-value="pi">π</button><button class="calc-key scientific-key" type="button" data-value="e">e</button><button class="calc-key scientific-key" type="button" data-value="(">(</button><button class="calc-key scientific-key" type="button" data-value=")">)</button>
          <button class="calc-key danger" type="button" data-action="clear">C</button><button class="calc-key" type="button" data-action="backspace">CE</button><button class="calc-key" type="button" data-action="percent">%</button><button class="calc-key operator" type="button" data-value="/">/</button>
          <button class="calc-key" type="button" data-value="7">7</button><button class="calc-key" type="button" data-value="8">8</button><button class="calc-key" type="button" data-value="9">9</button><button class="calc-key operator" type="button" data-value="*">×</button>
          <button class="calc-key" type="button" data-value="4">4</button><button class="calc-key" type="button" data-value="5">5</button><button class="calc-key" type="button" data-value="6">6</button><button class="calc-key operator" type="button" data-value="-">−</button>
          <button class="calc-key" type="button" data-value="1">1</button><button class="calc-key" type="button" data-value="2">2</button><button class="calc-key" type="button" data-value="3">3</button><button class="calc-key operator" type="button" data-value="+">+</button>
          <button class="calc-key" type="button" data-action="negate">+/−</button><button class="calc-key" type="button" data-value="0">0</button><button class="calc-key" type="button" data-value=".">.</button><button class="calc-key equals" type="button" data-action="equals">=</button>
        </div>
      </div>
    </aside>`;

  const footer = `
    <footer class="site-footer">
      <div class="footer-bottom"><p>&copy; 2026 KalQ. All rights reserved.</p><nav aria-label="Footer links"><a href="#">About Us</a><span aria-hidden="true"></span><a href="#">Contact Us</a><span aria-hidden="true"></span><a href="#">Privacy Policy</a><span aria-hidden="true"></span><a href="#">Terms of Use</a><span aria-hidden="true"></span><a href="#">Disclaimer</a></nav><form class="footer-subscribe" aria-label="Subscribe for updates"><input type="email" placeholder="Enter your email" aria-label="Email address"><button type="submit">Subscribe</button></form><a class="back-top" href="#" aria-label="Back to top"><svg class="icon" aria-hidden="true"><use href="#icon-up"></use></svg></a></div>
    </footer>`;

  function mountShell() {
    if (!document.querySelector(".icon-sprite")) document.body.insertAdjacentHTML("afterbegin", sprite);
    if (!document.querySelector(".site-header")) document.querySelector(".icon-sprite").insertAdjacentHTML("afterend", header + panel);
    if (!document.querySelector(".site-footer")) {
      const anchor = document.querySelector(".modal, .print-view");
      if (anchor) anchor.insertAdjacentHTML("beforebegin", footer);
      else document.body.insertAdjacentHTML("beforeend", footer);
    }
  }

  function setupSearch() {
    const form = document.querySelector(".top-search");
    const input = form && form.querySelector('input[type="search"]');
    if (!form || !input) return;
    const list = document.createElement("div");
    list.className = "search-suggestions";
    list.hidden = true;
    form.append(list);

    const render = () => {
      const query = input.value.trim().toLowerCase();
      const matches = query ? calculators.filter(([name, , category]) => `${name} ${category}`.toLowerCase().includes(query)).slice(0, 6) : [];
      list.innerHTML = matches.map(([name, href, category]) => `<a href="${href}"><span>${name}</span><small>${category}</small></a>`).join("");
      list.hidden = !matches.length;
      return matches;
    };

    input.addEventListener("input", render);
    input.addEventListener("focus", render);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const matches = render();
      if (matches[0]) window.location.href = matches[0][1];
    });
    document.addEventListener("click", (event) => {
      if (!form.contains(event.target)) list.hidden = true;
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        event.preventDefault();
        input.focus();
      }
      if (event.key === "Escape") list.hidden = true;
    });
  }

  function setupTheme() {
    let saved = "";
    try { saved = localStorage.getItem("kalq-theme") || ""; } catch (error) {}
    const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && systemPrefersDark)) document.documentElement.dataset.theme = "dark";
    const update = () => {
      const dark = document.documentElement.dataset.theme === "dark";
      document.querySelectorAll("[data-shell-theme]").forEach((button) => {
        button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
        button.setAttribute("aria-pressed", String(dark));
      });
    };
    document.querySelectorAll("[data-shell-theme]").forEach((button) => button.addEventListener("click", () => {
      const dark = document.documentElement.dataset.theme !== "dark";
      if (dark) document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
      try { localStorage.setItem("kalq-theme", dark ? "dark" : "light"); } catch (error) {}
      update();
    }));
    update();
  }

  function setupCalculator() {
    const panelElement = document.getElementById("calculatorPanel");
    const card = panelElement && panelElement.querySelector(".calculator-card");
    const expressionElement = panelElement && panelElement.querySelector(".calculator-expression");
    const resultElement = panelElement && panelElement.querySelector(".calculator-result");
    if (!panelElement || !card || !expressionElement || !resultElement) return;
    let expression = "";

    const show = (open) => {
      panelElement.hidden = !open;
      document.querySelectorAll("[data-shell-calculator]").forEach((button) => button.setAttribute("aria-expanded", String(open)));
    };
    const update = (result) => {
      expressionElement.textContent = expression || "0";
      if (result !== undefined) resultElement.textContent = result;
    };
    const calculate = () => {
      try {
        let safe = expression.replace(/\^/g, "**").replace(/\bpi\b/gi, "Math.PI").replace(/\be\b/g, "Math.E");
        safe = safe.replace(/\bsin\(/g, "Math.sin(").replace(/\bcos\(/g, "Math.cos(").replace(/\btan\(/g, "Math.tan(").replace(/\bsqrt\(/g, "Math.sqrt(").replace(/\bln\(/g, "Math.log(").replace(/\blog\(/g, "Math.log10(");
        if (!/^[0-9+\-*/().,\sA-Za-z_*]+$/.test(safe)) throw new Error("Invalid expression");
        const value = Function(`"use strict"; return (${safe})`)();
        if (!Number.isFinite(value)) throw new Error("Invalid result");
        const formatted = Number(value.toPrecision(12)).toString();
        update(formatted);
        expression = formatted;
      } catch (error) { resultElement.textContent = "Error"; }
    };

    document.querySelectorAll("[data-shell-calculator]").forEach((button) => button.addEventListener("click", () => show(panelElement.hidden)));
    panelElement.querySelector(".calculator-close").addEventListener("click", () => show(false));
    panelElement.querySelectorAll(".mode-button").forEach((button) => button.addEventListener("click", () => {
      const scientific = button.dataset.mode === "scientific";
      card.classList.toggle("is-scientific", scientific);
      panelElement.querySelectorAll(".mode-button").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
    }));
    panelElement.querySelectorAll(".calc-key").forEach((button) => button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "clear") { expression = ""; resultElement.textContent = "0"; }
      else if (action === "backspace") expression = expression.slice(0, -1);
      else if (action === "percent") expression += "/100";
      else if (action === "negate") expression = expression ? `-(${expression})` : "-";
      else if (action === "equals") { calculate(); return; }
      else expression += button.dataset.value || "";
      update();
    }));
    update("0");
  }

  function setupFooter() {
    const form = document.querySelector(".footer-subscribe");
    if (form) form.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = form.querySelector("button");
      const original = button.textContent;
      button.textContent = "Subscribed";
      window.setTimeout(() => { button.textContent = original; }, 1600);
      form.reset();
    });
  }

  function setupHeaderScroll() {
    const headerElement = document.querySelector(".site-header");
    const calculatorPanel = document.getElementById("calculatorPanel");
    if (!headerElement) return;

    let lastScrollY = Math.max(0, window.scrollY);
    let scheduled = false;

    const keepVisible = () => {
      const searchSuggestions = headerElement.querySelector(".search-suggestions");
      return headerElement.matches(":focus-within") ||
        (searchSuggestions && !searchSuggestions.hidden) ||
        (calculatorPanel && !calculatorPanel.hidden);
    };

    const update = () => {
      const currentScrollY = Math.max(0, window.scrollY);
      const movement = currentScrollY - lastScrollY;

      if (currentScrollY <= 24 || movement < -4 || keepVisible()) {
        headerElement.classList.remove("site-header-hidden");
      } else if (movement > 5 && currentScrollY > headerElement.offsetHeight + 24) {
        headerElement.classList.add("site-header-hidden");
      }

      lastScrollY = currentScrollY;
      scheduled = false;
    };

    window.addEventListener("scroll", () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    headerElement.addEventListener("mouseenter", () => headerElement.classList.remove("site-header-hidden"));
    headerElement.addEventListener("focusin", () => headerElement.classList.remove("site-header-hidden"));
  }

  function setupReportLayer() {
    const sync = () => document.body.classList.toggle("shell-report-open", Boolean(document.querySelector(".modal.open")));
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"], subtree: true });
    sync();
  }

  function pageName() {
    return decodeURIComponent(window.location.pathname.split("/").pop() || "").toLowerCase();
  }

  function marketName(value) {
    return MARKET_ALIASES[value] || CURRENCIES[value] || "";
  }

  async function fetchLiveFx(from, to) {
    if (from === to) return { rate: 1, date: new Date().toISOString().slice(0, 10), source: "Same currency" };
    const key = `${from}/${to}`;
    const cached = fxCache.get(key);
    if (cached && Date.now() - cached.savedAt < 15 * 60 * 1000) return cached;
    const urls = [
      `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`,
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ];
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) continue;
        const data = await response.json();
        const rate = Number(data.rates && data.rates[to]);
        if (!Number.isFinite(rate) || rate <= 0) continue;
        const result = { rate, date: data.date || new Date().toISOString().slice(0, 10), source: "Frankfurter / ECB reference data", savedAt: Date.now() };
        fxCache.set(key, result);
        return result;
      } catch (error) {}
    }
    throw new Error("Live FX service unavailable");
  }

  function replaceOptions(select, options, preferred) {
    if (!select) return;
    const previous = preferred || select.value;
    const useIso = Array.from(select.options).some((option) => MARKET_NAMES.some((name) => option.value === MARKETS[name].iso));
    select.replaceChildren(...options.map(({ value, label, iso }) => {
      const option = document.createElement("option");
      option.value = useIso && iso ? iso : value;
      option.textContent = label;
      return option;
    }));
    const supported = Array.from(select.options).find((option) => option.value === previous || marketName(option.value) === marketName(previous));
    select.value = supported ? supported.value : select.options[0]?.value || "";
  }

  function setupMarketRestrictions() {
    const countryOptions = MARKET_NAMES.map((name) => ({ value: name, iso: MARKETS[name].iso, label: name }));
    const currencyOptions = MARKET_NAMES.map((name) => ({ value: MARKETS[name].currency, label: `${MARKETS[name].currency} — ${name}` }));
    ["country", "sourceCountry", "destinationCountry", "senderCountry", "recipientCountry"].forEach((id) => {
      const select = document.getElementById(id);
      if (select && select.tagName === "SELECT") replaceOptions(select, countryOptions);
    });
    ["currency", "fromCurrency", "toCurrency", "baseCurrency", "targetCurrency"].forEach((id) => {
      const select = document.getElementById(id);
      if (select && select.tagName === "SELECT") replaceOptions(select, currencyOptions);
    });
  }

  function setupCountryPolicy() {
    const country = document.getElementById("country") || document.getElementById("senderCountry") || document.getElementById("sourceCountry");
    if (!country) return;
    const page = pageName();
    const planningCosts = {
      "United States": { propertyTax: 1.10, stampDuty: 0, legal: 0.35 },
      "United Kingdom": { propertyTax: 0.45, stampDuty: 2.0, legal: 0.40 },
      Malaysia: { propertyTax: 0.35, stampDuty: 1.0, legal: 0.50 },
      Singapore: { propertyTax: 0.40, stampDuty: 3.0, legal: 0.45 },
      Indonesia: { propertyTax: 0.50, stampDuty: 2.5, legal: 0.50 },
      India: { propertyTax: 0.20, stampDuty: 5.0, legal: 0.50 },
      China: { propertyTax: 0.30, stampDuty: 1.0, legal: 0.40 }
    };
    const statusHost = country.closest(".field") || country.parentElement;
    let status = statusHost && statusHost.querySelector(".shell-policy-status");
    if (!status && statusHost) {
      status = document.createElement("small");
      status.className = "shell-live-status shell-policy-status";
      statusHost.append(status);
    }
    const apply = () => {
      const name = marketName(country.value);
      const profile = MARKETS[name];
      if (!profile) return;
      const currency = document.getElementById("currency");
      if (currency && currency.value !== profile.currency) {
        currency.value = profile.currency;
        currency.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (page === "compound-interest.html") {
        const tax = document.getElementById("taxRate");
        if (tax) { tax.value = profile.taxRate; tax.dispatchEvent(new Event("input", { bubbles: true })); }
      }
      if (page === "loan-calculator.html") {
        const rate = document.getElementById("annualRate");
        if (rate) { rate.value = Math.max(profile.policyRate + 2.25, 0).toFixed(2); rate.dispatchEvent(new Event("input", { bubbles: true })); }
      }
      if (page === "mortgage-calculator.html") {
        const rate = document.getElementById("rate");
        if (rate) { rate.value = Math.max(profile.policyRate + 1.75, 0).toFixed(3); rate.dispatchEvent(new Event("input", { bubbles: true })); }
        const price = Number(document.getElementById("homePrice")?.value);
        const tax = document.getElementById("tax");
        if (tax && Number.isFinite(price)) { tax.value = Math.round(price * planningCosts[name].propertyTax / 100); tax.dispatchEvent(new Event("input", { bubbles: true })); }
      }
      if (page === "mortgage-comparison.html") {
        const price = Number(document.getElementById("aPrice")?.value);
        const costs = planningCosts[name];
        if (Number.isFinite(price) && costs) {
          const assignments = { propertyTax: price * costs.propertyTax / 100, stampDuty: price * costs.stampDuty / 100, legalFees: price * costs.legal / 100 };
          Object.entries(assignments).forEach(([id, amount]) => { const input = document.getElementById(id); if (input) input.value = String(Math.round(amount * 100) / 100); });
          document.getElementById("compareBtn")?.click();
        }
      }
      if (status) {
        status.dataset.state = "ready";
        status.innerHTML = `${profile.policyLabel}: <strong>${profile.policyRate.toFixed(2)}%</strong>. Country defaults and official references updated for ${name}.`;
      }
      document.dispatchEvent(new CustomEvent("kalq:marketchange", { detail: { name, ...profile } }));
    };
    country.addEventListener("change", apply);
    apply();
  }

  function setupContextualHelp() {
    const country = document.getElementById("country") || document.getElementById("senderCountry") || document.getElementById("sourceCountry");
    if (!country) return;
    const page = pageName();
    const financialPages = new Set(["compound-interest.html", "currency-exchange.html", "currency-comparison.html", "loan-calculator.html", "mortgage-calculator.html", "mortgage-comparison.html", "mortgage-refinance.html", "age-calculator.html"]);
    if (!financialPages.has(page)) return;
    const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const update = () => {
      const name = marketName(country.value);
      const profile = MARKETS[name];
      if (!profile) return;
      const faqItems = [
        [`Which ${name} policy assumptions are used?`, `The calculator applies ${profile.policyLabel} (${profile.policyRate.toFixed(2)}%) as the current policy reference and keeps product-specific margins visible as planning assumptions.`],
        [`Does changing to ${profile.currency} convert existing values?`, `Yes. Existing monetary inputs are converted with today's available reference FX rate; the calculator does not only replace the currency symbol.`],
        [`Are the ${name} tax and fee estimates final?`, `No. Tax, stamp duty, fees, and eligibility can depend on residency, transaction type, income, and local rules. Confirm the result with the relevant authority.`],
        [`Which providers are shown for ${name}?`, `Provider and bank choices are limited to services commonly available in ${name}: ${profile.providers.join(", ")} and ${profile.banks.join(", ")}.`]
      ];
      document.querySelectorAll(".faq-list, .faq-grid, .faqs-grid").forEach((container) => {
        if (container.closest(".report, .print-view")) return;
        container.innerHTML = faqItems.map(([q, a]) => `<article class="faq-item"><strong>${escape(q)}</strong><p>${escape(a)}</p></article>`).join("");
      });
      document.querySelectorAll(".support-card.faq").forEach((card) => {
        if (card.closest(".report, .print-view")) return;
        const heading = card.querySelector("h3")?.outerHTML || "<h3>Frequently Asked Questions</h3>";
        card.innerHTML = heading + faqItems.map(([q, a]) => `<div class="faq-item"><b>${escape(q)}</b><p>${escape(a)}</p></div>`).join("");
      });
      document.querySelectorAll(".references-list, .reference-list, .references-grid").forEach((container) => {
        if (container.closest(".report, .print-view")) return;
        container.innerHTML = profile.references.map(([label, href]) => `<a class="reference-item" href="${href}" target="_blank" rel="noopener noreferrer"><strong>${escape(label)}</strong><span>Official ${escape(name)} source</span></a>`).join("");
      });
      document.querySelectorAll(".support-card.references, .support-card.reference").forEach((card) => {
        if (card.closest(".report, .print-view")) return;
        const heading = card.querySelector("h3")?.outerHTML || "<h3>References</h3>";
        card.innerHTML = heading + `<div class="reference-links">${profile.references.map(([label, href]) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${escape(label)}<small>Official ${escape(name)} source</small></a>`).join("")}</div>`;
      });
      document.querySelectorAll(".report-info-card").forEach((card) => {
        if (!/^references$/i.test(card.querySelector("h3")?.textContent.trim() || "")) return;
        const paragraph = card.querySelector("p");
        if (paragraph) paragraph.innerHTML = profile.references.map(([label, href]) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`).join(" · ");
      });
    };
    country.addEventListener("change", update);
    update();
  }

  function setupLiveFinancialCurrency() {
    const page = decodeURIComponent(window.location.pathname.split("/").pop() || "").toLowerCase();
    const monetaryInputsByPage = {
      "compound-interest.html": ["startAmount", "contributionAmount", "targetAmount"],
      "loan-calculator.html": ["loanAmount", "downPayment", "extraMonthly", "oneTimeExtra", "processingFee", "insuranceCost", "balloonPayment"],
      "mortgage-calculator.html": ["homePrice", "downPayment", "tax", "insurance", "hoa", "extra", "income"],
      "mortgage-comparison.html": ["aPrice", "bPrice", "cPrice", "aDown", "bDown", "cDown", "aLoan", "bLoan", "cLoan", "aFee", "bFee", "cFee", "propertyTax", "insurance", "maintenance", "mortgageInsurance", "closingCosts", "loanFees", "extraPayment", "legalFees", "stampDuty", "mrta", "epfWithdrawal", "monthlyIncome", "otherDebt"],
      "mortgage-refinance.html": ["currentBalance", "propertyValue", "closingCosts", "legalFees", "valuationFees", "earlyPenalty", "cashOut", "monthlyEscrow"]
    };
    const monetaryIds = monetaryInputsByPage[page];
    const currency = document.getElementById("currency");
    if (!monetaryIds || !currency) return;

    const country = document.getElementById("country");
    const status = document.createElement("small");
    status.className = "shell-live-status";
    status.textContent = "Monetary inputs convert using live FX when the currency changes.";
    (currency.closest(".field") || currency.parentElement).append(status);

    let activeCurrency = currency.value;
    let requestToken = 0;

    const calculate = () => {
      const action = document.getElementById("calculateBtn") || document.getElementById("compareBtn");
      if (action) action.click();
    };
    const setStatus = (message, state = "ready") => {
      status.textContent = message;
      status.dataset.state = state;
    };
    const convertCurrency = async (nextCurrency) => {
      const from = activeCurrency;
      const to = nextCurrency;
      if (!from || !to || from === to) {
        activeCurrency = to || from;
        calculate();
        return;
      }
      const token = ++requestToken;
      currency.classList.add("shell-live-updating");
      currency.setAttribute("aria-busy", "true");
      setStatus(`Loading live ${from}/${to} exchange rate...`, "loading");
      try {
        const { rate, date, source } = await fetchLiveFx(from, to);
        if (token !== requestToken) return;
        monetaryIds.forEach((id) => {
          const input = document.getElementById(id);
          if (!input || input.value === "") return;
          const value = Number(input.value);
          if (!Number.isFinite(value)) return;
          input.value = String(Math.round(value * rate * 100) / 100);
        });
        activeCurrency = to;
        setStatus(`Live FX applied: 1 ${from} = ${rate.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${to} (${date}, ${source}).`);
        calculate();
      } catch (error) {
        if (token !== requestToken) return;
        currency.value = from;
        activeCurrency = from;
        setStatus("Live FX could not be loaded, so the previous currency and values were kept.", "error");
        calculate();
      } finally {
        if (token === requestToken) {
          currency.classList.remove("shell-live-updating");
          currency.removeAttribute("aria-busy");
        }
      }
    };

    currency.addEventListener("change", () => convertCurrency(currency.value));
    if (country) country.addEventListener("change", () => {
      const expected = MARKETS[marketName(country.value)]?.currency;
      if (expected && currency.value !== expected) currency.value = expected;
      convertCurrency(currency.value);
    });
  }

  function setupLiveInflation() {
    const country = document.getElementById("country");
    const inflation = document.getElementById("inflationRate");
    if (!country || !inflation) return;
    const codes = Object.fromEntries(MARKET_NAMES.flatMap((name) => [[name, MARKETS[name].iso], [MARKETS[name].iso, MARKETS[name].iso]]));
    const status = document.createElement("small");
    status.className = "shell-live-status";
    (inflation.closest(".field") || inflation.parentElement).append(status);
    let token = 0;

    const refresh = async () => {
      const code = codes[country.value];
      if (!code) return;
      const currentToken = ++token;
      status.dataset.state = "loading";
      status.textContent = "Loading the latest available official annual inflation value...";
      inflation.classList.add("shell-live-updating");
      inflation.setAttribute("aria-busy", "true");
      try {
        const year = new Date().getFullYear();
        const response = await fetch(`https://api.worldbank.org/v2/country/${code}/indicator/FP.CPI.TOTL.ZG?format=json&date=${year - 8}:${year}&per_page=20`, { cache: "no-store" });
        if (!response.ok) throw new Error("Inflation service unavailable");
        const payload = await response.json();
        const latest = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1].find((item) => Number.isFinite(Number(item.value))) : null;
        if (!latest) throw new Error("No inflation observation available");
        if (currentToken !== token) return;
        inflation.value = Number(latest.value).toFixed(2);
        inflation.dispatchEvent(new Event("input", { bubbles: true }));
        status.dataset.state = "ready";
        status.textContent = `World Bank annual inflation: ${Number(latest.value).toFixed(2)}% (${latest.date}).`;
      } catch (error) {
        if (currentToken !== token) return;
        status.dataset.state = "error";
        status.textContent = "Official inflation data is unavailable; the current manual assumption was kept.";
      } finally {
        if (currentToken === token) {
          inflation.classList.remove("shell-live-updating");
          inflation.removeAttribute("aria-busy");
        }
      }
    };

    country.addEventListener("change", refresh);
    refresh();
  }

  function init() {
    mountShell();
    setupSearch();
    setupTheme();
    setupCalculator();
    setupFooter();
    setupHeaderScroll();
    setupReportLayer();
    setupMarketRestrictions();
    setupLiveFinancialCurrency();
    setupLiveInflation();
    setupCountryPolicy();
    setupContextualHelp();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
}());
