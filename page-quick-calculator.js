(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const actions=document.querySelector(".top-actions, .topactions");
  if(!actions)return;
  const calculatorIcon=document.getElementById("i-calculator")?"#i-calculator":document.getElementById("calc")?"#calc":"#qr";

  const notify=message=>{
    const toast=$("toast");
    if(!toast)return;
    toast.textContent=message;
    toast.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer=setTimeout(()=>toast.classList.remove("show"),2200);
  };
  const search=$("toolSearch");
  if(search)search.addEventListener("keydown",event=>{
    if(event.key==="Enter"&&search.value.trim())location.href=`index.html?search=${encodeURIComponent(search.value.trim())}`;
  });
  $("topBookmarkBtn")?.addEventListener("click",()=>notify("Use your browser bookmark command to save this calculator."));
  $("recentActivityBtn")?.addEventListener("click",()=>notify("Recent calculator activity is available from your browser history."));
  document.querySelector(".top-actions .lang-btn")?.addEventListener("click",()=>notify("English is the default language."));

  let launcher=$("calculatorLauncher");
  if(!launcher){
    launcher=document.createElement("button");
    launcher.className=actions.classList.contains("topactions")?"iconbtn":"icon-btn";
    launcher.id="calculatorLauncher";
    launcher.type="button";
    launcher.title="Quick calculator";
    launcher.setAttribute("aria-label","Open quick calculator");
    launcher.innerHTML=`<svg class="ui-icon" aria-hidden="true"><use href="${calculatorIcon}"></use></svg>`;
    actions.appendChild(launcher);
  }
  launcher.setAttribute("aria-haspopup","dialog");
  launcher.setAttribute("aria-expanded","false");
  if($("calculatorOverlay"))return;

  const overlay=document.createElement("div");
  overlay.className="calculator-overlay";
  overlay.id="calculatorOverlay";
  overlay.hidden=true;
  overlay.innerHTML=`
    <section class="calculator-shell" role="dialog" aria-labelledby="calculatorTitle">
      <div class="calculator-head"><div class="calculator-title"><span class="calculator-title-icon" aria-hidden="true"><svg class="ui-icon"><use href="${calculatorIcon}"></use></svg></span><h2 id="calculatorTitle">Quick Calculator</h2></div><button class="calculator-close" id="calculatorClose" type="button" aria-label="Close calculator">&times;</button></div>
      <div class="calculator-tabs" role="tablist" aria-label="Calculator type"><button class="calculator-tab active" id="basicTab" type="button" role="tab" aria-selected="true" aria-controls="basicCalculator" data-calc-mode="basic">Basic</button><button class="calculator-tab" id="scientificTab" type="button" role="tab" aria-selected="false" aria-controls="scientificCalculator" data-calc-mode="scientific">Scientific</button></div>
      <div class="calculator-display" aria-live="polite"><span class="calculator-expression" id="calculatorExpression">0</span><strong class="calculator-result" id="calculatorResult">0</strong></div>
      <div class="calculator-panel" id="basicCalculator" role="tabpanel" aria-labelledby="basicTab"><div class="calculator-keypad">
        <button class="calculator-key danger" type="button" data-calc-action="clear">C</button><button class="calculator-key function" type="button" data-calc-action="backspace" aria-label="Backspace">⌫</button><button class="calculator-key operator" type="button" data-calc-value="%">%</button><button class="calculator-key operator" type="button" data-calc-value="÷">÷</button>
        <button class="calculator-key" type="button" data-calc-value="7">7</button><button class="calculator-key" type="button" data-calc-value="8">8</button><button class="calculator-key" type="button" data-calc-value="9">9</button><button class="calculator-key operator" type="button" data-calc-value="×">×</button>
        <button class="calculator-key" type="button" data-calc-value="4">4</button><button class="calculator-key" type="button" data-calc-value="5">5</button><button class="calculator-key" type="button" data-calc-value="6">6</button><button class="calculator-key operator" type="button" data-calc-value="−">−</button>
        <button class="calculator-key" type="button" data-calc-value="1">1</button><button class="calculator-key" type="button" data-calc-value="2">2</button><button class="calculator-key" type="button" data-calc-value="3">3</button><button class="calculator-key operator" type="button" data-calc-value="+">+</button>
        <button class="calculator-key function" type="button" data-calc-action="sign">±</button><button class="calculator-key" type="button" data-calc-value="0">0</button><button class="calculator-key" type="button" data-calc-value=".">.</button><button class="calculator-key equals" type="button" data-calc-action="equals">=</button>
      </div></div>
      <div class="calculator-panel" id="scientificCalculator" role="tabpanel" aria-labelledby="scientificTab" hidden><div class="calculator-keypad">
        <button class="calculator-key function" type="button" data-calc-value="sin(">sin</button><button class="calculator-key function" type="button" data-calc-value="cos(">cos</button><button class="calculator-key function" type="button" data-calc-value="tan(">tan</button><button class="calculator-key operator" type="button" data-calc-value="^">x<sup>y</sup></button>
        <button class="calculator-key function" type="button" data-calc-value="log(">log</button><button class="calculator-key function" type="button" data-calc-value="ln(">ln</button><button class="calculator-key function" type="button" data-calc-value="sqrt(">√</button><button class="calculator-key danger" type="button" data-calc-action="clear">C</button>
        <button class="calculator-key function" type="button" data-calc-value="(">(</button><button class="calculator-key function" type="button" data-calc-value=")">)</button><button class="calculator-key function" type="button" data-calc-value="π">π</button><button class="calculator-key function" type="button" data-calc-action="backspace" aria-label="Backspace">⌫</button>
        <button class="calculator-key" type="button" data-calc-value="7">7</button><button class="calculator-key" type="button" data-calc-value="8">8</button><button class="calculator-key" type="button" data-calc-value="9">9</button><button class="calculator-key operator" type="button" data-calc-value="÷">÷</button>
        <button class="calculator-key" type="button" data-calc-value="4">4</button><button class="calculator-key" type="button" data-calc-value="5">5</button><button class="calculator-key" type="button" data-calc-value="6">6</button><button class="calculator-key operator" type="button" data-calc-value="×">×</button>
        <button class="calculator-key" type="button" data-calc-value="1">1</button><button class="calculator-key" type="button" data-calc-value="2">2</button><button class="calculator-key" type="button" data-calc-value="3">3</button><button class="calculator-key operator" type="button" data-calc-value="−">−</button>
        <button class="calculator-key function" type="button" data-calc-value="e">e</button><button class="calculator-key" type="button" data-calc-value="0">0</button><button class="calculator-key" type="button" data-calc-value=".">.</button><button class="calculator-key operator" type="button" data-calc-value="+">+</button>
        <button class="calculator-key function" type="button" data-calc-value="%">%</button><button class="calculator-key function" type="button" data-calc-action="sign">±</button><button class="calculator-key equals span-two" type="button" data-calc-action="equals">=</button>
      </div></div>
    </section>`;
  document.body.appendChild(overlay);

  let expression="",result="0",justEvaluated=false;
  const operators=["+","−","×","÷","^"];
  const display=()=>{$("calculatorExpression").textContent=expression||"0";$("calculatorResult").textContent=result};
  const format=value=>{if(!Number.isFinite(value))throw new Error("Invalid result");if(value===0)return "0";const magnitude=Math.abs(value);return magnitude>=1e12||magnitude<1e-9?value.toExponential(8).replace(/\.0+e/,"e"):String(Number(value.toPrecision(12)))};
  const evaluate=value=>{
    let source=value.replace(/×/g,"*").replace(/÷/g,"/").replace(/−/g,"-").replace(/\^/g,"**").replace(/π/g,"PI").replace(/\be\b/g,"E").replace(/(\d+(?:\.\d+)?)%/g,"($1/100)");
    if(!source||!/^[0-9+\-*/().,\sA-Za-z_*]+$/.test(source))throw new Error("Invalid expression");
    const degrees=fn=>angle=>fn(angle*Math.PI/180);
    return Function("sin","cos","tan","log","ln","sqrt","PI","E",`"use strict";return (${source})`)(degrees(Math.sin),degrees(Math.cos),degrees(Math.tan),Math.log10,Math.log,Math.sqrt,Math.PI,Math.E);
  };
  const append=value=>{const operator=operators.includes(value);if(justEvaluated){expression=operator&&result!=="Error"?result+value:"";justEvaluated=false}if(operator&&operators.includes(expression.slice(-1)))expression=expression.slice(0,-1)+value;else if(value==="."&&/(?:^|[+−×÷^(])\d*\.\d*$/.test(expression))return;else expression+=value;display()};
  const action=name=>{if(name==="clear"){expression="";result="0";justEvaluated=false}else if(name==="backspace"){expression=expression.slice(0,-1);justEvaluated=false}else if(name==="sign"){expression=expression?`−(${expression})`:"−";justEvaluated=false}else if(name==="equals"&&expression){try{result=format(evaluate(expression));expression=result}catch(error){result="Error"}justEvaluated=true}display()};
  const show=open=>{overlay.hidden=!open;launcher.setAttribute("aria-expanded",String(open));if(open)$("calculatorClose").focus();else launcher.focus()};

  launcher.addEventListener("click",()=>show(overlay.hidden));
  $("calculatorClose").addEventListener("click",()=>show(false));
  overlay.querySelectorAll("[data-calc-mode]").forEach(tab=>tab.addEventListener("click",()=>{overlay.querySelectorAll("[data-calc-mode]").forEach(item=>{const active=item===tab;item.classList.toggle("active",active);item.setAttribute("aria-selected",String(active))});$("basicCalculator").hidden=tab.dataset.calcMode!=="basic";$("scientificCalculator").hidden=tab.dataset.calcMode!=="scientific"}));
  overlay.querySelectorAll("[data-calc-value],[data-calc-action]").forEach(button=>button.addEventListener("click",()=>button.dataset.calcAction?action(button.dataset.calcAction):append(button.dataset.calcValue)));
  document.addEventListener("keydown",event=>{if(overlay.hidden)return;if(event.key==="Escape"){event.preventDefault();show(false);return}if(event.key==="Enter"||event.key==="="){event.preventDefault();action("equals");return}if(event.key==="Backspace"){event.preventDefault();action("backspace");return}const map={"/":"÷","*":"×","-":"−"},value=map[event.key]||event.key;if(/^[0-9.+%()]$/.test(value)||operators.includes(value)){event.preventDefault();append(value)}});
  display();
})();
