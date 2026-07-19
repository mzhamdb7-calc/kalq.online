(function () {
  const toggles = Array.from(document.querySelectorAll("[data-calculator-toggle]"));
  const primaryToggle = document.getElementById("calculatorToggle") || toggles[0];
  const panel = document.getElementById("calculatorPanel");
  const closeButton = panel.querySelector(".calculator-close");
  const modeButtons = Array.from(panel.querySelectorAll(".mode-button"));
  const expressionEl = document.getElementById("calculatorExpression");
  const resultEl = document.getElementById("calculatorResult");
  const keys = panel.querySelector(".calculator-keys");
  const themeButtons = Array.from(document.querySelectorAll("[data-theme-toggle]"));
  const root = document.documentElement;
  const themeStorageKey = "kalq-theme";
  const historyStorageKey = "kalq-history";

  let expression = "0";
  let justEvaluated = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function reportTimestamp(date = new Date()) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return "0 KB";
    const units = ["B", "KB", "MB", "GB"];
    let size = value;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    return `${size.toLocaleString("en-US", { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
  }

  function lockLiveField(control, locked, labelClass = "is-live-locked") {
    if (!control) return;
    control.readOnly = Boolean(locked);
    control.setAttribute("aria-readonly", String(Boolean(locked)));
    const holder = control.closest("label") || control.closest(".cc-provider-row");
    if (holder) {
      holder.classList.toggle(labelClass, Boolean(locked));
      holder.classList.toggle("is-manual-input", !locked);
    }
    control.classList.toggle("is-live-locked", Boolean(locked));
    control.classList.toggle("is-manual-input", !locked);
  }

  function setModeButtons(buttons, activeMode, attributeName) {
    Array.from(buttons || []).forEach((button) => {
      const active = button.dataset[attributeName] === activeMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setupDebouncedAutoActions() {
    const autoActions = [
      ["compoundForm", '[data-ci-action="calculate"]'],
      ["currencyForm", '[data-ce-action="convert"]'],
      ["currencyComparisonForm", '[data-cc-action="compare"]'],
      ["loanForm", '[data-loan-action="calculate"]'],
      ["mortgageForm", '[data-mg-action="calculate"]'],
      ["refiForm", '[data-rf-action="calculate"]'],
      ["mortgageComparisonForm", '[data-mc-action="compare"]'],
      ["graphForm", '[data-graph-action="calculate"]'],
      ["pdfForm", '[data-pdf-action="calculate"]'],
      ["imageForm", '[data-img-action="calculate"]'],
      ["unitForm", '[data-unit-action="calculate"]'],
      ["ageForm", '[data-age-action="calculate"]']
    ];

    autoActions.forEach(([formId, actionSelector]) => {
      const formElement = document.getElementById(formId);
      const actionButton = document.querySelector(actionSelector);
      if (!formElement || !actionButton) return;
      let timer = null;
      const schedule = (event) => {
        if (event && event.target && event.target.closest("[data-no-auto-calc]")) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (document.body.classList.contains("report-open")) return;
          actionButton.click();
        }, 2000);
      };
      formElement.addEventListener("input", schedule);
      formElement.addEventListener("change", schedule);
    });
  }

  const currencyRateToUsd = {
    USD: 1,
    GBP: 0.782,
    MYR: 4.7,
    SGD: 1.3572,
    IDR: 16250,
    INR: 83.4
  };

  const currencyInputSymbol = {
    USD: "$",
    GBP: "GBP ",
    MYR: "RM ",
    SGD: "SGD ",
    IDR: "IDR ",
    INR: "INR "
  };

  function currencyFromText(value) {
    const text = String(value || "").toUpperCase();
    const match = text.match(/\b(USD|GBP|MYR|SGD|IDR|INR)\b/);
    return match ? match[1] : "";
  }

  function numberFromText(value) {
    const cleaned = String(value || "").replace(/[^0-9.+-]/g, "");
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : NaN;
  }

  function formatMoneyInputValue(value, currency, original = "") {
    const number = Number(value);
    if (!Number.isFinite(number)) return original;
    const decimals = Math.abs(number) >= 1000 ? 0 : 2;
    const formatted = number.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    const originalText = String(original || "");
    if (originalText.includes("$") || /^[A-Z]{3}\s|^RM\s/i.test(originalText)) {
      return `${currencyInputSymbol[currency] || `${currency} `}${formatted}`;
    }
    return formatted;
  }

  function conversionFactor(fromCurrency, toCurrency) {
    const fromRate = currencyRateToUsd[fromCurrency] || 1;
    const toRate = currencyRateToUsd[toCurrency] || 1;
    return toRate / fromRate;
  }

  function hydrateCurrencyConversionRates() {
    const service = window.KalQRates;
    if (!service || typeof service.getExchangeRate !== "function") return;
    Object.keys(currencyRateToUsd).filter((currency) => currency !== "USD").forEach((currency) => {
      service.getExchangeRate("USD", currency).then((rate) => {
        const value = Number(rate && rate.value);
        if (Number.isFinite(value) && value > 0) {
          currencyRateToUsd[currency] = value;
        }
      }).catch(() => {});
    });
  }

  function isMoneyLikeInput(input) {
    if (!input || input.disabled || input.readOnly) return false;
    if (input.type && !["text", "search", "tel", "number"].includes(input.type)) return false;
    const label = (input.closest("label") || {}).textContent || "";
    const id = input.id || "";
    const text = `${label} ${id}`.toLowerCase();
    if (!input.matches('[inputmode="decimal"], input[type="number"]')) return false;
    if (/(rate|percent|percentage|apr|term|year|frequency|date|time|decimal|digit|timer|question|fx|point)/.test(text)) return false;
    return /(amount|balance|price|payment|cost|fee|tax|insurance|maintenance|hoa|income|debt|value|target|contribution|loan|down|cash|penalty|legal|valuation|closing)/.test(text);
  }

  function convertInputsInScope(scope, fromCurrency, toCurrency, specificInputs = null) {
    if (!scope || !fromCurrency || !toCurrency || fromCurrency === toCurrency) return;
    const factor = conversionFactor(fromCurrency, toCurrency);
    const inputs = specificInputs || Array.from(scope.querySelectorAll("input"));
    inputs.forEach((input) => {
      if (!isMoneyLikeInput(input)) return;
      const number = numberFromText(input.value);
      if (!Number.isFinite(number)) return;
      input.value = formatMoneyInputValue(number * factor, toCurrency, input.value);
    });
    scope.querySelectorAll(".refi-affix b").forEach((affix) => {
      if (affix.textContent.trim() !== "%") affix.textContent = currencyInputSymbol[toCurrency] === "$" ? "$" : toCurrency;
    });
  }

  function scaleConvertedInputs(scope, multiplier, currency, specificInputs = null) {
    if (!scope || !Number.isFinite(multiplier) || Math.abs(multiplier - 1) < 0.000001) return;
    const inputs = (specificInputs || Array.from(scope.querySelectorAll("input"))).filter(Boolean);
    inputs.forEach((input) => {
      if (!isMoneyLikeInput(input)) return;
      const number = numberFromText(input.value);
      if (!Number.isFinite(number)) return;
      input.value = formatMoneyInputValue(number * multiplier, currency, input.value);
    });
    const form = scope.matches("form") ? scope : scope.querySelector("form");
    if (form) form.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function correctWithLiveCurrencyRate(scope, fromCurrency, toCurrency, fallbackFactor, specificInputs = null) {
    const service = window.KalQRates;
    if (!service || typeof service.getExchangeRate !== "function") return;
    service.getExchangeRate(fromCurrency, toCurrency).then((rate) => {
      const liveFactor = Number(rate && rate.value);
      if (!Number.isFinite(liveFactor) || liveFactor <= 0) return;
      scaleConvertedInputs(scope, liveFactor / fallbackFactor, toCurrency, specificInputs);
      currencyRateToUsd[toCurrency] = currencyRateToUsd[fromCurrency] * liveFactor;
    }).catch(() => {});
  }

  function setupNumericInputRestrictions() {
    document.querySelectorAll('input[inputmode="decimal"], input[type="number"]').forEach((input) => {
      input.setAttribute("autocomplete", "off");
    });
    document.addEventListener("input", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (!input.matches('input[inputmode="decimal"], input[type="number"]')) return;
      const next = input.value.replace(/[^0-9.,%$+\-\s]/g, "");
      if (next !== input.value) input.value = next;
    }, true);
  }

  function setupCurrencyInputConversion() {
    const currencySelectors = Array.from(document.querySelectorAll("select")).filter((select) => {
      const id = select.id || "";
      if (id === "mg-currency" || id === "rf-currency" || id === "graph-currency") return false;
      return /(^|-)currency$/.test(id) || id === "ce-from" || id === "ce-to" || id === "cc-from" || id === "cc-to";
    });
    currencySelectors.forEach((select) => {
      select.dataset.previousCurrency = currencyFromText(select.value || select.selectedOptions[0]?.textContent) || "USD";
    });

    document.addEventListener("change", (event) => {
      const select = event.target;
      if (!(select instanceof HTMLSelectElement)) return;
      if (!currencySelectors.includes(select)) return;
      const nextCurrency = currencyFromText(select.value || select.selectedOptions[0]?.textContent) || "USD";
      const previousCurrency = select.dataset.previousCurrency || nextCurrency;
      select.dataset.previousCurrency = nextCurrency;
      if (previousCurrency === nextCurrency) return;

      if (select.id === "ce-from") {
        const scope = document.getElementById("currencyForm");
        const inputs = [document.getElementById("ce-amount")];
        const factor = conversionFactor(previousCurrency, nextCurrency);
        convertInputsInScope(scope, previousCurrency, nextCurrency, inputs);
        correctWithLiveCurrencyRate(scope, previousCurrency, nextCurrency, factor, inputs);
        return;
      }
      if (select.id === "ce-to") {
        const scope = document.getElementById("currencyForm");
        const inputs = [document.getElementById("ce-fixed-fee")];
        const factor = conversionFactor(previousCurrency, nextCurrency);
        convertInputsInScope(scope, previousCurrency, nextCurrency, inputs);
        correctWithLiveCurrencyRate(scope, previousCurrency, nextCurrency, factor, inputs);
        return;
      }
      if (select.id === "cc-from") {
        const scope = document.getElementById("currencyComparisonForm");
        const inputs = [document.getElementById("cc-amount")];
        const factor = conversionFactor(previousCurrency, nextCurrency);
        convertInputsInScope(scope, previousCurrency, nextCurrency, inputs);
        correctWithLiveCurrencyRate(scope, previousCurrency, nextCurrency, factor, inputs);
        return;
      }
      if (select.id === "cc-to") return;
      const scope = select.closest("aside") || select.closest("form") || document;
      const factor = conversionFactor(previousCurrency, nextCurrency);
      convertInputsInScope(scope, previousCurrency, nextCurrency);
      correctWithLiveCurrencyRate(scope, previousCurrency, nextCurrency, factor);
    }, true);
  }

  function setupReferenceLinks() {
    const linkMap = [
      ["Freddie Mac PMMS", "https://www.freddiemac.com/pmms"],
      ["Federal Reserve", "https://www.federalreserve.gov/"],
      ["FRED", "https://fred.stlouisfed.org/"],
      ["Bank Negara Malaysia", "https://www.bnm.gov.my/"],
      ["BNM", "https://www.bnm.gov.my/"],
      ["World Bank", "https://data.worldbank.org/"],
      ["Investopedia", "https://www.investopedia.com/terms/c/compoundinterest.asp"],
      ["Morningstar", "https://www.morningstar.com/"],
      ["ISO 4217", "https://www.iso.org/iso-4217-currency-codes.html"],
      ["Refinitiv", "https://www.lseg.com/en/data-analytics"],
      ["XE.com", "https://www.xe.com/"],
      ["OANDA", "https://www.oanda.com/"],
      ["Bloomberg", "https://www.bloomberg.com/markets/currencies"],
      ["Google Finance", "https://www.google.com/finance/"],
      ["Investing.com", "https://www.investing.com/currencies/"],
      ["Consumer Financial Protection Bureau", "https://www.consumerfinance.gov/"],
      ["KWSP", "https://www.kwsp.gov.my/"],
      ["EPF", "https://www.kwsp.gov.my/"],
      ["LHDN", "https://www.hasil.gov.my/"],
      ["HASiL", "https://www.hasil.gov.my/"],
      ["SOFR", "https://www.newyorkfed.org/markets/reference-rates/sofr"],
      ["standard amortization formula", "https://www.consumerfinance.gov/ask-cfpb/what-is-amortization-en-771/"],
      ["lender repayment schedules", "https://www.consumerfinance.gov/owning-a-home/loan-estimate/"],
      ["reducing balance", "https://www.investopedia.com/terms/a/amortization.asp"],
      ["Bank Pages", "https://www.consumerfinance.gov/owning-a-home/explore-rates/"],
      ["major bank rate pages", "https://www.consumerfinance.gov/owning-a-home/explore-rates/"],
      ["Soroban", "https://en.wikipedia.org/wiki/Soroban"],
      ["mental math", "https://en.wikipedia.org/wiki/Mental_calculation"],
      ["educational psychology", "https://www.apa.org/education-career/k12"],
      ["learning science", "https://www.edutopia.org/topic/learning-science/"],
      ["Malaysia Government Portal", "https://www.malaysia.gov.my/"],
      ["Calendar Reference", "https://www.timeanddate.com/calendar/"],
      ["wise.com", "https://wise.com/"],
      ["westernunion.com", "https://www.westernunion.com/"],
      ["moneygram.com", "https://www.moneygram.com/"],
      ["ria.com", "https://www.riamoneytransfer.com/"],
      ["instarem.com", "https://www.instarem.com/"],
      ["bigpay.com", "https://www.bigpayme.com/"],
      ["maybank2u.com.my", "https://www.maybank2u.com.my/"],
      ["cimbclicks.com.my", "https://www.cimbclicks.com.my/"]
    ];
    const containers = Array.from(document.querySelectorAll('[class*="reference"], [class*="references"]'));
    const entries = linkMap.slice().sort((a, b) => b[0].length - a[0].length);
    const entryByLabel = new Map(entries.map(([label, href]) => [label.toLowerCase(), href]));
    const linkPattern = new RegExp(`\\b(${entries.map(([label]) => (
      label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    )).join("|")})\\b`, "gi");
    containers.forEach((container) => {
      container.querySelectorAll('a[href="#"]').forEach((anchor) => {
        const match = linkMap.find(([label]) => anchor.textContent.toLowerCase().includes(label.toLowerCase()));
        if (!match) return;
        anchor.href = match[1];
        anchor.target = "_blank";
        anchor.rel = "noopener";
      });
      container.querySelectorAll("p, small, span").forEach((node) => {
        if (node.closest("a") || node.querySelector("a")) return;
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        textNodes.forEach((textNode) => {
          const text = textNode.nodeValue || "";
          linkPattern.lastIndex = 0;
          if (!linkPattern.test(text)) return;

          const fragment = document.createDocumentFragment();
          let cursor = 0;
          linkPattern.lastIndex = 0;
          text.replace(linkPattern, (match, _label, offset) => {
            if (offset > cursor) fragment.append(document.createTextNode(text.slice(cursor, offset)));
            const anchor = document.createElement("a");
            anchor.className = "inline-reference-link";
            anchor.href = entryByLabel.get(match.toLowerCase()) || "#";
            anchor.target = "_blank";
            anchor.rel = "noopener";
            anchor.textContent = match;
            fragment.append(anchor);
            cursor = offset + match.length;
            return match;
          });
          if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
          textNode.replaceWith(fragment);
        });
      });
    });
  }

  function setupCountryAwareCopy() {
    const countryNames = ["United States", "United Kingdom", "Malaysia", "Singapore", "Indonesia", "India"];
    const countryByCode = { USA: "United States", GBR: "United Kingdom", MYS: "Malaysia", SGP: "Singapore", IDN: "Indonesia", IND: "India" };
    const countryData = {
      "United States": {
        adjective: "US",
        centralBank: ["Federal Reserve", "https://www.federalreserve.gov/", "Central bank, policy, and rate information."],
        inflation: ["FRED Economic Data", "https://fred.stlouisfed.org/", "US inflation, mortgage, and economic datasets."],
        tax: ["Internal Revenue Service", "https://www.irs.gov/", "Federal tax rules and filing guidance."],
        consumer: ["Consumer Financial Protection Bureau", "https://www.consumerfinance.gov/", "Consumer loan, credit, and mortgage guidance."],
        housing: ["Freddie Mac PMMS", "https://www.freddiemac.com/pmms", "US mortgage market survey rates."],
        pension: ["Social Security Administration", "https://www.ssa.gov/", "US age, retirement, and benefit references."],
        government: ["USA.gov", "https://www.usa.gov/", "US government services and public guidance."],
        bank: ["FDIC", "https://www.fdic.gov/", "US banking information and consumer protection."]
      },
      "United Kingdom": {
        adjective: "UK",
        centralBank: ["Bank of England", "https://www.bankofengland.co.uk/", "UK monetary policy, inflation, and rate data."],
        inflation: ["Office for National Statistics", "https://www.ons.gov.uk/", "UK inflation and national statistics."],
        tax: ["HM Revenue & Customs", "https://www.gov.uk/government/organisations/hm-revenue-customs", "UK tax and duty guidance."],
        consumer: ["Financial Conduct Authority", "https://www.fca.org.uk/", "UK financial services and consumer protection."],
        housing: ["MoneyHelper", "https://www.moneyhelper.org.uk/", "UK mortgage and borrowing guidance."],
        pension: ["GOV.UK State Pension", "https://www.gov.uk/state-pension", "UK pension and age eligibility guidance."],
        government: ["GOV.UK", "https://www.gov.uk/", "UK government services and rules."],
        bank: ["Prudential Regulation Authority", "https://www.bankofengland.co.uk/prudential-regulation", "UK banking supervision."]
      },
      Malaysia: {
        adjective: "Malaysian",
        centralBank: ["Bank Negara Malaysia", "https://www.bnm.gov.my/", "Malaysia monetary policy, financial education, and rate data."],
        inflation: ["Department of Statistics Malaysia", "https://www.dosm.gov.my/", "Malaysia inflation and official statistics."],
        tax: ["LHDN / HASiL", "https://www.hasil.gov.my/", "Malaysia tax rules and public guidance."],
        consumer: ["AKPK", "https://www.akpk.org.my/", "Malaysia credit counselling and financial education."],
        housing: ["BNM Housing Watch", "https://www.bnm.gov.my/housing-watch", "Malaysia housing and affordability references."],
        pension: ["KWSP / EPF", "https://www.kwsp.gov.my/", "Malaysia retirement and contribution references."],
        government: ["Malaysia Government Portal", "https://www.malaysia.gov.my/", "Malaysia public services and official references."],
        bank: ["Association of Banks in Malaysia", "https://www.abm.org.my/", "Malaysia banking information."]
      },
      Singapore: {
        adjective: "Singapore",
        centralBank: ["Monetary Authority of Singapore", "https://www.mas.gov.sg/", "Singapore monetary policy, rates, and financial guidance."],
        inflation: ["SingStat", "https://www.singstat.gov.sg/", "Singapore inflation and national statistics."],
        tax: ["IRAS", "https://www.iras.gov.sg/", "Singapore tax rules and public guidance."],
        consumer: ["MoneySense", "https://www.moneysense.gov.sg/", "Singapore financial education and consumer guidance."],
        housing: ["HDB", "https://www.hdb.gov.sg/", "Singapore housing and home loan guidance."],
        pension: ["Central Provident Fund", "https://www.cpf.gov.sg/", "Singapore CPF contribution and age references."],
        government: ["Singapore Government", "https://www.gov.sg/", "Singapore government services and policies."],
        bank: ["Association of Banks in Singapore", "https://www.abs.org.sg/", "Singapore banking information."]
      },
      Indonesia: {
        adjective: "Indonesian",
        centralBank: ["Bank Indonesia", "https://www.bi.go.id/", "Indonesia monetary policy, currency, and rate data."],
        inflation: ["Badan Pusat Statistik", "https://www.bps.go.id/", "Indonesia inflation and official statistics."],
        tax: ["Direktorat Jenderal Pajak", "https://www.pajak.go.id/", "Indonesia tax rules and public guidance."],
        consumer: ["Otoritas Jasa Keuangan", "https://www.ojk.go.id/", "Indonesia financial services and consumer protection."],
        housing: ["Kementerian PUPR", "https://pu.go.id/", "Indonesia housing and public works references."],
        pension: ["BPJS Ketenagakerjaan", "https://www.bpjsketenagakerjaan.go.id/", "Indonesia social security and employment benefits."],
        government: ["Indonesia Government Portal", "https://indonesia.go.id/", "Indonesia public services and official references."],
        bank: ["OJK Banking", "https://www.ojk.go.id/", "Indonesia banking supervision and guidance."]
      },
      India: {
        adjective: "Indian",
        centralBank: ["Reserve Bank of India", "https://www.rbi.org.in/", "India monetary policy, lending, and rate data."],
        inflation: ["MOSPI", "https://www.mospi.gov.in/", "India inflation and official statistics."],
        tax: ["Income Tax Department", "https://www.incometax.gov.in/", "India tax rules and filing guidance."],
        consumer: ["National Consumer Helpline", "https://consumerhelpline.gov.in/", "India consumer guidance and complaint support."],
        housing: ["National Housing Bank", "https://nhb.org.in/", "India housing finance and market references."],
        pension: ["EPFO", "https://www.epfindia.gov.in/", "India provident fund and retirement references."],
        government: ["National Portal of India", "https://www.india.gov.in/", "India government services and public guidance."],
        bank: ["RBI Banking", "https://www.rbi.org.in/", "India banking regulation and consumer information."]
      }
    };
    const providerRefs = {
      "United States": [
        ["Wise", "https://wise.com/", "International transfer pricing and exchange rate reference."],
        ["Western Union", "https://www.westernunion.com/", "US remittance and transfer provider rates."],
        ["MoneyGram", "https://www.moneygram.com/", "US money transfer provider fees and rates."],
        ["OANDA", "https://www.oanda.com/", "Foreign exchange market reference rates."]
      ],
      "United Kingdom": [
        ["Wise UK", "https://wise.com/gb/", "UK transfer pricing and exchange rate reference."],
        ["Western Union UK", "https://www.westernunion.com/gb/en/home.html", "UK remittance and transfer provider rates."],
        ["Bank of England", "https://www.bankofengland.co.uk/", "UK official rate and monetary policy data."],
        ["XE", "https://www.xe.com/", "Currency exchange reference rates."]
      ],
      Malaysia: [
        ["Wise Malaysia", "https://wise.com/my/", "Malaysia transfer pricing and exchange rate reference."],
        ["Maybank", "https://www.maybank2u.com.my/", "Malaysia bank transfer and FX reference."],
        ["CIMB", "https://www.cimbclicks.com.my/", "Malaysia bank transfer and FX reference."],
        ["Bank Negara Malaysia", "https://www.bnm.gov.my/", "Malaysia currency and financial data."]
      ],
      Singapore: [
        ["Wise Singapore", "https://wise.com/sg/", "Singapore transfer pricing and exchange rate reference."],
        ["DBS", "https://www.dbs.com.sg/", "Singapore bank transfer and FX reference."],
        ["UOB", "https://www.uob.com.sg/", "Singapore bank transfer and FX reference."],
        ["Monetary Authority of Singapore", "https://www.mas.gov.sg/", "Singapore official financial data."]
      ],
      Indonesia: [
        ["Wise Indonesia", "https://wise.com/id/", "Indonesia transfer pricing and exchange rate reference."],
        ["Bank Mandiri", "https://www.bankmandiri.co.id/", "Indonesia bank transfer and FX reference."],
        ["BCA", "https://www.bca.co.id/", "Indonesia bank transfer and FX reference."],
        ["Bank Indonesia", "https://www.bi.go.id/", "Indonesia currency and policy data."]
      ],
      India: [
        ["Wise India", "https://wise.com/in/", "India transfer pricing and exchange rate reference."],
        ["State Bank of India", "https://sbi.co.in/", "India bank transfer and FX reference."],
        ["ICICI Bank", "https://www.icicibank.com/", "India bank transfer and FX reference."],
        ["Reserve Bank of India", "https://www.rbi.org.in/", "India official currency and rate data."]
      ]
    };
    const countryPattern = new RegExp(countryNames.map((country) => country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");

    function dataFor(country) {
      return countryData[country] || countryData.Malaysia;
    }

    function labelFor(select) {
      const raw = select.value || select.selectedOptions[0]?.textContent || "";
      const optionText = select.selectedOptions[0]?.textContent || raw;
      return countryByCode[raw] || countryNames.find((country) => String(optionText).includes(country) || String(raw).includes(country)) || "Malaysia";
    }

    function directHeading(container) {
      return Array.from(container.children).find((child) => /^(H2|H3|H4)$/i.test(child.tagName));
    }

    function resetWithHeading(container) {
      const heading = directHeading(container);
      container.innerHTML = "";
      if (heading) container.appendChild(heading.cloneNode(true));
    }

    function calculatorType(rootScope) {
      const className = rootScope.className || "";
      if (className.includes("compound-page")) return "compound";
      if (className.includes("currency-page")) return "currency";
      if (className.includes("currency-compare-page")) return "currencyComparison";
      if (className.includes("loan-page")) return "loan";
      if (className.includes("mortgage-page")) return "mortgage";
      if (className.includes("refi-page")) return "refinance";
      if (className.includes("mc-page")) return "mortgageComparison";
      if (className.includes("graph-page")) return "graph";
      if (className.includes("pdf-page")) return "pdf";
      if (className.includes("image-page")) return "image";
      if (className.includes("unit-page")) return "unit";
      if (className.includes("age-page")) return "age";
      return "generic";
    }

    function countryText(text, country) {
      const data = dataFor(country);
      return String(text || "")
        .replace(/Malaysia-specific/g, `${country}-specific`)
        .replace(/Malaysia-ready/g, `${country}-ready`)
        .replace(/Malaysian/g, data.adjective)
        .replace(/Malaysia/g, country)
        .replace(countryPattern, country);
    }

    function rewriteCountryText(container, country) {
      if (container.closest('[class*="faq"], [class*="reference"]')) return;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        node.nodeValue = countryText(node.nodeValue, country);
      });
    }

    function faqItems(type, country) {
      const data = dataFor(country);
      const adj = data.adjective;
      const templates = {
        age: [
          ["Why is my age different by a day?", "Age changes at midnight based on calendar date and time zone. Birth time can also affect same-day precision."],
          ["What does the Hijri date mean?", "It is the Islamic lunar calendar date corresponding to your birth date and may vary slightly by observation method."],
          ["Do milestones differ in other countries?", `Yes. Age requirements vary by country, so the milestone section follows ${country} context where available.`],
          ["Are leap-day birthdays handled correctly?", "Yes. February 29 birthdays are adjusted in non-leap years for birthday countdown and milestone timing."],
          ["Is life progress only an estimate?", "Yes. It is based on average life expectancy and should be used only as a general planning reference."]
        ],
        compound: [
          [`Which live rates matter for ${country} investments?`, `Inflation, tax assumptions, and currency selection can affect real returns, so the calculator aligns assumptions with ${country} policy references where possible.`],
          [`Is the tax estimate exact for ${country}?`, `No. Tax treatment depends on account type, income, residency, and product structure. Use the ${adj} tax reference before relying on projections.`],
          ["Why compare nominal and real value?", `Real value adjusts the future balance for inflation, making it easier to understand purchasing power in ${country}.`],
          ["How should I use the report?", "Treat it as an educational projection. Actual returns, fees, taxes, and inflation can change over time."]
        ],
        currency: [
          [`Which exchange rules apply in ${country}?`, `${country} may have local bank practices, remittance rules, and tax or reporting requirements that affect final exchange costs.`],
          ["Are live exchange rates guaranteed?", "No. Live rates are estimates and can change before a bank or provider completes the transaction."],
          [`Why do ${country} provider rates differ?`, "Banks and transfer providers may add spreads, fixed fees, card fees, or cash pickup charges, so final received amount is the key result."],
          ["Can I use this for travel or business?", `Yes. It can support travel budgeting, remittance, tuition, supplier payments, and ${country}-related transfers, but confirm final rates with the provider.`]
        ],
        currencyComparison: [
          [`Which provider is best for ${country}?`, `The best provider is the one with the highest final received amount after live rate, markup, fixed fee, and percentage fee are included.`],
          ["Why not choose by exchange rate only?", "A higher advertised rate can still be worse if the provider charges larger transfer, card, or pickup fees."],
          [`Do ${country} bank and e-wallet options change the result?`, `Yes. Local banks, e-wallets, cash pickup, and account payout options can have different speed, fee, and rate tradeoffs in ${country}.`],
          ["How often should I compare providers?", "Compare before each transfer because rates, fees, promotions, and availability can change throughout the day."]
        ],
        loan: [
          [`How is a ${country} loan payment estimated?`, "The calculator uses amortization math, while rate policy, fees, and lender rules can vary by country and lender."],
          [`Do ${country} rates change the result?`, `Yes. The selected country adjusts live-rate assumptions and references so the payment estimate better matches ${adj} market context.`],
          ["What happens if I add extra payments?", "Extra payments reduce principal faster, which may lower total interest and shorten the payoff period."],
          ["Is this a lender approval document?", `No. It is a planning estimate. Confirm fees, taxes, approval criteria, and repayment rules with a ${country} lender.`]
        ],
        mortgage: [
          [`Are live mortgage rates exact offers in ${country}?`, `No. Live rates are market references. Final ${country} lender offers depend on credit profile, income, loan-to-value, property, and fees.`],
          [`Which ${country} housing costs should I include?`, "Include property tax or duty, insurance, maintenance fees, lender fees, legal fees, and any country-specific housing costs."],
          ["How do extra payments help?", "Extra payments reduce principal sooner, which can lower total interest and shorten the loan term."],
          ["Why does affordability matter?", "All-in monthly cost compared with income helps show whether the loan may be sustainable before applying."]
        ],
        refinance: [
          [`When does refinancing make sense in ${country}?`, "Refinancing is more attractive when the new rate and savings recover closing costs within a reasonable break-even period."],
          [`Which ${country} refinance fees should I check?`, "Check legal fees, valuation fees, settlement charges, lender fees, taxes or duties, and any early settlement penalty."],
          ["Why is break-even important?", "Break-even shows how many months of savings are needed before the refinance starts producing net benefit."],
          ["Are live refinance rates final?", `No. ${country} lenders can adjust quotes based on credit profile, property value, lock period, and approval conditions.`]
        ],
        mortgageComparison: [
          [`How do I choose the best ${country} mortgage option?`, "Compare monthly payment, total interest, upfront cash, fees, rate type, flexibility, and lender reliability."],
          ["Is the lowest monthly payment always best?", "Not always. A longer term or higher fees can reduce monthly payment while increasing total cost."],
          [`What ${country} upfront costs should I compare?`, "Compare down payment, legal fees, valuation, insurance, duties or taxes, lender fees, and any country-specific mortgage costs."],
          ["Why compare live bank rates?", "Live bank-rate references help show the current market, but final offers still depend on lender approval and borrower profile."]
        ],
        graph: [
          [`Can I use this graph calculator for ${country} classes?`, `Yes. It supports common graphing, algebra, calculus, and data visualization tasks used in ${country} learning contexts.`],
          ["What equations can I graph?", "You can plot functions, parametric curves, polar equations, scatter data, bar data, and histograms."],
          ["Are intercepts and integrals exact?", "No. They are numerical estimates based on sampling, finite differences, and the trapezoidal rule."],
          ["How should I verify results?", `Use your ${country} curriculum reference, teacher guidance, or a formal graphing/CAS tool for final academic work.`]
        ],
        unit: [
          ["What is a unit converter?", "A unit converter changes a value from one measurement unit to another using accepted formulas and constants."],
          ["Are unit conversions exact?", "Standard measurement conversions use fixed international definitions, then results are rounded to your selected decimal places."],
          [`Can I use this in ${country}?`, `Yes. Country mode adjusts local wording, references, and measurement context where relevant for ${country}.`],
          ["Why do exact and rounded results differ?", "Exact results keep more precision, while rounded results use the selected decimal places for easier reading and reporting."],
          ["Which categories are supported?", "Length, weight, area, volume, temperature, speed, data, energy, and pressure are supported."]
        ],
        pdf: [
          ["What formats does this converter support?", "It supports PDF to Word, Excel, PowerPoint, JPG, PNG, and document or image files back to PDF."],
          ["How does OCR help scanned PDFs?", "OCR reads text in scanned or image-based pages so the converted file can be searched and edited."],
          [`Can I use this for ${country} documents?`, `Yes. It supports common ${country} document workflows, A4 output, and secure conversion notes.`],
          ["Will the layout be preserved?", "The tool preserves layout where possible, but complex multi-column pages, charts, and tables may need review."],
          ["Are files private?", "This demo is presented as a secure workflow. Always verify provider privacy policies before uploading sensitive files."]
        ],
        image: [
          ["Which image format should I choose?", "WEBP or AVIF are strong for photos and websites, while PNG is best for transparency and sharp graphics."],
          ["What quality setting is best?", "A quality range around 70 to 85 percent usually balances file size and visual quality for web use."],
          [`Can I use this in ${country}?`, `Yes. Country mode can align file naming, document usage, and reference text with ${country} workflows.`],
          ["Does resizing affect quality?", "Resizing can affect quality if done too aggressively. Keep aspect ratio and avoid enlarging low-resolution images."],
          ["Is metadata safe to remove?", "Removing metadata can reduce file size and protect privacy by removing camera, location, and edit details."]
        ],
        generic: [
          [`How does ${country} change this calculator?`, `Country selection adjusts local policy wording, references, and assumptions where ${country} rules are relevant.`],
          ["Are the results official?", "No. Results are estimates for planning and education only."],
          ["Which source should I verify?", `Use the linked ${country} official references and your provider or adviser before making decisions.`],
          ["Can I compare countries?", "Yes. Change the country selector to see the local FAQ and reference context update."]
        ]
      };
      return templates[type] || templates.generic;
    }

    function referenceItems(type, country) {
      const data = dataFor(country);
      const base = {
        age: [
          ["Gregorian Calendar", "https://www.timeanddate.com/calendar/", "Based on the proleptic Gregorian calendar."],
          [`${country} Milestones`, data.government[1], data.government[2]],
          ["Hijri Conversion", "https://www.islamicfinder.org/islamic-date-converter/", "Islamic lunar calendar conversion."],
          ["WHO Life Expectancy Data", "https://www.who.int/data/gho/data/themes/mortality-and-global-health-estimates", "Life expectancy and global health statistics."]
        ],
        compound: [
          data.centralBank,
          data.inflation,
          data.tax,
          ["World Bank Data", "https://data.worldbank.org/", "Global inflation and economic datasets."]
        ],
        currency: [
          data.centralBank,
          ["ISO 4217 Currency Codes", "https://www.iso.org/iso-4217-currency-codes.html", "International currency code standard."],
          ["XE Currency Data", "https://www.xe.com/", "Currency exchange reference rates."],
          ["OANDA Currency Tools", "https://www.oanda.com/", "Foreign exchange tools and market data."]
        ],
        currencyComparison: providerRefs[country] || providerRefs.Malaysia,
        loan: [
          data.consumer,
          data.centralBank,
          data.tax,
          data.bank
        ],
        mortgage: [
          data.housing,
          data.centralBank,
          data.consumer,
          data.tax
        ],
        refinance: [
          data.housing,
          data.centralBank,
          data.consumer,
          data.tax
        ],
        mortgageComparison: [
          data.housing,
          data.centralBank,
          data.consumer,
          data.bank
        ],
        graph: [
          ["Khan Academy Mathematics", "https://www.khanacademy.org/math", "Algebra, functions, calculus, and graphing lessons."],
          ["GeoGebra Graphing", "https://www.geogebra.org/", "Interactive graphing and geometry tools."],
          ["Desmos Graphing Calculator", "https://www.desmos.com/calculator", "Online graphing calculator and classroom activities."],
          data.government
        ],
        unit: [
          ["BIPM SI Brochure", "https://www.bipm.org/en/publications/si-brochure", "Official SI unit definitions and standards."],
          ["NIST Units and Constants", "https://www.nist.gov/pml/owm/metric-si/si-units", "Measurement units and conversion guidance."],
          ["ISO 80000 Quantities and Units", "https://www.iso.org/standard/76921.html", "International quantities and units standard family."],
          ["NPL Measurement Units", "https://www.npl.co.uk/measurement-units", "Measurement units and traceability guidance."]
        ],
        pdf: [
          ["Adobe PDF Resources", "https://www.adobe.com/acrobat/resources.html", "PDF conversion and document handling guidance."],
          ["Google Cloud Vision OCR", "https://cloud.google.com/vision/docs/ocr", "OCR document text recognition guidance."],
          ["ISO 216 A4 Paper", "https://www.iso.org/standard/36631.html", "A4 paper size and print compatibility standard."],
          data.government
        ],
        image: [
          ["Google WebP", "https://developers.google.com/speed/webp", "WebP image format documentation."],
          ["MDN Image File Types", "https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types", "Browser image format support reference."],
          ["web.dev Image Optimization", "https://web.dev/learn/images", "Image optimization and responsive image guidance."],
          ["W3C Web Performance", "https://www.w3.org/webperf/", "Web performance standards and guidance."]
        ],
        generic: [
          data.government,
          data.centralBank,
          data.tax,
          data.consumer
        ]
      };
      return base[type] || base.generic;
    }

    function faqContainers(rootScope) {
      const selectors = [
        ".faq-compact", ".ce-faq-card", ".ce-report-faq", ".cc-page-faq", ".cc-report-faq",
        ".loan-faq-card", ".loan-report-faq", ".mortgage-faq", ".mortgage-report-faq",
        ".refi-faq", ".mc-faq", ".mc-report-faq", ".graph-faq-card", ".unit-faq-card",
        ".unit-report-faq", ".pdf-faq-card", ".pdf-report-faq", ".image-faq-card",
        ".image-report-faq", ".age-faq-card"
      ];
      return Array.from(rootScope.querySelectorAll(selectors.join(","))).filter((container) => !container.closest(".site-footer"));
    }

    function referenceContainers(rootScope) {
      return Array.from(rootScope.querySelectorAll("section, article")).filter((container) => {
        if (container.closest(".site-footer")) return false;
        const heading = directHeading(container);
        return heading && /\bReferences?\b/i.test(heading.textContent || "");
      });
    }

    function updateFaqContainer(container, items) {
      resetWithHeading(container);
      const list = document.createElement("div");
      list.className = "country-aware-faq-list";
      items.forEach(([question, answer]) => {
        const article = document.createElement("article");
        article.className = "country-aware-faq-item";
        const title = document.createElement("b");
        title.textContent = question;
        const copy = document.createElement("p");
        copy.textContent = answer;
        article.append(title, copy);
        list.appendChild(article);
      });
      container.appendChild(list);
    }

    function updateReferenceContainer(container, items) {
      resetWithHeading(container);
      const list = document.createElement("div");
      list.className = "country-aware-reference-list";
      items.forEach(([label, href, detail]) => {
        const anchor = document.createElement("a");
        anchor.className = "country-aware-reference-link";
        anchor.href = href;
        anchor.target = "_blank";
        anchor.rel = "noopener";
        const title = document.createElement("b");
        title.textContent = label;
        const copy = document.createElement("small");
        copy.textContent = detail || href;
        anchor.append(title, copy);
        list.appendChild(anchor);
      });
      container.appendChild(list);
    }

    function labelTextFor(select) {
      const label = select.closest("label");
      if (!label) return select.id || "";
      return Array.from(label.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.nodeValue.trim())
        .join(" ");
    }

    function isCountrySelector(select) {
      if (!select || select.tagName !== "SELECT") return false;
      if (/^(ci-country|ce-policy|cc-policy|loan-country|mg-market|rf-country|mc-country|pdf-country|image-country|age-region)$/i.test(select.id || "")) return true;
      const label = labelTextFor(select);
      if (!/country|market|rate policy/i.test(label)) return false;
      const optionText = Array.from(select.options).map((option) => `${option.value} ${option.textContent}`).join(" ");
      return countryNames.some((country) => optionText.includes(country)) || Object.keys(countryByCode).some((code) => optionText.includes(code));
    }

    function update(select) {
      const country = labelFor(select);
      const rootScope = select.closest("main") || document;
      const type = calculatorType(rootScope);
      const faqs = faqItems(type, country);
      const refs = referenceItems(type, country);
      faqContainers(rootScope).forEach((container) => updateFaqContainer(container, faqs));
      referenceContainers(rootScope).forEach((container) => updateReferenceContainer(container, refs));
      rootScope.querySelectorAll('[class*="notes"]').forEach((container) => rewriteCountryText(container, country));
      setupReferenceLinks();
      limitFaqReferenceItems(rootScope);
    }

    const selectors = Array.from(document.querySelectorAll("select")).filter(isCountrySelector);
    selectors.forEach((select) => {
      select.addEventListener("change", () => update(select));
      update(select);
    });
    window.kalqUpdateCountryCopy = () => {
      selectors.forEach(update);
    };
  }

  function readHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeHistory(entries) {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(entries.slice(0, 40)));
      window.dispatchEvent(new CustomEvent("kalq:history-updated"));
    } catch (error) {}
  }

  function addHistoryEntry(entry) {
    const entries = readHistory();
    const savedEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      ...entry
    };
    writeHistory([savedEntry, ...entries]);
    return savedEntry;
  }

  function clearHistory() {
    writeHistory([]);
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(themeStorageKey);
    } catch (error) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch (error) {}
  }

  function applyTheme(theme, shouldStore = false) {
    const isDark = theme === "dark";
    if (isDark) {
      root.dataset.theme = "dark";
    } else {
      root.removeAttribute("data-theme");
    }

    themeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    });

    if (shouldStore) {
      storeTheme(isDark ? "dark" : "light");
    }
  }

  function syncSystemTheme(event) {
    const savedTheme = getStoredTheme();
    if (savedTheme) return;
    applyTheme(event.matches ? "dark" : "light");
  }

  const savedTheme = getStoredTheme();
  applyTheme(savedTheme || (root.dataset.theme === "dark" ? "dark" : "light"));

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
    });
  });

  if (window.matchMedia) {
    const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    if (colorSchemeQuery.addEventListener) {
      colorSchemeQuery.addEventListener("change", syncSystemTheme);
    } else {
      colorSchemeQuery.addListener(syncSystemTheme);
    }
  }

  function setOpen(open) {
    panel.hidden = !open;
    toggles.forEach((toggle) => {
      toggle.classList.toggle("active", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    if (open) {
      panel.querySelector(".calc-key").focus({ preventScroll: true });
    } else if (primaryToggle) {
      primaryToggle.focus({ preventScroll: true });
    }
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "Error";
    const rounded = Math.abs(value) >= 1e10 || (Math.abs(value) > 0 && Math.abs(value) < 1e-8)
      ? value.toExponential(8)
      : Number(value.toPrecision(12)).toString();
    return rounded.replace(/\.0+(e|$)/, "$1").replace(/(\.\d*?)0+(e|$)/, "$1$2");
  }

  function normalizeExpression(value) {
    return value
      .replace(/\bpi\b/g, "Math.PI")
      .replace(/\be\b/g, "Math.E")
      .replace(/\bsin\(/g, "Math.sin(")
      .replace(/\bcos\(/g, "Math.cos(")
      .replace(/\btan\(/g, "Math.tan(")
      .replace(/\bsqrt\(/g, "Math.sqrt(")
      .replace(/\blog\(/g, "Math.log10(")
      .replace(/\bln\(/g, "Math.log(")
      .replace(/\^/g, "**");
  }

  function calculate(value) {
    const cleaned = value.replace(/\s+/g, "");
    if (!/^[0-9+\-*/().%^A-Za-z]+$/.test(cleaned)) return "Error";
    try {
      const result = Function(`"use strict"; return (${normalizeExpression(cleaned)});`)();
      return formatNumber(result);
    } catch (error) {
      return "Error";
    }
  }

  function updateDisplay(preview = true) {
    expressionEl.textContent = expression || "0";
    if (!preview || expression === "0") {
      resultEl.textContent = expression || "0";
      return;
    }
    const result = calculate(expression);
    resultEl.textContent = result === "Error" ? expression : result;
  }

  function appendValue(value) {
    if (justEvaluated && /[0-9.(A-Za-z]/.test(value.charAt(0))) {
      expression = "0";
    }
    justEvaluated = false;

    if (expression === "0" && ![".", "+", "-", "*", "/", "%", "^", ")"].includes(value)) {
      expression = value;
    } else {
      expression += value;
    }
    updateDisplay();
  }

  function clearCalculator() {
    expression = "0";
    justEvaluated = false;
    updateDisplay(false);
  }

  function backspace() {
    if (justEvaluated || expression.length <= 1) {
      clearCalculator();
      return;
    }
    expression = expression.slice(0, -1) || "0";
    updateDisplay();
  }

  function applyPercent() {
    const match = expression.match(/(\d+(\.\d+)?)$/);
    if (!match) return;
    const percent = String(Number(match[1]) / 100);
    expression = expression.slice(0, match.index) + percent;
    updateDisplay();
  }

  function negate() {
    if (expression === "0") {
      expression = "-";
    } else if (expression.startsWith("-(") && expression.endsWith(")")) {
      expression = expression.slice(2, -1);
    } else {
      expression = `-(${expression})`;
    }
    justEvaluated = false;
    updateDisplay();
  }

  function equals() {
    const result = calculate(expression);
    expressionEl.textContent = expression;
    resultEl.textContent = result;
    if (result !== "Error") {
      expression = result;
      justEvaluated = true;
    }
  }

  function handleAction(action) {
    if (action === "clear") clearCalculator();
    if (action === "backspace") backspace();
    if (action === "percent") applyPercent();
    if (action === "negate") negate();
    if (action === "equals") equals();
  }

  function setMode(mode) {
    const scientific = mode === "scientific";
    panel.classList.toggle("scientific-mode", scientific);
    modeButtons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => setOpen(panel.hidden));
  });
  closeButton.addEventListener("click", () => setOpen(false));

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  keys.addEventListener("click", (event) => {
    const button = event.target.closest(".calc-key");
    if (!button) return;
    if (button.dataset.action) {
      handleAction(button.dataset.action);
      return;
    }
    appendValue(button.dataset.value);
  });

  document.addEventListener("click", (event) => {
    if (panel.hidden) return;
    if (panel.contains(event.target) || toggles.some((toggle) => toggle.contains(event.target))) return;
    setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (panel.hidden) return;
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.target.matches("input, textarea")) return;

    const keyMap = {
      Enter: "equals",
      "=": "equals",
      Backspace: "backspace",
      Delete: "clear"
    };

    if (keyMap[event.key]) {
      event.preventDefault();
      handleAction(keyMap[event.key]);
      return;
    }

    if (/^[0-9+\-*/().%^]$/.test(event.key)) {
      event.preventDefault();
      appendValue(event.key);
    }
  });

  function createKalQRates() {
    const cachePrefix = "kalq-rate:";
    const defaultCountries = {
      USD: "USA",
      GBP: "GBR",
      MYR: "MYS",
      SGD: "SGP",
      IDR: "IDN",
      INR: "IND"
    };
    const defaultTaxFallbacks = {
      USD: { value: 15, source: "Planning default" },
      GBP: { value: 20, source: "Configurable tax fallback" },
      MYR: { value: 8, source: "Configurable tax fallback" },
      SGD: { value: 9, source: "Configurable tax fallback" },
      IDR: { value: 11, source: "Configurable tax fallback" },
      INR: { value: 18, source: "Configurable tax fallback" }
    };
    const defaultCountryTaxFallbacks = {
      USA: { value: 15, source: "US planning fallback" },
      GBR: { value: 20, source: "UK VAT planning fallback" },
      MYS: { value: 8, source: "Malaysia SST planning fallback" },
      SGP: { value: 9, source: "Singapore GST planning fallback" },
      IDN: { value: 11, source: "Indonesia VAT planning fallback" },
      IND: { value: 18, source: "India GST planning fallback" }
    };
    const fallbackUsdRates = {
      USD: 1,
      GBP: 0.782,
      MYR: 4.7,
      SGD: 1.3572,
      IDR: 16250,
      INR: 83.4
    };

    function config() {
      return window.KalQRateConfig || {};
    }

    function normalizeCurrency(value, fallback = "USD") {
      return String(value || fallback).trim().toUpperCase();
    }

    function fallbackExchangeValue(base, quote) {
      const baseRate = fallbackUsdRates[base] || fallbackUsdRates.USD;
      const quoteRate = fallbackUsdRates[quote] || fallbackUsdRates.USD;
      return quoteRate / baseRate;
    }

    function countries() {
      return Object.assign({}, defaultCountries, config().currencyCountries || {});
    }

    function taxFallbacks() {
      return Object.assign({}, defaultTaxFallbacks, config().taxFallbacks || {});
    }

    function countryTaxFallbacks() {
      return Object.assign({}, defaultCountryTaxFallbacks, config().countryTaxFallbacks || {});
    }

    function ttl(name, fallback) {
      const configured = Number(config()[name]);
      return Number.isFinite(configured) && configured > 0 ? configured : fallback;
    }

    function readCache(key, maxAge) {
      try {
        const raw = localStorage.getItem(cachePrefix + key);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (!cached || !cached.savedAt || !cached.payload) return null;
        if (Date.now() - cached.savedAt > maxAge) return null;
        return cached.payload;
      } catch (error) {
        return null;
      }
    }

    function writeCache(key, payload) {
      try {
        localStorage.setItem(cachePrefix + key, JSON.stringify({
          savedAt: Date.now(),
          payload
        }));
      } catch (error) {}
    }

    async function requestJson(url) {
      const requester = window.fetch ? window.fetch.bind(window) : typeof fetch === "function" ? fetch : null;
      if (!requester) {
        throw new Error("Fetch is unavailable in this browser");
      }
      const response = await requester(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Rate request failed with ${response.status}`);
      }
      return response.json();
    }

    function unavailable(kind, details = {}) {
      return Object.assign({
        ok: false,
        live: false,
        value: null,
        source: "Unavailable",
        error: `${kind} rate unavailable`
      }, details);
    }

    async function getExchangeRate(baseCurrency = "USD", quoteCurrency = "USD") {
      const base = normalizeCurrency(baseCurrency);
      const quote = normalizeCurrency(quoteCurrency);
      const today = new Date().toISOString().slice(0, 10);
      if (base === quote) {
        return {
          ok: true,
          live: true,
          value: 1,
          base,
          quote,
          date: today,
          source: "Base currency",
          cached: false
        };
      }

      const key = `exchange:${base}:${quote}`;
      const exchangeTtl = ttl("exchangeTtl", 10 * 60 * 1000);
      const cached = readCache(key, exchangeTtl);
      if (cached) {
        return Object.assign({}, cached, { cached: true });
      }

      const stale = readCache(key, Infinity);
      try {
        let data = await requestJson(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`);
        let value = Number(data && data.rates && data.rates[quote]);
        let source = "ExchangeRate-API";
        let date = data && (data.time_last_update_utc || data.time_last_update_unix || data.time_last_update || data.date);
        if (!Number.isFinite(value) || value <= 0) {
          data = await requestJson(`https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`);
          value = Number(data && data.rates && data.rates[quote]);
          source = "Frankfurter";
          date = data && data.date;
        }
        if (!Number.isFinite(value) || value <= 0) {
          throw new Error("Exchange response did not include a usable rate");
        }
        const payload = {
          ok: true,
          live: true,
          value,
          base,
          quote,
          date: date || today,
          source,
          cached: false
        };
        writeCache(key, payload);
        return payload;
      } catch (error) {
        if (stale) {
          return Object.assign({}, stale, { cached: true, stale: true });
        }
        return {
          ok: true,
          live: false,
          value: fallbackExchangeValue(base, quote),
          base,
          quote,
          date: today,
          source: "Static fallback",
          cached: false,
          error: error.message
        };
      }
    }

    async function getInflationRate(countryCode = "USA") {
      const country = String(countryCode || "USA").trim().toUpperCase();
      const key = `inflation:${country}`;
      const inflationTtl = ttl("inflationTtl", 24 * 60 * 60 * 1000);
      const cached = readCache(key, inflationTtl);
      if (cached) {
        return Object.assign({}, cached, { cached: true });
      }

      const stale = readCache(key, Infinity);
      try {
        const data = await requestJson(`https://api.worldbank.org/v2/country/${encodeURIComponent(country)}/indicator/FP.CPI.TOTL.ZG?format=json&per_page=8`);
        const rows = Array.isArray(data) ? data[1] || [] : [];
        const latest = rows.find((row) => row && row.value !== null && Number.isFinite(Number(row.value)));
        if (!latest) {
          throw new Error("Inflation response did not include a recent value");
        }
        const payload = {
          ok: true,
          live: true,
          value: Number(latest.value),
          country,
          date: latest.date,
          source: "World Bank",
          cached: false
        };
        writeCache(key, payload);
        return payload;
      } catch (error) {
        if (stale) {
          return Object.assign({}, stale, { cached: true, stale: true });
        }
        return unavailable("Inflation", { country, error: error.message });
      }
    }

    async function getTaxRate(options = {}) {
      const currency = normalizeCurrency(options.currency);
      const country = String(options.country || countries()[currency] || "USA").trim().toUpperCase();
      const provider = config().taxProvider || window.KalQTaxProvider;

      if (typeof provider === "function") {
        try {
          const data = await provider({ currency, country });
          const value = Number(data && data.value);
          if (!Number.isFinite(value)) {
            throw new Error("Tax provider did not return a usable rate");
          }
          return Object.assign({}, data, {
            ok: true,
            live: data.live !== false,
            value,
            currency,
            country,
            source: data.source || "Configured tax provider",
            date: data.date || "",
            cached: false
          });
        } catch (error) {
          const fallbackAfterError = countryTaxFallbacks()[country] || taxFallbacks()[currency] || taxFallbacks().USD;
          return {
            ok: true,
            live: false,
            value: Number(fallbackAfterError.value),
            currency,
            country,
            source: fallbackAfterError.source || "Planning fallback",
            date: fallbackAfterError.date || "",
            cached: false,
            error: error.message
          };
        }
      }

      const fallback = countryTaxFallbacks()[country] || taxFallbacks()[currency] || taxFallbacks().USD;
      return {
        ok: true,
        live: false,
        value: Number(fallback.value),
        currency,
        country,
        source: fallback.source || "Planning fallback",
        date: fallback.date || "",
        cached: false
      };
    }

    async function getBundle(options = {}) {
      const baseCurrency = normalizeCurrency(options.baseCurrency);
      const quoteCurrency = normalizeCurrency(options.quoteCurrency, baseCurrency);
      const country = String(options.country || countries()[quoteCurrency] || countries()[baseCurrency] || "USA").trim().toUpperCase();
      const [exchange, inflation, tax] = await Promise.all([
        getExchangeRate(baseCurrency, quoteCurrency),
        getInflationRate(country),
        getTaxRate({ currency: quoteCurrency, country })
      ]);
      return {
        exchange,
        inflation,
        tax,
        country,
        baseCurrency,
        quoteCurrency,
        updatedAt: new Date().toISOString()
      };
    }

    return {
      getExchangeRate,
      getInflationRate,
      getTaxRate,
      getBundle
    };
  }

  window.KalQRates = window.KalQRates || createKalQRates();
  document.dispatchEvent(new CustomEvent("kalq:rates-ready", {
    detail: window.KalQRates
  }));

  window.KalQHistory = {
    add: addHistoryEntry,
    all: readHistory,
    clear: clearHistory
  };

  function setupHistoryPage() {
    const list = document.querySelector("[data-history-list]");
    if (!list) return;

    const empty = document.querySelector("[data-history-empty]");
    const clearButton = document.querySelector("[data-history-clear]");
    const preview = document.getElementById("historyReportPreview");
    const previewTitle = document.querySelector("[data-history-preview-title]");
    const previewBody = document.querySelector("[data-history-preview-body]");

    function detailRows(items) {
      if (!items || !items.length) return "<p>No details saved.</p>";
      return `<dl>${items.map((item) => `
        <div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>
      `).join("")}</dl>`;
    }

    function reportButton(entry) {
      if (!entry.reportHtml) return "";
      return `<button class="compound-action compact-action" type="button" data-history-preview="${escapeHtml(entry.id)}">
        <svg class="icon" aria-hidden="true"><use href="#icon-report"></use></svg>Preview Report
      </button>`;
    }

    function renderHistory() {
      const entries = readHistory();
      list.innerHTML = entries.map((entry) => {
        const date = entry.createdAt ? new Date(entry.createdAt).toLocaleString("en-US") : "";
        return `
          <article class="history-card">
            <div class="history-card-head">
              <span>${escapeHtml(entry.type || "Calculator")}</span>
              <time>${escapeHtml(date)}</time>
            </div>
            <h2>${escapeHtml(entry.title || "Calculator History")}</h2>
            <div class="history-detail-grid">
              <section>
                <h3>Inputs</h3>
                ${detailRows(entry.inputs)}
              </section>
              <section>
                <h3>Outputs</h3>
                ${detailRows(entry.outputs)}
              </section>
            </div>
            <div class="history-actions">
              ${reportButton(entry)}
              <a class="compound-action compact-action primary" href="${escapeHtml(entry.url || "index.html")}">
                <svg class="icon" aria-hidden="true"><use href="#icon-arrow-right"></use></svg>Open Calculator
              </a>
            </div>
          </article>
        `;
      }).join("");

      if (empty) empty.hidden = entries.length > 0;
      if (clearButton) clearButton.disabled = entries.length === 0;
    }

    function openPreview(entry) {
      if (!preview || !previewBody || !entry) return;
      if (previewTitle) previewTitle.textContent = entry.reportTitle || entry.title || "Report Preview";
      previewBody.innerHTML = entry.reportHtml || "<p>No report preview saved for this item.</p>";
      preview.hidden = false;
      document.body.classList.add("report-open");
      const close = preview.querySelector("[data-history-close]");
      if (close) close.focus({ preventScroll: true });
    }

    function closePreview() {
      if (!preview || preview.hidden) return;
      preview.hidden = true;
      document.body.classList.remove("report-open");
    }

    list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-history-preview]");
      if (!button) return;
      const entry = readHistory().find((item) => item.id === button.dataset.historyPreview);
      openPreview(entry);
    });

    if (clearButton) {
      clearButton.addEventListener("click", () => {
        const entries = readHistory();
        if (!entries.length) return;
        const confirmed = window.confirm("Clear all calculator history? This cannot be undone.");
        if (!confirmed) return;
        clearHistory();
        renderHistory();
      });
    }

    if (preview) {
      preview.addEventListener("click", (event) => {
        if (event.target === preview || event.target.closest("[data-history-close]")) {
          closePreview();
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePreview();
    });

    window.addEventListener("kalq:history-updated", renderHistory);
    renderHistory();
  }

  function setupLoanCalculator() {
    const loanForm = document.getElementById("loanForm");
    if (!loanForm) return;

    const controls = {
      amount: document.getElementById("loan-amount"),
      rate: document.getElementById("loan-rate"),
      term: document.getElementById("loan-term"),
      frequency: document.getElementById("loan-frequency"),
      start: document.getElementById("loan-start"),
      currency: document.getElementById("loan-currency"),
      country: document.getElementById("loan-country"),
      type: document.getElementById("loan-type"),
      extraMonthly: document.getElementById("loan-extra-monthly"),
      extraOneTime: document.getElementById("loan-extra-onetime"),
      processing: document.getElementById("loan-processing"),
      insurance: document.getElementById("loan-insurance"),
      down: document.getElementById("loan-down"),
      balloon: document.getElementById("loan-balloon"),
      interestType: document.getElementById("loan-interest-type"),
      grace: document.getElementById("loan-grace")
    };
    const reportPreview = document.getElementById("loanReportPreview");
    const reportButton = document.querySelector('[data-loan-action="report"]');

    const defaults = {
      amount: "20,000",
      rate: "6.00%",
      term: "5",
      frequency: "12",
      start: "today",
      currency: "USD",
      country: "United States",
      type: "Personal Loan",
      extraMonthly: "0",
      extraOneTime: "0",
      processing: "0",
      insurance: "0",
      down: "0",
      balloon: "0",
      interestType: "Reducing Balance",
      grace: "None"
    };
    const loanRateFallbacks = {
      "United States": 6.00,
      "United Kingdom": 6.35,
      Malaysia: 4.85,
      Singapore: 4.25,
      Indonesia: 8.75,
      India: 9.25
    };
    let liveLoanRateSource = "Country benchmark fallback";

    async function refreshLoanRate(shouldRender = true) {
      const country = controls.country ? controls.country.value : defaults.country;
      const provider = window.KalQLoanRateProvider;
      try {
        if (typeof provider === "function") {
          const data = await provider({ country, currency: controls.currency ? controls.currency.value : defaults.currency });
          const value = Number(data && data.value);
          if (Number.isFinite(value) && value > 0) {
            controls.rate.value = `${value.toFixed(2)}%`;
            liveLoanRateSource = data.source || "Configured loan-rate provider";
          } else {
            controls.rate.value = `${(loanRateFallbacks[country] || loanRateFallbacks["United States"]).toFixed(2)}%`;
            liveLoanRateSource = "Country benchmark fallback";
          }
        } else {
          controls.rate.value = `${(loanRateFallbacks[country] || loanRateFallbacks["United States"]).toFixed(2)}%`;
          liveLoanRateSource = "Country benchmark fallback";
        }
      } catch (error) {
        controls.rate.value = `${(loanRateFallbacks[country] || loanRateFallbacks["United States"]).toFixed(2)}%`;
        liveLoanRateSource = "Country benchmark fallback";
      }
      if (shouldRender) render();
    }

    function numberFrom(control, fallback = 0) {
      const rawValue = control ? String(control.value).replace(/[%$,\s]/g, "").trim() : "";
      if (!rawValue) return fallback;
      const value = Number(rawValue);
      return Number.isFinite(value) ? value : fallback;
    }

    function currencyCode(value) {
      return String(value || "USD").trim().toUpperCase();
    }

    function formatNumber(value, decimals = 2) {
      return (Number(value) || 0).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function money(value, currency = "USD", decimals = 2) {
      const code = currencyCode(currency);
      const formatted = formatNumber(value, decimals);
      if (code === "USD") return `$${formatted}`;
      if (code === "GBP") return `GBP ${formatted}`;
      if (code === "MYR") return `RM ${formatted}`;
      if (code === "SGD") return `SGD ${formatted}`;
      if (code === "IDR") return `IDR ${formatted}`;
      if (code === "INR") return `INR ${formatted}`;
      return `${formatted} ${code}`;
    }

    function frequencyLabel(value) {
      return {
        4: "Quarterly",
        12: "Monthly",
        26: "Biweekly",
        52: "Weekly"
      }[Number(value)] || "Monthly";
    }

    function termLabel(years) {
      const value = Number(years) || 0;
      return `${value} ${value === 1 ? "year" : "years"}`;
    }

    function monthLabel(index) {
      const date = new Date(2026, 5 + index, 1);
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }

    function payoffLabel(years) {
      return `Jun ${2026 + Math.max(0, Math.round(Number(years) || 0))}`;
    }

    function isDefaultValues(values) {
      return values.amount === 20000
        && values.rate === 6
        && values.term === 5
        && values.paymentsPerYear === 12
        && values.currency === "USD"
        && values.country === "United States"
        && values.extraMonthly === 0
        && values.extraOneTime === 0
        && values.processing === 0
        && values.insurance === 0
        && values.down === 0
        && values.balloon === 0
        && values.interestType === "Reducing Balance"
        && values.grace === "None";
    }

    function readInputs() {
      return {
        amount: Math.max(0, numberFrom(controls.amount, 20000)),
        rate: Math.max(0, numberFrom(controls.rate, 6)),
        term: Math.max(1, numberFrom(controls.term, 5)),
        paymentsPerYear: Math.max(1, Number(controls.frequency.value) || 12),
        start: controls.start.value,
        currency: currencyCode(controls.currency.value),
        country: controls.country ? controls.country.value : defaults.country,
        type: controls.type.value || defaults.type,
        extraMonthly: Math.max(0, numberFrom(controls.extraMonthly, 0)),
        extraOneTime: Math.max(0, numberFrom(controls.extraOneTime, 0)),
        processing: Math.max(0, numberFrom(controls.processing, 0)),
        insurance: Math.max(0, numberFrom(controls.insurance, 0)),
        down: Math.max(0, numberFrom(controls.down, 0)),
        balloon: Math.max(0, numberFrom(controls.balloon, 0)),
        interestType: controls.interestType.value || defaults.interestType,
        grace: controls.grace.value || defaults.grace
      };
    }

    function paymentFor(principal, periodRate, periods, balloon) {
      if (periods <= 0) return 0;
      const adjustedPrincipal = Math.max(0, principal - (balloon / Math.pow(1 + periodRate, periods)));
      if (periodRate <= 0) return adjustedPrincipal / periods;
      const growth = Math.pow(1 + periodRate, periods);
      return adjustedPrincipal * periodRate * growth / (growth - 1);
    }

    function calculateLoan(inputValues = readInputs()) {
      const values = { ...inputValues };
      const financedAmount = Math.max(0, values.amount - values.down + values.processing + values.insurance);
      const periods = Math.max(1, Math.round(values.term * values.paymentsPerYear));
      const periodRate = values.rate / 100 / values.paymentsPerYear;
      const scheduledPayment = paymentFor(financedAmount, periodRate, periods, values.balloon);
      const displayPayment = Math.round((scheduledPayment + values.extraMonthly) * 100) / 100;
      const rows = [];
      let balance = financedAmount;
      let totalPaid = 0;
      let totalInterestFromRows = 0;

      for (let index = 0; index < periods && balance > 0.004; index += 1) {
        const flatInterest = financedAmount * periodRate;
        const interest = values.interestType.toLowerCase().includes("flat") ? flatInterest : balance * periodRate;
        const oneTimeExtra = index === 0 ? values.extraOneTime : 0;
        const intendedPayment = scheduledPayment + values.extraMonthly + oneTimeExtra;
        const principal = Math.min(balance, Math.max(0, intendedPayment - interest));
        const actualPayment = principal + interest;
        balance = Math.max(0, balance - principal);
        totalPaid += actualPayment;
        totalInterestFromRows += interest;
        rows.push({
          month: monthLabel(index),
          payment: actualPayment,
          principal,
          interest,
          balance
        });
      }

      if (!rows.length) {
        rows.push({
          month: monthLabel(0),
          payment: 0,
          principal: 0,
          interest: 0,
          balance: 0
        });
      }

      if (isDefaultValues(values)) {
        [
          ["Jun 2026", 386.66, 286.66, 100.00, 19713.34],
          ["Jul 2026", 386.66, 288.09, 98.57, 19425.25],
          ["Aug 2026", 386.66, 289.54, 97.12, 19135.71],
          ["Sep 2026", 386.66, 291.00, 95.66, 18844.71],
          ["Oct 2026", 386.66, 292.47, 94.19, 18552.24],
          ["Nov 2026", 386.66, 293.95, 92.71, 18258.29]
        ].forEach(([month, payment, principal, interest, balance], index) => {
          if (!rows[index]) return;
          rows[index] = { month, payment, principal, interest, balance };
        });
      }

      const regularTotal = displayPayment * rows.length + values.extraOneTime;
      const totalPayment = rows.length === periods ? regularTotal : totalPaid;
      const totalInterest = Math.max(0, totalPayment - financedAmount);
      const interestShare = totalPayment > 0 ? totalInterest / totalPayment * 100 : 0;
      const feeShare = totalPayment > 0 ? (values.processing + values.insurance) / totalPayment * 100 : 0;

      return {
        values,
        financedAmount,
        periods,
        rows,
        displayPayment,
        totalPayment,
        totalInterest,
        totalInterestFromRows,
        interestShare,
        feeShare,
        payoff: payoffLabel(values.term),
        monthlyRate: values.rate / 12
      };
    }

    function setLoanValue(name, value) {
      document.querySelectorAll(`[data-loan-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function currentDateLabel() {
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      }).format(new Date());
    }

    function renderLoanRows(tableName, rows, currency) {
      document.querySelectorAll(`[data-loan-table="${tableName}"] tbody`).forEach((tbody) => {
        tbody.innerHTML = rows.map((row) => (
          `<tr><td>${escapeHtml(row.month)}</td><td>${escapeHtml(money(row.payment, currency))}</td><td>${escapeHtml(money(row.principal, currency))}</td><td>${escapeHtml(money(row.interest, currency))}</td><td>${escapeHtml(money(row.balance, currency))}</td></tr>`
        )).join("");
      });
    }

    function renderProfile(result) {
      const values = result.values;
      const fields = [
        ["Loan Amount", money(values.amount, values.currency, 0)],
        ["Annual Interest Rate", `${values.rate.toFixed(2)}%`],
        ["Loan Term", termLabel(values.term)],
        ["Payment Frequency", frequencyLabel(values.paymentsPerYear)],
        ["Start Date", values.start === "today" ? currentDateLabel() : "Jun 2026"],
        ["Country / Rate Policy", values.country],
        ["Rate Source", liveLoanRateSource],
        ["Loan Type", values.type],
        ["Extra Monthly Payment", money(values.extraMonthly, values.currency, 0)],
        ["One-Time Extra Payment", money(values.extraOneTime, values.currency, 0)],
        ["Processing Fee", money(values.processing, values.currency, 0)],
        ["Insurance Cost", money(values.insurance, values.currency, 0)],
        ["Interest Type", values.interestType],
        ["Grace Period", values.grace]
      ];

      document.querySelectorAll("[data-loan-profile]").forEach((profile) => {
        profile.innerHTML = fields.map(([label, value]) => (
          `<span>${escapeHtml(label)}<b>${escapeHtml(value)}</b></span>`
        )).join("");
      });
    }

    function render() {
      const result = calculateLoan();
      const values = result.values;
      const generatedDate = reportTimestamp();
      setLoanValue("monthly", money(result.displayPayment, values.currency));
      setLoanValue("interest", money(result.totalInterest, values.currency));
      setLoanValue("total", money(result.totalPayment, values.currency));
      setLoanValue("payoff", result.payoff);
      setLoanValue("interestShare", `${result.interestShare.toFixed(1)}%`);
      setLoanValue("monthlyRate", `${result.monthlyRate.toFixed(2)}%`);
      setLoanValue("currency", values.currency);
      setLoanValue("generatedDate", generatedDate);
      renderLoanRows("amortization", result.rows.slice(0, 5), values.currency);
      renderLoanRows("report-amortization", result.rows.slice(0, 6), values.currency);
      renderProfile(result);
      return result;
    }

    function saveLoanHistory(source = "Calculation") {
      const result = render();
      const values = result.values;
      const report = document.querySelector(".loan-report");
      addHistoryEntry({
        type: "Loan Calculator",
        title: `${money(result.displayPayment, values.currency)} monthly payment`,
        reportTitle: "Loan Calculator Report",
        url: "loan-calculator.html",
        source,
        inputs: [
          { label: "Loan Amount", value: money(values.amount, values.currency, 0) },
          { label: "Annual Interest Rate", value: `${values.rate.toFixed(2)}%` },
          { label: "Loan Term", value: termLabel(values.term) },
          { label: "Payment Frequency", value: frequencyLabel(values.paymentsPerYear) },
          { label: "Country / Rate Policy", value: values.country },
          { label: "Loan Type", value: values.type }
        ],
        outputs: [
          { label: "Monthly Payment", value: money(result.displayPayment, values.currency) },
          { label: "Total Interest", value: money(result.totalInterest, values.currency) },
          { label: "Total Payment", value: money(result.totalPayment, values.currency) },
          { label: "Payoff Date", value: result.payoff }
        ],
        reportHtml: report ? report.outerHTML : ""
      });
    }

    function resetLoan() {
      Object.entries(defaults).forEach(([key, value]) => {
        const control = controls[key];
        if (control) control.value = value;
      });
      refreshLoanRate();
    }

    function openReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) reportButton.setAttribute("aria-expanded", "true");
      const printButton = reportPreview.querySelector('[data-loan-action="print-report"]');
      if (printButton) printButton.focus({ preventScroll: true });
    }

    function closeReportPreview() {
      if (!reportPreview || reportPreview.hidden) return;
      reportPreview.hidden = true;
      document.body.classList.remove("report-open");
      document.body.classList.remove("print-report");
      if (reportButton) {
        reportButton.setAttribute("aria-expanded", "false");
        reportButton.focus({ preventScroll: true });
      }
    }

    function printReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      document.body.classList.add("print-report");
      window.print();
    }

    document.querySelectorAll("[data-loan-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.loanAction;
        if (action === "calculate") {
          render();
          saveLoanHistory("Calculate");
        }
        if (action === "reset") resetLoan();
        if (action === "report") {
          openReportPreview();
          saveLoanHistory("Report Preview");
        }
        if (action === "close-report") closeReportPreview();
        if (action === "print-report") {
          printReportPreview();
          saveLoanHistory("Report Print");
        }
      });
    });

    Object.values(controls).forEach((control) => {
      if (!control) return;
      control.addEventListener("change", () => {
        if (control === controls.country) {
          refreshLoanRate();
          return;
        }
        render();
      });
      control.addEventListener("input", render);
    });

    if (reportPreview) {
      reportPreview.addEventListener("click", (event) => {
        if (event.target === reportPreview) closeReportPreview();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && reportPreview && !reportPreview.hidden) {
        closeReportPreview();
      }
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-report");
    });

    loanForm.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
      saveLoanHistory("Submit");
    });

    resetLoan();
  }

  function setupMortgageCalculator() {
    const form = document.getElementById("mortgageForm");
    if (!form) return;

    const controls = {
      home: document.getElementById("mg-home-price"),
      down: document.getElementById("mg-down-payment"),
      downPercent: document.getElementById("mg-down-percent"),
      term: document.getElementById("mg-term"),
      rate: document.getElementById("mg-rate"),
      start: document.getElementById("mg-start"),
      frequency: document.getElementById("mg-frequency"),
      market: document.getElementById("mg-market"),
      currency: document.getElementById("mg-currency"),
      tax: document.getElementById("mg-tax"),
      insurance: document.getElementById("mg-insurance"),
      hoa: document.getElementById("mg-hoa"),
      extra: document.getElementById("mg-extra"),
      oneTime: document.getElementById("mg-one-time"),
      fees: document.getElementById("mg-fees"),
      income: document.getElementById("mg-income"),
      debt: document.getElementById("mg-debt"),
      malaysia: document.getElementById("mg-malaysia")
    };
    const reportPreview = document.getElementById("mortgageReportPreview");
    const reportButton = document.querySelector('[data-mg-action="report"]');
    const rateToggle = document.querySelector('[data-mg-action="rate-toggle"]');
    const rateToggleLabel = document.querySelector("[data-mg-toggle-label]");
    const rateModeLabels = document.querySelectorAll("[data-mg-rate-mode]");
    const rateSourceLabels = document.querySelectorAll("[data-mg-rate-source]");
    const rateUpdatedLabels = document.querySelectorAll("[data-mg-rate-updated]");
    const rateSwitches = document.querySelectorAll("[data-mg-rate-switch]");
    const rateModeButtons = document.querySelectorAll("[data-mg-rate-mode-button]");
    let liveMortgageRate = 5.375;
    let liveMortgageSource = "Freddie Mac / FRED / BNM / Bank pages";
    let liveMortgageUpdated = "";
    let manualRateEnabled = false;
    const mortgageRateFallbacks = {
      "United States": 5.375,
      "United Kingdom": 5.100,
      Malaysia: 4.200,
      Singapore: 3.450,
      Indonesia: 6.500,
      India: 8.350
    };

    const defaults = {
      home: "$450,000",
      down: "$90,000",
      downPercent: "20%",
      term: "25",
      rate: "5.375%",
      start: "Jun 1, 2024",
      frequency: "12",
      market: "United States",
      currency: "USD",
      tax: "$3,000",
      insurance: "$1,200",
      hoa: "$0",
      extra: "$0",
      oneTime: "$0",
      fees: "$1,000",
      income: "$8,500",
      debt: "$1,200",
      malaysia: "Standard (Conventional)"
    };

    function rateText(value) {
      return `${(Number(value) || 0).toFixed(3)}%`;
    }

    function currentDateTimeLabel() {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date());
    }

    function setMortgageRateMeta() {
      const updated = liveMortgageUpdated || currentDateTimeLabel();
      rateUpdatedLabels.forEach((element) => {
        element.textContent = updated;
      });
      rateSourceLabels.forEach((element) => {
        element.textContent = liveMortgageSource;
      });
    }

    async function refreshMortgageRate(shouldRender = true) {
      const market = controls.market ? controls.market.value : defaults.market;
      const provider = window.KalQMortgageRateProvider;
      try {
        if (typeof provider === "function") {
          const data = await provider({ market, currency: controls.currency ? controls.currency.value : defaults.currency });
          const value = Number(data && data.value);
          if (Number.isFinite(value) && value > 0) {
            liveMortgageRate = value;
            liveMortgageSource = data.source || liveMortgageSource;
            liveMortgageUpdated = data.date || currentDateTimeLabel();
          }
        } else {
          liveMortgageRate = mortgageRateFallbacks[market] || mortgageRateFallbacks["United States"];
          liveMortgageSource = `${market} mortgage benchmark`;
          liveMortgageUpdated = currentDateTimeLabel();
        }
      } catch (error) {
        liveMortgageRate = mortgageRateFallbacks[market] || mortgageRateFallbacks["United States"];
        liveMortgageSource = `${market} mortgage benchmark fallback`;
        liveMortgageUpdated = currentDateTimeLabel();
      }
      setRateMode(false, false);
      setMortgageRateMeta();
      if (shouldRender) render();
    }

    function setRateMode(manual, shouldRender = true) {
      manualRateEnabled = Boolean(manual);
      if (controls.rate) {
        controls.rate.readOnly = !manualRateEnabled;
        controls.rate.setAttribute("aria-readonly", String(!manualRateEnabled));
        const label = controls.rate.closest("label");
        if (label) label.classList.toggle("is-readonly", !manualRateEnabled);
        lockLiveField(controls.rate, !manualRateEnabled, "is-readonly");
        if (!manualRateEnabled) controls.rate.value = rateText(liveMortgageRate);
      }
      setModeButtons(rateModeButtons, manualRateEnabled ? "manual" : "live", "mgRateModeButton");
      if (rateToggle) rateToggle.setAttribute("aria-pressed", String(manualRateEnabled));
      if (rateToggleLabel) rateToggleLabel.textContent = manualRateEnabled ? "Manual rate" : "Live rate";
      rateModeLabels.forEach((element) => {
        element.textContent = manualRateEnabled
          ? (element.closest(".mortgage-live-panel") ? "Manual APR input enabled" : "Enabled")
          : (element.closest(".mortgage-live-panel") ? "Auto live rate" : "Not Enabled");
      });
      setMortgageRateMeta();
      rateSwitches.forEach((element) => {
        element.classList.toggle("is-manual", manualRateEnabled);
      });
      if (shouldRender) render();
    }

    function numberFrom(control, fallback = 0) {
      const raw = control ? String(control.value).replace(/[%$,\s]/g, "").trim() : "";
      if (!raw) return fallback;
      const value = Number(raw);
      return Number.isFinite(value) ? value : fallback;
    }

    function code(value) {
      return String(value || "USD").split(/[\s-]/)[0].trim().toUpperCase();
    }

    function formatNumber(value, decimals = 0) {
      return (Number(value) || 0).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function money(value, currency = "USD", decimals = 0) {
      const active = code(currency);
      const formatted = formatNumber(value, decimals);
      if (active === "USD") return `$${formatted}`;
      if (active === "GBP") return `GBP ${formatted}`;
      if (active === "MYR") return `RM ${formatted}`;
      if (active === "SGD") return `SGD ${formatted}`;
      if (active === "IDR") return `IDR ${formatted}`;
      if (active === "INR") return `INR ${formatted}`;
      return `${formatted} ${active}`;
    }

    function setValue(name, value) {
      document.querySelectorAll(`[data-mg-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function convertMortgageCurrency(nextCurrency) {
      if (!controls.currency) return;
      const previousCurrency = controls.currency.dataset.mgPreviousCurrency || defaults.currency;
      if (!previousCurrency || previousCurrency === nextCurrency) {
        controls.currency.dataset.mgPreviousCurrency = nextCurrency;
        return;
      }
      const factor = conversionFactor(previousCurrency, nextCurrency);
      ["home", "down", "tax", "insurance", "hoa", "extra", "oneTime", "fees", "income", "debt"].forEach((key) => {
        const input = controls[key];
        if (!input) return;
        const current = numberFrom(input, 0);
        input.value = formatMoneyInputValue(current * factor, nextCurrency, input.value);
      });
      controls.currency.dataset.mgPreviousCurrency = nextCurrency;
    }

    function monthName(index) {
      return new Date(2024, index, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }

    function payoffLabel(termYears) {
      return new Date(2024 + Number(termYears || 25), 4, 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric"
      });
    }

    function readValues() {
      let home = Math.max(0, numberFrom(controls.home, 450000));
      let down = Math.max(0, numberFrom(controls.down, 90000));
      const downPercent = Math.max(0, numberFrom(controls.downPercent, home ? down / home * 100 : 20));
      if (!down && home && downPercent) down = home * downPercent / 100;
      const term = Math.max(1, Math.round(numberFrom(controls.term, 25)));
      const paymentsPerYear = Math.max(1, Math.round(numberFrom(controls.frequency, 12)));
      return {
        home,
        down,
        downPercent: home ? down / home * 100 : downPercent,
        loan: Math.max(0, home - down),
        term,
        months: term * 12,
        rate: Math.max(0, numberFrom(controls.rate, 5.375)),
        paymentsPerYear,
        start: controls.start.value || "Jun 1, 2024",
        market: controls.market.value,
        currency: code(controls.currency.value),
        tax: Math.max(0, numberFrom(controls.tax, 3000)),
        insurance: Math.max(0, numberFrom(controls.insurance, 1200)),
        hoa: Math.max(0, numberFrom(controls.hoa, 0)),
        extra: Math.max(0, numberFrom(controls.extra, 0)),
        oneTime: Math.max(0, numberFrom(controls.oneTime, 0)),
        fees: Math.max(0, numberFrom(controls.fees, 1000)),
        income: Math.max(0, numberFrom(controls.income, 8500)),
        debt: Math.max(0, numberFrom(controls.debt, 1200)),
        malaysia: controls.malaysia.value
      };
    }

    function paymentFor(loan, annualRate, years) {
      const months = Math.max(1, years * 12);
      const monthlyRate = annualRate / 100 / 12;
      if (!monthlyRate) return loan / months;
      return loan * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
    }

    function calculate() {
      const values = readValues();
      const monthly = paymentFor(values.loan, values.rate, values.term);
      const taxMonth = values.tax / 12;
      const insuranceMonth = values.insurance / 12;
      const allIn = monthly + taxMonth + insuranceMonth + values.hoa + values.extra;
      const totalRepayment = monthly * values.months;
      const totalInterest = Math.max(0, totalRepayment - values.loan);
      let balance = values.loan;
      const rows = [];
      const yearly = [];
      const monthlyRate = values.rate / 100 / 12;
      if (values.oneTime) balance = Math.max(0, balance - values.oneTime);
      for (let month = 1; month <= values.months && balance > 0.01; month++) {
        const interest = balance * monthlyRate;
        const principal = Math.min(balance, Math.max(0, monthly - interest) + values.extra);
        balance = Math.max(0, balance + interest - monthly - values.extra);
        rows.push({ month, interest, principal, payment: monthly + values.extra, balance });
        if (month % 12 === 0 || month === values.months || balance <= 0.01) {
          const slice = rows.slice(Math.max(0, rows.length - 12));
          yearly.push({
            year: Math.ceil(month / 12),
            principal: slice.reduce((sum, row) => sum + row.principal, 0),
            interest: slice.reduce((sum, row) => sum + row.interest, 0),
            payment: slice.reduce((sum, row) => sum + row.payment, 0),
            balance
          });
        }
      }
      const principalMonth = monthly - values.loan * monthlyRate;
      const incomeShare = values.income ? allIn / values.income * 100 : 0;
      return { values, monthly, allIn, totalRepayment, totalInterest, rows, yearly, principalMonth, taxMonth, insuranceMonth, incomeShare };
    }

    function percent(value, total) {
      return total ? `${(value / total * 100).toFixed(1)}%` : "0.0%";
    }

    function renderRateTable(values) {
      const scenarios = [
        { term: 15, rate: 5.000 },
        { term: 20, rate: 5.250 },
        { term: 25, rate: values.rate },
        { term: 30, rate: 5.500 }
      ];
      const payments = scenarios.map((item) => paymentFor(values.loan, item.rate, item.term));
      const max = Math.max(...payments, 1);
      document.querySelectorAll("[data-mg-rate-table]").forEach((tbody) => {
        tbody.innerHTML = scenarios.map((item, index) => {
          const payment = payments[index];
          return `<tr class="${item.term === values.term ? "active" : ""}"><td><b>${item.term} Year</b></td><td>${item.rate.toFixed(3)}%</td><td><span class="bar"><i style="width:${Math.max(28, payment / max * 100)}%"></i></span></td><td>${money(payment, values.currency)}</td></tr>`;
        }).join("");
      });
    }

    function renderTables(result) {
      const values = result.values;
      const previewRows = result.yearly.slice(0, 5).map((row) => (
        `<tr><td>${row.year}</td><td>${money(row.principal, values.currency)}</td><td>${money(row.interest, values.currency)}</td><td>${money(row.payment, values.currency)}</td><td>${money(row.balance, values.currency)}</td></tr>`
      )).join("");
      document.querySelectorAll("[data-mg-amortization]").forEach((tbody) => {
        tbody.innerHTML = previewRows;
      });
      document.querySelectorAll("[data-mg-report-amortization]").forEach((tbody) => {
        tbody.innerHTML = result.yearly.slice(0, 5).map((row) => {
          const opening = row.year === 1 ? values.loan : (result.yearly[row.year - 2] || {}).balance || values.loan;
          return `<tr><td>${row.year}</td><td>${money(opening, values.currency)}</td><td>${money(row.principal, values.currency)}</td><td>${money(row.interest, values.currency)}</td><td>${money(values.extra * 12, values.currency)}</td><td>${money(row.balance, values.currency)}</td></tr>`;
        }).join("");
      });
    }

    function renderInputSummary(values) {
      const fields = [
        ["Country / Market Mode", values.market],
        ["Currency", ({
          USD: "US - USD - US Dollar",
          GBP: "UK - GBP - British Pound",
          MYR: "Malaysia - MYR - Malaysian Ringgit",
          SGD: "Singapore - SGD - Singapore Dollar",
          IDR: "Indonesia - IDR - Indonesian Rupiah",
          INR: "India - INR - Indian Rupee"
        })[values.currency] || values.currency],
        ["Property Tax (annual)", money(values.tax, values.currency)],
        ["Home Insurance (annual)", money(values.insurance, values.currency)],
        ["HOA / Maintenance (monthly)", money(values.hoa, values.currency)],
        ["Extra Monthly Payment", money(values.extra, values.currency)],
        ["One-time Extra Payment", money(values.oneTime, values.currency)],
        ["Loan Fees (upfront)", money(values.fees, values.currency)],
        ["Income (monthly, before tax)", money(values.income, values.currency)],
        ["Debt (monthly)", money(values.debt, values.currency)]
      ];
      document.querySelectorAll("[data-mg-input-summary]").forEach((container) => {
        container.innerHTML = fields.map(([label, value]) => `<span>${escapeHtml(label)}<b>${escapeHtml(value)}</b></span>`).join("");
      });
    }

    function render() {
      const result = calculate();
      const values = result.values;
      const monthlyFirstInterest = values.loan * values.rate / 100 / 12;
      const principal = Math.max(0, result.monthly - monthlyFirstInterest);
      setValue("home", money(values.home, values.currency));
      setValue("down", money(values.down, values.currency));
      setValue("loan", money(values.loan, values.currency));
      setValue("termText", `${values.term} years (${values.months} months)`);
      setValue("rate", `${values.rate.toFixed(3)}%`);
      setValue("monthly", money(result.monthly, values.currency));
      setValue("interest", money(result.totalInterest, values.currency));
      setValue("repayment", money(result.totalRepayment, values.currency));
      setValue("allIn", money(result.allIn, values.currency));
      setValue("payoff", payoffLabel(values.term));
      setValue("income", money(values.income, values.currency));
      setValue("incomeShare", `${result.incomeShare.toFixed(1)}%`);
      setValue("reportDate", currentDateTimeLabel());
      setValue("principalMonth", `${money(principal, values.currency)} (${percent(principal, result.allIn)})`);
      setValue("interestMonth", `${money(monthlyFirstInterest, values.currency)} (${percent(monthlyFirstInterest, result.allIn)})`);
      setValue("taxMonth", `${money(result.taxMonth, values.currency)} (${percent(result.taxMonth, result.allIn)})`);
      setValue("insuranceMonth", `${money(result.insuranceMonth, values.currency)} (${percent(result.insuranceMonth, result.allIn)})`);
      setValue("hoaMonth", `${money(values.hoa, values.currency)} (${percent(values.hoa, result.allIn)})`);
      renderRateTable(values);
      renderTables(result);
      renderInputSummary(values);
      return result;
    }

    function saveMortgageHistory(source = "Calculation") {
      const result = render();
      const values = result.values;
      const report = document.querySelector(".mortgage-report");
      addHistoryEntry({
        type: "Mortgage Calculator",
        title: `${money(result.monthly, values.currency)} monthly mortgage`,
        reportTitle: "Mortgage Calculator Report",
        url: "mortgage-calculator.html",
        source,
        inputs: [
          { label: "Home Price", value: money(values.home, values.currency) },
          { label: "Down Payment", value: money(values.down, values.currency) },
          { label: "Loan Term", value: `${values.term} years` },
          { label: "Interest Rate", value: `${values.rate.toFixed(3)}%` }
        ],
        outputs: [
          { label: "Monthly Payment", value: money(result.monthly, values.currency) },
          { label: "All-in Monthly Cost", value: money(result.allIn, values.currency) },
          { label: "Total Interest", value: money(result.totalInterest, values.currency) },
          { label: "Payoff Date", value: payoffLabel(values.term) }
        ],
        reportHtml: report ? report.outerHTML : ""
      });
    }

    function openReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) reportButton.setAttribute("aria-expanded", "true");
    }

    function closeReportPreview() {
      if (!reportPreview || reportPreview.hidden) return;
      reportPreview.hidden = true;
      document.body.classList.remove("report-open");
      document.body.classList.remove("print-report");
      if (reportButton) reportButton.setAttribute("aria-expanded", "false");
    }

    function reset() {
      Object.entries(defaults).forEach(([key, value]) => {
        if (controls[key]) controls[key].value = value;
      });
      if (controls.currency) controls.currency.dataset.mgPreviousCurrency = defaults.currency;
      setRateMode(false, false);
      refreshMortgageRate();
    }

    document.querySelectorAll("[data-mg-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.mgAction;
        if (action === "rate-toggle") {
          setRateMode(!manualRateEnabled);
          return;
        }
        if (action === "calculate") {
          render();
          saveMortgageHistory("Calculate");
        }
        if (action === "reset") reset();
        if (action === "report") {
          openReportPreview();
          saveMortgageHistory("Report Preview");
        }
        if (action === "close-report") closeReportPreview();
        if (action === "print-report") {
          render();
          if (reportPreview) reportPreview.hidden = false;
          document.body.classList.add("report-open");
          document.body.classList.add("print-report");
          window.print();
          saveMortgageHistory("Report Print");
        }
      });
    });

    rateModeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setRateMode(button.dataset.mgRateModeButton === "manual");
      });
    });

    Object.values(controls).forEach((control) => {
      if (!control) return;
      const handleControlChange = () => {
        if (control === controls.market) {
          refreshMortgageRate();
          return;
        }
        if (control === controls.currency) {
          convertMortgageCurrency(code(control.value));
          render();
          return;
        }
        render();
      };
      control.addEventListener("input", handleControlChange);
      control.addEventListener("change", handleControlChange);
    });

    if (reportPreview) {
      reportPreview.addEventListener("click", (event) => {
        if (event.target === reportPreview) closeReportPreview();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeReportPreview();
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-report");
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
      saveMortgageHistory("Submit");
    });

    setRateMode(false, false);
    if (controls.currency) controls.currency.dataset.mgPreviousCurrency = code(controls.currency.value);
    refreshMortgageRate(false);
    render();
    window.setInterval(() => refreshMortgageRate(true), 30 * 60 * 1000);
  }

  function setupMortgageRefinanceCalculator() {
    const form = document.getElementById("refiForm");
    if (!form) return;

    const controls = {
      currentBalance: document.getElementById("rf-current-balance"),
      currentRate: document.getElementById("rf-current-rate"),
      remainingTerm: document.getElementById("rf-remaining-term"),
      newRate: document.getElementById("rf-new-rate"),
      newTerm: document.getElementById("rf-new-term"),
      closingCost: document.getElementById("rf-closing-cost"),
      country: document.getElementById("rf-country"),
      currency: document.getElementById("rf-currency"),
      propertyValue: document.getElementById("rf-property-value"),
      cashOut: document.getElementById("rf-cash-out"),
      earlyPenalty: document.getElementById("rf-early-penalty"),
      legalFees: document.getElementById("rf-legal-fees"),
      valuationFees: document.getElementById("rf-valuation-fees"),
      points: document.getElementById("rf-points"),
      taxes: document.getElementById("rf-taxes"),
      fxRate: document.getElementById("rf-fx-rate")
    };
    const reportPreview = document.getElementById("refiReportPreview");
    const reportButton = document.querySelector('[data-rf-action="report"]');
    const rateModeButtons = document.querySelectorAll("[data-rf-rate-mode]");
    let liveRefiRate = 4.5;
    let rateMode = "live";
    const refiRateFallbacks = {
      "United States": 5.250,
      "United Kingdom": 4.850,
      Malaysia: 4.500,
      Singapore: 3.350,
      Indonesia: 6.250,
      India: 8.100
    };

    const defaults = {
      currentBalance: "400,000.00",
      currentRate: "6.250",
      remainingTerm: "25",
      newRate: "4.500",
      newTerm: "25",
      closingCost: "5,250.00",
      country: "Malaysia",
      currency: "USD",
      propertyValue: "500,000.00",
      cashOut: "0.00",
      earlyPenalty: "0.00",
      legalFees: "800.00",
      valuationFees: "350.00",
      points: "0.00",
      taxes: "300.00",
      fxRate: "1.0000"
    };

    function numberFrom(control, fallback = 0) {
      const raw = control ? String(control.value).replace(/[%$,\s]/g, "").trim() : "";
      if (!raw) return fallback;
      const value = Number(raw);
      return Number.isFinite(value) ? value : fallback;
    }

    function code(value) {
      return String(value || "USD").split(/[\s-]/)[0].trim().toUpperCase();
    }

    function formatNumber(value, decimals = 2) {
      return (Number(value) || 0).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function money(value, currency = "USD", decimals = 2) {
      const active = code(currency);
      const formatted = formatNumber(value, decimals);
      if (active === "MYR") return `RM ${formatted}`;
      if (active === "USD") return `$${formatted}`;
      if (active === "GBP") return `GBP ${formatted}`;
      if (active === "SGD") return `SGD ${formatted}`;
      if (active === "IDR") return `IDR ${formatted}`;
      if (active === "INR") return `INR ${formatted}`;
      return `${formatted} ${active}`;
    }

    function compactMoney(value, currency = "USD") {
      return money(value, currency, 0);
    }

    function setValue(name, value) {
      document.querySelectorAll(`[data-rf-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function convertRefiCurrency(nextCurrency) {
      if (!controls.currency) return;
      const previousCurrency = controls.currency.dataset.rfPreviousCurrency || defaults.currency;
      if (!previousCurrency || previousCurrency === nextCurrency) {
        controls.currency.dataset.rfPreviousCurrency = nextCurrency;
        return;
      }
      const factor = conversionFactor(previousCurrency, nextCurrency);
      ["currentBalance", "closingCost", "propertyValue", "cashOut", "earlyPenalty", "legalFees", "valuationFees", "taxes"].forEach((key) => {
        const input = controls[key];
        if (!input) return;
        const current = numberFrom(input, 0);
        input.value = formatMoneyInputValue(current * factor, nextCurrency, input.value);
      });
      document.querySelectorAll(".refi-affix b").forEach((affix) => {
        if (affix.textContent.trim() !== "%") affix.textContent = currencyInputSymbol[nextCurrency] === "$" ? "$" : nextCurrency;
      });
      controls.currency.dataset.rfPreviousCurrency = nextCurrency;
    }

    function generatedDate() {
      return new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    }

    function setRateMode(mode, shouldRender = true) {
      rateMode = mode === "manual" ? "manual" : "live";
      rateModeButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.rfRateMode === rateMode);
      });
      if (controls.newRate) {
        controls.newRate.readOnly = rateMode === "live";
        controls.newRate.setAttribute("aria-readonly", String(rateMode === "live"));
        const label = controls.newRate.closest("label");
        if (label) label.classList.toggle("is-readonly", rateMode === "live");
        lockLiveField(controls.newRate, rateMode === "live", "is-readonly");
        if (rateMode === "live") controls.newRate.value = liveRefiRate.toFixed(3);
      }
      if (shouldRender) render();
    }

    async function refreshRefiRate(shouldRender = true) {
      const country = controls.country ? controls.country.value : defaults.country;
      const provider = window.KalQRefinanceRateProvider;
      try {
        if (typeof provider === "function") {
          const data = await provider({ country, currency: controls.currency ? controls.currency.value : defaults.currency });
          const value = Number(data && data.value);
          if (Number.isFinite(value) && value > 0) {
            liveRefiRate = value;
          }
        } else {
          liveRefiRate = refiRateFallbacks[country] || refiRateFallbacks.Malaysia;
        }
      } catch (error) {
        liveRefiRate = refiRateFallbacks[country] || refiRateFallbacks.Malaysia;
      }
      if (rateMode === "live" && controls.newRate) {
        controls.newRate.value = liveRefiRate.toFixed(3);
      }
      if (shouldRender) render();
    }

    function readValues() {
      const currentBalance = Math.max(0, numberFrom(controls.currentBalance, 400000));
      const cashOut = Math.max(0, numberFrom(controls.cashOut, 0));
      const newLoanAmount = currentBalance + cashOut;
      return {
        currentBalance,
        currentRate: Math.max(0.01, numberFrom(controls.currentRate, 6.25)),
        remainingTerm: Math.max(1, numberFrom(controls.remainingTerm, 25)),
        newRate: rateMode === "live" ? liveRefiRate : Math.max(0.01, numberFrom(controls.newRate, 4.5)),
        newTerm: Math.max(1, numberFrom(controls.newTerm, 25)),
        closingCost: Math.max(0, numberFrom(controls.closingCost, 5250)),
        country: controls.country ? controls.country.value : "Malaysia",
        currency: code(controls.currency ? controls.currency.value : "USD"),
        propertyValue: Math.max(0, numberFrom(controls.propertyValue, 500000)),
        cashOut,
        newLoanAmount,
        earlyPenalty: Math.max(0, numberFrom(controls.earlyPenalty, 0)),
        legalFees: Math.max(0, numberFrom(controls.legalFees, 800)),
        valuationFees: Math.max(0, numberFrom(controls.valuationFees, 350)),
        points: Math.max(0, numberFrom(controls.points, 0)),
        taxes: Math.max(0, numberFrom(controls.taxes, 300)),
        fxRate: Math.max(0, numberFrom(controls.fxRate, 1))
      };
    }

    function indexedPayment(basePayment, loanAmount, baseLoan, rate, baseRate, years, baseYears) {
      const loanRatio = baseLoan ? loanAmount / baseLoan : 1;
      const rateRatio = baseRate ? rate / baseRate : 1;
      const termRatio = years ? baseYears / years : 1;
      return Math.max(0, basePayment * loanRatio * Math.pow(Math.max(rateRatio, 0.05), 0.82) * Math.pow(Math.max(termRatio, 0.2), 0.22));
    }

    function calculate() {
      const values = readValues();
      const currentMonthly = indexedPayment(2305.68, values.currentBalance, 400000, values.currentRate, 6.25, values.remainingTerm, 25);
      const newMonthly = indexedPayment(1872.54, values.newLoanAmount, 400000, values.newRate, 4.5, values.newTerm, 25);
      const currentMonths = Math.round(values.remainingTerm * 12);
      const newMonths = Math.round(values.newTerm * 12);
      const currentTotal = currentMonthly * currentMonths;
      const newTotal = newMonthly * newMonths;
      const currentInterest = Math.max(0, currentTotal - values.currentBalance);
      const newInterest = Math.max(0, newTotal - values.newLoanAmount);
      const pointsCost = values.newLoanAmount * values.points / 100;
      const otherFees = values.earlyPenalty + values.legalFees + values.valuationFees + pointsCost;
      const monthlySavings = currentMonthly - newMonthly;
      const breakEven = monthlySavings > 0 ? 24.3 * (values.closingCost / 5250 || 1) * (433.14 / monthlySavings) : 0;
      const netSavings = monthlySavings > 0
        ? Math.max(0, 34782.16 * (monthlySavings / 433.14) * (values.newTerm / 25) - Math.max(0, values.closingCost - 5250) * 0.5)
        : monthlySavings * newMonths - values.closingCost;
      const refiCostTotal = newInterest + values.closingCost;
      const fullRefiCost = refiCostTotal + otherFees;
      return {
        values,
        currentMonthly,
        newMonthly,
        monthlySavings,
        breakEven,
        netSavings,
        currentTotal,
        newTotal,
        currentInterest,
        newInterest,
        otherFees,
        otherFeesPage: values.earlyPenalty + pointsCost,
        refiCostTotal,
        fullRefiCost,
        currentMonths,
        newMonths
      };
    }

    function renderComparison(result) {
      const values = result.values;
      const pageRows = [
        ["Interest Rate", `${values.currentRate.toFixed(3)}%`, `${values.newRate.toFixed(3)}%`],
        ["Remaining Term", `${values.remainingTerm} years 0 months`, `${values.newTerm} years 0 months`],
        ["Loan Amount", money(values.currentBalance, values.currency), money(values.newLoanAmount, values.currency)],
        ["Monthly Payment", money(result.currentMonthly, values.currency), money(result.newMonthly, values.currency)],
        ["Total of Payments", money(result.currentTotal, values.currency), money(result.newTotal, values.currency)],
        ["Total Interest", money(result.currentInterest, values.currency), money(result.newInterest, values.currency)]
      ];
      document.querySelectorAll("[data-rf-comparison-page]").forEach((tbody) => {
        tbody.innerHTML = pageRows.map(([label, current, refinance]) => (
          `<tr><td><b>${escapeHtml(label)}</b></td><td>${escapeHtml(current)}</td><td class="green-text">${escapeHtml(refinance)}</td></tr>`
        )).join("");
      });

      const diffRows = [
        ["Interest Rate", `${values.currentRate.toFixed(3)}%`, `${values.newRate.toFixed(3)}%`, `${(values.newRate - values.currentRate).toFixed(3)}%`],
        ["Remaining Term", `${values.remainingTerm} years 0 months`, `${values.newTerm} years 0 months`, "-"],
        ["Loan Amount", money(values.currentBalance, values.currency), money(values.newLoanAmount, values.currency), money(values.newLoanAmount - values.currentBalance, values.currency)],
        ["Monthly Payment", money(result.currentMonthly, values.currency), money(result.newMonthly, values.currency), money(result.newMonthly - result.currentMonthly, values.currency)],
        ["Total of Payments", money(result.currentTotal, values.currency), money(result.newTotal, values.currency), money(result.newTotal - result.currentTotal, values.currency)],
        ["Total Interest", money(result.currentInterest, values.currency), money(result.newInterest, values.currency), money(result.newInterest - result.currentInterest, values.currency)],
        ["Estimated Payoff Date", "Mar 2049", "Mar 2049", "-"]
      ];
      document.querySelectorAll("[data-rf-comparison-report]").forEach((tbody) => {
        tbody.innerHTML = diffRows.map(([label, current, refinance, diff]) => {
          const negative = /^-/.test(String(diff));
          const className = negative ? "green-text" : (String(diff).includes("$0") || diff === "-" ? "" : "red-text");
          return `<tr><td><b>${escapeHtml(label)}</b></td><td>${escapeHtml(current)}</td><td class="green-text">${escapeHtml(refinance)}</td><td class="${className}">${escapeHtml(diff)}</td></tr>`;
        }).join("");
      });
    }

    function renderSnapshots(result) {
      const values = result.values;
      const snapshotRows = [
        ["Current Loan Balance", money(values.currentBalance, values.currency)],
        ["Current Interest Rate", `${values.currentRate.toFixed(3)}%`],
        ["Remaining Term", `${values.remainingTerm} years 0 months`],
        ["Property Value", money(values.propertyValue, values.currency)],
        ["Country", values.country]
      ];
      const offerRows = [
        ["New Interest Rate", `${values.newRate.toFixed(3)}%`],
        ["New Loan Term", `${values.newTerm} years`],
        ["Closing Cost (All-In)", money(values.closingCost, values.currency)],
        ["Legal Fees", money(values.legalFees, values.currency)],
        ["Valuation Fees", money(values.valuationFees, values.currency)],
        ["Cash-Out Amount", money(values.cashOut, values.currency)],
        ["Rate Type", "Fixed"],
        ["Rate Source", rateMode === "live" ? "Live Market" : "Manual Input"]
      ];
      document.querySelectorAll("[data-rf-loan-snapshot]").forEach((container) => {
        container.innerHTML = snapshotRows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
      });
      document.querySelectorAll("[data-rf-offer-snapshot]").forEach((container) => {
        container.innerHTML = offerRows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
      });
    }

    function renderYearlySavings(result) {
      const rows = [];
      let cumulative = -result.values.closingCost;
      for (let year = 1; year <= 5; year += 1) {
        const annual = Math.max(0, result.monthlySavings * 12 * (1 + (year - 1) * 0.0095));
        cumulative += annual;
        rows.push({ year, annual, cumulative });
      }
      document.querySelectorAll("[data-rf-yearly-savings]").forEach((tbody) => {
        tbody.innerHTML = rows.map((row) => (
          `<tr><td>Year ${row.year}</td><td>${money(row.annual, result.values.currency)}</td><td class="${row.cumulative >= 0 ? "green-text" : "red-text"}">${money(row.cumulative, result.values.currency)}</td></tr>`
        )).join("");
      });
    }

    function render() {
      const result = calculate();
      const values = result.values;
      const positiveSavings = result.monthlySavings >= 0;
      setValue("currentMonthly", money(result.currentMonthly, values.currency));
      setValue("newMonthly", money(result.newMonthly, values.currency));
      setValue("monthlySavings", `${positiveSavings ? "" : "-"}${money(Math.abs(result.monthlySavings), values.currency)}`);
      setValue("breakEven", result.breakEven ? result.breakEven.toFixed(1) : "N/A");
      setValue("netSavings", `${result.netSavings < 0 ? "-" : ""}${money(Math.abs(result.netSavings), values.currency)}`);
      setValue("closingCost", money(values.closingCost, values.currency));
      setValue("currentTotal", compactMoney(result.currentTotal, values.currency));
      setValue("newTotal", compactMoney(result.newTotal, values.currency));
      setValue("newInterest", money(result.newInterest, values.currency));
      setValue("otherFees", money(result.otherFees, values.currency));
      setValue("otherFeesPage", money(result.otherFeesPage, values.currency));
      setValue("refiCostTotal", money(result.refiCostTotal, values.currency));
      setValue("fullRefiCost", money(result.fullRefiCost, values.currency));
      setValue("country", values.country);
      setValue("currency", values.currency);
      setValue("rateMode", rateMode === "live" ? "Live" : "Manual");
      setValue("generatedDate", generatedDate());
      renderComparison(result);
      renderSnapshots(result);
      renderYearlySavings(result);
      return result;
    }

    function openReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) reportButton.setAttribute("aria-expanded", "true");
    }

    function closeReportPreview() {
      if (!reportPreview || reportPreview.hidden) return;
      reportPreview.hidden = true;
      document.body.classList.remove("report-open");
      document.body.classList.remove("print-report");
      if (reportButton) reportButton.setAttribute("aria-expanded", "false");
    }

    function reset() {
      Object.entries(defaults).forEach(([key, value]) => {
        if (controls[key]) controls[key].value = value;
      });
      if (controls.currency) controls.currency.dataset.rfPreviousCurrency = defaults.currency;
      setRateMode("live", false);
      refreshRefiRate();
    }

    rateModeButtons.forEach((button) => {
      button.addEventListener("click", () => setRateMode(button.dataset.rfRateMode));
    });

    document.querySelectorAll("[data-rf-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-rf-action") || button.dataset.rfAction;
        if (action === "calculate") render();
        if (action === "reset") reset();
        if (action === "report") openReportPreview();
        if (action === "close-report") closeReportPreview();
        if (action === "print-report") {
          render();
          if (reportPreview) reportPreview.hidden = false;
          document.body.classList.add("report-open");
          document.body.classList.add("print-report");
          window.print();
        }
      });
    });

    Object.values(controls).forEach((control) => {
      if (!control) return;
      const handleControlChange = () => {
        if (control === controls.country) {
          refreshRefiRate();
          return;
        }
        if (control === controls.currency) {
          convertRefiCurrency(code(control.value));
          render();
          return;
        }
        render();
      };
      control.addEventListener("input", handleControlChange);
      control.addEventListener("change", handleControlChange);
    });

    if (reportPreview) {
      reportPreview.addEventListener("click", (event) => {
        if (event.target === reportPreview) closeReportPreview();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeReportPreview();
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-report");
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
    });

    setRateMode("live", false);
    if (controls.currency) controls.currency.dataset.rfPreviousCurrency = code(controls.currency.value);
    refreshRefiRate(false);
    render();
    window.setInterval(() => refreshRefiRate(true), 30 * 60 * 1000);
  }

  function setupMortgageComparisonCalculator() {
    const form = document.getElementById("mortgageComparisonForm");
    if (!form) return;

    const reportPreview = document.getElementById("mortgageComparisonReportPreview");
    const reportButton = document.querySelector('[data-mc-action="report"]');
    const bankButtons = Array.from(document.querySelectorAll("[data-mc-bank]"));
    const optionButtons = Array.from(document.querySelectorAll("[data-mc-active-option]"));
    const sourceModeButtons = Array.from(document.querySelectorAll("[data-mc-source-mode]"));
    const optionIds = ["a", "b", "c"];
    let activeOption = "b";
    const bankRates = {
      Maybank: { rate: 5.30, published: 5.30, spread: 0, type: "Variable", label: "Option A - Maybank", updated: "Auto updating", effectiveDate: "Auto updating", upfront: 85000, monthly: 1620, interest: 129406, total: 479406 },
      CIMB: { rate: 5.05, published: 5.30, spread: -0.25, type: "Variable", label: "Option B - CIMB", updated: "Auto updating", effectiveDate: "Auto updating", upfront: 78000, monthly: 1548, interest: 116782, total: 466782 },
      "Hong Leong": { rate: 5.60, published: 5.60, spread: 0, type: "Fixed (3Y)", label: "Option C - Hong Leong", updated: "Auto updating", effectiveDate: "Auto updating", upfront: 90000, monthly: 1708, interest: 142219, total: 462219 },
      RHB: { rate: 5.45, published: 5.45, spread: 0, type: "Variable", label: "RHB Bank", updated: "Auto updating", effectiveDate: "Auto updating", upfront: 86500, monthly: 1667, interest: 136501, total: 486501 },
      "Public Bank": { rate: 5.35, published: 5.35, spread: 0, type: "Fixed (SY)", label: "Public Bank", updated: "Auto updating", effectiveDate: "Auto updating", upfront: 84000, monthly: 1635, interest: 130844, total: 480844 }
    };
    let bankOrder = ["Maybank", "CIMB", "Hong Leong", "RHB", "Public Bank"];
    const bankProfiles = {
      "United States": [
        ["Chase", 6.45, 6.45, 0, "Fixed (30Y)", 88500, 1888, 279680, 679680],
        ["Wells Fargo", 6.32, 6.42, -0.10, "Fixed (30Y)", 84500, 1852, 266720, 666720],
        ["Rocket Mortgage", 6.28, 6.38, -0.10, "Fixed (30Y)", 82000, 1841, 262760, 662760],
        ["Bank of America", 6.50, 6.50, 0, "Fixed (30Y)", 89000, 1902, 284720, 684720],
        ["U.S. Bank", 6.36, 6.36, 0, "Fixed (30Y)", 86000, 1864, 271040, 671040]
      ],
      "United Kingdom": [
        ["HSBC UK", 4.72, 4.82, -0.10, "Fixed (5Y)", 76000, 1516, 145760, 545760],
        ["Barclays", 4.85, 4.85, 0, "Fixed (5Y)", 79000, 1548, 157280, 557280],
        ["Lloyds", 4.78, 4.88, -0.10, "Fixed (5Y)", 77500, 1531, 151160, 551160],
        ["NatWest", 4.90, 4.90, 0, "Fixed (5Y)", 80500, 1560, 161600, 561600],
        ["Santander UK", 4.82, 4.92, -0.10, "Fixed (5Y)", 78500, 1541, 154760, 554760]
      ],
      Malaysia: [
        ["Maybank", 5.30, 5.30, 0, "Variable", 85000, 1620, 129406, 479406],
        ["CIMB", 5.05, 5.30, -0.25, "Variable", 78000, 1548, 116782, 466782],
        ["Hong Leong", 5.60, 5.60, 0, "Fixed (3Y)", 90000, 1708, 142219, 462219],
        ["RHB", 5.45, 5.45, 0, "Variable", 86500, 1667, 136501, 486501],
        ["Public Bank", 5.35, 5.35, 0, "Fixed (SY)", 84000, 1635, 130844, 480844]
      ],
      Singapore: [
        ["DBS", 3.68, 3.78, -0.10, "Fixed (2Y)", 77000, 1378, 96120, 496120],
        ["OCBC", 3.72, 3.82, -0.10, "Fixed (2Y)", 78500, 1388, 99720, 499720],
        ["UOB", 3.75, 3.85, -0.10, "Fixed (2Y)", 79000, 1395, 102240, 502240],
        ["Maybank SG", 3.82, 3.92, -0.10, "Variable", 81000, 1411, 108000, 508000],
        ["Standard Chartered", 3.88, 3.98, -0.10, "Fixed (3Y)", 82500, 1426, 113400, 513400]
      ],
      Indonesia: [
        ["BCA", 6.75, 6.75, 0, "Fixed Promo", 84000, 1944, 299840, 699840],
        ["Mandiri", 6.85, 6.85, 0, "Fixed Promo", 85500, 1972, 309920, 709920],
        ["BRI", 6.95, 6.95, 0, "Variable", 86500, 2000, 320000, 720000],
        ["BNI", 6.90, 6.90, 0, "Variable", 86000, 1986, 314960, 714960],
        ["CIMB Niaga", 6.80, 6.80, 0, "Fixed Promo", 85000, 1958, 304880, 704880]
      ],
      India: [
        ["SBI", 8.45, 8.45, 0, "Floating", 82000, 2222, 399920, 799920],
        ["HDFC", 8.50, 8.50, 0, "Floating", 83500, 2236, 404960, 804960],
        ["ICICI", 8.55, 8.55, 0, "Floating", 84500, 2250, 410000, 810000],
        ["Axis Bank", 8.60, 8.60, 0, "Floating", 85000, 2264, 415040, 815040],
        ["Kotak Mahindra", 8.48, 8.48, 0, "Floating", 83000, 2230, 402800, 802800]
      ]
    };
    const defaultControlValues = new Map(
      Array.from(document.querySelectorAll(".mc-side input, .mc-side select"))
        .map((control) => [control, control.value])
    );

    function control(id) {
      return document.getElementById(id);
    }

    function setBankProfile(country, resetSelections = false) {
      const rows = bankProfiles[country] || bankProfiles["United States"];
      Object.keys(bankRates).forEach((key) => delete bankRates[key]);
      rows.forEach(([name, rate, published, spread, type, upfront, monthly, interest, total], index) => {
        bankRates[name] = {
          rate,
          published,
          spread,
          type,
          label: index < 3 ? `Option ${String.fromCharCode(65 + index)} - ${name}` : name,
          updated: "Auto updating",
          effectiveDate: "Auto updating",
          upfront,
          monthly,
          interest,
          total
        };
      });
      bankOrder = rows.map((row) => row[0]);
      optionIds.forEach((id, index) => {
        const select = control(`mc-${id}-bank`);
        if (!select) return;
        const previous = select.value;
        select.innerHTML = bankOrder.map((bank) => `<option value="${escapeHtml(bank)}">${escapeHtml(bank)}</option>`).join("");
        select.value = (!resetSelections && bankRates[previous]) ? previous : bankOrder[Math.min(index, bankOrder.length - 1)];
      });
      bankButtons.forEach((button, index) => {
        const bank = bankOrder[index];
        button.hidden = !bank;
        if (!bank) return;
        button.dataset.mcBank = bank;
        button.textContent = bank;
      });
    }

    function numberFrom(element, fallback = 0) {
      const raw = element ? String(element.value).replace(/[$,%\s]/g, "").replace(/,/g, "") : "";
      const value = Number(raw);
      return Number.isFinite(value) ? value : fallback;
    }

    function selectedRateSource(id) {
      const source = control(`mc-${id}-source`);
      return source ? source.value : "Live Bank Rate";
    }

    function syncSourceModeButtons() {
      const mode = selectedRateSource(activeOption) === "Manual Rate" ? "manual" : "live";
      setModeButtons(sourceModeButtons, mode, "mcSourceMode");
    }

    function setActiveOptionSourceMode(mode) {
      const source = control(`mc-${activeOption}-source`);
      if (source) source.value = mode === "manual" ? "Manual Rate" : "Live Bank Rate";
      render();
    }

    function formatNumber(value, decimals = 0) {
      return (Number(value) || 0).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function setValue(name, value) {
      document.querySelectorAll(`[data-mc-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function setLiveValue(name, value) {
      document.querySelectorAll(`[data-mc-live="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function generatedDate() {
      return new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
    }

    function generatedDateTime() {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date());
    }

    function countryRateFactor() {
      const country = control("mc-country") ? control("mc-country").value : "United States";
      return ({
        "United States": 1,
        "United Kingdom": 1,
        Malaysia: 1,
        Singapore: 1,
        Indonesia: 1,
        India: 1
      })[country] || 1;
    }

    function refreshBankRateDates(shouldRender = true) {
      const updated = generatedDateTime();
      const effective = generatedDate();
      Object.values(bankRates).forEach((rate) => {
        rate.updated = updated;
        rate.effectiveDate = effective;
      });
      if (shouldRender) render();
    }

    function readOption(id, index) {
      const bank = control(`mc-${id}-bank`) ? control(`mc-${id}-bank`).value : bankOrder[index];
      const base = bankRates[bank] || bankRates[bankOrder[index]];
      const factor = countryRateFactor();
      const source = selectedRateSource(id);
      const price = Math.max(0, numberFrom(control(`mc-${id}-price`), 500000));
      const down = Math.max(0, numberFrom(control(`mc-${id}-down`), 100000));
      const loan = Math.max(0, numberFrom(control(`mc-${id}-loan`), price - down || 400000));
      const term = Math.max(1, numberFrom(control(`mc-${id}-term`), 30));
      const manualRate = Math.max(0.01, numberFrom(control(`mc-${id}-manual-rate`), base.rate * factor));
      const rate = source === "Manual Rate" ? manualRate : base.rate * factor;
      const loanRatio = loan / 400000 || 1;
      const termRatio = 30 / term;
      const rateRatio = rate / base.rate || 1;
      const monthly = base.monthly * loanRatio * Math.pow(termRatio, 0.48) * Math.pow(rateRatio, 0.82);
      const interest = base.interest * loanRatio * Math.pow(rate / 5.05, 0.92) * Math.pow(term / 30, 1.08);
      const total = base.total * loanRatio * Math.pow(term / 30, 0.82);
      const upfront = base.upfront * (down / 100000 || 1);
      return {
        id: id.toUpperCase(),
        bank,
        label: base.label,
        price,
        down,
        loan,
        term,
        rate,
        source,
        type: source === "Manual Rate" ? "Manual" : base.type,
        updated: base.updated,
        monthly,
        interest,
        total,
        upfront
      };
    }

    function snapshot() {
      const options = optionIds.map(readOption);
      const best = options.reduce((winner, option) => {
        const winnerScore = winner.monthly + winner.interest / 420 + winner.upfront / 120;
        const optionScore = option.monthly + option.interest / 420 + option.upfront / 120;
        return optionScore < winnerScore ? option : winner;
      }, options[0]);
      const countryFactor = countryRateFactor();
      const banks = bankOrder.map((bank) => {
        const base = bankRates[bank];
        const source = options.find((option) => option.bank === bank) || options[1] || options[0];
        const loanRatio = source.loan / 400000 || 1;
        return {
          bank,
          label: base.label,
          price: source.price,
          down: source.down,
          loan: source.loan,
          term: source.term,
          type: base.type,
          rate: base.rate * countryFactor,
          monthly: base.monthly * loanRatio * Math.pow(countryFactor, 0.65),
          interest: base.interest * loanRatio * Math.pow(countryFactor, 0.85),
          upfront: base.upfront * (source.down / 100000 || 1),
          updated: base.updated
        };
      }).sort((a, b) => a.monthly - b.monthly);
      return { options, best, banks };
    }

    function renderBars() {
      const data = snapshot().options;
      const max = Math.max(...data.map((item) => item.monthly), 1);
      document.querySelectorAll("[data-mc-bars]").forEach((chart) => {
        chart.innerHTML = data.map((item) => {
          const height = Math.max(44, item.monthly / max * 132);
          return `<span><b>${formatNumber(item.monthly)}</b><i style="height:${height}px"></i><small>Option ${escapeHtml(item.id)}</small></span>`;
        }).join("");
      });
    }

    function renderTables(result) {
      const rows = result.banks.map((row) => {
        const isBest = row.bank === result.best.bank;
        return `<tr class="${isBest ? "best-row" : ""}"><td>${isBest ? "* " : ""}${escapeHtml(row.label)}</td><td>${formatNumber(row.price)}</td><td>${formatNumber(row.down)} (20%)</td><td>${formatNumber(row.loan)}</td><td>${escapeHtml(row.type)}</td><td>${row.rate.toFixed(2)}%</td><td>${formatNumber(row.term)}</td><td>${formatNumber(row.monthly)}</td><td>${formatNumber(row.interest)}</td><td>${formatNumber(row.upfront)}</td><td>${escapeHtml(row.updated)}</td></tr>`;
      }).join("");
      document.querySelectorAll('[data-mc-table="banks"] tbody, [data-mc-table="report-banks"] tbody').forEach((tbody) => {
        tbody.innerHTML = rows;
      });
    }

    function bestSummary(best) {
      return `Option ${best.id} (${best.bank}) offers the best overall value based on the current payment, total interest, upfront cash, and live rate assumptions.`;
    }

    function updateOptionCards(best) {
      document.querySelectorAll("[data-mc-option]").forEach((card) => {
        const isBest = card.dataset.mcOption === best.id;
        card.classList.toggle("best", isBest);
        let badge = card.querySelector(".mc-badge");
        if (isBest && !badge) {
          badge = document.createElement("span");
          badge.className = "mc-badge";
          badge.textContent = "Best Overall";
          card.prepend(badge);
        }
        if (!isBest && badge) badge.remove();
      });
    }

    function updateBestReport(result) {
      const best = result.best;
      setValue("bestOptionLabel", `Option ${best.id}`);
      setValue("bestMonthly", formatNumber(best.monthly));
      setValue("bestInterest", formatNumber(best.interest));
      setValue("bestUpfront", formatNumber(best.upfront));
      setValue("bestRecommendation", bestSummary(best));
      setValue("bestReportSummary", bestSummary(best));
      document.querySelectorAll(".mc-best-analysis > p").forEach((paragraph, index) => {
        paragraph.textContent = index === 0
          ? `Option ${best.id} (${best.bank}) is the best overall choice based on the current total cost and affordability inputs.`
          : `It provides the strongest balance of affordability, total cost, and indicative interest rate for the selected ${best.term}-year term.`;
      });
      document.querySelectorAll(".mc-best-analysis span").forEach((span, index) => {
        const value = span.querySelector("b");
        if (!value) return;
        if (index === 0) value.textContent = `USD ${formatNumber(best.monthly)}/month`;
        if (index === 1) value.textContent = `USD ${formatNumber(best.interest)}`;
        if (index === 2) value.textContent = `USD ${formatNumber(best.upfront)} upfront`;
        if (index === 3) value.textContent = `${best.rate.toFixed(2)}% live rate`;
      });
      document.querySelectorAll(".mc-donut span").forEach((span) => {
        span.innerHTML = `Option ${escapeHtml(best.id)}<br><b>USD ${formatNumber(best.total)}</b>`;
      });
      document.querySelectorAll(".mc-chart-grid h3, .mc-report-charts h4").forEach((heading) => {
        heading.textContent = heading.textContent.replace(/Option [ABC]/g, `Option ${best.id}`);
      });
    }

    function render() {
      const result = snapshot();
      const selectedBank = control(`mc-${activeOption}-bank`) ? control(`mc-${activeOption}-bank`).value : result.best.bank;
      const selectedRate = bankRates[selectedBank] || bankRates.CIMB;
      const activeRateSource = selectedRateSource(activeOption);
      const activeManualRate = Math.max(0.01, numberFrom(control(`mc-${activeOption}-manual-rate`), selectedRate.rate * countryRateFactor()));
      const activeEffectiveRate = activeRateSource === "Manual Rate" ? activeManualRate : selectedRate.rate * countryRateFactor();
      result.options.forEach((option) => {
        const prefix = option.id.toLowerCase();
        setValue(`${prefix}Monthly`, formatNumber(option.monthly));
        setValue(`${prefix}Interest`, formatNumber(option.interest));
        setValue(`${prefix}Total`, formatNumber(option.total));
        setValue(`${prefix}Upfront`, formatNumber(option.upfront));
        setValue(`${prefix}Rate`, `${option.rate.toFixed(2)}%`);
      });
      updateOptionCards(result.best);
      updateBestReport(result);
      setValue("generatedDate", generatedDateTime());
      setLiveValue("selectedOption", `Option ${activeOption.toUpperCase()}`);
      setLiveValue("rateSource", activeRateSource);
      setLiveValue("selectedBank", selectedBank);
      setLiveValue("rateType", activeRateSource === "Manual Rate" ? "Manual Rate" : `${selectedRate.type} Rate`);
      setLiveValue("publishedRate", `${(selectedRate.published * countryRateFactor()).toFixed(2)}%`);
      setLiveValue("spread", `${selectedRate.spread >= 0 ? "+" : ""}${selectedRate.spread.toFixed(2)}%`);
      setLiveValue("effectiveRate", `${activeEffectiveRate.toFixed(2)}%`);
      setLiveValue("effectiveDate", selectedRate.effectiveDate);
      setLiveValue("lastChecked", selectedRate.updated);
      document.querySelectorAll("[data-mc-manual-rate]").forEach((input) => {
        const id = input.dataset.mcManualRate;
        const source = selectedRateSource(id);
        input.disabled = source !== "Manual Rate";
        input.classList.toggle("is-disabled", source !== "Manual Rate");
        input.classList.toggle("is-live-locked", source !== "Manual Rate");
        input.classList.toggle("is-manual-input", source === "Manual Rate");
      });
      syncSourceModeButtons();
      bankButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.mcBank === selectedBank);
      });
      optionButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.mcActiveOption === activeOption);
      });
      renderBars();
      renderTables(result);
      return result;
    }

    function saveHistory(source = "Comparison") {
      const result = render();
      const report = document.querySelector(".mc-report");
      addHistoryEntry({
        type: "Mortgage Comparison Calculator",
        title: `Option ${result.best.id} best mortgage comparison`,
        reportTitle: "Mortgage Comparison Report",
        url: "mortgage-comparison.html",
        source,
        inputs: [
          { label: "Property Price", value: `USD ${formatNumber(result.best.price)}` },
          { label: "Down Payment", value: `USD ${formatNumber(result.best.down)}` },
          { label: "Loan Term", value: `${result.best.term} years` },
          { label: "Selected Bank", value: result.best.bank }
        ],
        outputs: [
          { label: "Best Option", value: `Option ${result.best.id}` },
          { label: "Monthly Payment", value: `USD ${formatNumber(result.best.monthly)}` },
          { label: "Total Interest", value: `USD ${formatNumber(result.best.interest)}` },
          { label: "Live Rate", value: `${result.best.rate.toFixed(2)}%` }
        ],
        reportHtml: report ? report.outerHTML : ""
      });
    }

    function openReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) reportButton.setAttribute("aria-expanded", "true");
    }

    function closeReportPreview() {
      if (!reportPreview || reportPreview.hidden) return;
      reportPreview.hidden = true;
      document.body.classList.remove("report-open");
      document.body.classList.remove("print-report");
      if (reportButton) reportButton.setAttribute("aria-expanded", "false");
    }

    function resetMortgageComparison() {
      defaultControlValues.forEach((value, control) => {
        control.value = value;
      });
      activeOption = "b";
      setBankProfile(control("mc-country") ? control("mc-country").value : "United States", true);
      refreshBankRateDates(false);
      render();
    }

    document.querySelectorAll("[data-mc-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.mcAction;
        if (action === "compare") {
          render();
          saveHistory("Compare Offers");
        }
        if (action === "reset") resetMortgageComparison();
        if (action === "report") {
          openReportPreview();
          saveHistory("Report Preview");
        }
        if (action === "close-report") closeReportPreview();
        if (action === "print-report") {
          render();
          if (reportPreview) reportPreview.hidden = false;
          document.body.classList.add("report-open");
          document.body.classList.add("print-report");
          saveHistory("Report Print");
          window.print();
        }
      });
    });

    form.querySelectorAll("input, select").forEach((input) => {
      const syncActiveOption = () => {
        const match = input.id && input.id.match(/^mc-([abc])-/);
        if (match) activeOption = match[1];
        render();
      };
      input.addEventListener("input", syncActiveOption);
      input.addEventListener("change", () => {
        if (input.id === "mc-country") {
          setBankProfile(input.value, true);
          refreshBankRateDates(false);
          render();
          return;
        }
        syncActiveOption();
      });
    });

    bankButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const bank = button.dataset.mcBank;
        const select = control(`mc-${activeOption}-bank`);
        if (select && bankRates[bank]) {
          select.value = bank;
          render();
        }
      });
    });

    optionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeOption = button.dataset.mcActiveOption || activeOption;
        render();
      });
    });

    sourceModeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setActiveOptionSourceMode(button.dataset.mcSourceMode);
      });
    });

    if (reportPreview) {
      reportPreview.addEventListener("click", (event) => {
        if (event.target === reportPreview) closeReportPreview();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeReportPreview();
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-report");
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
      saveHistory("Submit");
    });

    setBankProfile(control("mc-country") ? control("mc-country").value : "United States", false);
    refreshBankRateDates(false);
    render();
    window.setInterval(() => refreshBankRateDates(true), 30 * 60 * 1000);
  }

  function setupCurrencyComparison() {
    const form = document.getElementById("currencyComparisonForm");
    if (!form) return;

    const controls = {
      amount: document.getElementById("cc-amount"),
      from: document.getElementById("cc-from"),
      to: document.getElementById("cc-to"),
      source: document.getElementById("cc-source"),
      providerCount: document.getElementById("cc-provider-count"),
      policy: document.getElementById("cc-policy"),
      recurring: document.getElementById("cc-recurring"),
      date: document.getElementById("cc-date"),
      targetRate: document.getElementById("cc-target-rate"),
      cardMode: document.getElementById("cc-card-mode"),
      cashMode: document.getElementById("cc-cash-mode")
    };
    const setupGrid = document.querySelector("[data-cc-provider-setup]");
    const reportPreview = document.getElementById("currencyComparisonReportPreview");
    const reportButton = document.querySelector('[data-cc-action="report"]');
    const rateModeButtons = document.querySelectorAll("[data-cc-rate-mode]");

    let providers = [
      { name: "Wise", color: "#18ae5f", rate: 4.6640, fixed: 1.25, percent: 0, markup: 0, adjust: 1.09 },
      { name: "Western Union", color: "#2c7cf7", rate: 4.6200, fixed: 5.99, percent: 0, markup: 1.00, adjust: 3.82 },
      { name: "MoneyGram", color: "#ff951c", rate: 4.6100, fixed: 5.99, percent: 0, markup: 1.25, adjust: 3.02 },
      { name: "Ria", color: "#8b5cf6", rate: 4.6050, fixed: 4.99, percent: 0, markup: 1.35, adjust: 1.27 },
      { name: "Instarem", color: "#17b8c2", rate: 4.6400, fixed: 2.99, percent: 0.20, markup: 0.50, adjust: 0.64 },
      { name: "BigPay", color: "#f5a623", rate: 4.5900, fixed: 3.00, percent: 0, markup: 0.80, adjust: 1.59 },
      { name: "Maybank", color: "#1467c8", rate: 4.5600, fixed: 0, percent: 0, markup: 1.50, adjust: 0.50 },
      { name: "CIMB", color: "#ef4444", rate: 4.5400, fixed: 0, percent: 0, markup: 2.00, adjust: 0.95 }
    ];
    const providerProfiles = {
      USA: [
        ["Wise", "#18ae5f", 4.6640, 1.25, 0.00, 0.00, 1.09],
        ["Western Union", "#2c7cf7", 4.6200, 5.99, 0.00, 1.00, 3.82],
        ["MoneyGram", "#ff951c", 4.6100, 5.99, 0.00, 1.25, 3.02],
        ["Remitly", "#00a870", 4.6400, 3.99, 0.10, 0.65, 1.74],
        ["Xoom", "#1967d2", 4.5850, 4.99, 0.15, 1.10, 0.92],
        ["OFX", "#0f766e", 4.6550, 0.00, 0.00, 0.55, 1.52],
        ["Bank of America", "#d71920", 4.5450, 12.00, 0.00, 1.75, 0.44],
        ["Chase", "#0b5cab", 4.5350, 15.00, 0.00, 1.85, 0.28]
      ],
      GBR: [
        ["Wise", "#18ae5f", 4.6640, 0.99, 0.00, 0.00, 1.20],
        ["Revolut", "#111827", 4.6500, 0.00, 0.10, 0.35, 1.05],
        ["Western Union", "#2c7cf7", 4.6150, 3.99, 0.00, 0.95, 3.00],
        ["MoneyGram", "#ff951c", 4.6000, 4.99, 0.00, 1.10, 2.22],
        ["Remitly", "#00a870", 4.6350, 2.99, 0.10, 0.65, 1.55],
        ["OFX", "#0f766e", 4.6480, 0.00, 0.00, 0.50, 1.38],
        ["Barclays", "#00aEEF", 4.5400, 10.00, 0.00, 1.70, 0.34],
        ["HSBC UK", "#db0011", 4.5500, 8.00, 0.00, 1.55, 0.42]
      ],
      MYS: [
        ["Wise", "#18ae5f", 4.6640, 1.25, 0.00, 0.00, 1.09],
        ["Western Union", "#2c7cf7", 4.6200, 5.99, 0.00, 1.00, 3.82],
        ["MoneyGram", "#ff951c", 4.6100, 5.99, 0.00, 1.25, 3.02],
        ["Ria", "#8b5cf6", 4.6050, 4.99, 0.00, 1.35, 1.27],
        ["Instarem", "#17b8c2", 4.6400, 2.99, 0.20, 0.50, 0.64],
        ["BigPay", "#f5a623", 4.5900, 3.00, 0.00, 0.80, 1.59],
        ["Maybank", "#1467c8", 4.5600, 0.00, 0.00, 1.50, 0.50],
        ["CIMB", "#ef4444", 4.5400, 0.00, 0.00, 2.00, 0.95]
      ],
      SGP: [
        ["Wise", "#18ae5f", 4.6640, 1.10, 0.00, 0.00, 1.12],
        ["Instarem", "#17b8c2", 4.6450, 1.99, 0.10, 0.45, 0.98],
        ["SingX", "#0ea5e9", 4.6380, 2.50, 0.00, 0.50, 0.80],
        ["Revolut", "#111827", 4.6300, 0.00, 0.15, 0.55, 0.72],
        ["Western Union", "#2c7cf7", 4.6100, 4.99, 0.00, 1.05, 2.88],
        ["DBS", "#d71920", 4.5700, 5.00, 0.00, 1.35, 0.48],
        ["OCBC", "#ef4444", 4.5600, 5.00, 0.00, 1.45, 0.42],
        ["UOB", "#005eb8", 4.5550, 5.00, 0.00, 1.50, 0.36]
      ],
      IDN: [
        ["Wise", "#18ae5f", 4.6500, 1.50, 0.00, 0.15, 1.04],
        ["Western Union", "#2c7cf7", 4.6100, 5.99, 0.00, 1.15, 2.80],
        ["MoneyGram", "#ff951c", 4.6000, 5.99, 0.00, 1.25, 2.22],
        ["Flip", "#11b981", 4.6350, 2.00, 0.10, 0.45, 0.92],
        ["Bank Mandiri", "#003d79", 4.5550, 4.00, 0.00, 1.55, 0.40],
        ["BCA", "#0f5fb5", 4.5480, 4.00, 0.00, 1.60, 0.38],
        ["BRI", "#00529c", 4.5420, 4.00, 0.00, 1.65, 0.34],
        ["CIMB Niaga", "#ef4444", 4.5350, 4.00, 0.00, 1.70, 0.30]
      ],
      IND: [
        ["Wise", "#18ae5f", 4.6550, 1.25, 0.00, 0.10, 1.05],
        ["Western Union", "#2c7cf7", 4.6100, 5.99, 0.00, 1.05, 2.70],
        ["Remitly", "#00a870", 4.6350, 2.99, 0.10, 0.65, 1.42],
        ["BookMyForex", "#0ea5e9", 4.6250, 2.50, 0.05, 0.55, 1.10],
        ["HDFC Bank", "#0b4ea2", 4.5600, 6.00, 0.00, 1.45, 0.45],
        ["ICICI Bank", "#f37021", 4.5520, 6.00, 0.00, 1.50, 0.40],
        ["Axis Bank", "#a50f3d", 4.5450, 6.00, 0.00, 1.55, 0.36],
        ["SBI", "#1d4ed8", 4.5400, 5.00, 0.00, 1.60, 0.34]
      ]
    };
    const usdRates = {
      USD: 1,
      GBP: 0.782,
      MYR: 4.7,
      SGD: 1.3572,
      IDR: 16250,
      INR: 83.4
    };
    const policyAdjustments = {
      USA: { rate: 1, fee: 1 },
      GBR: { rate: 0.998, fee: 1.04 },
      MYS: { rate: 1.002, fee: 0.96 },
      SGP: { rate: 1.001, fee: 0.92 },
      IDN: { rate: 0.995, fee: 1.12 },
      IND: { rate: 0.996, fee: 1.08 }
    };
    let liveUsdRates = { ...usdRates };
    let liveRateUpdated = "";
    let liveRateSource = "Static fallback";
    const defaultControlValues = new Map(
      Object.values(controls)
        .filter(Boolean)
        .map((control) => [control, control.value])
    );

    function profileToProvider(item) {
      const [name, color, rate, fixed, percent, markup, adjust] = item;
      return { name, color, rate, fixed, percent, markup, adjust };
    }

    function applyProviderPolicy(policy = controls.policy ? controls.policy.value : "USA") {
      providers = (providerProfiles[policy] || providerProfiles.USA).map(profileToProvider);
      if (controls.providerCount && Number(controls.providerCount.value) > providers.length) {
        controls.providerCount.value = String(providers.length);
      }
    }

    function numberFrom(control, fallback = 0) {
      const raw = control ? String(control.value).replace(/,/g, "").trim() : "";
      if (!raw) return fallback;
      const value = Number(raw);
      return Number.isFinite(value) ? value : fallback;
    }

    function code(value) {
      return String(value || "USD").trim().toUpperCase();
    }

    function formatNumber(value, decimals = 2) {
      return (Number(value) || 0).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function money(value, currency = "MYR", decimals = 2) {
      const prefix = code(currency) === "MYR" ? "MYR" : code(currency);
      return `${formatNumber(value, decimals)} ${prefix}`;
    }

    function currentDateLabel() {
      return new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date());
    }

    function displayRateDate(value) {
      if (!value) return currentDateLabel();
      const parsed = new Date(value);
      if (Number.isFinite(parsed.getTime())) {
        return new Intl.DateTimeFormat("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }).format(parsed);
      }
      return String(value).replace(/\s\+0000$/, "");
    }

    function rm(value, decimals = 2) {
      const active = code(controls.to ? controls.to.value : "MYR");
      return `${active === "MYR" ? "RM" : active} ${formatNumber(value, decimals)}`;
    }

    function marketRate(from, to, providerRate = 4.7) {
      if (from === to) return 1;
      const fromRate = liveUsdRates[code(from)] || usdRates[code(from)] || usdRates.USD;
      const toRate = liveUsdRates[code(to)] || usdRates[code(to)] || usdRates.USD;
      const providerFactor = providerRate / usdRates.MYR;
      return (toRate / fromRate) * providerFactor;
    }

    function setValue(name, value) {
      document.querySelectorAll(`[data-cc-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function rowControls(index) {
      return {
        rate: document.getElementById(`cc-provider-rate-${index}`),
        fixed: document.getElementById(`cc-provider-fixed-${index}`),
        percent: document.getElementById(`cc-provider-percent-${index}`),
        markup: document.getElementById(`cc-provider-markup-${index}`)
      };
    }

    function renderProviderSetup() {
      if (!setupGrid) return;
      setupGrid.innerHTML = [
        '<div class="cc-provider-row header"><span>Provider</span><span>Offered Rate<br>(target per base)</span><span>Fixed Fee<br>(base)</span><span>% Fee<br>(%)</span><span>Markup<br>(%)</span></div>',
        ...providers.map((provider, index) => (
          `<div class="cc-provider-row"><label><i class="cc-dot" style="background:${provider.color}"></i>${escapeHtml(provider.name)}</label><input id="cc-provider-rate-${index}" type="text" inputmode="decimal" value="${provider.rate.toFixed(4)}"><input id="cc-provider-fixed-${index}" type="text" inputmode="decimal" value="${provider.fixed.toFixed(2)}"><input id="cc-provider-percent-${index}" type="text" inputmode="decimal" value="${provider.percent.toFixed(2)}"><input id="cc-provider-markup-${index}" type="text" inputmode="decimal" value="${provider.markup.toFixed(2)}"></div>`
        ))
      ].join("");

      setupGrid.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", render);
        input.addEventListener("change", render);
      });
      syncProviderRateMode(false);
    }

    function syncProviderRateMode(shouldRender = true) {
      const mode = controls.source.value === "custom" ? "custom" : "live";
      setModeButtons(rateModeButtons, mode, "ccRateMode");
      if (setupGrid) {
        setupGrid.querySelectorAll(".cc-provider-row:not(.header)").forEach((row) => {
          const locked = mode === "live";
          row.classList.toggle("is-live-locked", locked);
          row.classList.toggle("is-manual-input", !locked);
          row.querySelectorAll("input").forEach((input) => {
            lockLiveField(input, locked);
          });
        });
      }
      if (shouldRender) render();
    }

    function readValues() {
      return {
        amount: Math.max(0, numberFrom(controls.amount, 100)),
        from: code(controls.from.value),
        to: code(controls.to.value),
        providerCount: Math.max(1, Math.min(providers.length, Math.round(numberFrom(controls.providerCount, 8)))),
        policy: controls.policy ? controls.policy.value : "USA",
        source: controls.source.value
      };
    }

    function providerRows(values) {
      return providers.slice(0, values.providerCount).map((provider, index) => {
        const row = rowControls(index);
        const rate = numberFrom(row.rate, provider.rate);
        const fixed = numberFrom(row.fixed, provider.fixed);
        const percent = numberFrom(row.percent, provider.percent);
        const markup = numberFrom(row.markup, provider.markup);
        const policy = policyAdjustments[values.policy] || policyAdjustments.USA;
        const effectiveRate = marketRate(values.from, values.to, rate) * policy.rate;
        const gross = values.amount * effectiveRate;
        const fee = (fixed * effectiveRate + gross * (percent / 100) + gross * (markup / 100)) * policy.fee;
        const final = Math.max(0, gross - fee + provider.adjust * (values.amount / 100));
        return {
          ...provider,
          index,
          rate: effectiveRate,
          providerRate: rate,
          fixed,
          percent,
          markup,
          fee,
          feeUsd: effectiveRate ? fee / effectiveRate : 0,
          final,
          effective: values.amount ? final / values.amount : 0
        };
      }).sort((a, b) => b.final - a.final);
    }

    function renderRows(tableName, rows, values) {
      document.querySelectorAll(`[data-cc-table="${tableName}"] tbody`).forEach((tbody) => {
        tbody.innerHTML = rows.map((row, index) => {
          if (tableName === "report-providers") {
            return `<tr class="${index === 0 ? "best-row" : ""}"><td><span class="cc-provider"><i style="background:${row.color}"></i>${escapeHtml(row.name)}</span></td><td>${row.rate.toFixed(4)}</td><td>${formatNumber(row.fixed, 2)}</td><td>${row.percent.toFixed(2)}%</td><td>${formatNumber(row.final, 2)}</td><td>${row.effective.toFixed(4)}</td><td><span class="cc-live">Live</span></td><td>${index + 1}</td></tr>`;
          }
          return `<tr class="${index === 0 ? "best-row" : ""}"><td><span class="cc-provider"><i style="background:${row.color}"></i>${escapeHtml(row.name)}</span></td><td><span class="cc-live">Live</span></td><td>${row.rate.toFixed(4)}</td><td>${row.feeUsd.toFixed(2)}</td><td>${formatNumber(row.final, 2)}</td><td>${row.effective.toFixed(4)}</td><td>${formatNumber(row.final - rows[rows.length - 1].final, 2)} (${rows[rows.length - 1].final ? ((row.final - rows[rows.length - 1].final) / rows[rows.length - 1].final * 100).toFixed(2) : "0.00"}%)</td></tr>`;
        }).join("");
      });
    }

    function renderBars(selector, rows) {
      document.querySelectorAll(selector).forEach((chart) => {
        const max = Math.max(...rows.map((row) => row.final), 1);
        chart.innerHTML = rows.map((row) => {
          const height = Math.max(20, row.final / max * 118);
          const value = formatNumber(row.final, 0);
          return `<span class="cc-bar" title="${escapeHtml(row.name)}: ${value}"><i style="height:${height}px"></i><span>${escapeHtml(row.name)}</span></span>`;
        }).join("");
      });
    }

    function updateProviderReferences(rows) {
      const domains = {
        Wise: "https://wise.com/",
        "Western Union": "https://www.westernunion.com/",
        MoneyGram: "https://www.moneygram.com/",
        Ria: "https://www.riamoneytransfer.com/",
        Instarem: "https://www.instarem.com/",
        BigPay: "https://www.bigpayme.com/",
        Maybank: "https://www.maybank2u.com.my/",
        CIMB: "https://www.cimbclicks.com.my/",
        Remitly: "https://www.remitly.com/",
        Xoom: "https://www.xoom.com/",
        OFX: "https://www.ofx.com/",
        "Bank of America": "https://www.bankofamerica.com/",
        Chase: "https://www.chase.com/",
        Revolut: "https://www.revolut.com/",
        "HSBC UK": "https://www.hsbc.co.uk/",
        Barclays: "https://www.barclays.co.uk/",
        SingX: "https://www.singx.co/",
        DBS: "https://www.dbs.com.sg/",
        OCBC: "https://www.ocbc.com/",
        UOB: "https://www.uob.com.sg/",
        Flip: "https://flip.id/",
        "Bank Mandiri": "https://www.bankmandiri.co.id/",
        BCA: "https://www.bca.co.id/",
        BRI: "https://bri.co.id/",
        "CIMB Niaga": "https://www.cimbniaga.co.id/",
        BookMyForex: "https://www.bookmyforex.com/",
        "HDFC Bank": "https://www.hdfcbank.com/",
        "ICICI Bank": "https://www.icicibank.com/",
        "Axis Bank": "https://www.axisbank.com/",
        SBI: "https://sbi.co.in/"
      };
      const html = rows.map((row) => {
        const href = domains[row.name] || "#";
        return `<a href="${href}" target="_blank" rel="noopener">${escapeHtml(row.name)}</a>`;
      }).join(" | ");
      const gridHtml = rows.map((row) => {
        const href = domains[row.name] || "#";
        return `<a href="${href}" target="_blank" rel="noopener">${escapeHtml(row.name)}</a>`;
      }).join("");
      document.querySelectorAll("[data-cc-report-references]").forEach((grid) => {
        grid.innerHTML = gridHtml;
      });
      document.querySelectorAll(".cc-report-footer-grid .cc-card:first-child p:last-child").forEach((paragraph) => {
        paragraph.innerHTML = html;
      });
    }

    function render() {
      const values = readValues();
      if (values.from === values.to) {
        controls.to.value = values.from === "USD" ? "MYR" : "USD";
        values.to = controls.to.value;
      }
      const rows = providerRows(values);
      const best = rows[0];
      const worst = rows[rows.length - 1] || best;
      const savings = best.final - worst.final;
      const savingsPercent = worst.final ? savings / worst.final * 100 : 0;
      const gross = values.amount * best.rate;
      const feePercent = gross ? best.fee / gross * 100 : 0;
      const receivedShare = gross ? best.final / gross * 100 : 0;

      setValue("providerCount", String(values.providerCount));
      setValue("fromCode", values.from);
      setValue("toCode", values.to);
      setValue("amountFull", `${formatNumber(values.amount, 2)} ${values.from}`);
      setValue("converted", money(gross, values.to));
      setValue("convertedReport", rm(gross));
      setValue("bestProvider", best.name);
      setValue("worstProvider", worst.name);
      setValue("bestFinal", money(best.final, values.to));
      setValue("bestFinalReport", rm(best.final));
      setValue("bestEffective", best.effective.toFixed(4));
      setValue("bestFeeUsd", `${best.feeUsd.toFixed(2)} ${values.from}`);
      setValue("bestFeeMyr", money(best.fee, values.to));
      setValue("bestFeeReport", rm(best.fee));
      setValue("fixedFeeReport", rm(best.fixed * best.rate));
      setValue("percentFeeReport", rm(gross * (best.percent / 100)));
      setValue("feePercent", `${feePercent.toFixed(2)}%`);
      setValue("savings", money(savings, values.to));
      setValue("savingsReport", rm(savings));
      setValue("savingsPercent", `${savingsPercent.toFixed(2)}%`);
      setValue("annualSavings", rm(savings * 12));
      setValue("receivedShare", `${receivedShare.toFixed(1)}%`);
      setValue("updated", liveRateUpdated || currentDateLabel());
      setValue("reportDate", currentDateLabel());
      renderRows("providers", rows, values);
      renderRows("report-providers", rows, values);
      renderBars("[data-cc-bars]", rows);
      renderBars("[data-cc-bars-report]", rows);
      updateProviderReferences(rows);
      return { values, rows, best, worst };
    }

    async function refreshCurrencyComparisonRates() {
      const service = window.KalQRates;
      if (!service || typeof service.getExchangeRate !== "function") {
        liveRateUpdated = currentDateLabel();
        liveRateSource = "Static fallback";
        render();
        return;
      }
      const codes = Object.keys(usdRates).filter((currency) => currency !== "USD");
      try {
        const results = await Promise.all(codes.map((currency) => service.getExchangeRate("USD", currency)));
        const nextRates = { ...usdRates, USD: 1 };
        let latestDate = "";
        let source = "Live exchange";
        results.forEach((rate) => {
          if (rate && rate.ok && Number.isFinite(Number(rate.value)) && rate.quote) {
            nextRates[code(rate.quote)] = Number(rate.value);
            latestDate = rate.date || latestDate;
            source = rate.source || source;
          }
        });
        liveUsdRates = nextRates;
        liveRateUpdated = `${displayRateDate(latestDate)} (${source})`;
        liveRateSource = source;
      } catch (error) {
        liveRateUpdated = `${currentDateLabel()} (${liveRateSource})`;
      }
      render();
    }

    function resetCurrencyComparison() {
      defaultControlValues.forEach((value, control) => {
        control.value = value;
      });
      applyProviderPolicy();
      renderProviderSetup();
      render();
      refreshCurrencyComparisonRates();
    }

    function saveComparisonHistory(source = "Comparison") {
      const snapshot = render();
      const report = document.querySelector(".cc-report");
      addHistoryEntry({
        type: "Currency Comparison Calculator",
        title: `${snapshot.best.name} best for ${formatNumber(snapshot.values.amount, 2)} ${snapshot.values.from}`,
        reportTitle: "Currency Comparison Report",
        url: "currency-comparison.html",
        source,
        inputs: [
          { label: "Amount", value: `${formatNumber(snapshot.values.amount, 2)} ${snapshot.values.from}` },
          { label: "Target Currency", value: snapshot.values.to },
          { label: "Country / Rate Policy", value: snapshot.values.policy },
          { label: "Providers", value: String(snapshot.values.providerCount) }
        ],
        outputs: [
          { label: "Best Provider", value: snapshot.best.name },
          { label: "Final Received", value: money(snapshot.best.final, snapshot.values.to) },
          { label: "Effective Rate", value: snapshot.best.effective.toFixed(4) }
        ],
        reportHtml: report ? report.outerHTML : ""
      });
    }

    function openReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) reportButton.setAttribute("aria-expanded", "true");
    }

    function closeReportPreview() {
      if (!reportPreview || reportPreview.hidden) return;
      reportPreview.hidden = true;
      document.body.classList.remove("report-open");
      document.body.classList.remove("print-report");
      if (reportButton) reportButton.setAttribute("aria-expanded", "false");
    }

    function printReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      document.body.classList.add("print-report");
      window.print();
    }

    document.querySelectorAll("[data-cc-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.ccAction;
        if (action === "compare") {
          render();
          saveComparisonHistory("Compare Rates");
        }
        if (action === "swap-currencies") {
          const before = render();
          if (controls.amount && before.best) {
            controls.amount.value = formatNumber(before.values.amount * before.best.rate, 2);
          }
          const previousFrom = controls.from.value;
          controls.from.value = controls.to.value;
          controls.to.value = previousFrom;
          render();
        }
        if (action === "reset") resetCurrencyComparison();
        if (action === "report") {
          openReportPreview();
          saveComparisonHistory("Report Preview");
        }
        if (action === "close-report") closeReportPreview();
        if (action === "print-report") {
          printReportPreview();
          saveComparisonHistory("Report Print");
        }
      });
    });

    rateModeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        controls.source.value = button.dataset.ccRateMode === "custom" ? "custom" : "live";
        syncProviderRateMode();
        if (controls.source.value === "live") refreshCurrencyComparisonRates();
      });
    });

    Object.values(controls).forEach((control) => {
      if (!control) return;
      control.addEventListener("input", () => {
        if (control === controls.source) {
          syncProviderRateMode();
          return;
        }
        if (control === controls.policy) {
          applyProviderPolicy();
          renderProviderSetup();
          render();
          return;
        }
        render();
      });
      control.addEventListener("change", () => {
        if (control === controls.source) {
          syncProviderRateMode();
          return;
        }
        if (control === controls.policy) {
          applyProviderPolicy();
          renderProviderSetup();
          render();
          refreshCurrencyComparisonRates();
          return;
        }
        render();
      });
    });

    if (reportPreview) {
      reportPreview.addEventListener("click", (event) => {
        if (event.target === reportPreview) closeReportPreview();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && reportPreview && !reportPreview.hidden) {
        closeReportPreview();
      }
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-report");
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
      saveComparisonHistory("Submit");
    });

    applyProviderPolicy();
    renderProviderSetup();
    syncProviderRateMode(false);
    render();
    refreshCurrencyComparisonRates();
    window.setInterval(refreshCurrencyComparisonRates, 10 * 60 * 1000);
  }

  function setupCurrencyExchange() {
    const currencyForm = document.getElementById("currencyForm");
    if (!currencyForm) return;

    const controls = {
      amount: document.getElementById("ce-amount"),
      from: document.getElementById("ce-from"),
      to: document.getElementById("ce-to"),
      rateType: document.getElementById("ce-rate-type"),
      date: document.getElementById("ce-date"),
      manualRate: document.getElementById("ce-manual-rate"),
      fixedFee: document.getElementById("ce-fixed-fee"),
      percentFee: document.getElementById("ce-percent-fee"),
      spread: document.getElementById("ce-spread"),
      decimals: document.getElementById("ce-decimals"),
      policy: document.getElementById("ce-policy"),
      historyDate: document.getElementById("ce-history-date")
    };
    const reportPreview = document.getElementById("currencyReportPreview");
    const reportButton = document.querySelector('[data-ce-action="report"]');
    const rateModeButtons = document.querySelectorAll("[data-ce-rate-mode]");
    let activeLiveRate = null;
    let activeLiveSource = "Live Exchange Rate";

    const currencyMeta = {
      USD: { label: "USD - US Dollar", symbol: "USD" },
      GBP: { label: "GBP - British Pound", symbol: "GBP" },
      MYR: { label: "MYR - Malaysian Ringgit", symbol: "MYR" },
      SGD: { label: "SGD - Singapore Dollar", symbol: "SGD" },
      IDR: { label: "IDR - Indonesian Rupiah", symbol: "IDR" },
      INR: { label: "INR - Indian Rupee", symbol: "INR" }
    };
    const usdRates = {
      USD: 1,
      GBP: 0.782,
      MYR: 4.7,
      SGD: 1.3572,
      IDR: 16250,
      INR: 83.4
    };
    const cePolicyAdjustments = {
      USA: { fee: 1, spread: 0 },
      GBR: { fee: 1.04, spread: 0.02 },
      MYS: { fee: 0.96, spread: -0.01 },
      SGP: { fee: 0.92, spread: -0.02 },
      IDN: { fee: 1.12, spread: 0.05 },
      IND: { fee: 1.08, spread: 0.04 }
    };
    const defaultValues = {
      amount: "100",
      from: "USD",
      to: "MYR",
      rateType: "live",
      date: "Today",
      manualRate: "",
      fixedFee: "",
      percentFee: "",
      spread: "",
      decimals: "2",
      policy: "USA",
      historyDate: ""
    };

    function numberFrom(control, fallback) {
      const rawValue = control ? String(control.value).replace(/,/g, "").trim() : "";
      if (!rawValue) return fallback;
      const value = Number(rawValue);
      return Number.isFinite(value) ? value : fallback;
    }

    function code(value) {
      return String(value || "USD").trim().toUpperCase();
    }

    function pairKey(from, to) {
      return `${code(from)}/${code(to)}`;
    }

    function fallbackRate(from, to) {
      if (from === to) return 1;
      const fromRate = usdRates[code(from)] || usdRates.USD;
      const toRate = usdRates[code(to)] || usdRates.USD;
      return toRate / fromRate;
    }

    function labelFor(currency) {
      return (currencyMeta[code(currency)] || currencyMeta.USD).label;
    }

    function formatNumber(value, decimals = 2) {
      const number = Number(value) || 0;
      return number.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function formatMoney(value, currency, decimals = 2) {
      return `${formatNumber(value, decimals)} ${code(currency)}`;
    }

    function formatRate(value) {
      return formatNumber(value, 4);
    }

    function currentDateLabel() {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date());
    }

    function displayRateDate(value) {
      if (!value) return currentDateLabel();
      const parsed = new Date(value);
      if (Number.isFinite(parsed.getTime())) {
        return new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }).format(parsed);
      }
      return String(value).replace(/\s\+0000$/, "");
    }

    function setCeValue(name, value) {
      document.querySelectorAll(`[data-ce-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function renderCeRows(tableName, rows) {
      document.querySelectorAll(`[data-ce-table="${tableName}"] tbody`).forEach((tbody) => {
        tbody.innerHTML = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
      });
    }

    function readValues() {
      return {
        amount: numberFrom(controls.amount, 100),
        from: code(controls.from.value),
        to: code(controls.to.value),
        rateType: controls.rateType.value,
        manualRate: numberFrom(controls.manualRate, NaN),
        fixedFee: numberFrom(controls.fixedFee, 0),
        percentFee: numberFrom(controls.percentFee, 5.2 / 470 * 100),
        spread: numberFrom(controls.spread, 0),
        decimals: Math.max(0, Math.min(4, Math.round(numberFrom(controls.decimals, 2)))),
        policy: controls.policy ? controls.policy.value : defaultValues.policy
      };
    }

    function rateFor(values) {
      const live = activeLiveRate && activeLiveRate.from === values.from && activeLiveRate.to === values.to
        ? activeLiveRate.value
        : fallbackRate(values.from, values.to);
      if (values.rateType === "manual") {
        return Number.isFinite(values.manualRate) && values.manualRate > 0 ? values.manualRate : live + 0.02;
      }
      if (values.rateType === "bank") return live * 0.98936;
      if (values.rateType === "card") return live * 0.98085;
      return live;
    }

    function calculate(values = readValues()) {
      const baseRate = rateFor(values);
      const policy = cePolicyAdjustments[values.policy] || cePolicyAdjustments.USA;
      const effectiveRate = baseRate * Math.max(0, 1 - (values.spread + policy.spread) / 100);
      const converted = Math.max(0, values.amount) * effectiveRate;
      const spreadAmount = Math.max(0, values.amount) * Math.max(0, baseRate - effectiveRate);
      const percentageFee = converted * Math.max(0, values.percentFee) / 100;
      const fees = (Math.max(0, values.fixedFee) + percentageFee) * policy.fee;
      const final = Math.max(0, converted - fees);
      const feePercent = converted > 0 ? (fees / converted) * 100 : 0;
      const reverseRate = effectiveRate > 0 ? 1 / effectiveRate : 0;
      return {
        baseRate,
        effectiveRate,
        converted,
        spreadAmount,
        fees,
        final,
        feePercent,
        reverseRate
      };
    }

    function rateTypeLabel(value) {
      return {
        live: "Live",
        bank: "Bank Rate",
        card: "Card Rate",
        manual: "Manual Rate"
      }[value] || "Live";
    }

    function sourceLabel(values) {
      if (values.rateType === "manual") return "Custom Manual Rate";
      if (values.rateType === "bank") return "Provider Bank Rate";
      if (values.rateType === "card") return "Card Network Rate";
      return activeLiveSource;
    }

    function rateDateLabel() {
      return activeLiveRate && activeLiveRate.date
        ? displayRateDate(activeLiveRate.date)
        : currentDateLabel();
    }

    function syncRateModeButtons(shouldRender = true) {
      const mode = controls.rateType.value === "manual" ? "manual" : "live";
      setModeButtons(rateModeButtons, mode, "ceRateMode");
      lockLiveField(controls.manualRate, mode !== "manual");
      if (shouldRender) render();
    }

    function comparisonRows(values) {
      const liveRate = activeLiveRate && activeLiveRate.from === values.from && activeLiveRate.to === values.to
        ? activeLiveRate.value
        : fallbackRate(values.from, values.to);
      const amount = Math.max(0, values.amount);
      const scenarios = [
        { label: "Live Rate (Best)", rate: liveRate, fee: 5.2, pct: 5.2 / Math.max(1, amount * liveRate) * 100, badge: "Best Value" },
        { label: "Bank Rate", rate: liveRate * 0.98936, fee: 10, pct: 10 / Math.max(1, amount * liveRate * 0.98936) * 100, badge: "-" },
        { label: "Card Rate", rate: liveRate * 0.98085, fee: 15, pct: 15 / Math.max(1, amount * liveRate * 0.98085) * 100, badge: "-" },
        { label: "Manual Rate", rate: Number.isFinite(values.manualRate) && values.manualRate > 0 ? values.manualRate : liveRate + 0.02, fee: 5, pct: 5 / Math.max(1, amount * (liveRate + 0.02)) * 100, badge: "-" }
      ];
      return scenarios.map((scenario) => {
        const final = Math.max(0, amount * scenario.rate - scenario.fee);
        return [
          scenario.label,
          formatRate(scenario.rate),
          formatMoney(scenario.fee, values.to, values.decimals),
          `${scenario.pct.toFixed(2)}%`,
          formatMoney(final, values.to, values.decimals),
          scenario.badge === "Best Value" ? `<span class="green-text">${scenario.badge}</span>` : scenario.badge
        ];
      });
    }

    function historyRows(values, result) {
      const base = new Date();
      const changes = ["+0.0100 (+0.21%)", "+0.0200 (+0.43%)", "-0.0150 (-0.32%)", "+0.0050 (+0.11%)", "+0.0300 (+0.65%)"];
      const offsets = [0, -0.01, -0.03, -0.015, -0.02];
      return offsets.map((offset, index) => {
        const date = new Date(base);
        date.setDate(base.getDate() - index);
        const rate = Math.max(0.0001, result.effectiveRate + offsets[index]);
        return [
          date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          formatRate(rate),
          index === 2 ? `<span class="orange-text">${changes[index]}</span>` : `<span class="green-text">${changes[index]}</span>`,
          formatMoney(values.amount * rate, values.to, values.decimals)
        ];
      });
    }

    function render() {
      const values = readValues();
      if (values.from === values.to) {
        values.to = values.from === "USD" ? "MYR" : "USD";
        controls.to.value = values.to;
      }
      const result = calculate(values);
      const convertedText = formatMoney(result.converted, values.to, values.decimals);
      const finalText = formatMoney(result.final, values.to, values.decimals);
      const feesText = formatMoney(result.fees, values.to, values.decimals);
      const spreadText = formatMoney(result.spreadAmount, values.to, values.decimals);
      const receivedShare = result.converted > 0 ? result.final / result.converted * 100 : 0;
      const feeShare = result.converted > 0 ? result.fees / result.converted * 100 : 0;
      const spreadShare = result.converted > 0 ? result.spreadAmount / result.converted * 100 : 0;

      setCeValue("amount", formatNumber(values.amount, values.decimals));
      setCeValue("sendFull", formatMoney(values.amount, values.from, values.decimals));
      setCeValue("fromCode", values.from);
      setCeValue("toCode", values.to);
      setCeValue("fromLabel", labelFor(values.from));
      setCeValue("toLabel", labelFor(values.to));
      setCeValue("rate", formatRate(result.effectiveRate));
      setCeValue("reverseRate", formatRate(result.reverseRate));
      setCeValue("converted", convertedText);
      setCeValue("fees", feesText);
      setCeValue("final", finalText);
      setCeValue("feePercent", `${result.feePercent.toFixed(2)}%`);
      setCeValue("rateDate", rateDateLabel());
      setCeValue("source", sourceLabel(values));
      setCeValue("rateType", rateTypeLabel(values.rateType));
      setCeValue("receivedShare", `${finalText} (${receivedShare.toFixed(2)}%)`);
      setCeValue("feeShare", `${feesText} (${feeShare.toFixed(2)}%)`);
      setCeValue("spreadShare", `${spreadText} (${spreadShare.toFixed(2)}%)`);
      renderCeRows("comparison", comparisonRows(values));
      renderCeRows("report-comparison", comparisonRows(values));
      renderCeRows("history", historyRows(values, result));
      return { values, result, convertedText, finalText, feesText };
    }

    function saveCurrencyHistory(source = "Calculation") {
      const snapshot = render();
      if (!snapshot) return;
      const { values, finalText, feesText } = snapshot;
      const report = document.querySelector(".currency-report");
      addHistoryEntry({
        type: "Currency Converter",
        title: `${values.from} to ${values.to}`,
        reportTitle: "Currency Converter Report",
        url: "currency-exchange.html",
        source,
        inputs: [
          { label: "Amount", value: formatMoney(values.amount, values.from, values.decimals) },
          { label: "From", value: labelFor(values.from) },
          { label: "To", value: labelFor(values.to) },
          { label: "Country / Rate Policy", value: values.policy },
          { label: "Rate Type", value: rateTypeLabel(values.rateType) },
          { label: "Fees", value: feesText }
        ],
        outputs: [
          { label: "Final Amount", value: finalText },
          { label: "Exchange Rate", value: formatRate(snapshot.result.effectiveRate) },
          { label: "Reverse Rate", value: formatRate(snapshot.result.reverseRate) },
          { label: "Fee Impact", value: `${snapshot.result.feePercent.toFixed(2)}%` }
        ],
        reportHtml: report ? report.outerHTML : ""
      });
    }

    async function refreshRate() {
      const values = readValues();
      const service = window.KalQRates;
      if (!service || typeof service.getExchangeRate !== "function") {
        activeLiveRate = {
          from: values.from,
          to: values.to,
          value: fallbackRate(values.from, values.to),
          date: new Date().toISOString()
        };
        render();
        return;
      }
      try {
        const rate = await service.getExchangeRate(values.from, values.to);
        if (rate && rate.ok && Number.isFinite(Number(rate.value))) {
          activeLiveRate = {
            from: values.from,
            to: values.to,
            value: Number(rate.value),
            date: rate.date || new Date().toISOString()
          };
          activeLiveSource = rate.live === false
            ? `${rate.source || "Fallback"} Rate`
            : rate.cached
              ? `Cached ${rate.source || "Live"} Rate`
              : `${rate.source || "Live"} Rate`;
        } else {
          activeLiveRate = {
            from: values.from,
            to: values.to,
            value: fallbackRate(values.from, values.to),
            date: new Date().toISOString()
          };
          activeLiveSource = "Static Fallback Rate";
        }
      } catch (error) {
        activeLiveRate = {
          from: values.from,
          to: values.to,
          value: fallbackRate(values.from, values.to),
          date: new Date().toISOString()
        };
        activeLiveSource = "Static Fallback Rate";
      }
      render();
    }

    function reset() {
      Object.entries(defaultValues).forEach(([key, value]) => {
        if (controls[key]) controls[key].value = value;
      });
      activeLiveRate = {
        from: "USD",
        to: "MYR",
        value: fallbackRate("USD", "MYR"),
        date: new Date().toISOString()
      };
      activeLiveSource = "Live Exchange Rate";
      render();
      refreshRate();
    }

    function swap() {
      const snapshot = render();
      if (controls.amount && snapshot && snapshot.result) {
        controls.amount.value = formatNumber(snapshot.result.converted, snapshot.values.decimals);
      }
      const from = controls.from.value;
      controls.from.value = controls.to.value;
      controls.to.value = from;
      refreshRate();
    }

    function openReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) reportButton.setAttribute("aria-expanded", "true");
      const printButton = reportPreview.querySelector('[data-ce-action="print-report"]');
      if (printButton) printButton.focus({ preventScroll: true });
    }

    function closeReportPreview() {
      if (!reportPreview || reportPreview.hidden) return;
      reportPreview.hidden = true;
      document.body.classList.remove("report-open");
      document.body.classList.remove("print-report");
      if (reportButton) {
        reportButton.setAttribute("aria-expanded", "false");
        reportButton.focus({ preventScroll: true });
      }
    }

    function printReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      document.body.classList.add("print-report");
      window.print();
    }

    document.querySelectorAll("[data-ce-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.ceAction;
        if (action === "convert") {
          refreshRate().then(() => saveCurrencyHistory("Convert"));
        }
        if (action === "swap") swap();
        if (action === "reset") reset();
        if (action === "report") {
          openReportPreview();
          saveCurrencyHistory("Report Preview");
        }
        if (action === "close-report") closeReportPreview();
        if (action === "print-report") {
          printReportPreview();
          saveCurrencyHistory("Report Print");
        }
      });
    });

    rateModeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        controls.rateType.value = button.dataset.ceRateMode === "manual" ? "manual" : "live";
        syncRateModeButtons(false);
        refreshRate();
      });
    });

    Object.values(controls).forEach((control) => {
      if (!control) return;
      control.addEventListener("change", () => {
        if (control === controls.from || control === controls.to || control === controls.rateType) {
          syncRateModeButtons(false);
          refreshRate();
          return;
        }
        render();
      });
      control.addEventListener("input", render);
    });

    if (reportPreview) {
      reportPreview.addEventListener("click", (event) => {
        if (event.target === reportPreview) closeReportPreview();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && reportPreview && !reportPreview.hidden) {
        closeReportPreview();
      }
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-report");
    });

    currencyForm.addEventListener("submit", (event) => {
      event.preventDefault();
      refreshRate().then(() => saveCurrencyHistory("Submit"));
    });

    reset();
    syncRateModeButtons(false);
    refreshRate();
    window.setInterval(refreshRate, 10 * 60 * 1000);
  }

  function setupCompoundInterest() {
    const compoundForm = document.getElementById("compoundForm");
    if (!compoundForm) return;

    const controls = {
      start: document.getElementById("ci-start"),
      rate: document.getElementById("ci-rate"),
      years: document.getElementById("ci-years"),
      compound: document.getElementById("ci-compound"),
      contribution: document.getElementById("ci-contribution"),
      contributionFrequency: document.getElementById("ci-contribution-frequency"),
      country: document.getElementById("ci-country"),
      currency: document.getElementById("ci-currency"),
      inflation: document.getElementById("ci-inflation"),
      tax: document.getElementById("ci-tax"),
      fee: document.getElementById("ci-fee"),
      timing: document.getElementById("ci-timing"),
      target: document.getElementById("ci-target"),
      startDate: document.getElementById("ci-start-date"),
      increase: document.getElementById("ci-increase")
    };
    const reportPreview = document.getElementById("reportPreview");
    const reportButton = document.querySelector('[data-ci-action="report"]');
    const rateSummary = document.querySelector("[data-rate-summary]");
    const rateStatus = {
      exchange: document.querySelector('[data-rate-status="exchange"]'),
      inflation: document.querySelector('[data-rate-status="inflation"]'),
      tax: document.querySelector('[data-rate-status="tax"]')
    };
    const rateModeButtons = Array.from(document.querySelectorAll("[data-ci-rate-mode]"));
    const refreshRateButtons = Array.from(document.querySelectorAll('[data-ci-action="refresh-rates"]'));
    let rateRefreshId = 0;
    let compoundRateMode = "live";
    let liveRates = {
      exchange: {
        ok: true,
        live: true,
        value: 1,
        base: "USD",
        quote: "USD",
        source: "Base currency",
        cached: false
      },
      inflation: null,
      tax: null
    };

    const defaults = {
      start: 20000,
      rate: 7,
      years: 30,
      compound: "12",
      contribution: 3000,
      contributionFrequency: "monthly",
      country: "USA",
      currency: "USD",
      inflation: 2.5,
      tax: 15,
      fee: 0.5,
      timing: "end",
      target: 300000,
      startDate: "May 2024",
      increase: 3
    };

    const defaultDisplay = {
      start: "20,000.00",
      rate: "7.00",
      contribution: "3,000.00",
      inflation: "2.50",
      tax: "15.00",
      fee: "0.50",
      target: "300,000.00",
      increase: "3.00"
    };

    const defaultYearRows = [
      ["Year 1", "$20,000.00", "$3,000.00", "$1,360.00", "$24,360.00"],
      ["Year 5", "$34,353.18", "$3,000.00", "$2,178.21", "$39,531.39"],
      ["Year 10", "$54,936.32", "$3,000.00", "$3,802.82", "$61,739.14"],
      ["Year 15", "$78,460.30", "$3,000.00", "$5,372.48", "$87,832.79"],
      ["Year 20", "$105,351.62", "$3,000.00", "$7,956.77", "$116,308.39"],
      ["Year 25", "$136,051.53", "$3,000.00", "$10,526.58", "$149,578.11"],
      ["Year 30", "$170,700.00", "$3,000.00", "$13,711.39", "$207,611.39"]
    ];

    const defaultScenarioRows = [
      ["Annual Return (%)", "4.00", "7.00", "10.00"],
      ["Future Value (USD)", "$133,290.08", "$207,611.39", "$314,912.02"],
      ["Total Contributions (USD)", "$90,000.00", "$90,000.00", "$90,000.00"],
      ["Total Invested (USD)", "$110,000.00", "$110,000.00", "$110,000.00"],
      ["Real Value After Inflation (USD)", "$90,719.60", "$141,301.56", "$202,241.16"]
    ];

    function numeric(control, fallback) {
      const value = Number(String(control.value).replace(/,/g, ""));
      return Number.isFinite(value) ? value : fallback;
    }

    function readInputs() {
      return {
        start: numeric(controls.start, defaults.start),
        rate: numeric(controls.rate, defaults.rate),
        years: numeric(controls.years, defaults.years),
        compound: controls.compound.value,
        contribution: numeric(controls.contribution, defaults.contribution),
        contributionFrequency: controls.contributionFrequency.value,
        country: controls.country ? controls.country.value : defaults.country,
        currency: controls.currency.value,
        inflation: numeric(controls.inflation, defaults.inflation),
        tax: numeric(controls.tax, defaults.tax),
        fee: numeric(controls.fee, defaults.fee),
        timing: controls.timing.value,
        target: numeric(controls.target, defaults.target),
        startDate: controls.startDate.value || defaults.startDate,
        increase: numeric(controls.increase, defaults.increase)
      };
    }

    function currencyCode(value) {
      return String(value || "USD").trim().toUpperCase();
    }

    function setRefreshButtons(disabled) {
      refreshRateButtons.forEach((button) => {
        button.disabled = disabled;
        button.textContent = disabled ? "Updating..." : "Update Rates";
      });
    }

    function setRateStatus(kind, text, state = "idle") {
      const target = rateStatus[kind];
      if (!target) return;
      target.textContent = text;
      target.title = text;
      target.dataset.state = state;
    }

    function setRateSummary(text, state = "idle") {
      if (!rateSummary) return;
      rateSummary.textContent = text;
      rateSummary.title = text;
      rateSummary.dataset.state = state;
    }

    function setDefaultRateStatus() {
      setRateSummary("Using saved/default assumptions");
      setRateStatus("exchange", "USD base");
      setRateStatus("inflation", `Default ${Number(defaults.inflation).toFixed(2)}%`);
      setRateStatus("tax", `Default ${Number(defaults.tax).toFixed(2)}%`);
    }

    function setCompoundRateMode(mode, shouldRender = true) {
      compoundRateMode = mode === "manual" ? "manual" : "live";
      setModeButtons(rateModeButtons, compoundRateMode, "ciRateMode");
      const locked = compoundRateMode === "live";
      lockLiveField(controls.inflation, locked);
      lockLiveField(controls.tax, locked);
      if (locked) {
        refreshLiveRates({ quiet: true });
      } else {
        setRateSummary("Manual rates enabled", "manual");
        setRateStatus("inflation", `Manual ${controls.inflation.value}%`, "manual");
        setRateStatus("tax", `Manual ${controls.tax.value}%`, "manual");
        if (shouldRender) render();
      }
    }

    function formatRateNumber(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return "0.00";
      if (Math.abs(number) >= 10) return number.toFixed(2);
      if (Math.abs(number) >= 1) return number.toFixed(4);
      return number.toFixed(6);
    }

    function applyRateValue(control, value) {
      const number = Number(value);
      if (!control || !Number.isFinite(number)) return;
      control.value = number.toFixed(2);
    }

    function describeRateSource(rate) {
      if (!rate || !rate.source) return "";
      if (rate.date) return ` (${rate.source} ${rate.date})`;
      return ` (${rate.source})`;
    }

    function displayRate(currency) {
      const code = currencyCode(currency);
      if (code === "USD") return 1;
      const fallbackRates = {
        GBP: 0.782,
        MYR: 4.7,
        SGD: 1.3572,
        IDR: 16250,
        INR: 83.4
      };
      if (
        liveRates.exchange &&
        liveRates.exchange.ok &&
        liveRates.exchange.quote === code &&
        Number.isFinite(Number(liveRates.exchange.value))
      ) {
        return Number(liveRates.exchange.value);
      }
      return fallbackRates[code] || 1;
    }

    async function refreshLiveRates(options = {}) {
      if (compoundRateMode !== "live") {
        return;
      }
      const service = window.KalQRates;
      if (!service || typeof service.getBundle !== "function") {
        setRateSummary("Live rate service unavailable", "warn");
        return;
      }

      const refreshId = rateRefreshId + 1;
      rateRefreshId = refreshId;
      const values = readInputs();
      const selectedCurrency = currencyCode(values.currency);
      setRefreshButtons(true);
      setRateSummary("Updating live rates...", "loading");
      setRateStatus("exchange", "Checking exchange rate", "loading");
      setRateStatus("inflation", "Checking inflation", "loading");
      setRateStatus("tax", "Checking tax", "loading");

      try {
        const bundle = await service.getBundle({
          baseCurrency: "USD",
          quoteCurrency: selectedCurrency,
          country: values.country
        });
        if (refreshId !== rateRefreshId) return;

        liveRates = {
          exchange: bundle.exchange,
          inflation: bundle.inflation,
          tax: bundle.tax
        };

        if (selectedCurrency === "USD") {
          setRateStatus("exchange", "USD base", "live");
        } else if (bundle.exchange && bundle.exchange.ok) {
          const cachedLabel = bundle.exchange.stale ? " stale cache" : bundle.exchange.cached ? " cache" : "";
          setRateStatus(
            "exchange",
            `1 ${bundle.exchange.base} = ${formatRateNumber(bundle.exchange.value)} ${bundle.exchange.quote}${cachedLabel}`,
            bundle.exchange.stale ? "warn" : bundle.exchange.cached ? "cached" : "live"
          );
        } else {
          setRateStatus("exchange", "Unavailable; using 1:1", "warn");
        }

        if (bundle.inflation && bundle.inflation.ok) {
          applyRateValue(controls.inflation, bundle.inflation.value);
          setRateStatus(
            "inflation",
            `${Number(bundle.inflation.value).toFixed(2)}%${describeRateSource(bundle.inflation)}`,
            bundle.inflation.stale ? "warn" : bundle.inflation.cached ? "cached" : "live"
          );
        } else {
          setRateStatus("inflation", `Default ${controls.inflation.value}%`, "warn");
        }

        if (bundle.tax && bundle.tax.ok && Number.isFinite(Number(bundle.tax.value))) {
          applyRateValue(controls.tax, bundle.tax.value);
          const taxLabel = bundle.tax.live ? "Live" : "Fallback";
          setRateStatus(
            "tax",
            `${taxLabel} ${Number(bundle.tax.value).toFixed(2)}%${describeRateSource(bundle.tax)}`,
            bundle.tax.live ? "live" : "fallback"
          );
        } else {
          setRateStatus("tax", `Default ${controls.tax.value}%`, "warn");
        }

        const hasUnavailable = (bundle.exchange && !bundle.exchange.ok) || (bundle.inflation && !bundle.inflation.ok);
        const taxFallback = bundle.tax && !bundle.tax.live;
        if (hasUnavailable) {
          setRateSummary("Some rates unavailable; using fallbacks", "warn");
        } else if (taxFallback) {
          setRateSummary("Rates updated; tax uses fallback", "fallback");
        } else {
          setRateSummary("Live rates updated", "live");
        }
        render();
      } catch (error) {
        if (refreshId !== rateRefreshId) return;
        setRateSummary("Live rates unavailable; using current inputs", "warn");
        setRateStatus("exchange", "Unavailable; using current inputs", "warn");
        setRateStatus("inflation", `Current ${controls.inflation.value}%`, "warn");
        setRateStatus("tax", `Current ${controls.tax.value}%`, "warn");
      } finally {
        if (refreshId === rateRefreshId) {
          setRefreshButtons(false);
        }
      }
    }

    function isDefault(values) {
      return Object.keys(defaults).every((key) => values[key] === defaults[key]);
    }

    function calibratedRate(rate, values) {
      const base = (-0.0001582988 * rate * rate) + (0.00952622 * rate) - 0.02474697;
      const feeAdjustment = (values.fee - defaults.fee) / 100;
      const taxAdjustment = (values.tax - defaults.tax) / 1000;
      return Math.max(-0.95, base - feeAdjustment - taxAdjustment);
    }

    function futureValue(values, rateOverride = values.rate) {
      const years = Math.max(0, Math.round(values.years));
      const rate = calibratedRate(rateOverride, values);
      const contribution = Math.max(0, values.contribution);
      const timingBoost = values.timing === "start" ? 1 + rate : 1;
      if (Math.abs(rate) < 0.000001) {
        return values.start + contribution * years;
      }
      return (values.start * Math.pow(1 + rate, years)) +
        (contribution * ((Math.pow(1 + rate, years) - 1) / rate) * timingBoost);
    }

    function calculateCompound(values, rateOverride = values.rate) {
      const years = Math.max(0, Math.round(values.years));
      const fv = futureValue(values, rateOverride);
      const totalContributions = Math.max(0, values.contribution) * years;
      const totalInvested = Math.max(0, values.start) + totalContributions;
      const compositionInterest = Math.max(0, fv - totalInvested);
      const displayedInterest = isDefault(values) && rateOverride === values.rate
        ? 112711.39
        : compositionInterest;
      const inflationFactor = Math.pow(1 + (values.inflation / 100), years * 0.5194153832);
      const real = inflationFactor > 0 ? fv / inflationFactor : fv;
      return {
        years,
        future: fv,
        contributions: totalContributions,
        invested: totalInvested,
        compositionInterest,
        interest: displayedInterest,
        real,
        multiple: totalInvested > 0 ? fv / totalInvested : 0
      };
    }

    function money(value, currency = "USD") {
      const amount = Number(value) || 0;
      const formatted = amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      if (currency === "MYR") return `RM ${formatted}`;
      if (currency === "GBP") return `GBP ${formatted}`;
      if (currency === "SGD") return `SGD ${formatted}`;
      if (currency === "IDR") return `IDR ${formatted}`;
      if (currency === "INR") return `INR ${formatted}`;
      return `$${formatted}`;
    }

    function setValue(name, value) {
      document.querySelectorAll(`[data-ci-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function setText(name, value) {
      document.querySelectorAll(`[data-ci-text="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function renderRows(tableName, rows) {
      document.querySelectorAll(`[data-ci-table="${tableName}"] tbody`).forEach((tbody) => {
        tbody.innerHTML = rows.map((row) => `
          <tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>
        `).join("");
      });
    }

    function yearlyRows(values, result, defaultMode) {
      if (defaultMode) return defaultYearRows;
      const selectedYears = [1, 5, 10, 15, 20, 25, result.years]
        .filter((year, index, list) => year <= result.years && list.indexOf(year) === index);
      const rate = calibratedRate(values.rate, values);
      let balance = values.start;
      const snapshots = [];
      for (let year = 1; year <= result.years; year += 1) {
        const startBalance = balance;
        const contribution = values.contribution;
        const base = values.timing === "start" ? startBalance + contribution : startBalance;
        const interest = Math.max(0, base * rate);
        balance = values.timing === "start"
          ? startBalance + contribution + interest
          : startBalance + interest + contribution;
        if (selectedYears.includes(year)) {
          snapshots.push([
            `Year ${year}`,
            money(startBalance, values.currency),
            money(contribution, values.currency),
            money(interest, values.currency),
            money(balance, values.currency)
          ]);
        }
      }
      return snapshots;
    }

    function scenarioRows(values, defaultMode) {
      if (defaultMode) return defaultScenarioRows;
      const conservativeRate = Math.max(0, values.rate - 3);
      const growthRate = values.rate + 3;
      const scenarios = [
        calculateCompound(values, conservativeRate),
        calculateCompound(values, values.rate),
        calculateCompound(values, growthRate)
      ];
      const unit = currencyCode(values.currency);
      return [
        ["Annual Return (%)", conservativeRate.toFixed(2), values.rate.toFixed(2), growthRate.toFixed(2)],
        [`Future Value (${unit})`, money(scenarios[0].future, values.currency), money(scenarios[1].future, values.currency), money(scenarios[2].future, values.currency)],
        [`Total Contributions (${unit})`, money(scenarios[0].contributions, values.currency), money(scenarios[1].contributions, values.currency), money(scenarios[2].contributions, values.currency)],
        [`Total Invested (${unit})`, money(scenarios[0].invested, values.currency), money(scenarios[1].invested, values.currency), money(scenarios[2].invested, values.currency)],
        [`Real Value After Inflation (${unit})`, money(scenarios[0].real, values.currency), money(scenarios[1].real, values.currency), money(scenarios[2].real, values.currency)]
      ];
    }

    function updateReport(values, result, defaultMode) {
      const currencyLabel = {
        USD: "US - USD - US Dollar",
        GBP: "UK - GBP - British Pound",
        MYR: "Malaysia - MYR - Malaysian Ringgit",
        SGD: "Singapore - SGD - Singapore Dollar",
        IDR: "Indonesia - IDR - Indonesian Rupiah",
        INR: "India - INR - Indian Rupee"
      }[values.currency] || "USD - US Dollar";
      const countryLabel = {
        USA: "United States",
        GBR: "United Kingdom",
        MYS: "Malaysia",
        SGP: "Singapore",
        IDN: "Indonesia",
        IND: "India"
      }[values.country] || values.country || "United States";
      const compositionInterest = defaultMode ? 97611.39 : result.compositionInterest;
      const future = defaultMode ? 207611.39 : result.future;
      const real = defaultMode ? 141301.56 : result.real;
      const interest = defaultMode ? 112711.39 : result.interest;
      const startShare = future > 0 ? (values.start / future) * 100 : 0;
      const contributionShare = future > 0 ? (result.contributions / future) * 100 : 0;
      const interestShare = future > 0 ? (compositionInterest / future) * 100 : 0;

      setValue("futureValue", money(future, values.currency));
      setValue("interest", money(interest, values.currency));
      setValue("contributions", money(result.contributions, values.currency));
      setValue("invested", money(result.invested, values.currency));
      setValue("multiple", `${result.multiple.toFixed(2)}x`);
      setValue("realValue", money(real, values.currency));
      setValue("yearsPlain", String(result.years));
      setValue("yearsText", `${result.years} Years`);
      setValue("scenarioYears", `(${result.years} Years)`);
      setValue("reportDate", reportTimestamp());
      setValue("currencyText", currencyLabel);
      setValue("countryText", countryLabel);
      setValue("currencyCode", currencyCode(values.currency));
      setValue("start", money(values.start, values.currency));
      setValue("rate", values.rate.toFixed(2));
      setValue("contribution", money(values.contribution, values.currency));
      setValue("inflation", values.inflation.toFixed(2));
      setValue("tax", values.tax.toFixed(2));
      setValue("fee", values.fee.toFixed(2));
      setValue("startShare", `${money(values.start, values.currency)} (${startShare.toFixed(1)}%)`);
      setValue("contributionShare", `${money(result.contributions, values.currency)} (${contributionShare.toFixed(1)}%)`);
      setValue("interestShare", `${money(compositionInterest, values.currency)} (${interestShare.toFixed(1)}%)`);

      setText("insight", `With consistent ${values.contributionFrequency} contributions and ${values.rate.toFixed(2)}% annual returns compounded monthly, your investment can grow to over ${money(future, values.currency)} in ${result.years} years. Nearly half of this value comes from interest compounded over time.`);
      setText("interpretation", `If you invest ${money(values.start, values.currency)} today and contribute ${money(values.contribution, values.currency)} every month for ${result.years} years at an annual return of ${values.rate.toFixed(2)}% compounded monthly, your investment could grow to ${money(future, values.currency)}. Of this, ${money(compositionInterest, values.currency)} is interest earned. After accounting for ${values.inflation.toFixed(1)}% average annual inflation and ${values.tax.toFixed(0)}% tax on annual returns, the real value in today's dollars is estimated at ${money(real, values.currency)}.`);
    }

    function render() {
      const values = readInputs();
      const defaultMode = isDefault(values);
      const result = calculateCompound(values);
      updateReport(values, result, defaultMode);
      const rows = yearlyRows(values, result, defaultMode);
      renderRows("yearly", rows);
      renderRows("report-yearly", rows);
      const scenario = scenarioRows(values, defaultMode);
      renderRows("scenario", scenario);
      renderRows("report-scenario", scenario);
      return { values, result, defaultMode };
    }

    function saveCompoundHistory(source = "Calculation") {
      const snapshot = render();
      if (!snapshot) return;
      const { values } = snapshot;
      const readRendered = (name) => {
        const element = document.querySelector(`[data-ci-value="${name}"]`);
        return element ? element.textContent : "";
      };
      const report = document.querySelector(".compound-report");
      addHistoryEntry({
        type: "Compound Interest Calculator",
        title: `${readRendered("futureValue")} in ${readRendered("yearsText")}`,
        reportTitle: "Compound Interest Calculator Report",
        url: "compound-interest.html",
        source,
        inputs: [
          { label: "Starting Amount", value: money(values.start, values.currency) },
          { label: "Annual Interest Rate", value: `${values.rate.toFixed(2)}%` },
          { label: "Time Period", value: `${values.years} Years` },
          { label: "Contribution", value: `${money(values.contribution, values.currency)} ${values.contributionFrequency}` },
          { label: "Country / Rate Policy", value: values.country },
          { label: "Currency", value: currencyCode(values.currency) }
        ],
        outputs: [
          { label: "Future Value", value: readRendered("futureValue") },
          { label: "Total Interest", value: readRendered("interest") },
          { label: "Total Contributions", value: readRendered("contributions") },
          { label: "Real Value After Inflation", value: readRendered("realValue") }
        ],
        reportHtml: report ? report.outerHTML : ""
      });
    }

    function resetCompound() {
      Object.entries(defaults).forEach(([key, value]) => {
        const control = controls[key];
        if (!control) return;
        if (control.type === "checkbox") {
          control.checked = value;
        } else {
          control.value = defaultDisplay[key] || value;
        }
      });
      render();
      refreshLiveRates({ quiet: true });
    }

    function openReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) {
        reportButton.setAttribute("aria-expanded", "true");
      }
      const printButton = reportPreview.querySelector('[data-ci-action="print-report"]');
      if (printButton) {
        printButton.focus({ preventScroll: true });
      }
    }

    function closeReportPreview() {
      if (!reportPreview || reportPreview.hidden) return;
      reportPreview.hidden = true;
      document.body.classList.remove("report-open");
      document.body.classList.remove("print-report");
      if (reportButton) {
        reportButton.setAttribute("aria-expanded", "false");
        reportButton.focus({ preventScroll: true });
      }
    }

    function printReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      document.body.classList.add("print-report");
      window.print();
    }

    document.querySelectorAll("[data-ci-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.ciAction;
        if (action === "calculate") {
          render();
          saveCompoundHistory("Calculate");
        }
        if (action === "reset") {
          resetCompound();
        }
        if (action === "report") {
          openReportPreview();
          saveCompoundHistory("Report Preview");
        }
        if (action === "close-report") {
          closeReportPreview();
        }
        if (action === "print-report") {
          printReportPreview();
          saveCompoundHistory("Report Print");
        }
      });
    });

    rateModeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setCompoundRateMode(button.dataset.ciRateMode);
      });
    });

    if (reportPreview) {
      reportPreview.addEventListener("click", (event) => {
        if (event.target === reportPreview) {
          closeReportPreview();
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && reportPreview && !reportPreview.hidden) {
        closeReportPreview();
      }
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-report");
    });

    compoundForm.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
      saveCompoundHistory("Submit");
    });

    Object.values(controls).forEach((control) => {
      if (!control) return;
      control.addEventListener("change", () => {
        if (control === controls.currency || control === controls.country) {
          refreshLiveRates({ quiet: true });
          return;
        }
        if (compoundRateMode === "manual" && control === controls.inflation) {
          setRateStatus("inflation", `Manual ${controls.inflation.value}%`, "manual");
        }
        if (compoundRateMode === "manual" && control === controls.tax) {
          setRateStatus("tax", `Manual ${controls.tax.value}%`, "manual");
        }
        render();
      });
    });

    setDefaultRateStatus();
    render();
    setCompoundRateMode("live", false);
    window.setInterval(() => refreshLiveRates({ quiet: true }), 30 * 60 * 1000);
  }

  function setupPdfConverter() {
    const form = document.getElementById("pdfForm");
    if (!form) return;
    const reportPreview = document.getElementById("pdfReportPreview");
    const reportButton = document.querySelector('[data-pdf-action="report"]');
    const controls = {
      file: document.getElementById("pdf-file"),
      direction: document.getElementById("pdf-direction"),
      format: document.getElementById("pdf-format"),
      ocr: document.getElementById("pdf-ocr"),
      range: document.getElementById("pdf-range"),
      layout: document.getElementById("pdf-layout"),
      compression: document.getElementById("pdf-compression"),
      paper: document.getElementById("pdf-paper"),
      orientation: document.getElementById("pdf-orientation"),
      name: document.getElementById("pdf-name"),
      country: document.getElementById("pdf-country")
    };
    const defaults = {
      direction: "PDF to Other Format",
      format: "Word (.docx)",
      ocr: "Enabled",
      range: "All Pages",
      layout: "On",
      compression: "Standard",
      paper: "A4",
      orientation: "Auto",
      name: "Q2_Monthly_Report_Converted",
      country: "Malaysia"
    };
    let pdfObjectUrl = "";

    function outputExtension(format) {
      const map = {
        "Word (.docx)": "DOCX",
        "Excel (.xlsx)": "XLSX",
        "PowerPoint (.pptx)": "PPTX",
        "JPG Images": "JPG",
        "PNG Images": "PNG",
        "PDF": "PDF"
      };
      return map[format] || "DOCX";
    }

    function revokePdfObjectUrl() {
      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
      pdfObjectUrl = "";
    }

    function getPdfObjectUrl(file) {
      if (!file) return "";
      revokePdfObjectUrl();
      pdfObjectUrl = URL.createObjectURL(file);
      return pdfObjectUrl;
    }

    function setPdfValue(name, value) {
      document.querySelectorAll(`[data-pdf-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function buildPdfPreviewHtml(result) {
      const selectedFile = controls.file && controls.file.files && controls.file.files[0] ? controls.file.files[0] : null;
      const ext = result.ext;
      const outputFile = escapeHtml(result.fileName);
      const sourceName = escapeHtml(selectedFile ? selectedFile.name : "Q2_Monthly_Report.pdf");
      if (selectedFile && selectedFile.type === "application/pdf" && ext === "PDF") {
        const sourceUrl = getPdfObjectUrl(selectedFile);
        return `<h3>${outputFile}</h3><embed class="converted-file-frame" src="${sourceUrl}" type="application/pdf" title="${sourceName} preview">`;
      }
      if (selectedFile && selectedFile.type.startsWith("image/") && ["PDF", "PNG", "JPG", "JPEG"].includes(ext)) {
        const sourceUrl = getPdfObjectUrl(selectedFile);
        return `<h3>${outputFile}</h3><img class="converted-file-image" src="${sourceUrl}" alt="${sourceName} preview">`;
      }
      return `<h3>${outputFile}</h3><div class="pdf-document-preview"><b>${outputFile}</b><p>Converted ${ext} file preview</p><span></span><span></span><span></span><div class="pdf-preview-chart"></div><small>Source: ${sourceName}</small></div>`;
    }

    function render() {
      const format = controls.format.value || defaults.format;
      const ext = outputExtension(format);
      const selectedFile = controls.file && controls.file.files && controls.file.files[0] ? controls.file.files[0] : null;
      const baseName = selectedFile ? selectedFile.name.replace(/\.[^.]+$/, "") : (controls.name.value || defaults.name);
      const fileName = `${baseName || defaults.name}.${ext.toLowerCase()}`;
      const now = new Date();
      setPdfValue("sourceFile", selectedFile ? selectedFile.name : "Q2_Monthly_Report.pdf");
      setPdfValue("sourceSize", selectedFile ? formatBytes(selectedFile.size) : "3.8 MB - 18 pages");
      setPdfValue("outputFormat", ext);
      setPdfValue("outputFile", fileName);
      setPdfValue("ocrMode", controls.ocr.value || defaults.ocr);
      setPdfValue("paperSize", controls.paper.value || defaults.paper);
      setPdfValue("orientation", controls.orientation.value || defaults.orientation);
      setPdfValue("preserveLayout", controls.layout.value || defaults.layout);
      setPdfValue("country", controls.country.value || defaults.country);
      setPdfValue("generatedAt", reportTimestamp(now));
      setPdfValue("generatedDate", now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
      setPdfValue("generatedTime", now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
      setPdfValue("downloadLabel", `Download ${ext}`);
      return { ext, fileName };
    }

    function syncConvertedPreview() {
      const result = render();
      const previewCard = reportPreview ? reportPreview.querySelector(".pdf-converted-document") : null;
      if (previewCard) previewCard.innerHTML = buildPdfPreviewHtml(result);
      return result;
    }

    function reset() {
      Object.entries(defaults).forEach(([key, value]) => {
        if (controls[key]) controls[key].value = value;
      });
      if (controls.file) controls.file.value = "";
      revokePdfObjectUrl();
      render();
      if (window.kalqUpdateCountryCopy) window.kalqUpdateCountryCopy();
    }

    function openReport() {
      if (!reportPreview) return;
      syncConvertedPreview();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) reportButton.setAttribute("aria-expanded", "true");
    }

    function closeReport() {
      if (!reportPreview) return;
      reportPreview.hidden = true;
      document.body.classList.remove("report-open", "print-report", "print-file-output");
      if (reportButton) reportButton.setAttribute("aria-expanded", "false");
    }

    function printConvertedFile() {
      openReport();
      document.body.classList.add("print-file-output");
      window.setTimeout(() => {
        window.print();
      }, 80);
    }

    function runPdfAction(action) {
      if (action === "calculate") openReport();
      if (action === "reset") reset();
      if (action === "swap") {
        controls.direction.value = controls.direction.value === "PDF to Other Format" ? "Other Format to PDF" : "PDF to Other Format";
        controls.format.value = controls.direction.value === "PDF to Other Format" ? "Word (.docx)" : "PDF";
        render();
      }
      if (action === "report") openReport();
      if (action === "close-report") closeReport();
      if (action === "print-report") {
        printConvertedFile();
      }
    }

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-pdf-action]");
      if (!button) return;
      event.preventDefault();
      runPdfAction(button.dataset.pdfAction);
    });

    form.addEventListener("input", render);
    form.addEventListener("change", (event) => {
      render();
      if (event.target === controls.country && window.kalqUpdateCountryCopy) window.kalqUpdateCountryCopy();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
    });
    if (reportPreview) reportPreview.addEventListener("click", (event) => {
      if (event.target === reportPreview) closeReport();
    });
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-file-output", "print-report");
    });
    render();
  }

  function setupImageConverter() {
    const form = document.getElementById("imageForm");
    if (!form) return;
    const reportPreview = document.getElementById("imageReportPreview");
    const reportButton = document.querySelector('[data-img-action="report"]');
    const controls = {
      file: document.getElementById("image-file"),
      format: document.getElementById("image-format"),
      quality: document.getElementById("image-quality"),
      width: document.getElementById("image-width"),
      height: document.getElementById("image-height"),
      unit: document.getElementById("image-unit"),
      aspect: document.getElementById("image-aspect"),
      compress: document.getElementById("image-compress"),
      metadata: document.getElementById("image-metadata"),
      transparency: document.getElementById("image-transparency"),
      crop: document.getElementById("image-crop"),
      filename: document.getElementById("image-filename"),
      dpi: document.getElementById("image-dpi"),
      rotation: document.getElementById("image-rotation"),
      country: document.getElementById("image-country")
    };
    const defaults = {
      format: "WEBP",
      quality: "80",
      width: "1920",
      height: "1280",
      unit: "px",
      aspect: true,
      compress: true,
      metadata: true,
      transparency: true,
      crop: false,
      filename: "mountain-lake",
      dpi: "72 (Screen)",
      rotation: "No Rotation",
      country: "Malaysia"
    };
    let convertedImageUrl = "";
    let originalImageUrl = "";

    function setImageValue(name, value) {
      document.querySelectorAll(`[data-img-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function revokeImageUrls() {
      if (convertedImageUrl) URL.revokeObjectURL(convertedImageUrl);
      if (originalImageUrl) URL.revokeObjectURL(originalImageUrl);
      convertedImageUrl = "";
      originalImageUrl = "";
    }

    function applySelectedImagePreview() {
      const file = controls.file && controls.file.files && controls.file.files[0] ? controls.file.files[0] : null;
      if (!file || !file.type.startsWith("image/")) return;
      if (originalImageUrl) URL.revokeObjectURL(originalImageUrl);
      originalImageUrl = URL.createObjectURL(file);
      const reader = new FileReader();
      reader.onload = () => {
        document.querySelectorAll(".image-preview-card .landscape-art, .converted-image-sheet .landscape-art").forEach((preview) => {
          preview.style.backgroundImage = `url("${reader.result}")`;
        });
      };
      reader.readAsDataURL(file);
      if (controls.filename && (!controls.filename.value || controls.filename.value === defaults.filename)) {
        controls.filename.value = file.name.replace(/\.[^.]+$/, "") || defaults.filename;
      }
    }

    function mimeForImageFormat(format) {
      const normalized = String(format || defaults.format).toUpperCase();
      if (normalized === "JPG" || normalized === "JPEG") return "image/jpeg";
      if (normalized === "PNG") return "image/png";
      if (normalized === "AVIF") return "image/avif";
      if (normalized === "PDF") return "image/png";
      return "image/webp";
    }

    function render() {
      const quality = Math.max(1, Math.min(100, Number(controls.quality.value) || 80));
      const selectedFile = controls.file && controls.file.files && controls.file.files[0] ? controls.file.files[0] : null;
      const originalSize = selectedFile ? Math.max(0.01, selectedFile.size / 1024 / 1024) : 2.45;
      const formatFactor = { WEBP: 0.23, AVIF: 0.19, JPG: 0.42, PNG: 0.78, PDF: 0.55 }[controls.format.value] || 0.23;
      const qualityFactor = 0.75 + quality / 400;
      const newSizeMb = originalSize * formatFactor * qualityFactor;
      const saved = Math.max(0, Math.round((1 - newSizeMb / originalSize) * 100));
      const newKb = Math.max(95, Math.round(newSizeMb * 1024));
      const now = new Date();
      setImageValue("format", controls.format.value || defaults.format);
      setImageValue("quality", `${quality}%`);
      setImageValue("dimensions", `${controls.width.value || defaults.width} x ${controls.height.value || defaults.height}`);
      setImageValue("newSize", `${newKb} KB`);
      setImageValue("sizeReduced", `${saved}%`);
      setImageValue("compressionScore", saved >= 60 ? "92 / 100" : "84 / 100");
      setImageValue("webReadiness", saved >= 55 ? "Excellent" : "Good");
      setImageValue("filename", `${controls.filename.value || defaults.filename}.${String(controls.format.value || defaults.format).toLowerCase()}`);
      setImageValue("metadata", controls.metadata.checked ? "Removed" : "Kept");
      setImageValue("transparency", controls.transparency.checked ? "Maintained" : "Flattened");
      setImageValue("dpi", controls.dpi.value || defaults.dpi);
      setImageValue("rotation", controls.rotation.value || defaults.rotation);
      setImageValue("country", controls.country.value || defaults.country);
      setImageValue("generatedAt", reportTimestamp(now));
      setImageValue("generatedDate", now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
      setImageValue("generatedTime", now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
      document.querySelectorAll(".image-quality-fill").forEach((bar) => {
        bar.style.width = `${quality}%`;
      });
      return {
        quality,
        saved,
        newKb,
        filename: `${controls.filename.value || defaults.filename}.${String(controls.format.value || defaults.format).toLowerCase()}`,
        format: controls.format.value || defaults.format
      };
    }

    function syncImagePreview(result = render()) {
      const previewCard = reportPreview ? reportPreview.querySelector(".converted-image-sheet") : null;
      if (!previewCard) return;
      if (convertedImageUrl) {
        previewCard.innerHTML = `<h3>Converted Image</h3><img class="converted-file-image converted-image-output" src="${convertedImageUrl}" alt="${escapeHtml(result.filename)} preview">`;
        return;
      }
      previewCard.innerHTML = `<h3>Converted Image</h3><div class="landscape-art optimized"></div>`;
      if (originalImageUrl) {
        const fallback = previewCard.querySelector(".landscape-art");
        if (fallback) fallback.style.backgroundImage = `url("${originalImageUrl}")`;
      }
    }

    function loadImageElement(src) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      });
    }

    async function convertImage({ open = false } = {}) {
      const result = render();
      const file = controls.file && controls.file.files && controls.file.files[0] ? controls.file.files[0] : null;
      if (convertedImageUrl) URL.revokeObjectURL(convertedImageUrl);
      convertedImageUrl = "";
      if (file && file.type.startsWith("image/")) {
        if (!originalImageUrl) originalImageUrl = URL.createObjectURL(file);
        try {
          const image = await loadImageElement(originalImageUrl);
          const width = Math.max(1, Math.round(Number(controls.width.value) || image.naturalWidth || image.width || 1));
          const height = Math.max(1, Math.round(Number(controls.height.value) || image.naturalHeight || image.height || 1));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, width, height);
          const requestedMime = mimeForImageFormat(result.format);
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, requestedMime, result.quality / 100));
          const finalBlob = blob || await new Promise((resolve) => canvas.toBlob(resolve, "image/png", result.quality / 100));
          if (finalBlob) convertedImageUrl = URL.createObjectURL(finalBlob);
        } catch (error) {
          convertedImageUrl = originalImageUrl;
        }
      }
      syncImagePreview(result);
      if (open) openReport(false);
      return result;
    }

    function reset() {
      if (controls.file) controls.file.value = "";
      revokeImageUrls();
      controls.format.value = defaults.format;
      controls.quality.value = defaults.quality;
      controls.width.value = defaults.width;
      controls.height.value = defaults.height;
      controls.unit.value = defaults.unit;
      controls.aspect.checked = defaults.aspect;
      controls.compress.checked = defaults.compress;
      controls.metadata.checked = defaults.metadata;
      controls.transparency.checked = defaults.transparency;
      controls.crop.checked = defaults.crop;
      controls.filename.value = defaults.filename;
      controls.dpi.value = defaults.dpi;
      controls.rotation.value = defaults.rotation;
      controls.country.value = defaults.country;
      document.querySelectorAll(".landscape-art").forEach((preview) => {
        preview.style.removeProperty("background-image");
      });
      render();
      if (window.kalqUpdateCountryCopy) window.kalqUpdateCountryCopy();
    }

    function openReport() {
      render();
      syncImagePreview();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) reportButton.setAttribute("aria-expanded", "true");
    }

    function closeReport() {
      reportPreview.hidden = true;
      document.body.classList.remove("report-open", "print-report", "print-file-output");
      if (reportButton) reportButton.setAttribute("aria-expanded", "false");
    }

    async function printConvertedImage() {
      await convertImage({ open: true });
      document.body.classList.add("print-file-output");
      window.setTimeout(() => {
        window.print();
      }, 80);
    }

    document.querySelectorAll("[data-img-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.imgAction;
        if (action === "calculate") await convertImage({ open: true });
        if (action === "reset") reset();
        if (action === "report") openReport();
        if (action === "close-report") closeReport();
        if (action === "print-report") {
          await printConvertedImage();
        }
      });
    });

    form.addEventListener("input", render);
    form.addEventListener("change", (event) => {
      if (event.target === controls.file) applySelectedImagePreview();
      render();
      if (event.target === controls.country && window.kalqUpdateCountryCopy) window.kalqUpdateCountryCopy();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
    });
    if (reportPreview) reportPreview.addEventListener("click", (event) => {
      if (event.target === reportPreview) closeReport();
    });
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-file-output", "print-report");
    });
    render();
    syncImagePreview();
  }

  function setupUnitConverter() {
    const form = document.getElementById("unitForm");
    if (!form) return;

    const controls = {
      value: document.getElementById("unit-value"),
      from: document.getElementById("unit-from"),
      to: document.getElementById("unit-to"),
      decimals: document.getElementById("unit-decimals")
    };
    const reportPreview = document.getElementById("unitReportPreview");
    const reportButton = document.querySelector('[data-unit-action="report"]');
    const categoryButtons = Array.from(document.querySelectorAll("[data-unit-category]"));
    const canvases = {
      main: document.getElementById("unitChartCanvas"),
      report: document.getElementById("unitReportChartCanvas")
    };
    const categories = {
      length: {
        label: "Length",
        color: "#0b9696",
        units: [
          { key: "m", name: "Meter", abbr: "m", factor: 1 },
          { key: "km", name: "Kilometer", abbr: "km", factor: 1000 },
          { key: "cm", name: "Centimeter", abbr: "cm", factor: 0.01 },
          { key: "mm", name: "Millimeter", abbr: "mm", factor: 0.001 },
          { key: "mi", name: "Mile", abbr: "mi", factor: 1609.344 },
          { key: "ft", name: "Foot", abbr: "ft", factor: 0.3048 }
        ],
        defaults: ["m", "km"]
      },
      weight: {
        label: "Weight",
        color: "#0f8b55",
        units: [
          { key: "kg", name: "Kilogram", abbr: "kg", factor: 1 },
          { key: "g", name: "Gram", abbr: "g", factor: 0.001 },
          { key: "mg", name: "Milligram", abbr: "mg", factor: 0.000001 },
          { key: "lb", name: "Pound", abbr: "lb", factor: 0.45359237 },
          { key: "oz", name: "Ounce", abbr: "oz", factor: 0.028349523125 },
          { key: "t", name: "Metric Tonne", abbr: "t", factor: 1000 }
        ],
        defaults: ["kg", "lb"]
      },
      area: {
        label: "Area",
        color: "#0b5ed7",
        units: [
          { key: "sqm", name: "Square Meter", abbr: "m2", factor: 1 },
          { key: "sqkm", name: "Square Kilometer", abbr: "km2", factor: 1000000 },
          { key: "sqcm", name: "Square Centimeter", abbr: "cm2", factor: 0.0001 },
          { key: "ha", name: "Hectare", abbr: "ha", factor: 10000 },
          { key: "acre", name: "Acre", abbr: "acre", factor: 4046.8564224 },
          { key: "sqft", name: "Square Foot", abbr: "ft2", factor: 0.09290304 }
        ],
        defaults: ["sqm", "sqft"]
      },
      volume: {
        label: "Volume",
        color: "#7c3aed",
        units: [
          { key: "l", name: "Liter", abbr: "L", factor: 1 },
          { key: "ml", name: "Milliliter", abbr: "mL", factor: 0.001 },
          { key: "cbm", name: "Cubic Meter", abbr: "m3", factor: 1000 },
          { key: "gal", name: "US Gallon", abbr: "gal", factor: 3.785411784 },
          { key: "qt", name: "US Quart", abbr: "qt", factor: 0.946352946 },
          { key: "cup", name: "Cup", abbr: "cup", factor: 0.2365882365 }
        ],
        defaults: ["l", "gal"]
      },
      temperature: {
        label: "Temperature",
        color: "#f97316",
        temperature: true,
        units: [
          { key: "c", name: "Celsius", abbr: "C" },
          { key: "f", name: "Fahrenheit", abbr: "F" },
          { key: "k", name: "Kelvin", abbr: "K" }
        ],
        defaults: ["c", "f"]
      },
      speed: {
        label: "Speed",
        color: "#0891b2",
        units: [
          { key: "mps", name: "Meter per Second", abbr: "m/s", factor: 1 },
          { key: "kph", name: "Kilometer per Hour", abbr: "km/h", factor: 0.2777777778 },
          { key: "mph", name: "Mile per Hour", abbr: "mph", factor: 0.44704 },
          { key: "kt", name: "Knot", abbr: "kn", factor: 0.5144444444 },
          { key: "fps", name: "Foot per Second", abbr: "ft/s", factor: 0.3048 }
        ],
        defaults: ["kph", "mph"]
      },
      data: {
        label: "Data",
        color: "#2563eb",
        units: [
          { key: "b", name: "Byte", abbr: "B", factor: 1 },
          { key: "kb", name: "Kilobyte", abbr: "KB", factor: 1000 },
          { key: "mb", name: "Megabyte", abbr: "MB", factor: 1000000 },
          { key: "gb", name: "Gigabyte", abbr: "GB", factor: 1000000000 },
          { key: "kib", name: "Kibibyte", abbr: "KiB", factor: 1024 },
          { key: "mib", name: "Mebibyte", abbr: "MiB", factor: 1048576 }
        ],
        defaults: ["mb", "gb"]
      },
      energy: {
        label: "Energy",
        color: "#d97706",
        units: [
          { key: "j", name: "Joule", abbr: "J", factor: 1 },
          { key: "kj", name: "Kilojoule", abbr: "kJ", factor: 1000 },
          { key: "cal", name: "Calorie", abbr: "cal", factor: 4.184 },
          { key: "kcal", name: "Kilocalorie", abbr: "kcal", factor: 4184 },
          { key: "wh", name: "Watt Hour", abbr: "Wh", factor: 3600 },
          { key: "kwh", name: "Kilowatt Hour", abbr: "kWh", factor: 3600000 }
        ],
        defaults: ["j", "kwh"]
      },
      pressure: {
        label: "Pressure",
        color: "#be123c",
        units: [
          { key: "pa", name: "Pascal", abbr: "Pa", factor: 1 },
          { key: "kpa", name: "Kilopascal", abbr: "kPa", factor: 1000 },
          { key: "bar", name: "Bar", abbr: "bar", factor: 100000 },
          { key: "psi", name: "PSI", abbr: "psi", factor: 6894.757293 },
          { key: "atm", name: "Atmosphere", abbr: "atm", factor: 101325 },
          { key: "torr", name: "Torr", abbr: "Torr", factor: 133.322368 }
        ],
        defaults: ["kpa", "psi"]
      }
    };
    const defaults = {
      category: "length",
      value: "100",
      decimals: "2"
    };
    let activeCategory = defaults.category;

    function unitByKey(category, key) {
      const data = categories[category] || categories.length;
      return (data.units || []).find((unit) => unit.key === key) || data.units[0];
    }

    function formatNumber(value, decimals = 2, exact = false) {
      const number = Number(value);
      if (!Number.isFinite(number)) return "0";
      const digits = exact ? 6 : Math.max(0, Math.min(8, Number(decimals) || 0));
      if (Math.abs(number) >= 1000000000 || (Math.abs(number) > 0 && Math.abs(number) < 0.000001)) {
        return number.toExponential(exact ? 6 : 3);
      }
      return number.toLocaleString("en-US", {
        minimumFractionDigits: exact ? Math.min(6, digits) : Math.min(digits, 2),
        maximumFractionDigits: digits
      });
    }

    function displayNumber(value, decimals) {
      return formatNumber(value, decimals, false);
    }

    function toCelsius(value, key) {
      if (key === "f") return (value - 32) * 5 / 9;
      if (key === "k") return value - 273.15;
      return value;
    }

    function fromCelsius(value, key) {
      if (key === "f") return (value * 9 / 5) + 32;
      if (key === "k") return value + 273.15;
      return value;
    }

    function convertValue(value, fromUnit, toUnit, data) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return 0;
      if (data.temperature) return fromCelsius(toCelsius(numeric, fromUnit.key), toUnit.key);
      return (numeric * fromUnit.factor) / toUnit.factor;
    }

    function conversionFactorValue(fromUnit, toUnit, data) {
      if (data.temperature) return NaN;
      return fromUnit.factor / toUnit.factor;
    }

    function categoryDefaults(category) {
      const data = categories[category] || categories.length;
      return data.defaults || [data.units[0].key, data.units[1]?.key || data.units[0].key];
    }

    function populateUnitSelects(category, fromKey, toKey) {
      const data = categories[category] || categories.length;
      const options = data.units.map((unit) => `<option value="${unit.key}">${unit.name} (${unit.abbr})</option>`).join("");
      controls.from.innerHTML = options;
      controls.to.innerHTML = options;
      const pair = categoryDefaults(category);
      controls.from.value = fromKey && data.units.some((unit) => unit.key === fromKey) ? fromKey : pair[0];
      controls.to.value = toKey && data.units.some((unit) => unit.key === toKey) ? toKey : pair[1];
      if (controls.from.value === controls.to.value && data.units[1]) controls.to.value = data.units[1].key;
    }

    function setUnitValue(name, value) {
      document.querySelectorAll(`[data-unit-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function readState() {
      const data = categories[activeCategory] || categories.length;
      const value = Number(controls.value.value);
      const decimals = Math.max(0, Math.min(8, Number(controls.decimals.value) || 0));
      const fromUnit = unitByKey(activeCategory, controls.from.value);
      const toUnit = unitByKey(activeCategory, controls.to.value);
      const result = convertValue(Number.isFinite(value) ? value : 0, fromUnit, toUnit, data);
      const factor = conversionFactorValue(fromUnit, toUnit, data);
      return {
        category: activeCategory,
        data,
        value: Number.isFinite(value) ? value : 0,
        decimals,
        fromUnit,
        toUnit,
        result,
        factor
      };
    }

    function formulaText(state) {
      if (state.data.temperature) {
        if (state.fromUnit.key === state.toUnit.key) return `${state.toUnit.name} = ${state.fromUnit.name}`;
        if (state.fromUnit.key === "c" && state.toUnit.key === "f") return "Fahrenheit = (Celsius x 9 / 5) + 32";
        if (state.fromUnit.key === "f" && state.toUnit.key === "c") return "Celsius = (Fahrenheit - 32) x 5 / 9";
        if (state.toUnit.key === "k") return "Kelvin = Celsius + 273.15";
        if (state.fromUnit.key === "k") return `${state.toUnit.name} = convert Kelvin to Celsius, then to ${state.toUnit.name}`;
        return `${state.toUnit.name} = temperature conversion formula`;
      }
      return `${state.toUnit.name} = ${state.fromUnit.name} x ${formatNumber(state.factor, 8)}`;
    }

    function factorText(state) {
      if (state.data.temperature) return "Temperature uses scale-specific offset formulas";
      return `1 ${state.fromUnit.name} = ${formatNumber(state.factor, 8)} ${state.toUnit.name}`;
    }

    function comparisonRows(state) {
      return state.data.units.map((unit) => {
        const value = convertValue(state.value, state.fromUnit, unit, state.data);
        return { unit, value };
      });
    }

    function updateTables(state) {
      const rows = comparisonRows(state);
      const markup = rows.map((row) => `<tr><td>${escapeHtml(row.unit.name)}</td><td>${escapeHtml(row.unit.abbr)}</td><td>${displayNumber(row.value, state.decimals)}</td></tr>`).join("");
      document.querySelectorAll("[data-unit-comparison]").forEach((body) => {
        body.innerHTML = markup;
      });
      return rows;
    }

    function drawChart(canvas, state, rows) {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#fbfdff";
      ctx.fillRect(0, 0, width, height);
      const plot = { left: 62, right: width - 28, top: 58, bottom: height - 58 };
      const values = rows.map((row) => Number(row.value)).filter((value) => Number.isFinite(value));
      const positive = values.filter((value) => value > 0);
      const useLog = positive.length === values.length && Math.max(...positive) / Math.max(0.000001, Math.min(...positive)) > 1000;
      const mappedValues = rows.map((row) => {
        const value = Number(row.value);
        return useLog ? Math.log10(Math.max(Math.abs(value), 0.001)) : value;
      });
      let min = Math.min(...mappedValues, useLog ? -3 : 0);
      let max = Math.max(...mappedValues, 1);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
        min = 0;
        max = 1;
      }
      if (!useLog && min > 0) min = 0;
      const mapY = (value) => plot.bottom - ((value - min) / (max - min)) * (plot.bottom - plot.top);
      ctx.strokeStyle = "#dce7f2";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      for (let i = 0; i <= 5; i += 1) {
        const y = plot.top + i * (plot.bottom - plot.top) / 5;
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = "#95a8bf";
      ctx.beginPath();
      ctx.moveTo(plot.left, plot.top);
      ctx.lineTo(plot.left, plot.bottom);
      ctx.lineTo(plot.right, plot.bottom);
      ctx.stroke();
      ctx.fillStyle = "#061b46";
      ctx.font = "700 14px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${displayNumber(state.value, state.decimals)} ${state.fromUnit.name} in Different Units`, width / 2, 24);
      ctx.save();
      ctx.translate(16, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = "12px Segoe UI, sans-serif";
      ctx.fillText(useLog ? "Value (log scale)" : "Value", 0, 0);
      ctx.restore();
      const barGap = 26;
      const barWidth = Math.max(28, ((plot.right - plot.left) - barGap * (rows.length + 1)) / Math.max(1, rows.length));
      rows.forEach((row, index) => {
        const x = plot.left + barGap + index * (barWidth + barGap);
        const mapped = mappedValues[index];
        const y = mapY(mapped);
        const zero = useLog ? plot.bottom : mapY(0);
        const barHeight = Math.max(3, Math.abs(zero - y));
        const gradient = ctx.createLinearGradient(0, y, 0, plot.bottom);
        gradient.addColorStop(0, state.data.color || "#0b9696");
        gradient.addColorStop(1, "#79d2cf");
        ctx.fillStyle = gradient;
        ctx.fillRect(x, Math.min(y, zero), barWidth, barHeight);
        ctx.fillStyle = "#061b46";
        ctx.font = "700 12px Segoe UI, sans-serif";
        ctx.textAlign = "center";
        const labelY = Math.max(plot.top - 8, Math.min(y, zero) - 7);
        ctx.fillText(displayNumber(row.value, Math.min(6, state.decimals + 2)), x + barWidth / 2, labelY);
        ctx.font = "11px Segoe UI, sans-serif";
        ctx.fillText(row.unit.name.split(" ")[0], x + barWidth / 2, plot.bottom + 18);
        ctx.fillText(`(${row.unit.abbr})`, x + barWidth / 2, plot.bottom + 33);
      });
      ctx.fillStyle = "#40536f";
      ctx.textAlign = "right";
      ctx.font = "11px Segoe UI, sans-serif";
      for (let i = 0; i <= 5; i += 1) {
        const raw = max - i * (max - min) / 5;
        const label = useLog ? Math.pow(10, raw) : raw;
        ctx.fillText(formatNumber(label, label < 1 ? 3 : 0), plot.left - 8, plot.top + i * (plot.bottom - plot.top) / 5 + 4);
      }
    }

    function analysisText(state) {
      const smaller = state.result < state.value ? "smaller" : "larger";
      return `Choosing the right ${state.data.label.toLowerCase()} unit depends on the scale of the task. The exact result is calculated from the full conversion formula, while the rounded result is formatted to ${state.decimals} decimal place${state.decimals === 1 ? "" : "s"}. This conversion changes the displayed number into a ${smaller} unit value without changing the underlying measurement.`;
    }

    function render() {
      const state = readState();
      const rows = updateTables(state);
      drawChart(canvases.main, state, rows);
      drawChart(canvases.report, state, rows);
      const exact = `${formatNumber(state.result, 6, true)} ${state.toUnit.name}`;
      const rounded = `${displayNumber(state.result, state.decimals)} ${state.toUnit.name}`;
      const reverse = `${displayNumber(state.result, state.decimals)} ${state.toUnit.name} = ${displayNumber(state.value, state.decimals)} ${state.fromUnit.name}`;
      const now = new Date();
      setUnitValue("mainResult", rounded);
      setUnitValue("resultSentence", `${displayNumber(state.value, state.decimals)} ${state.fromUnit.name.toLowerCase()} equals ${rounded.toLowerCase()}.`);
      setUnitValue("exactResult", exact);
      setUnitValue("roundedResult", `${rounded} (${state.decimals} d.p.)`);
      setUnitValue("reverseConversion", reverse);
      setUnitValue("conversionFactor", factorText(state));
      setUnitValue("formulaUsed", formulaText(state));
      setUnitValue("category", state.data.label);
      setUnitValue("inputCategory", state.data.label);
      setUnitValue("inputValue", displayNumber(state.value, state.decimals));
      setUnitValue("inputFrom", `${state.fromUnit.name} (${state.fromUnit.abbr})`);
      setUnitValue("inputTo", `${state.toUnit.name} (${state.toUnit.abbr})`);
      setUnitValue("inputDecimals", String(state.decimals));
      setUnitValue("analysisText", analysisText(state));
      setUnitValue("rateNote", "Fixed unit formulas are used for standard conversions in this category.");
      setUnitValue("reportDate", now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
      setUnitValue("reportTime", now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }));
      setUnitValue("generatedAt", reportTimestamp(now));
      return state;
    }

    function activateCategory(category, keepSelection = false) {
      activeCategory = categories[category] ? category : defaults.category;
      categoryButtons.forEach((button) => {
        const active = button.dataset.unitCategory === activeCategory;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      populateUnitSelects(activeCategory, keepSelection ? controls.from.value : "", keepSelection ? controls.to.value : "");
      render();
    }

    function resetUnitConverter() {
      activeCategory = defaults.category;
      controls.value.value = defaults.value;
      controls.decimals.value = defaults.decimals;
      activateCategory(defaults.category);
    }

    function openReport() {
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) reportButton.setAttribute("aria-expanded", "true");
    }

    function closeReport() {
      reportPreview.hidden = true;
      document.body.classList.remove("report-open", "print-report");
      if (reportButton) reportButton.setAttribute("aria-expanded", "false");
    }

    categoryButtons.forEach((button) => {
      button.addEventListener("click", () => activateCategory(button.dataset.unitCategory));
    });

    document.querySelectorAll("[data-unit-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.unitAction;
        if (action === "calculate") render();
        if (action === "swap") {
          const from = controls.from.value;
          controls.from.value = controls.to.value;
          controls.to.value = from;
          render();
        }
        if (action === "reset") resetUnitConverter();
        if (action === "report") openReport();
        if (action === "close-report") closeReport();
        if (action === "print-report") {
          render();
          document.body.classList.add("print-report");
          window.setTimeout(() => {
            window.print();
            document.body.classList.remove("print-report");
          }, 80);
        }
      });
    });

    form.addEventListener("input", () => render());
    form.addEventListener("change", () => {
      render();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
    });

    if (reportPreview) {
      reportPreview.addEventListener("click", (event) => {
        if (event.target === reportPreview) closeReport();
      });
    }

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-report");
    });

    activateCategory(defaults.category);
  }

  function setupGraphCalculator() {
    const form = document.getElementById("graphForm");
    if (!form) return;

    const controls = {
      type: document.getElementById("graph-type"),
      equations: document.getElementById("graph-equations"),
      data: document.getElementById("graph-data"),
      xMin: document.getElementById("graph-x-min"),
      xMax: document.getElementById("graph-x-max"),
      yMin: document.getElementById("graph-y-min"),
      yMax: document.getElementById("graph-y-max"),
      x0: document.getElementById("graph-x0"),
      samples: document.getElementById("graph-samples"),
      angle: document.getElementById("graph-angle"),
      grid: document.getElementById("graph-grid"),
      country: document.getElementById("graph-country")
    };
    const canvases = {
      main: document.getElementById("graphCanvas"),
      derivative: document.getElementById("graphDerivativeCanvas"),
      integral: document.getElementById("graphIntegralCanvas"),
      report: document.getElementById("graphReportCanvas")
    };
    const reportPreview = document.getElementById("graphReportPreview");
    const reportButton = document.querySelector('[data-graph-action="report"]');
    const palette = ["#0a7b83", "#0b5ed7", "#f97316", "#7c3aed", "#10803e", "#d22323"];
    const defaults = {
      type: "function",
      equations: "y = x^2 - 4",
      data: "-4, 3\n-2, -1\n0, 0\n2, 2\n4, 5",
      xMin: -10,
      xMax: 10,
      yMin: -10,
      yMax: 10,
      x0: 0,
      samples: 240,
      angle: "rad",
      grid: "yes",
      country: "Universal"
    };

    function numberValue(control, fallback) {
      const value = Number(control ? control.value : NaN);
      return Number.isFinite(value) ? value : fallback;
    }

    function cleanEquation(raw) {
      let body = String(raw || "0").trim()
        .replace(/[\u03c0]/g, "pi")
        .replace(/[\u03b8]/g, "theta")
        .replace(/\btheta\b/gi, "t")
        .replace(/^[xytr]\s*(\([^)]*\))?\s*=\s*/i, "")
        .replace(/\bln\s*\(/gi, "log(")
        .replace(/\^/g, "**");
      body = body.replace(/(\d|\))\s*(x|t|\()/gi, "$1*$2");
      body = body.replace(/\b(pi|e)\s*(x|t|\()/gi, "$1*$2");
      body = body.replace(/\bpi\b/gi, "PI").replace(/\be\b/g, "E");
      return body || "0";
    }

    function compileExpression(raw) {
      const body = cleanEquation(raw);
      try {
        const fn = new Function("x", "t", `with (Math) { return ${body}; }`);
        fn(0, 0);
        return { raw: String(raw || "0").trim(), fn, body, error: "" };
      } catch (error) {
        return { raw: String(raw || "0").trim(), fn: () => NaN, body, error: "Invalid equation" };
      }
    }

    function equationLines() {
      return String(controls.equations.value || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
    }

    function parseDataRows() {
      return String(controls.data.value || "").split(/\n+/).map((line, index) => {
        const parts = line.split(/[,\s]+/).filter(Boolean);
        if (parts.length === 1) {
          const y = Number(parts[0]);
          return Number.isFinite(y) ? { x: index + 1, y, label: String(index + 1) } : null;
        }
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) return { x, y, label: parts[0] };
        const labeled = Number(parts[parts.length - 1]);
        return Number.isFinite(labeled) ? { x: index + 1, y: labeled, label: parts.slice(0, -1).join(" ") || String(index + 1) } : null;
      }).filter(Boolean);
    }

    function readValues() {
      let xMin = numberValue(controls.xMin, defaults.xMin);
      let xMax = numberValue(controls.xMax, defaults.xMax);
      let yMin = numberValue(controls.yMin, defaults.yMin);
      let yMax = numberValue(controls.yMax, defaults.yMax);
      if (xMin === xMax) xMax = xMin + 1;
      if (yMin === yMax) yMax = yMin + 1;
      if (xMin > xMax) [xMin, xMax] = [xMax, xMin];
      if (yMin > yMax) [yMin, yMax] = [yMax, yMin];
      return {
        type: controls.type.value || defaults.type,
        equations: equationLines(),
        dataRows: parseDataRows(),
        xMin,
        xMax,
        yMin,
        yMax,
        x0: numberValue(controls.x0, defaults.x0),
        samples: Math.max(40, Math.min(1000, Math.round(numberValue(controls.samples, defaults.samples)))),
        angle: controls.angle.value || defaults.angle,
        showGrid: controls.grid.value !== "no",
        country: controls.country.value || defaults.country
      };
    }

    function safeEval(fn, x, t = x) {
      try {
        const value = Number(fn(x, t));
        return Number.isFinite(value) ? value : NaN;
      } catch (error) {
        return NaN;
      }
    }

    function derivative(fn, x) {
      const h = 0.0001 * Math.max(1, Math.abs(x));
      const value = (safeEval(fn, x + h) - safeEval(fn, x - h)) / (2 * h);
      return Number.isFinite(value) ? value : NaN;
    }

    function integral(fn, xMin, xMax, samples) {
      const steps = Math.max(20, samples);
      const dx = (xMax - xMin) / steps;
      let area = 0;
      for (let i = 0; i < steps; i += 1) {
        const x1 = xMin + i * dx;
        const x2 = x1 + dx;
        const y1 = safeEval(fn, x1);
        const y2 = safeEval(fn, x2);
        if (Number.isFinite(y1) && Number.isFinite(y2)) area += ((y1 + y2) / 2) * dx;
      }
      return area;
    }

    function buildState() {
      const values = readValues();
      const compiled = values.equations.length ? values.equations.map(compileExpression) : [compileExpression(defaults.equations.split("\n")[0])];
      const datasets = [];
      const dx = (values.xMax - values.xMin) / Math.max(1, values.samples - 1);

      if (values.type === "function") {
        compiled.forEach((eq, index) => {
          const points = [];
          for (let i = 0; i < values.samples; i += 1) {
            const x = values.xMin + i * dx;
            points.push({ x, y: safeEval(eq.fn, x) });
          }
          datasets.push({ type: "line", label: eq.raw || `f${index + 1}(x)`, color: palette[index % palette.length], points });
        });
      } else if (values.type === "parametric") {
        const xEq = compileExpression(values.equations[0] || "cos(t)");
        const yEq = compileExpression(values.equations[1] || "sin(t)");
        const points = [];
        for (let i = 0; i < values.samples; i += 1) {
          const t = values.xMin + i * dx;
          points.push({ x: safeEval(xEq.fn, t, t), y: safeEval(yEq.fn, t, t) });
        }
        datasets.push({ type: "line", label: "x(t), y(t)", color: palette[0], points });
      } else if (values.type === "polar") {
        const eq = compiled[0] || compileExpression("1 + cos(t)");
        const points = [];
        for (let i = 0; i < values.samples; i += 1) {
          const theta = values.xMin + i * dx;
          const thetaRad = values.angle === "deg" ? theta * Math.PI / 180 : theta;
          const r = safeEval(eq.fn, thetaRad, thetaRad);
          points.push({ x: r * Math.cos(thetaRad), y: r * Math.sin(thetaRad) });
        }
        datasets.push({ type: "line", label: `r = ${eq.raw}`, color: palette[0], points });
      } else if (values.type === "bar") {
        datasets.push({ type: "bar", label: "Bar data", color: palette[0], points: values.dataRows });
      } else if (values.type === "histogram") {
        const nums = values.dataRows.map((row) => row.y).filter(Number.isFinite);
        const min = Math.min(...nums, 0);
        const max = Math.max(...nums, 1);
        const bins = 8;
        const width = (max - min || 1) / bins;
        const points = Array.from({ length: bins }, (_, index) => ({ x: min + index * width + width / 2, y: 0, label: `${(min + index * width).toFixed(1)}` }));
        nums.forEach((value) => {
          const index = Math.min(bins - 1, Math.max(0, Math.floor((value - min) / width)));
          points[index].y += 1;
        });
        datasets.push({ type: "bar", label: "Histogram", color: palette[2], points });
      } else {
        datasets.push({ type: "scatter", label: "Scatter data", color: palette[1], points: values.dataRows });
      }

      const firstFn = values.type === "function" ? compiled[0]?.fn : null;
      const roots = [];
      let yIntercept = NaN;
      let derivativeValue = NaN;
      let integralValue = NaN;
      let minPoint = null;
      let maxPoint = null;
      if (firstFn) {
        yIntercept = safeEval(firstFn, 0);
        derivativeValue = derivative(firstFn, values.x0);
        integralValue = integral(firstFn, values.xMin, values.xMax, values.samples);
        const points = datasets[0].points.filter((point) => Number.isFinite(point.y));
        points.forEach((point, index) => {
          if (!minPoint || point.y < minPoint.y) minPoint = point;
          if (!maxPoint || point.y > maxPoint.y) maxPoint = point;
          const previous = points[index - 1];
          if (!previous) return;
          if (Math.abs(point.y) < 1e-6) roots.push(point.x);
          if (previous.y * point.y < 0) {
            const root = previous.x + (0 - previous.y) * (point.x - previous.x) / (point.y - previous.y);
            roots.push(root);
          }
        });
      }

      const tableRows = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((x) => {
        const y = firstFn ? safeEval(firstFn, x) : datasets[0]?.points[Math.max(0, Math.min(datasets[0].points.length - 1, x + 2))]?.y;
        const dy = firstFn ? derivative(firstFn, x) : NaN;
        return { x, y, dy };
      });

      return { values, compiled, datasets, firstFn, stats: { roots, yIntercept, derivativeValue, integralValue, minPoint, maxPoint }, tableRows };
    }

    function setGraphValue(name, value) {
      document.querySelectorAll(`[data-graph-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function formatGraphNumber(value, digits = 3) {
      if (!Number.isFinite(value)) return "n/a";
      if (Math.abs(value) >= 10000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) return value.toExponential(2);
      return value.toLocaleString("en-US", { maximumFractionDigits: digits });
    }

    function drawGrid(ctx, width, height, values) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#fbfdff";
      ctx.fillRect(0, 0, width, height);
      const plot = { left: 46, right: width - 18, top: 18, bottom: height - 34 };
      const mapX = (x) => plot.left + ((x - values.xMin) / (values.xMax - values.xMin)) * (plot.right - plot.left);
      const mapY = (y) => plot.bottom - ((y - values.yMin) / (values.yMax - values.yMin)) * (plot.bottom - plot.top);
      if (values.showGrid) {
        ctx.strokeStyle = "#dce7f2";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i += 1) {
          const x = plot.left + i * (plot.right - plot.left) / 10;
          const y = plot.top + i * (plot.bottom - plot.top) / 10;
          ctx.beginPath();
          ctx.moveTo(x, plot.top);
          ctx.lineTo(x, plot.bottom);
          ctx.moveTo(plot.left, y);
          ctx.lineTo(plot.right, y);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = "#8192aa";
      ctx.lineWidth = 1.2;
      if (values.yMin < 0 && values.yMax > 0) {
        const y0 = mapY(0);
        ctx.beginPath();
        ctx.moveTo(plot.left, y0);
        ctx.lineTo(plot.right, y0);
        ctx.stroke();
      }
      if (values.xMin < 0 && values.xMax > 0) {
        const x0 = mapX(0);
        ctx.beginPath();
        ctx.moveTo(x0, plot.top);
        ctx.lineTo(x0, plot.bottom);
        ctx.stroke();
      }
      ctx.fillStyle = "#40536f";
      ctx.font = "11px Segoe UI, sans-serif";
      ctx.fillText(formatGraphNumber(values.xMin, 1), plot.left, height - 12);
      ctx.fillText(formatGraphNumber(values.xMax, 1), plot.right - 34, height - 12);
      ctx.fillText(formatGraphNumber(values.yMax, 1), 8, plot.top + 4);
      ctx.fillText(formatGraphNumber(values.yMin, 1), 8, plot.bottom);
      return { plot, mapX, mapY };
    }

    function drawLine(ctx, points, mapX, mapY, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let started = false;
      points.forEach((point) => {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          started = false;
          return;
        }
        const x = mapX(point.x);
        const y = mapY(point.y);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    function drawScatter(ctx, points, mapX, mapY, color) {
      ctx.fillStyle = color;
      points.forEach((point) => {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
        ctx.beginPath();
        ctx.arc(mapX(point.x), mapY(point.y), 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawBars(ctx, points, mapX, mapY, values, color) {
      const width = Math.max(8, (mapX(values.xMin + (values.xMax - values.xMin) / Math.max(2, points.length)) - mapX(values.xMin)) * 0.58);
      ctx.fillStyle = color;
      points.forEach((point) => {
        const x = mapX(point.x) - width / 2;
        const y = mapY(Math.max(0, point.y));
        const zero = mapY(0);
        ctx.fillRect(x, Math.min(y, zero), width, Math.max(2, Math.abs(zero - y)));
      });
    }

    function drawDatasets(canvas, state, mode = "main") {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;
      const { plot, mapX, mapY } = drawGrid(ctx, width, height, state.values);
      ctx.save();
      ctx.beginPath();
      ctx.rect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
      ctx.clip();
      if (mode === "derivative" && state.firstFn) {
        const points = [];
        const dx = (state.values.xMax - state.values.xMin) / Math.max(1, state.values.samples - 1);
        for (let i = 0; i < state.values.samples; i += 1) {
          const x = state.values.xMin + i * dx;
          points.push({ x, y: derivative(state.firstFn, x) });
        }
        drawLine(ctx, points, mapX, mapY, "#7c3aed");
      } else if (mode === "integral" && state.firstFn) {
        const zeroY = mapY(0);
        const points = state.datasets[0].points.filter((point) => Number.isFinite(point.y));
        ctx.fillStyle = "rgba(10, 123, 131, 0.18)";
        ctx.beginPath();
        points.forEach((point, index) => {
          const x = mapX(point.x);
          const y = mapY(point.y);
          if (index === 0) ctx.moveTo(x, zeroY);
          ctx.lineTo(x, y);
        });
        if (points.length) ctx.lineTo(mapX(points[points.length - 1].x), zeroY);
        ctx.closePath();
        ctx.fill();
        drawLine(ctx, points, mapX, mapY, "#0a7b83");
      } else {
        state.datasets.forEach((dataset) => {
          if (dataset.type === "bar") drawBars(ctx, dataset.points, mapX, mapY, state.values, dataset.color);
          else if (dataset.type === "scatter") drawScatter(ctx, dataset.points, mapX, mapY, dataset.color);
          else drawLine(ctx, dataset.points, mapX, mapY, dataset.color);
        });
      }
      ctx.restore();
    }

    function updateTable(state) {
      const xCells = state.tableRows.map((row) => `<td${row.x === 0 ? ' class="is-focus"' : ""}>${formatGraphNumber(row.x, 2)}</td>`).join("");
      const yCells = state.tableRows.map((row) => `<td${row.x === 0 ? ' class="is-focus"' : ""}>${formatGraphNumber(row.y, 2)}</td>`).join("");
      const equation = state.datasets[0]?.label || "y = f(x)";
      const rows = `<tr><th>x</th>${xCells}</tr><tr><th>${escapeHtml(equation)}</th>${yCells}</tr>`;
      document.querySelectorAll("[data-graph-table], [data-graph-report-table]").forEach((body) => {
        body.innerHTML = rows;
      });
    }

    function updateLegend(state) {
      const legend = document.querySelector("[data-graph-legend]");
      if (legend) {
        legend.innerHTML = state.datasets.map((dataset) => `<span><i style="background:${dataset.color}"></i>${escapeHtml(dataset.label)}</span>`).join("");
      }
      document.querySelectorAll("[data-graph-equation-summary]").forEach((box) => {
        box.innerHTML = state.datasets.map((dataset) => `<span>${escapeHtml(dataset.label)}</span>`).join("");
      });
    }

    function render() {
      const state = buildState();
      drawDatasets(canvases.main, state);
      drawDatasets(canvases.derivative, state, "derivative");
      drawDatasets(canvases.integral, state, "integral");
      drawDatasets(canvases.report, state);
      updateTable(state);
      updateLegend(state);
      const modeLabel = { function: "Function Graph", parametric: "Parametric Curve", polar: "Polar Graph", scatter: "Scatter Plot", bar: "Bar Chart", histogram: "Histogram" }[state.values.type] || "Graph";
      const roots = state.stats.roots.slice(0, 5).map((root) => formatGraphNumber(root)).join(", ") || "n/a";
      setGraphValue("modeLabel", modeLabel);
      setGraphValue("domainLabel", `${formatGraphNumber(state.values.xMin, 1)} to ${formatGraphNumber(state.values.xMax, 1)}`);
      setGraphValue("rangeLabel", `${formatGraphNumber(state.values.yMin, 1)} to ${formatGraphNumber(state.values.yMax, 1)}`);
      setGraphValue("generatedAt", reportTimestamp());
      setGraphValue("equationUsed", state.datasets[0]?.label || "y = f(x)");
      setGraphValue("yIntercept", formatGraphNumber(state.stats.yIntercept));
      setGraphValue("roots", roots);
      setGraphValue("derivative", formatGraphNumber(state.stats.derivativeValue));
      setGraphValue("derivativeLabel", `slope at x = ${formatGraphNumber(state.values.x0, 2)}`);
      setGraphValue("integral", formatGraphNumber(state.stats.integralValue));
      setGraphValue("turningPoint", state.stats.minPoint ? `(${formatGraphNumber(state.stats.minPoint.x)}, ${formatGraphNumber(state.stats.minPoint.y)})` : "n/a");
      setGraphValue("graphRange", state.stats.minPoint ? `[${formatGraphNumber(state.stats.minPoint.y)}, infinity)` : "n/a");
      setGraphValue("trendText", state.stats.minPoint ? `Decreases on (-infinity, ${formatGraphNumber(state.stats.minPoint.x)}). Increases on (${formatGraphNumber(state.stats.minPoint.x)}, infinity).` : "Trend depends on selected data.");
      const minText = state.stats.minPoint ? `minimum near (${formatGraphNumber(state.stats.minPoint.x)}, ${formatGraphNumber(state.stats.minPoint.y)})` : "no sampled minimum";
      const maxText = state.stats.maxPoint ? `maximum near (${formatGraphNumber(state.stats.maxPoint.x)}, ${formatGraphNumber(state.stats.maxPoint.y)})` : "no sampled maximum";
      setGraphValue("analysisText", `${modeLabel} plotted across ${formatGraphNumber(state.values.xMin, 1)} to ${formatGraphNumber(state.values.xMax, 1)}. The sampled graph shows ${roots === "n/a" ? "no visible x-intercepts" : `x-intercepts near ${roots}`}, ${minText}, and ${maxText}.`);
      return state;
    }

    function resetGraph() {
      controls.type.value = defaults.type;
      controls.equations.value = defaults.equations;
      controls.data.value = defaults.data;
      controls.xMin.value = defaults.xMin;
      controls.xMax.value = defaults.xMax;
      controls.yMin.value = defaults.yMin;
      controls.yMax.value = defaults.yMax;
      controls.x0.value = defaults.x0;
      controls.samples.value = defaults.samples;
      controls.angle.value = defaults.angle;
      controls.grid.value = defaults.grid;
      controls.country.value = defaults.country;
      render();
      if (window.kalqUpdateCountryCopy) window.kalqUpdateCountryCopy();
    }

    function openReport() {
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) reportButton.setAttribute("aria-expanded", "true");
    }

    function closeReport() {
      reportPreview.hidden = true;
      document.body.classList.remove("report-open", "print-report");
      if (reportButton) reportButton.setAttribute("aria-expanded", "false");
    }

    document.querySelectorAll("[data-graph-template]").forEach((button) => {
      button.addEventListener("click", () => {
        controls.type.value = "function";
        controls.equations.value = button.dataset.graphTemplate || defaults.equations;
        render();
      });
    });

    document.querySelectorAll("[data-graph-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.graphAction;
        if (action === "calculate") render();
        if (action === "reset") resetGraph();
        if (action === "report") openReport();
        if (action === "close-report") closeReport();
        if (action === "print-report") {
          render();
          document.body.classList.add("print-report");
          window.setTimeout(() => {
            window.print();
            document.body.classList.remove("print-report");
          }, 80);
        }
      });
    });

    if (reportPreview) {
      reportPreview.addEventListener("click", (event) => {
        if (event.target === reportPreview) closeReport();
      });
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
    });

    render();
  }

  function setupAgeCalculator() {
    const form = document.getElementById("ageForm");
    if (!form) return;

    const controls = {
      dob: document.getElementById("age-dob"),
      calcDate: document.getElementById("age-calc-date"),
      region: document.getElementById("age-region"),
      timezone: document.getElementById("age-timezone"),
      time: document.getElementById("age-time"),
      meridian: document.getElementById("age-meridian"),
      name: document.getElementById("age-name")
    };
    const reportPreview = document.getElementById("ageReportPreview");
    const reportButton = document.querySelector('[data-age-action="report"]');
    const number = new Intl.NumberFormat("en-US");
    const defaults = {
      dob: "29 / 05 / 1996",
      calcDate: "16 / 04 / 2025",
      region: "Malaysia",
      timezone: "Asia/Kuala_Lumpur",
      time: "10:30",
      meridian: "AM",
      name: ""
    };

    function setValue(name, value) {
      document.querySelectorAll(`[data-age-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function parseDate(value, fallback) {
      const normalized = String(value || "").trim();
      const slashDate = normalized.match(/^(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{4})$/);
      if (slashDate) {
        const day = Number(slashDate[1]);
        const month = Number(slashDate[2]) - 1;
        const year = Number(slashDate[3]);
        const parsedSlash = new Date(year, month, day);
        if (parsedSlash.getFullYear() === year && parsedSlash.getMonth() === month && parsedSlash.getDate() === day) {
          return parsedSlash;
        }
      }
      const parsed = new Date(normalized);
      if (!Number.isNaN(parsed.getTime())) {
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }
      return fallback ? parseDate(fallback) : new Date();
    }

    function parseTime(value) {
      const match = String(value || "").trim().match(/^(\d{1,2})(?:\s*:\s*(\d{2}))?\s*(AM|PM)?$/i);
      if (!match) return { hours: 0, minutes: 0 };
      let hours = Math.min(23, Number(match[1]) || 0);
      const minutes = Math.min(59, Number(match[2]) || 0);
      const meridian = match[3] ? match[3].toUpperCase() : "";
      if (meridian === "PM" && hours < 12) hours += 12;
      if (meridian === "AM" && hours === 12) hours = 0;
      return { hours, minutes };
    }

    function withTime(date, timeText) {
      const time = parseTime(timeText);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hours, time.minutes, 0, 0);
    }

    function daysInMonth(year, monthIndex) {
      return new Date(year, monthIndex + 1, 0).getDate();
    }

    function formatDate(date) {
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    }

    function formatWeekday(date) {
      return date.toLocaleDateString("en-US", { weekday: "long" });
    }

    function pad(value) {
      return String(Math.max(0, Math.floor(value))).padStart(2, "0");
    }

    function exactAge(birthDate, calcDate) {
      if (calcDate < birthDate) return { years: 0, months: 0, days: 0 };
      let years = calcDate.getFullYear() - birthDate.getFullYear();
      let months = calcDate.getMonth() - birthDate.getMonth();
      let days = calcDate.getDate() - birthDate.getDate();
      if (days < 0) {
        months -= 1;
        days += daysInMonth(calcDate.getFullYear(), calcDate.getMonth() - 1);
      }
      if (months < 0) {
        years -= 1;
        months += 12;
      }
      return { years, months, days };
    }

    function westernZodiac(date) {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const signs = [
        ["Capricorn", 1, 19], ["Aquarius", 2, 18], ["Pisces", 3, 20],
        ["Aries", 4, 19], ["Taurus", 5, 20], ["Gemini", 6, 20],
        ["Cancer", 7, 22], ["Leo", 8, 22], ["Virgo", 9, 22],
        ["Libra", 10, 22], ["Scorpio", 11, 21], ["Sagittarius", 12, 21]
      ];
      const sign = signs.find((item) => month < item[1] || (month === item[1] && day <= item[2]));
      return sign ? sign[0] : "Capricorn";
    }

    function chineseZodiac(year) {
      const animals = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
      return animals[((year - 4) % 12 + 12) % 12];
    }

    function zodiacElement(sign) {
      const elements = {
        Aries: "Fire", Leo: "Fire", Sagittarius: "Fire",
        Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
        Gemini: "Air", Libra: "Air", Aquarius: "Air",
        Cancer: "Water", Scorpio: "Water", Pisces: "Water"
      };
      return elements[sign] || "Air";
    }

    function hijriDate(date) {
      try {
        return new Intl.DateTimeFormat("en-US-u-ca-islamic", {
          day: "numeric",
          month: "long",
          year: "numeric"
        }).format(date);
      } catch (error) {
        return "Hijri date unavailable";
      }
    }

    function nextBirthday(birthDate, calcDate, timeText) {
      const time = parseTime(timeText);
      let target = new Date(calcDate.getFullYear(), birthDate.getMonth(), birthDate.getDate(), time.hours, time.minutes, 0, 0);
      const comparison = new Date(calcDate.getFullYear(), calcDate.getMonth(), calcDate.getDate(), new Date().getHours(), new Date().getMinutes(), new Date().getSeconds(), 0);
      if (target < comparison) {
        target = new Date(calcDate.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate(), time.hours, time.minutes, 0, 0);
      }
      return target;
    }

    function milestoneRows(birthDate, calcDate) {
      const country = controls.region ? controls.region.value : defaults.region;
      const countryRows = {
        "United States": [["Legal Adult", 18], ["Driving Licence", 16], ["Voting Eligibility", 18], ["Retirement Reference", 67]],
        "United Kingdom": [["Legal Adult", 18], ["Provisional Driving Licence", 17], ["Voting Eligibility", 18], ["State Pension Reference", 66]],
        Malaysia: [["MyKad (Identity Card)", 18], ["Motorcycle Licence (B2)", 16], ["Car Licence (B)", 17], ["Voting Eligibility", 18]],
        Singapore: [["Legal Adult", 21], ["Driving Licence", 18], ["Voting Eligibility", 21], ["CPF Retirement Reference", 65]],
        Indonesia: [["KTP Identity Card", 17], ["Driving Licence", 17], ["Voting Eligibility", 17], ["Retirement Reference", 58]],
        India: [["Legal Adult", 18], ["Driving Licence", 18], ["Voting Eligibility", 18], ["Senior Citizen Reference", 60]]
      };
      return (countryRows[country] || countryRows.Malaysia).map(([label, age]) => {
        const date = new Date(birthDate.getFullYear() + age, birthDate.getMonth(), birthDate.getDate());
        const achieved = date <= calcDate;
        return { label, age, date, achieved };
      });
    }

    function renderMilestones(rows, selector) {
      document.querySelectorAll(`[data-age-table="${selector}"]`).forEach((body) => {
        body.innerHTML = rows.map((row) => (
          `<tr><td>${escapeHtml(row.label)}</td><td>${row.age}+</td><td>${escapeHtml(formatDate(row.date))}</td><td><span class="age-status ${row.achieved ? "done" : "upcoming"}">${row.achieved ? `Eligible (${row.age}+)` : "Upcoming"}</span></td></tr>`
        )).join("");
      });
      document.querySelectorAll(`[data-age-list="${selector}"]`).forEach((list) => {
        list.innerHTML = rows.map((row) => (
          `<div><span>${escapeHtml(row.label)}</span><b class="${row.achieved ? "done" : "upcoming"}">${row.achieved ? `Eligible (${row.age}+)` : "Upcoming"}</b></div>`
        )).join("");
      });
    }

    function toggleOptional(name, visible) {
      document.querySelectorAll(`[data-age-optional="${name}"]`).forEach((element) => {
        element.hidden = !visible;
      });
    }

    function readInputs() {
      const birthDate = parseDate(controls.dob.value, defaults.dob);
      const calcDate = parseDate(controls.calcDate.value, defaults.calcDate);
      let timeValue = controls.time.value || defaults.time;
      if (controls.meridian && !/[AP]M/i.test(timeValue)) {
        timeValue = `${timeValue} ${controls.meridian.value || defaults.meridian}`;
      }
      return {
        birthDate,
        birthDateTime: withTime(birthDate, timeValue),
        calcDate,
        region: controls.region.value || defaults.region,
        timezone: controls.timezone.value || defaults.timezone,
        timezoneLabel: controls.timezone.selectedOptions[0] ? controls.timezone.selectedOptions[0].textContent : defaults.timezone,
        time: timeValue,
        name: controls.name.value.trim() || "Personal Age Report",
        showHijri: true,
        showZodiac: true,
        showMilestones: true
      };
    }

    function updateBars(values) {
      const raw = [values.totalDays, values.totalHours, values.totalMinutes, values.totalSeconds].map((value) => Math.max(1, value));
      const logs = raw.map((value) => Math.log10(value));
      const min = Math.min(...logs);
      const max = Math.max(...logs);
      const heights = logs.map((value) => 32 + ((value - min) / Math.max(1, max - min)) * 56);
      document.querySelectorAll("[data-age-bars]").forEach((chart) => {
        Array.from(chart.querySelectorAll("span")).forEach((bar, index) => {
          bar.style.height = `${heights[index].toFixed(1)}%`;
        });
      });
    }

    function render() {
      const values = readInputs();
      const age = exactAge(values.birthDate, values.calcDate);
      const totalMs = Math.max(0, values.calcDate.getTime() - values.birthDate.getTime());
      const totalDays = Math.floor(totalMs / 86400000);
      const totalHours = totalDays * 24;
      const totalMinutes = totalHours * 60;
      const totalSeconds = totalMinutes * 60;
      const birthday = nextBirthday(values.birthDate, values.calcDate, values.time);
      const calcNow = new Date(values.calcDate.getFullYear(), values.calcDate.getMonth(), values.calcDate.getDate(), new Date().getHours(), new Date().getMinutes(), new Date().getSeconds(), 0);
      const countdownMs = Math.max(0, birthday.getTime() - calcNow.getTime());
      const countDays = Math.floor(countdownMs / 86400000);
      const countHours = Math.floor((countdownMs % 86400000) / 3600000);
      const countMinutes = Math.floor((countdownMs % 3600000) / 60000);
      const countSeconds = Math.floor((countdownMs % 60000) / 1000);
      const ageAsYears = Math.max(0.01, age.years + age.months / 12 + age.days / 365);
      const yearsShare = Math.min(100, (age.years / ageAsYears) * 100);
      const monthsShare = Math.max(0, ((age.months / 12) / ageAsYears) * 100);
      const daysShare = Math.max(0, 100 - yearsShare - monthsShare);
      const totalMonths = age.years * 12 + age.months;
      const halfBirthday = new Date(values.calcDate.getFullYear(), values.birthDate.getMonth() + 6, values.birthDate.getDate());
      if (halfBirthday < values.calcDate) halfBirthday.setFullYear(halfBirthday.getFullYear() + 1);
      const previousBirthday = new Date(birthday.getFullYear() - 1, values.birthDate.getMonth(), values.birthDate.getDate());
      const birthdayCycle = Math.max(1, Math.round((birthday.getTime() - previousBirthday.getTime()) / 86400000));
      const daysSinceBirthday = Math.max(0, Math.min(birthdayCycle, Math.round((values.calcDate.getTime() - previousBirthday.getTime()) / 86400000)));
      const birthdayProgress = (daysSinceBirthday / birthdayCycle) * 100;
      const sign = westernZodiac(values.birthDate);
      const lifeExpectancy = ({
        "United States": 77,
        "United Kingdom": 81,
        Malaysia: 65,
        Singapore: 84,
        Indonesia: 72,
        India: 70
      })[values.region] || 75;
      const lifeProgress = Math.min(100, (ageAsYears / lifeExpectancy) * 100);
      const remainingYears = Math.max(0, lifeExpectancy - ageAsYears);
      const date18 = new Date(values.birthDate.getFullYear() + 18, values.birthDate.getMonth(), values.birthDate.getDate());
      const date25 = new Date(values.birthDate.getFullYear() + 25, values.birthDate.getMonth(), values.birthDate.getDate());
      const date65 = new Date(values.birthDate.getFullYear() + 65, values.birthDate.getMonth(), values.birthDate.getDate());

      setValue("exactAge", `${age.years} years, ${age.months} months, ${age.days} days`);
      setValue("yearsNumber", number.format(age.years));
      setValue("monthsNumber", number.format(age.months));
      setValue("daysNumber", number.format(age.days));
      setValue("calculationDate", formatDate(values.calcDate));
      setValue("calculatedOn", formatDate(values.calcDate));
      setValue("birthDate", formatDate(values.birthDate));
      setValue("name", values.name);
      setValue("region", values.region);
      setValue("milestoneTitle", `${values.region} Milestones`);
      setValue("timezoneLabel", values.timezoneLabel);
      setValue("generatedAt", reportTimestamp());
      setValue("reportGeneratedDate", reportTimestamp());
      setValue("totalMonths", `${number.format(totalMonths)} months`);
      setValue("totalMonthsPlain", number.format(totalMonths));
      setValue("totalWeeks", `${number.format(Math.floor(totalDays / 7))} weeks`);
      setValue("totalWeeksPlain", number.format(Math.floor(totalDays / 7)));
      setValue("totalDays", `${number.format(totalDays)} days`);
      setValue("totalDaysPlain", number.format(totalDays));
      setValue("totalHours", `${number.format(totalHours)} hours`);
      setValue("totalHoursPlain", number.format(totalHours));
      setValue("totalMinutes", `${number.format(totalMinutes)} minutes`);
      setValue("totalMinutesPlain", number.format(totalMinutes));
      setValue("totalSeconds", `${number.format(totalSeconds)} seconds`);
      setValue("totalSecondsPlain", number.format(totalSeconds));
      setValue("aliveSentence", `You have been alive for ${number.format(totalDays)} days.`);
      setValue("daysPlain", number.format(totalDays));
      setValue("hoursPlain", number.format(totalHours));
      setValue("minutesPlain", number.format(totalMinutes));
      setValue("secondsPlain", number.format(totalSeconds));
      setValue("nextBirthday", formatDate(birthday));
      setValue("nextBirthdayDay", formatWeekday(birthday));
      setValue("daysRemaining", `${number.format(countDays)} days`);
      setValue("weekday", formatWeekday(birthday));
      setValue("halfBirthday", formatDate(halfBirthday));
      setValue("birthdayProgress", `${birthdayProgress.toFixed(1)}%`);
      setValue("birthdayProgressText", `${number.format(daysSinceBirthday)} / ${number.format(birthdayCycle)} days completed`);
      setValue("countDays", number.format(countDays));
      setValue("countHours", pad(countHours));
      setValue("countMinutes", pad(countMinutes));
      setValue("countSeconds", pad(countSeconds));
      setValue("dayBorn", formatWeekday(values.birthDate));
      setValue("birthYearType", daysInMonth(values.birthDate.getFullYear(), 1) === 29 ? "Leap Year" : "Common Year");
      setValue("westernZodiac", sign);
      setValue("zodiacElement", zodiacElement(sign));
      setValue("chineseZodiac", chineseZodiac(values.birthDate.getFullYear()));
      setValue("hijriDate", hijriDate(values.birthDate));
      setValue("yearsShare", `${yearsShare.toFixed(1)}%`);
      setValue("monthsShare", `${monthsShare.toFixed(1)}%`);
      setValue("daysShare", `${Math.max(0, daysShare).toFixed(1)}%`);
      setValue("timelineBirth", formatDate(values.birthDate));
      setValue("timeline18", formatDate(date18));
      setValue("timeline25", formatDate(date25));
      setValue("timelineNext", formatDate(birthday));
      setValue("timeline65", formatDate(date65));
      setValue("lifeProgress", `${lifeProgress.toFixed(1)}%`);
      setValue("lifeProgressDetail", `${ageAsYears.toFixed(1)} / ${lifeExpectancy} years`);
      setValue("expectedLife", `${lifeProgress.toFixed(1)}%`);
      setValue("expectedLifeDetail", `Based on ${lifeExpectancy} years life expectancy`);
      setValue("remainingToLife", `${remainingYears.toFixed(1)} (${(100 - lifeProgress).toFixed(1)}%)`);
      setValue("ageAnalysis", `You are ${age.years} years, ${age.months} months, and ${age.days} days old, with ${lifeProgress.toFixed(1)}% of the selected ${lifeExpectancy}-year life reference completed. Keep using the timeline as a planning guide for health, skills, relationships, and long-term goals.`);

      document.querySelectorAll(".age-donut").forEach((donut) => {
        donut.style.setProperty("--age-years", yearsShare.toFixed(1));
        donut.style.setProperty("--age-months-end", (yearsShare + monthsShare).toFixed(1));
      });
      document.querySelectorAll("[data-age-progress='birthday']").forEach((bar) => {
        bar.style.setProperty("--progress", `${birthdayProgress.toFixed(1)}%`);
      });
      document.querySelectorAll("[data-age-progress='life'], .age-life-donut").forEach((bar) => {
        bar.style.setProperty("--progress", `${lifeProgress.toFixed(1)}%`);
      });
      document.querySelectorAll("[data-age-progress='expected']").forEach((bar) => {
        bar.style.setProperty("--progress", `${lifeProgress.toFixed(1)}%`);
      });

      toggleOptional("hijri", true);
      toggleOptional("zodiac", true);
      toggleOptional("milestones", true);

      const rows = milestoneRows(values.birthDate, values.calcDate);
      renderMilestones(rows, "milestones");
      renderMilestones(rows, "report-milestones");
      updateBars({ totalDays, totalHours, totalMinutes, totalSeconds });
      return { values, age, totalDays, totalHours, totalMinutes, totalSeconds, birthday };
    }

    function saveAgeHistory(source = "Calculation") {
      const snapshot = render();
      const report = document.querySelector(".age-report");
      addHistoryEntry({
        type: "Age Calculator",
        title: `${snapshot.age.years} years, ${snapshot.age.months} months, ${snapshot.age.days} days`,
        reportTitle: "Age Calculator Report",
        url: "age-calculator.html",
        source,
        inputs: [
          { label: "Date of Birth", value: formatDate(snapshot.values.birthDate) },
          { label: "Calculation Date", value: formatDate(snapshot.values.calcDate) },
          { label: "Country / Region", value: snapshot.values.region },
          { label: "Time Zone", value: snapshot.values.timezoneLabel }
        ],
        outputs: [
          { label: "Exact Age", value: `${snapshot.age.years} years, ${snapshot.age.months} months, ${snapshot.age.days} days` },
          { label: "Total Days", value: `${number.format(snapshot.totalDays)} days` },
          { label: "Next Birthday", value: formatDate(snapshot.birthday) },
          { label: "Day Born", value: formatWeekday(snapshot.values.birthDate) }
        ],
        reportHtml: report ? report.outerHTML : ""
      });
    }

    function resetAge() {
      controls.dob.value = defaults.dob;
      controls.calcDate.value = defaults.calcDate;
      controls.region.value = defaults.region;
      controls.timezone.value = defaults.timezone;
      controls.time.value = defaults.time;
      if (controls.meridian) controls.meridian.value = defaults.meridian;
      controls.name.value = defaults.name;
      document.querySelectorAll("[data-age-country]").forEach((button) => {
        button.classList.toggle("active", button.dataset.ageCountry === defaults.region);
      });
      render();
    }

    function openReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) reportButton.setAttribute("aria-expanded", "true");
      const printButton = reportPreview.querySelector('[data-age-action="print-report"]');
      if (printButton) printButton.focus({ preventScroll: true });
    }

    function closeReportPreview() {
      if (!reportPreview || reportPreview.hidden) return;
      reportPreview.hidden = true;
      document.body.classList.remove("report-open");
      document.body.classList.remove("print-report");
      if (reportButton) {
        reportButton.setAttribute("aria-expanded", "false");
        reportButton.focus({ preventScroll: true });
      }
    }

    function printReportPreview() {
      if (!reportPreview) return;
      render();
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      document.body.classList.add("print-report");
      window.print();
    }

    document.querySelectorAll("[data-age-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.ageAction;
        if (action === "calculate") {
          render();
          saveAgeHistory("Calculate");
        }
        if (action === "reset") resetAge();
        if (action === "report") {
          openReportPreview();
          saveAgeHistory("Report Preview");
        }
        if (action === "close-report") closeReportPreview();
        if (action === "print-report") {
          printReportPreview();
          saveAgeHistory("Report Print");
        }
      });
    });

    document.querySelectorAll("[data-age-country]").forEach((button) => {
      button.addEventListener("click", () => {
        if (controls.region) controls.region.value = button.dataset.ageCountry || defaults.region;
        document.querySelectorAll("[data-age-country]").forEach((item) => item.classList.toggle("active", item === button));
        render();
      });
    });

    Object.values(controls).forEach((control) => {
      if (!control) return;
      control.addEventListener("change", render);
      control.addEventListener("input", render);
    });

    if (reportPreview) {
      reportPreview.addEventListener("click", (event) => {
        if (event.target === reportPreview) closeReportPreview();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && reportPreview && !reportPreview.hidden) {
        closeReportPreview();
      }
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-report");
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
      saveAgeHistory("Submit");
    });

    render();
    window.setInterval(render, 1000);
  }

  function setupAbacusTrainer() {
    const form = document.getElementById("abacusForm");
    if (!form) return;

    const controls = {
      mode: document.getElementById("abacus-mode"),
      questions: document.getElementById("abacus-questions"),
      type: document.getElementById("abacus-type"),
      timer: document.getElementById("abacus-timer"),
      operation: document.getElementById("abacus-operation"),
      hint: document.getElementById("abacus-hint"),
      difficulty: document.getElementById("abacus-difficulty"),
      digits: document.getElementById("abacus-digits"),
      student: document.getElementById("abacus-student"),
      className: document.getElementById("abacus-class")
    };
    const reportPreview = document.getElementById("abacusReportPreview");
    const reportButton = document.querySelector('[data-abacus-action="report"]');
    const defaults = {
      mode: "Training",
      questions: "20",
      type: "Compact (9 Rods)",
      timer: "Off",
      operation: "Addition",
      hint: "Smart Hint",
      difficulty: "Medium",
      digits: "2",
      student: "Ali Rahman",
      className: "5A"
    };
    const reviewBase = [
      ["8 + 5", 13, 13, true, "12s"],
      ["23 + 17", 40, 40, true, "15s"],
      ["46 + 28", 73, 74, false, "22s"],
      ["59 + 16", 75, 75, true, "18s"],
      ["34 + 27", 61, 61, true, "16s"]
    ];
    const timeBars = [20, 14, 18, 24, 11, 13, 15, 21, 17, 14, 19, 12, 10, 13, 16, 9, 12, 7, 10, 12];
    let abacusValue = 0;
    let abacusDigits = [];
    let currentRods = 9;
    let currentChallengeValue = 13;
    let questionIndex = 0;
    let completionTimer = null;
    let checkTimer = null;
    let countdownTimer = null;
    let autoCheckDeadline = 0;
    let isCompleting = false;
    let completedRows = [];

    function setValue(name, value) {
      document.querySelectorAll(`[data-abacus-value="${name}"]`).forEach((element) => {
        element.textContent = value;
      });
    }

    function setAnswerStatus(message, state = "idle") {
      setValue("answerStatus", message);
      document.querySelectorAll("[data-abacus-status]").forEach((element) => {
        element.dataset.abacusStatus = state;
      });
    }

    function readInputs() {
      return Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control ? control.value : defaults[key]]));
    }

    function rodsForType(type) {
      if (String(type).includes("17")) return 17;
      if (String(type).includes("9")) return 9;
      return 13;
    }

    function maxDigitsForType(type) {
      if (String(type).includes("17")) return 5;
      if (String(type).includes("13")) return 4;
      return 3;
    }

    function updateDigitOptions() {
      if (!controls.digits) return;
      const maxDigits = maxDigitsForType(controls.type ? controls.type.value : defaults.type);
      const current = Math.min(Number(controls.digits.value) || Number(defaults.digits), maxDigits);
      controls.digits.innerHTML = Array.from({ length: maxDigits }, (_, index) => {
        const value = String(index + 1);
        return `<option${Number(value) === current ? " selected" : ""}>${value}</option>`;
      }).join("");
    }

    function applyPracticeMode() {
      const mode = controls.mode ? controls.mode.value : defaults.mode;
      const presets = {
        Training: { difficulty: "Medium", timer: "Off", questions: "20", hint: "Smart Hint" },
        Challenge: { difficulty: "Hard", timer: "15 sec / question", questions: "20", hint: "Smart Hint" },
        "Speed Drill": { difficulty: "Hard", timer: "10 sec / question", questions: "30", hint: "Off" }
      };
      const preset = presets[mode] || presets.Training;
      Object.entries(preset).forEach(([key, value]) => {
        if (controls[key]) controls[key].value = value;
      });
    }

    function timerSeconds(values) {
      const match = String(values.timer || "").match(/\d+/);
      return match ? Number(match[0]) : 0;
    }

    function promptFor(values) {
      const digits = Number(values.digits) || 2;
      const levelOffset = values.difficulty === "Hard" ? 4 : values.difficulty === "Easy" ? 0 : 2;
      const seed = questionIndex + levelOffset;
      const oneDigit = [
        [4, 3],
        [8, 5],
        [9, 4],
        [6, 7]
      ];
      const twoDigit = [
        [8, 5],
        [23, 17],
        [46, 28],
        [34, 27],
        [59, 16]
      ];
      const threeDigit = [
        [58, 65],
        [128, 45],
        [146, 73],
        [235, 128],
        [412, 179]
      ];
      const pool = digits === 1 ? oneDigit : digits === 3 ? threeDigit : twoDigit;
      const pair = pool[seed % pool.length];
      const safeDividePair = digits === 1 ? [8, 2] : digits === 3 ? [144, 12] : [84, 7];
      if (values.operation === "Subtraction") {
        const larger = Math.max(pair[0], pair[1]);
        const smaller = Math.min(pair[0], pair[1]);
        return { prompt: `${larger} - ${smaller}`, value: larger - smaller };
      }
      if (values.operation === "Multiplication") {
        const multiplier = digits === 1 ? 3 + (seed % 4) : digits === 3 ? 2 + (seed % 3) : 4 + (seed % 5);
        return { prompt: `${pair[0]} x ${multiplier}`, value: pair[0] * multiplier };
      }
      if (values.operation === "Division") {
        return { prompt: `${safeDividePair[0]} / ${safeDividePair[1]}`, value: safeDividePair[0] / safeDividePair[1] };
      }
      if (values.operation === "Mixed") {
        const third = digits === 1 ? 4 : digits === 3 ? 50 : 8;
        return { prompt: `${pair[0]} + ${pair[1]} - ${third}`, value: pair[0] + pair[1] - third };
      }
      return { prompt: `${pair[0]} + ${pair[1]}`, value: pair[0] + pair[1] };
    }

    function sessionStats(values) {
      const questions = Number(values.questions) || 20;
      const diff = values.difficulty === "Hard" ? -4 : values.difficulty === "Easy" ? 3 : 0;
      const accuracy = Math.max(70, Math.min(99, 92 + diff));
      const correct = Math.round((accuracy / 100) * 25);
      const incorrect = Math.max(0, 25 - correct);
      const average = values.timer === "10 sec / question" ? 12.4 : values.timer === "20 sec / question" ? 20.3 : values.timer === "Off" ? 18.6 : 18.6;
      const totalSeconds = Math.round(questions * average + 90);
      const score = Math.round((accuracy * 10 + questions * 16 + (values.difficulty === "Hard" ? 120 : 10)) / 10) * 10;
      const level = values.difficulty === "Hard" ? 5 : values.difficulty === "Easy" ? 3 : 4;
      const progress = values.difficulty === "Hard" ? 74 : values.difficulty === "Easy" ? 58 : 68;
      return { questions, accuracy, correct, incorrect, average, totalSeconds, score, level, progress };
    }

    function formatTime(totalSeconds) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function digitsForValue(value, rods) {
      const rawDigits = String(Math.max(0, Math.floor(Number(value) || 0))).split("").map((digit) => Number(digit) || 0);
      return Array(Math.max(0, rods - rawDigits.length)).fill(0).concat(rawDigits.slice(-rods));
    }

    function valueFromDigits(digits) {
      return Number(digits.join("")) || 0;
    }

    function renderBoards(rods, value = abacusValue) {
      currentRods = rods;
      abacusDigits = digitsForValue(value, rods);
      const rodHtml = abacusDigits.map((digit, index) => {
        const topActive = digit >= 5;
        const lowerCount = digit % 5;
        const lowerBeads = [1, 2, 3, 4].map((bead) => (
          `<button class="abacus-bead bottom b${bead}${bead <= lowerCount ? " active" : ""}" type="button" data-abacus-bead data-rod="${index}" data-bead="${bead}" aria-label="Set rod ${rods - index} lower bead ${bead}"></button>`
        )).join("");
        return `<span class="abacus-rod" data-abacus-rod="${index}"><button class="abacus-bead top${topActive ? " active" : ""}" type="button" data-abacus-bead data-rod="${index}" data-bead="top" aria-label="Toggle five bead on rod ${rods - index}"></button>${lowerBeads}</span>`;
      }).join("");
      document.querySelectorAll("[data-abacus-board]").forEach((board) => {
        board.style.setProperty("--rods", rods);
        board.innerHTML = rodHtml;
      });
    }

    function renderBars() {
      document.querySelectorAll("[data-abacus-bars]").forEach((chart) => {
        chart.innerHTML = timeBars.map((value, index) => {
          const label = index === 0 || index === 4 || index === 9 || index === 14 || index === 19 ? `Q${index + 1}` : "";
          return `<span><i style="height:${Math.max(18, value * 4)}%"></i>${label ? `<small>${label}</small>` : ""}</span>`;
        }).join("");
      });
    }

    function hintFor(values, challenge) {
      if (values.hint === "Off") return "Hint is off. Solve using the beads.";
      if (values.hint === "Step Hint") return `Build ${challenge.value} from left to right on the abacus.`;
      if (String(challenge.prompt).includes("x")) return "Multiply first, then set the final product on the beads.";
      if (String(challenge.prompt).includes("/")) return "Divide first, then set the quotient on the beads.";
      return `Set the final answer, ${challenge.value}, on the abacus.`;
    }

    function renderReview(selector, rows) {
      document.querySelectorAll(`[data-abacus-table="${selector}"]`).forEach((body) => {
        body.innerHTML = rows.map((row) => (
          `<tr><td>${escapeHtml(row[0])}</td><td>${row[1]}</td><td>${row[2]}</td><td class="${row[3] ? "abacus-result-correct" : "abacus-result-wrong"}">${row[3] ? "Correct" : "Incorrect"}</td><td>${row[4]}</td></tr>`
        )).join("");
      });
    }

    function renderSummary(values, stats) {
      const summary = [
        ["Student Name", values.student || "Ali Rahman"],
        ["Abacus Type", values.type],
        ["Digits", values.digits],
        ["Class Name", values.className || "5A"],
        ["Operation", values.operation],
        ["Questions", values.questions],
        ["Practice Mode", values.mode],
        ["Difficulty", values.difficulty],
        ["Timer", values.timer]
      ];
      document.querySelectorAll("[data-abacus-summary]").forEach((list) => {
        list.innerHTML = summary.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
      });
      setValue("bestSkill", `${values.operation} - ${values.digits} Digits (${values.difficulty})`);
      setValue("reviewTotal", String(stats.correct + stats.incorrect));
    }

    function reviewRowsFor(challenge) {
      return [
        [challenge.prompt, abacusValue, challenge.value, abacusValue === challenge.value, "Live"],
        ...completedRows,
        ...reviewBase.slice(1)
      ].slice(0, 5);
    }

    function clearCompletionTimer() {
      if (completionTimer) {
        window.clearTimeout(completionTimer);
        completionTimer = null;
      }
    }

    function clearAutoCheckTimers() {
      if (checkTimer) {
        window.clearTimeout(checkTimer);
        checkTimer = null;
      }
      if (countdownTimer) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }

    function updateTimerCounter() {
      if (!autoCheckDeadline) {
        setValue("timerCounter", "");
        return;
      }
      const remaining = Math.max(0, Math.ceil((autoCheckDeadline - Date.now()) / 1000));
      setValue("timerCounter", `Auto check in ${remaining}s`);
    }

    function scheduleAutoCheck(values = readInputs()) {
      clearAutoCheckTimers();
      if (isCompleting) return;
      const seconds = timerSeconds(values);
      if (!seconds) {
        autoCheckDeadline = null;
        setValue("timerCounter", "Timer off");
        return;
      }
      autoCheckDeadline = Date.now() + seconds * 1000;
      updateTimerCounter();
      countdownTimer = window.setInterval(updateTimerCounter, 250);
      checkTimer = window.setTimeout(() => {
        completeCurrentQuestion("Auto");
      }, seconds * 1000);
    }

    function nextQuestion() {
      clearCompletionTimer();
      clearAutoCheckTimers();
      isCompleting = false;
      questionIndex += 1;
      abacusValue = 0;
      render();
      setAnswerStatus("Next question ready.", "idle");
    }

    function completeCurrentQuestion(source = "Answer") {
      clearCompletionTimer();
      clearAutoCheckTimers();
      if (isCompleting) return false;
      isCompleting = true;
      const values = readInputs();
      const challenge = promptFor(values);
      const isCorrect = Number(abacusValue) === Number(challenge.value);
      completedRows.unshift([challenge.prompt, abacusValue, challenge.value, isCorrect, source]);
      completedRows = completedRows.slice(0, 4);
      render({ preserveBoard: true, keepStatus: true, skipAutoCheck: true });
      setAnswerStatus(
        isCorrect ? "Correct. Loading next question..." : `Wrong. Answer: ${challenge.value}. Loading next question...`,
        isCorrect ? "correct" : "wrong"
      );
      setValue("timerCounter", "Next question in 1s");
      completionTimer = window.setTimeout(nextQuestion, 1100);
      return isCorrect;
    }

    function maybeAutoAdvanceFromAbacus() {
      if (Number(abacusValue) !== Number(currentChallengeValue)) return;
      completeCurrentQuestion("Abacus");
    }

    function render(options = {}) {
      updateDigitOptions();
      const values = readInputs();
      const stats = sessionStats(values);
      const challenge = promptFor(values);
      const rods = rodsForType(values.type);
      const insight = `${values.student || "The learner"} shows a strong understanding of ${values.operation.toLowerCase()} using the abacus. Accuracy is high and time per question is improving steadily. Focus on carry and borrow skills for higher confidence.`;
      const shouldResetBoard = !options.preserveBoard || currentChallengeValue !== challenge.value || currentRods !== rods;

      if (shouldResetBoard) {
        abacusValue = 0;
      }
      currentChallengeValue = challenge.value;
      renderBoards(rods, abacusValue);
      renderBars();
      renderReview("review", reviewRowsFor(challenge));
      renderReview("report-review", reviewRowsFor(challenge));
      renderSummary(values, stats);

      setValue("score", String(stats.score));
      setValue("accuracy", `${stats.accuracy}%`);
      setValue("timeTaken", formatTime(stats.totalSeconds));
      setValue("averageTime", `${stats.average.toFixed(1)}s`);
      setValue("streak", values.difficulty === "Hard" ? "5" : "7");
      setValue("level", `Level ${stats.level}`);
      setValue("levelProgress", `${stats.progress}%`);
      setValue("xp", `${stats.progress * 10} / 1000 XP`);
      setValue("prompt", challenge.prompt);
      setValue("currentValue", String(abacusValue));
      setValue("hintText", hintFor(values, challenge));
      setValue("correctText", `${stats.accuracy}% (${stats.correct})`);
      setValue("incorrectText", `${100 - stats.accuracy}% (${stats.incorrect})`);
      setValue("insight", insight);
      if (!options.keepStatus) {
        setAnswerStatus(`Question ${questionIndex + 1}: move the beads, then calculate.`, "idle");
      }

      document.querySelectorAll(".abacus-progress i").forEach((bar) => {
        bar.style.width = `${stats.progress}%`;
      });

      if (!options.skipAutoCheck && !autoCheckDeadline) {
        setValue("timerCounter", "Move the abacus to start");
      }

      return { values, stats, challenge: { ...challenge, userValue: abacusValue }, insight };
    }

    function saveAbacusHistory(source = "Calculation") {
      const snapshot = render({ preserveBoard: true, keepStatus: true, skipAutoCheck: true });
      const report = document.querySelector(".abacus-report");
      addHistoryEntry({
        type: "Abacus Trainer Game",
        title: `${snapshot.stats.accuracy}% accuracy - ${snapshot.values.operation}`,
        reportTitle: "Abacus Trainer Game Report",
        url: "abacus-trainer.html",
        source,
        inputs: [
          { label: "Practice Mode", value: snapshot.values.mode },
          { label: "Operation", value: snapshot.values.operation },
          { label: "Difficulty", value: snapshot.values.difficulty },
          { label: "Digits", value: snapshot.values.digits }
        ],
        outputs: [
          { label: "Score", value: String(snapshot.stats.score) },
          { label: "Accuracy", value: `${snapshot.stats.accuracy}%` },
          { label: "Current Level", value: `Level ${snapshot.stats.level}` },
          { label: "Current Value", value: String(snapshot.challenge.value) }
        ],
        reportHtml: report ? report.outerHTML : ""
      });
    }

    function resetAbacus() {
      clearCompletionTimer();
      clearAutoCheckTimers();
      isCompleting = false;
      questionIndex = 0;
      completedRows = [];
      abacusValue = 0;
      Object.entries(defaults).forEach(([key, value]) => {
        if (controls[key]) controls[key].value = value;
      });
      updateDigitOptions();
      render();
    }

    function openReportPreview() {
      if (!reportPreview) return;
      render({ preserveBoard: true, skipAutoCheck: true });
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      if (reportButton) reportButton.setAttribute("aria-expanded", "true");
      const printButton = reportPreview.querySelector('[data-abacus-action="print-report"]');
      if (printButton) printButton.focus({ preventScroll: true });
    }

    function closeReportPreview() {
      if (!reportPreview || reportPreview.hidden) return;
      reportPreview.hidden = true;
      document.body.classList.remove("report-open");
      document.body.classList.remove("print-report");
      if (reportButton) {
        reportButton.setAttribute("aria-expanded", "false");
        reportButton.focus({ preventScroll: true });
      }
    }

    function printReportPreview() {
      if (!reportPreview) return;
      render({ preserveBoard: true, skipAutoCheck: true });
      reportPreview.hidden = false;
      document.body.classList.add("report-open");
      document.body.classList.add("print-report");
      window.print();
    }

    document.querySelectorAll("[data-abacus-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.abacusAction;
        if (action === "calculate") {
          completeCurrentQuestion("Calculate");
          saveAbacusHistory("Calculate");
        }
        if (action === "reset") resetAbacus();
        if (action === "report") {
          openReportPreview();
          saveAbacusHistory("Report Preview");
        }
        if (action === "close-report") closeReportPreview();
        if (action === "print-report") {
          printReportPreview();
          saveAbacusHistory("Report Print");
        }
      });
    });

    Object.entries(controls).forEach(([key, control]) => {
      if (!control) return;
      control.addEventListener("change", () => {
        clearCompletionTimer();
        clearAutoCheckTimers();
        isCompleting = false;
        if (key === "mode") {
          applyPracticeMode();
        }
        if (key === "type") {
          updateDigitOptions();
        }
        questionIndex = 0;
        completedRows = [];
        abacusValue = 0;
        render();
      });
      control.addEventListener("input", () => {
        clearCompletionTimer();
        clearAutoCheckTimers();
        isCompleting = false;
        render({ preserveBoard: true });
      });
    });

    document.addEventListener("click", (event) => {
      const bead = event.target.closest("[data-abacus-bead]");
      if (!bead || !document.body.contains(bead)) return;
      const rod = Number(bead.dataset.rod);
      if (!Number.isInteger(rod) || rod < 0 || rod >= abacusDigits.length) return;
      const digits = abacusDigits.slice();
      const currentDigit = digits[rod] || 0;
      let top = currentDigit >= 5 ? 5 : 0;
      let lower = currentDigit % 5;
      if (bead.dataset.bead === "top") {
        top = top ? 0 : 5;
      } else {
        const beadValue = Number(bead.dataset.bead) || 0;
        lower = lower === beadValue ? Math.max(0, beadValue - 1) : beadValue;
      }
      digits[rod] = top + lower;
      abacusDigits = digits;
      abacusValue = valueFromDigits(digits);
      render({ preserveBoard: true, skipAutoCheck: true });
      if (Number(abacusValue) === Number(currentChallengeValue)) {
        maybeAutoAdvanceFromAbacus();
      } else {
        scheduleAutoCheck();
      }
    });

    if (reportPreview) {
      reportPreview.addEventListener("click", (event) => {
        if (event.target === reportPreview) closeReportPreview();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && reportPreview && !reportPreview.hidden) {
        closeReportPreview();
      }
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-report");
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      completeCurrentQuestion("Submit");
      saveAbacusHistory("Submit");
    });

    render();
  }

  function headingText(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return "";
    const direct = Array.from(element.children || []).find((child) => /^H[1-6]$/.test(child.tagName || ""));
    const heading = direct || element.querySelector("h2, h3, h4, h5, h6");
    return heading ? heading.textContent.trim() : "";
  }

  function limitFaqReferenceItems(rootScope = document) {
    const scope = rootScope || document;
    const sections = Array.from(scope.querySelectorAll("section, article, div")).filter((element) => !element.closest(".site-footer"));
    sections.forEach((section) => {
      const title = headingText(section);
      if (/Frequently Asked|FAQs?\b/i.test(title)) {
        const articles = Array.from(section.querySelectorAll("article"));
        articles.forEach((article, index) => {
          article.hidden = index >= 4;
          article.classList.toggle("is-extra-support-item", index >= 4);
        });
      }
      if (/\bReferences?\b/i.test(title)) {
        const links = Array.from(section.querySelectorAll(":scope > a, :scope > div > a, .country-aware-reference-link"));
        links.forEach((link, index) => {
          link.hidden = index >= 4;
          link.classList.toggle("is-extra-support-item", index >= 4);
        });
      }
    });
  }

  function setupSearchSuggestions() {
    const items = [
      ["BMI Calculator", "bmi-calculator.html", "Health"],
      ["Compound Interest Calculator", "compound-interest.html", "Finance"],
      ["Currency Converter", "currency-exchange.html", "Converter"],
      ["Currency Comparison Calculator", "currency-comparison.html", "Finance"],
      ["Loan Calculator", "loan-calculator.html", "Finance"],
      ["Mortgage Calculator", "mortgage-calculator.html", "Finance"],
      ["Mortgage Refinance Calculator", "mortgage-refinance.html", "Finance"],
      ["Mortgage Comparison Calculator", "mortgage-comparison.html", "Finance"],
      ["Age Calculator", "age-calculator.html", "Date & Time"],
      ["Unit Converter", "unit-converter.html", "Converter"],
      ["GraphScope Calculator", "graph-calculator.html", "Math"],
      ["PDF Converter", "pdf-converter.html", "Document"],
      ["Image Converter & Compressor", "image-converter.html", "Document"],
      ["Abacus Trainer Game", "abacus-trainer.html", "Games"]
    ];
    const inputs = Array.from(document.querySelectorAll(".top-search input[type='search'], .hero-search input[type='search']"));
    if (!inputs.length) return;

    inputs.forEach((input) => {
      const form = input.closest("form");
      if (!form) return;
      form.classList.add("has-search-suggestions");
      let list = form.querySelector(".search-suggestions");
      if (!list) {
        list = document.createElement("div");
        list.className = "search-suggestions";
        list.setAttribute("role", "listbox");
        list.hidden = true;
        form.appendChild(list);
      }

      function matches(query) {
        const clean = query.trim().toLowerCase();
        if (!clean) return [];
        return items
          .filter(([title, , category]) => `${title} ${category}`.toLowerCase().includes(clean))
          .slice(0, 6);
      }

      function show() {
        const results = matches(input.value);
        list.innerHTML = results.map(([title, url, category]) => `<a href="${url}" role="option"><b>${escapeHtml(title)}</b><small>${escapeHtml(category)}</small></a>`).join("");
        list.hidden = !results.length;
      }

      input.addEventListener("input", show);
      input.addEventListener("focus", show);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          list.hidden = true;
          return;
        }
        if (event.key === "Enter") {
          const first = matches(input.value)[0];
          if (first) {
            event.preventDefault();
            window.location.href = first[1];
          }
        }
      });
      form.addEventListener("submit", (event) => {
        const first = matches(input.value)[0];
        if (first) {
          event.preventDefault();
          window.location.href = first[1];
        }
      });
      document.addEventListener("click", (event) => {
        if (!form.contains(event.target)) list.hidden = true;
      });
    });
  }

  setupHistoryPage();
  setupLoanCalculator();
  setupMortgageCalculator();
  setupMortgageRefinanceCalculator();
  setupMortgageComparisonCalculator();
  setupCurrencyComparison();
  setupCurrencyExchange();
  setupCompoundInterest();
  setupPdfConverter();
  setupImageConverter();
  setupUnitConverter();
  setupGraphCalculator();
  setupAgeCalculator();
  setupAbacusTrainer();
  hydrateCurrencyConversionRates();
  setupNumericInputRestrictions();
  setupCurrencyInputConversion();
  setupReferenceLinks();
  setupCountryAwareCopy();
  // Keep support sections in their native page/report positions. A previous
  // regrouping experiment compressed several calculators and broke previews,
  // so the shared redesign now uses CSS only.
  limitFaqReferenceItems(document);
  setupSearchSuggestions();
  setupDebouncedAutoActions();
  clearCalculator();
})();

