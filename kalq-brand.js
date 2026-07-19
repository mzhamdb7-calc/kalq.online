(function () {
  "use strict";

  const ownScript = document.currentScript;
  const logoUrl = ownScript
    ? new URL("kalq-transparent.png", ownScript.src || document.baseURI).href
    : "kalq-transparent.png";

  const makeLogo = (label) => {
    const crop = document.createElement("span");
    crop.className = "kalq-logo-crop";

    const image = document.createElement("img");
    image.src = logoUrl;
    image.alt = label;
    image.decoding = "async";
    crop.appendChild(image);
    return crop;
  };

  const brandElement = (element, roleClass, label) => {
    if (!element || element.querySelector(":scope > .kalq-logo-crop")) return;
    element.classList.add(roleClass);
    element.prepend(makeLogo(label));
  };

  const relatedGroups = [
    {
      category: "Finance", color: "#0f56d9", soft: "#dce8fb",
      tools: [
        ["credit-card-payoff-calculator.html", "Credit Card", "▣"],
        ["emi-calculator.html", "EMI", "="],
        ["fuel-cost-calculator.html", "Fuel Cost", "◇"],
        ["salary-calculator.html", "Salary", "$"],
        ["savings-calculator.html", "Savings", "↗"],
        ["compound-interest-calculator.html", "Compound Interest", "%"],
        ["retirement-calculator.html", "Retirement", "◎"]
      ]
    },
    {
      category: "Mathematics", color: "#6423c7", soft: "#e7ddf6",
      tools: [
        ["percentage-calculator.html", "Percentage", "%"],
        ["polynomial-root-finder-calculator.html", "Polynomial Roots", "ƒ"],
        ["graphing-calculator.html", "Graphing Calculator", "⌁"]
      ]
    },
    {
      category: "Health & Wellness", color: "#c9363b", soft: "#f6dcde",
      tools: [
        ["bmi-calculator.html", "BMI", "♥"],
        ["ideal-weight-calculator.html", "Ideal Weight", "◎"],
        ["pregnancy-due-date-calculator.html", "Pregnancy Due Date", "◷"]
      ]
    },
    {
      category: "Education", color: "#c77b00", soft: "#f4e6c8",
      tools: [["gpa-calculator.html", "GPA", "◇"]]
    },
    {
      category: "Date & Time", color: "#087ea4", soft: "#d9edf4",
      tools: [
        ["age-calculator.html", "Age", "◷"],
        ["date-difference-calculator.html", "Date Difference", "↔"]
      ]
    },
    {
      category: "Converters", color: "#0e7490", soft: "#d7edf2",
      tools: [["unit-converter.html", "Unit Converter", "⇄"]]
    },
    {
      category: "Digital Tools", color: "#4f46c8", soft: "#dfe2f7",
      tools: [
        ["password-generator.html", "Password Generator", "✦"],
        ["qr-code-generator.html", "QR Code", "▦"]
      ]
    },
    {
      category: "Everyday Life", color: "#c72e78", soft: "#f3dce8",
      tools: [["tip-calculator.html", "Tip Calculator", "%"]]
    },
    {
      category: "Science", color: "#1d4ed8", soft: "#dce5f5",
      tools: [
        ["snow-day-calculator.html", "Snow Day", "❄"],
        ["rain-day-calculator.html", "Rain Day", "☂"],
        ["storm-calculator.html", "Storm", "△"],
        ["monsoon-calculator.html", "Monsoon", "⇄"],
        ["visibility-calculator.html", "Visibility", "◎"],
        ["outdoor-weather-calculator.html", "Outdoor Weather", "☼"],
        ["moon-phase-calculator.html", "Moon Phase", "◔"]
      ]
    },
    {
      category: "Games & Practice", color: "#cf2947", soft: "#f4dce2",
      tools: [
        ["mental-math-game.html", "Mental Math Rush", "×+"],
        ["abacus-rush-game.html", "Abacus Rush", "◎"]
      ]
    }
  ];

  const currentFile = () => (location.pathname.split("/").pop() || "index.html").toLowerCase();

  let weatherHeightFrame = 0;
  const syncWeatherCardHeights = () => {
    cancelAnimationFrame(weatherHeightFrame);
    weatherHeightFrame = requestAnimationFrame(() => {
      const pairs = [
        [".weather-chart-card", ".analysis-card"],
        [".risk-driver-card", ".composition-card"]
      ];
      const usePairedHeights = window.innerWidth > 820;

      for (const [leftSelector, rightSelector] of pairs) {
        const left = document.querySelector(leftSelector);
        const right = document.querySelector(rightSelector);
        if (!left || !right) continue;

        if (!usePairedHeights) {
          left.style.minHeight = "";
          right.style.minHeight = "";
          continue;
        }

        const sharedHeight = Math.ceil(Math.max(left.getBoundingClientRect().height, right.getBoundingClientRect().height));
        const targetHeight = `${sharedHeight}px`;
        if (left.style.minHeight !== targetHeight) left.style.minHeight = targetHeight;
        if (right.style.minHeight !== targetHeight) right.style.minHeight = targetHeight;
      }
    });
  };

  const applyRelatedTools = () => {
    const fileName = currentFile();
    if (fileName === "index.html" || fileName === "mainpage.html") return;

    const placeGroupNavigation = (navigation) => {
      const main = document.querySelector("main");
      if (!main) return false;

      const pageHead = main.querySelector(".page-head, .pagehead");
      if (pageHead && pageHead.parentElement === main) {
        if (navigation.parentElement !== main || navigation.nextElementSibling !== pageHead) {
          main.insertBefore(navigation, pageHead);
        }
      } else {
        if (navigation.parentElement !== main || navigation !== main.firstElementChild) {
          main.insertBefore(navigation, main.firstChild);
        }
      }
      return true;
    };

    const existingWeatherNav = document.querySelector(".weather-tool-switcher");
    if (existingWeatherNav) {
      document.body.classList.add("kalq-weather-page");
      existingWeatherNav.setAttribute("aria-label", "Science calculator quick access");
      placeGroupNavigation(existingWeatherNav);
      if (fileName === "moon-phase-calculator.html") syncWeatherCardHeights();
      return;
    }
    if (document.querySelector(".related-tools-nav")) return;

    const group = relatedGroups.find(item => item.tools.some(tool => tool[0] === fileName));
    if (!group) return;
    if (!document.querySelector("main")) return;

    const nav = document.createElement("nav");
    nav.className = "related-tools-nav";
    nav.setAttribute("aria-label", `${group.category} calculator quick access`);
    nav.style.setProperty("--related-color", group.color);
    nav.style.setProperty("--related-soft", group.soft);

    for (const [url, label, symbol] of group.tools) {
      const link = document.createElement("a");
      const active = url === fileName;
      link.className = `related-tool-link${active ? " active" : ""}`;
      link.href = url;
      if (active) link.setAttribute("aria-current", "page");

      const icon = document.createElement("span");
      icon.className = "related-tool-symbol";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = symbol;

      const text = document.createElement("span");
      text.textContent = label;
      link.append(icon, text);
      nav.appendChild(link);
    }

    placeGroupNavigation(nav);
  };

  const applyBranding = () => {
    document.querySelectorAll(".topbar .brand, .site-header .brand").forEach((brand) => {
      brand.setAttribute("aria-label", "KalQ home");
      brandElement(brand, "kalq-branded", "KalQ — Smart tools. Better decisions.");
    });

    const reportBrandSelectors = [
      ".report-sheet .report-brand",
      ".report-sheet .er-brand",
      ".report-sheet .gpr-brand",
      ".report-sheet .iwr-brand",
      ".report-sheet .ar-brand",
      ".report-sheet .mmr-report-brand",
      ".report-sheet .pr-brand",
      ".report-sheet .rp-brand",
      ".report-sheet .r2-brand",
      ".report-sheet .r4-brand",
      ".report-sheet .rr-brand",
      ".report-sheet .ucr-brand",
      ".report-sheet .cir-brand",
      ".report-sheet .rx-brand"
    ].join(",");

    document.querySelectorAll(reportBrandSelectors).forEach((brand) => {
      brandElement(brand, "kalq-report-brand", "KalQ");
    });

    document.querySelectorAll(".certificate-brand").forEach((brand) => {
      brandElement(brand, "kalq-certificate-brand", "KalQ");
    });

    applyRelatedTools();
  };

  const countryProfiles = {
    US:{name:"United States",currency:"USD",authority:"Internal Revenue Service",url:"https://www.irs.gov/",tax:"Federal income-tax rules apply, with separate state and local rules where relevant.",policy:"Use the selected calculator as an estimate and confirm current federal, state, employer, lender or product rules."},
    MY:{name:"Malaysia",currency:"MYR",authority:"Lembaga Hasil Dalam Negeri Malaysia",url:"https://www.hasil.gov.my/",tax:"Malaysian income tax, SST and statutory contribution rules depend on the transaction, residency and assessment details.",policy:"Confirm current LHDN, Royal Malaysian Customs, EPF, PERKESO, BNM or product rules as applicable."},
    GB:{name:"United Kingdom",currency:"GBP",authority:"HM Revenue & Customs",url:"https://www.gov.uk/government/organisations/hm-revenue-customs",tax:"UK tax treatment depends on the tax year, residence, income type and available allowances.",policy:"Confirm current HMRC rules, pension limits, consumer-credit terms and provider conditions."},
    EU:{name:"Euro Area",currency:"EUR",authority:"European Commission Taxation and Customs",url:"https://taxation-customs.ec.europa.eu/",tax:"Tax rules remain country-specific even when calculations use the euro.",policy:"Select the relevant member-state authority and verify local tax, pension, lending and consumer rules."},
    SG:{name:"Singapore",currency:"SGD",authority:"Inland Revenue Authority of Singapore",url:"https://www.iras.gov.sg/",tax:"Singapore tax treatment depends on residence, income type, reliefs, GST scope and product structure.",policy:"Confirm current IRAS, CPF, MAS and provider requirements before relying on an estimate."},
    AU:{name:"Australia",currency:"AUD",authority:"Australian Taxation Office",url:"https://www.ato.gov.au/",tax:"Australian tax and superannuation outcomes depend on residency, income year and personal circumstances.",policy:"Confirm current ATO, ASIC, superannuation and lender or product rules."},
    CA:{name:"Canada",currency:"CAD",authority:"Canada Revenue Agency",url:"https://www.canada.ca/en/revenue-agency.html",tax:"Canadian tax treatment can include federal and provincial or territorial rules.",policy:"Confirm current CRA, pension, savings-account, consumer-credit and provincial requirements."},
    JP:{name:"Japan",currency:"JPY",authority:"National Tax Agency Japan",url:"https://www.nta.go.jp/english/",tax:"Japanese national and local tax treatment depends on residence, income type and applicable deductions.",policy:"Confirm current NTA, pension, banking and product rules."},
    IN:{name:"India",currency:"INR",authority:"Income Tax Department India",url:"https://www.incometax.gov.in/",tax:"Indian tax outcomes depend on the selected regime, financial year, residency and eligible deductions.",policy:"Confirm current Income Tax Department, RBI, pension and provider rules."},
    ID:{name:"Indonesia",currency:"IDR",authority:"Directorate General of Taxes Indonesia",url:"https://www.pajak.go.id/",tax:"Indonesian tax treatment depends on residency, income or transaction type and current national rules.",policy:"Confirm current tax, Bank Indonesia, OJK and provider requirements."},
    CN:{name:"China",currency:"CNY",authority:"State Taxation Administration of China",url:"https://www.chinatax.gov.cn/eng/",tax:"Chinese tax treatment depends on residence, income type, location and applicable national or local rules.",policy:"Confirm current tax, pension, banking and product requirements with the relevant authority."},
    KR:{name:"South Korea",currency:"KRW",authority:"National Tax Service Korea",url:"https://www.nts.go.kr/english/main.do",tax:"Korean tax treatment depends on residency, income type and available deductions or credits.",policy:"Confirm current NTS, pension, financial-regulator and provider rules."},
    DE:{name:"Germany",currency:"EUR",authority:"Federal Ministry of Finance Germany",url:"https://www.bundesfinanzministerium.de/",tax:"German tax outcomes depend on residence, tax class, social insurance and the specific transaction or product.",policy:"Confirm current federal tax, pension, consumer-credit and provider rules."},
    AE:{name:"United Arab Emirates",currency:"AED",authority:"Federal Tax Authority UAE",url:"https://tax.gov.ae/",tax:"UAE tax treatment depends on the activity, VAT scope, employment arrangement and residence position.",policy:"Confirm current FTA, pension, banking, free-zone and provider rules."},
    CUSTOM:{name:"Selected country",currency:"",authority:"OECD Tax Policy",url:"https://www.oecd.org/en/topics/policy-issues/tax-policy.html",tax:"Tax treatment varies by country and cannot be inferred from the currency alone.",policy:"Enter current local rates manually and verify them with the responsible national authority."}
  };
  const countryAliases={USA:"US",US:"US",MYS:"MY",MY:"MY",MALAYSIA:"MY",GBR:"GB",GB:"GB",UK:"GB",SGP:"SG",SG:"SG",AUS:"AU",AU:"AU",CAN:"CA",CA:"CA",JPN:"JP",JP:"JP",IND:"IN",IN:"IN",IDN:"ID",ID:"ID",CHN:"CN",CN:"CN",KOR:"KR",KR:"KR",DEU:"DE",DE:"DE",ARE:"AE",AE:"AE",EMU:"EU",EU:"EU",OTHER:"CUSTOM",CUSTOM:"CUSTOM",UNIVERSAL:"CUSTOM"};
  const countryControlIds=["country","countrySelect","countryRateSelect","presetSelect","marketSelect"];
  const currencyControlIds=["currency","currencySelect"];
  const normalizeCountry=(value,label)=>{
    const raw=String(value||"").trim().toUpperCase();
    if(countryAliases[raw])return countryAliases[raw];
    const text=String(label||value||"").toLowerCase();
    if(text.includes("united states"))return "US";if(text.includes("malaysia"))return "MY";if(text.includes("united kingdom"))return "GB";
    if(text.includes("euro area"))return "EU";if(text.includes("singapore"))return "SG";if(text.includes("australia"))return "AU";
    if(text.includes("canada"))return "CA";if(text.includes("japan"))return "JP";if(text.includes("india"))return "IN";
    if(text.includes("indonesia"))return "ID";if(text.includes("china"))return "CN";if(text.includes("south korea"))return "KR";
    if(text.includes("germany"))return "DE";if(text.includes("united arab emirates"))return "AE";return "CUSTOM";
  };
  const findCountryControl=()=>countryControlIds.map(id=>document.getElementById(id)).find(control=>{
    if(!control||control.tagName!=="SELECT")return false;
    const text=[...control.options].map(option=>option.textContent).join(" ");
    return /country|malaysia|united states|united kingdom|singapore|australia/i.test(`${control.id} ${text}`);
  });
  const findCurrencyControl=()=>currencyControlIds.map(id=>document.getElementById(id)).find(control=>control&&control.tagName==="SELECT"&&[...control.options].some(option=>/^[A-Z]{3}$/.test(option.value)));
  const contextPanel=(profile)=>`<strong>${profile.name} tax &amp; policy context</strong><span>${profile.tax}</span><span>${profile.policy}</span>`;
  const countrySpecificPatterns={
    US:/united states|\bu\.s\.|\birs\b|social security administration|consumer financial protection bureau/i,
    MY:/malaysia|\blhdn\b|\bhasil\b|bank negara|\bbnm\b|\bpidm\b|\bepf\b|\bperkeso\b|royal malaysian customs/i,
    GB:/united kingdom|\bu\.k\.|\bhmrc\b|bank of england/i,
    SG:/singapore|\biras\b|monetary authority of singapore/i,
    AU:/australia|australian taxation office|\bato\b/i,
    CA:/canada|canada revenue agency|\bcra\b/i,
    JP:/japan|national tax agency japan/i,
    IN:/india|income tax department india|reserve bank of india/i,
    ID:/indonesia|direktorat jenderal pajak|bank indonesia/i,
    CN:/china|state taxation administration|people's bank of china/i,
    KR:/south korea|korea|national tax service korea|bank of korea/i,
    DE:/germany|bundeszentralamt|bundesbank/i,
    AE:/united arab emirates|\buae\b|federal tax authority/i
  };
  const filterCountrySpecificContent=(root,currentKey)=>{
    root.querySelectorAll('.faq,.reference-link').forEach(item=>{
      if(item.closest('.kalq-country-faqs,.kalq-country-references'))return;
      const text=item.textContent||'';
      const mentioned=Object.keys(countrySpecificPatterns).filter(key=>countrySpecificPatterns[key].test(text));
      item.hidden=mentioned.length>0&&!mentioned.includes(currentKey);
    });
  };
  const renderCountryContext=(control)=>{
    const selected=control.options[control.selectedIndex];
    const key=normalizeCountry(control.value,selected?.textContent);
    const profile=countryProfiles[key]||countryProfiles.CUSTOM;
    document.documentElement.dataset.kalqCountry=key;
    const field=control.closest(".field"),row=field?.closest(".inline-fields"),anchor=row||field||control;
    let panel=document.querySelector(".kalq-country-context");
    if(!panel){panel=document.createElement("aside");panel.className="kalq-country-context";panel.setAttribute("aria-live","polite")}
    if(panel.previousElementSibling!==anchor)anchor.insertAdjacentElement("afterend",panel);
    panel.innerHTML=contextPanel(profile);
    document.querySelectorAll('.tab-content[id*="faq" i]').forEach(tab=>{
      let block=tab.querySelector(".kalq-country-faqs");if(!block){block=document.createElement("div");block.className="kalq-country-faqs";tab.prepend(block)}
      block.innerHTML=`<details class="faq"><summary>Which tax rules apply in ${profile.name}?</summary><p>${profile.tax}</p></details><details class="faq"><summary>How current is the ${profile.name} policy information?</summary><p>${profile.policy} The calculator shows an estimate and links to the responsible authority for verification.</p></details>`;
    });
    document.querySelectorAll('.tab-content[id*="reference" i]').forEach(tab=>{
      let block=tab.querySelector(".kalq-country-references");if(!block){block=document.createElement("div");block.className="reference-list kalq-country-references";tab.prepend(block)}
      block.innerHTML=`<a class="reference-link" href="${profile.url}" target="_blank" rel="noopener"><div><strong>${profile.authority}</strong><br><span>Official ${profile.name} tax and policy information.</span></div><span>Open</span></a><a class="reference-link" href="https://www.oecd.org/en/topics/policy-issues/tax-policy.html" target="_blank" rel="noopener"><div><strong>OECD Tax Policy</strong><br><span>International tax-policy context and country comparisons.</span></div><span>Open</span></a>`;
    });
    document.querySelectorAll('.tab-content[id*="faq" i],.tab-content[id*="reference" i]').forEach(tab=>filterCountrySpecificContent(tab,key));
    return profile;
  };
  const syncCountryCurrency=(profile)=>{
    if(!profile.currency)return;
    const currency=findCurrencyControl();
    if(!currency||currency.value===profile.currency||![...currency.options].some(option=>option.value===profile.currency))return;
    currency.value=profile.currency;
    currency.dispatchEvent(new Event("change",{bubbles:true}));
  };
  const installCountryLocalization=()=>{
    const control=findCountryControl();if(!control||(!findCurrencyControl()&&control.id!=="marketSelect"))return;
    const update=({syncCurrency=false}={})=>{const profile=renderCountryContext(control);if(syncCurrency)setTimeout(()=>syncCountryCurrency(profile),0)};
    update();
    control.addEventListener("change",()=>update({syncCurrency:true}));
    document.addEventListener("click",event=>{if(event.target.closest('#resetBtn,#historyBtn'))setTimeout(()=>update(),0)});
  };

  const liveRateCache=new Map();
  window.KalQLiveRates={
    async fetchRate(from,to){
      if(from===to)return{rate:1,date:new Date().toISOString().slice(0,10),source:"Same currency"};
      const key=`${from}/${to}`,cached=liveRateCache.get(key);if(cached&&Date.now()-cached.saved<300000)return cached.value;
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
      try{const response=await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,{signal:controller.signal,cache:"no-store"});if(!response.ok)throw new Error(`Exchange-rate request failed (${response.status})`);const data=await response.json(),rate=Number(data?.rate);if(!Number.isFinite(rate)||rate<=0)throw new Error("Exchange rate unavailable");const value={rate,date:data.date||new Date().toISOString().slice(0,10),source:"Frankfurter"};liveRateCache.set(key,{saved:Date.now(),value});return value}finally{clearTimeout(timer)}
    }
  };

  if (document.body) {
    applyBranding();
  } else {
    document.addEventListener("DOMContentLoaded", applyBranding, { once: true });
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installCountryLocalization,{once:true});
  else setTimeout(installCountryLocalization,0);

  if (currentFile() === "moon-phase-calculator.html") {
    window.addEventListener("resize", syncWeatherCardHeights, { passive: true });
  }
})();
