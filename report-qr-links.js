(function(){
  const fileName=(location.pathname.split('/').pop()||'').toLowerCase();
  const calculatorNames={
    'bmi-calculator.html':'BMI Calculator',
    'ideal-weight-calculator.html':'Ideal Weight Calculator',
    'credit-card-payoff-calculator.html':'Credit Card Payoff Calculator',
    'age-calculator.html':'Age Calculator',
    'date-difference-calculator.html':'Date Difference Calculator',
    'emi-calculator.html':'EMI Calculator',
    'fuel-cost-calculator.html':'Fuel Cost Calculator',
    'gpa-calculator.html':'GPA Calculator',
    'mental-math-game.html':'Mental Math Rush',
    'abacus-rush-game.html':'Abacus Rush',
    'password-generator.html':'Password Generator',
    'qr-code-generator.html':'QR Code Generator',
    'percentage-calculator.html':'Percentage Calculator',
    'salary-calculator.html':'Salary Calculator',
    'savings-calculator.html':'Savings Calculator',
    'compound-interest-calculator.html':'Compound Interest Calculator',
    'retirement-calculator.html':'Retirement Calculator',
    'tip-calculator.html':'Tip Calculator',
    'pregnancy-due-date-calculator.html':'Pregnancy Due Date Calculator',
    'snow-day-calculator.html':'Snow Day Calculator',
    'rain-day-calculator.html':'Rain Day Calculator',
    'moon-phase-calculator.html':'Moon Phase Calculator',
    'storm-calculator.html':'Storm Calculator',
    'monsoon-calculator.html':'Monsoon Calculator',
    'visibility-calculator.html':'Visibility Calculator',
    'outdoor-weather-calculator.html':'Outdoor Weather Calculator',
    'unit-converter.html':'Unit Converter',
    'polynomial-root-finder-calculator.html':'Polynomial Root Finder',
    'graphing-calculator.html':'Graphing Calculator'
  };
  const calculatorName=calculatorNames[fileName]||document.querySelector('h1')?.textContent?.trim()||'KalQ Calculator';
  const canonicalUrl=document.querySelector('link[rel="canonical"]')?.href;
  const calculatorUrl=(canonicalUrl||location.href).split('#')[0].split('?')[0];
  const qrSource=`https://api.qrserver.com/v1/create-qr-code/?size=360x360&format=png&ecc=M&qzone=4&data=${encodeURIComponent(calculatorUrl)}`;

  document.querySelectorAll('.report-sheet').forEach(report=>{
    const title=report.querySelector('#reportTitle')||report.querySelector('header h1,header h2,.iwr-head h1,.iwr-head h2');
    if(title)title.classList.add('report-standard-title');
    report.querySelectorAll('header *, .iwr-head *').forEach(element=>{
      if([...element.classList].some(className=>/(^|-)meta$/i.test(className)))element.classList.add('report-standard-meta');
    });
  });

  document.querySelectorAll('.report-fake-qr,.rr-qr,.iwr-qr,.mm-qr-svg,#reportQrCode').forEach(placeholder=>{
    if(placeholder.tagName==='IMG')return;
    const image=document.createElement('img');
    const placeholderClass=typeof placeholder.className==='string'?placeholder.className:(placeholder.getAttribute('class')||'');
    image.className=`${placeholderClass} report-live-qr`.trim();
    image.alt=`QR code to open the ${calculatorName}`;
    placeholder.replaceWith(image);
  });

  const preservesGeneratedQr=fileName==='qr-code-generator.html';
  const reportQrImages=preservesGeneratedQr?[]:[...new Set(document.querySelectorAll('#rrQrImage,.report-qr-block img,.report-qr-box img,.report-qr-image,.r2-qr img,.er-qr,.pr-qr img,.r4-qr-box img,.gpr-qr-block img,.ar-qr img,.report-live-qr,.report-sheet img[class*="qr" i],.report-sheet [class*="qr" i] img,.report-sheet img[id*="qr" i],.report-sheet [id*="qr" i] img'))];
  reportQrImages.forEach(image=>{
    image.src=qrSource;
    image.alt=`QR code to open the ${calculatorName}`;
    image.title=`Open ${calculatorName}`;
    image.dataset.calculatorUrl=calculatorUrl;
  });

  const qrLink=document.getElementById('rrQrLink');
  if(qrLink)qrLink.href=calculatorUrl;

  document.querySelectorAll('.report-sheet a').forEach(link=>{
    const isQrLink=/qr/i.test(`${link.id} ${link.className}`)||link.querySelector('img[class*="qr" i],img[id*="qr" i]');
    if(!isQrLink)return;
    link.href=calculatorUrl;
    link.target='_blank';
    link.rel='noopener';
  });

  const copyBySelector={
    '.report-qr-block p':`<strong>Open ${calculatorName}</strong><br>Scan to return to this calculator and create a new report.`,
    '.report-qr-box p':`Scan to open the ${calculatorName} and refresh this report with new values.`,
    '.gpr-qr-block p':`Scan to open the ${calculatorName} and create a new academic report.`
    ,'.iwr-qr-text':`<strong>Scan to open the ${calculatorName}</strong><span>Return to this calculator and recalculate anytime.</span>`
    ,'.mm-qr-card div':`<strong>Scan to open the ${calculatorName}</strong><span>Return to this game and practise again.</span>`
    ,'.mmr-qr-box p':`Scan to open the ${calculatorName} and start another challenge.`
    ,'.report-qr-copy':`<strong>Scan to open</strong><span>${calculatorName}</span>`
    ,'.r2-qr p':`Scan to open the ${calculatorName} and create a new salary report.`
    ,'.er-data-body p':`<strong>Scan to open the ${calculatorName} and recalculate this savings plan.</strong>`
    ,'.pr-qr p':`Scan to open the ${calculatorName} and create a new pregnancy planning report.`
    ,'.report-qr-caption':`Scan to open the ${calculatorName} and refresh this report with the latest forecast.`
    ,'.ucr-qr-wrap p':`Scan to open the ${calculatorName} and create a new conversion report.`
    ,'.pr-qr-layout p':`Scan to open the ${calculatorName} and create a new polynomial roots report.`
    ,'.ar-qr p':`<strong>Open ${calculatorName}</strong><br>Scan to return to this calculator and create a new age report.`
    ,'.rp-marker-copy':`<strong>Open ${calculatorName}</strong><br>Scan to return and generate another secure password.`
  };
  Object.entries(copyBySelector).forEach(([selector,copy])=>{
    const element=document.querySelector(selector);
    if(element)element.innerHTML=copy;
  });

  const savingsQrLink=document.querySelector('.er-data-body a');
  if(savingsQrLink){savingsQrLink.href=calculatorUrl;savingsQrLink.textContent=`Open ${calculatorName}`;}

  const LONG_TABLE_ROW_LIMIT=30;
  let longTableRefreshQueued=false;
  function bodyRowCount(table){
    return [...table.tBodies].reduce((count,body)=>count+body.rows.length,0);
  }
  function tableLabel(table,rowCount){
    const caption=table.caption?.textContent?.trim();
    const sectionTitle=table.closest('section')?.querySelector('h2,h3,h4')?.textContent?.trim();
    return `${caption||sectionTitle||'Report table'}, ${rowCount} rows. Scroll to view all rows.`;
  }
  function refreshLongReportTables(){
    document.querySelectorAll('.report-sheet table').forEach(table=>{
      const rowCount=bodyRowCount(table);
      let wrapper=table.parentElement?.classList.contains('report-table-scroll')?table.parentElement:null;
      if(rowCount>LONG_TABLE_ROW_LIMIT){
        if(!wrapper){
          wrapper=document.createElement('div');
          wrapper.className='report-table-scroll';
          table.before(wrapper);
          wrapper.appendChild(table);
        }
        wrapper.tabIndex=0;
        wrapper.setAttribute('role','region');
        wrapper.setAttribute('aria-label',tableLabel(table,rowCount));
        wrapper.dataset.rowCount=String(rowCount);
      }else if(wrapper){
        wrapper.before(table);
        wrapper.remove();
      }
    });
  }
  function queueLongTableRefresh(){
    if(longTableRefreshQueued)return;
    longTableRefreshQueued=true;
    queueMicrotask(()=>{
      longTableRefreshQueued=false;
      refreshLongReportTables();
    });
  }
  refreshLongReportTables();
  document.querySelectorAll('.report-sheet').forEach(report=>{
    new MutationObserver(queueLongTableRefresh).observe(report,{childList:true,subtree:true});
  });
})();
