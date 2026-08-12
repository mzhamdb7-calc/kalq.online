(() => {
  'use strict';

  const GROUP_CLASS = 'kalq-report-group-page';
  const GUIDE_TITLE = /(?:calculation|conversion|chemistry|retirement|payroll|salary|pregnancy|tip|bmi|savings|currency|date|gpa|weight|apr|polynomial|compound)[^\n]{0,42}\bguide\b|\bguide\b|\bmethod\s*&\s*validation\b|\bpractical review\b|\buse,?\s*tips?\b|\bformulas?,?\s*use\b|\bdata and use notes\b|\breference guide\b|\blearning notes\b|\bformula,?\s*tips?,?\s*faqs?\b|\babout,?\s*how to use\b|\bmethod\s*&\s*practical\b|\bsources\s*&\s*next steps\b/i;
  const RESOURCE_PAGE_TITLE = /\bfaq(?:s)?\b|frequently asked|\breference(?:s)?\b|\bsource(?:s)?\b|\bdisclaimer\b|\blimitation(?:s)?\b|\bsupport\b|\bdata (?:and|&) use notes\b|\bnotes and sources\b/i;
  const RESOURCE_HEADING = /\bfaq(?:s)?\b|frequently asked|\breference(?:s)?\b|\bsource(?:s)?\b|\bdisclaimer\b|\blimitation(?:s)?\b|\brelated (?:tools|calculators)\b|interpretation boundaries/i;
  const RESOURCE_TEXT = /\bdisclaimer\b|\bimportant limitation(?:s)?\b|\breference(?:s)?\b|\brelated (?:tools|calculators)\b/i;
  const STRUCTURAL = '.report-masthead, .report-header, .report-title, .report-footer, .preview-toolbar, .preview-close';
  let organizing = false;
  let scheduled = false;

  function clean(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function reportPages(root) {
    return [...root.querySelectorAll(':scope > .report-page')];
  }

  function pageTitle(page) {
    return clean(page.querySelector(':scope > .report-title h1, :scope > h1')?.textContent);
  }

  function sectionHeading(section) {
    return clean(section.querySelector(':scope > h2, :scope > h3, h2, h3')?.textContent);
  }

  function isGuidePage(page) {
    if (page.classList.contains(GROUP_CLASS)) return true;
    const title = pageTitle(page);
    return GUIDE_TITLE.test(title) || RESOURCE_PAGE_TITLE.test(title);
  }

  function classify(node) {
    const heading = sectionHeading(node);
    if (heading) return RESOURCE_HEADING.test(heading) ? 'resources' : 'guidance';
    return RESOURCE_TEXT.test(clean(node.textContent).slice(0, 240)) ? 'resources' : 'guidance';
  }

  function cloneShell(template, kind, serial, claimedIds) {
    const page = document.createElement('section');
    const inherited = [...template.classList].filter((name) => name !== GROUP_CLASS);
    page.className = [...new Set([...inherited, 'report-page', GROUP_CLASS])].join(' ');
    const originalId = serial === 1 ? clean(template.id) : '';
    const keptOriginalId = originalId && !claimedIds.has(originalId);
    if (keptOriginalId) {
      page.id = originalId;
      claimedIds.add(originalId);
    } else {
      page.id = `kalqReport${kind === 'guidance' ? 'Guidance' : 'Resources'}Page${serial}`;
    }
    page.dataset.kalqReportGroup = kind;
    if (template.hidden) page.hidden = true;

    const masthead = template.querySelector(':scope > .report-masthead')?.cloneNode(true);
    if (masthead) page.append(masthead);

    const title = document.createElement('div');
    title.className = 'report-title';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Report guidance';
    const heading = document.createElement('h1');
    heading.textContent = kind === 'guidance' ? 'Guidance & Method' : 'FAQs, References & Support';
    const description = document.createElement('p');
    description.textContent = kind === 'guidance'
      ? 'Methods, formulas, interpretation, tips and practical use.'
      : 'Frequently asked questions, sources, limitations and related tools.';
    if (keptOriginalId) {
      const sourceTitle = template.querySelector(':scope > .report-title');
      const sourceEyebrow = sourceTitle?.querySelector('.eyebrow');
      const sourceHeading = sourceTitle?.querySelector('h1');
      const sourceDescription = sourceTitle?.querySelector('p');
      if (sourceEyebrow?.id) eyebrow.id = sourceEyebrow.id;
      if (sourceHeading?.id) heading.id = sourceHeading.id;
      if (sourceDescription?.id) description.id = sourceDescription.id;
    }
    title.append(eyebrow, heading, description);
    page.append(title);

    const content = document.createElement('div');
    content.className = 'kalq-report-group-content';
    page.append(content);

    const footer = template.querySelector(':scope > .report-footer')?.cloneNode(true);
    if (footer) page.append(footer);
    return { page, content };
  }

  /* Move authored top-level blocks rather than extracting nested sections.
     This preserves every original one- or multi-column grid and its order. */
  function authoredContent(page) {
    return [...page.children].filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.matches(STRUCTURAL)) return false;
      return clean(node.textContent) || node.querySelector('svg, canvas, table, img');
    });
  }

  function classifyBlock(node) {
    const sections = node.matches('.report-section, .analysis-panel')
      ? [node]
      : [...node.querySelectorAll('.report-section, .analysis-panel')];
    if (!sections.length) return classify(node);
    const kinds = new Set(sections.map(classify));
    return kinds.size === 1 && kinds.has('resources') ? 'resources' : 'guidance';
  }

  function pruneEmptyContainers(page) {
    [...page.querySelectorAll('.report-grid-2, .report-grid-3, .report-grid-4, .analysis-grid')]
      .reverse()
      .forEach((node) => {
        if (!clean(node.textContent) && !node.querySelector('svg, canvas, table, img')) node.remove();
      });
  }

  function hasMeaningfulContent(node) {
    if (!(node instanceof HTMLElement) || node.hidden) return false;
    const copy = node.cloneNode(true);
    copy.querySelectorAll('script, style, template, [hidden], [aria-hidden="true"]').forEach((item) => item.remove());
    if (clean(copy.textContent)) return true;
    return Boolean(copy.querySelector('table, svg, canvas, img, picture, video, .chart, .graph, .gauge, .timeline'));
  }

  function pruneBlankPages(root, includeOutputPages = false) {
    reportPages(root).forEach((page) => {
      if (!includeOutputPages && !page.classList.contains(GROUP_CLASS)) return;
      const content = page.classList.contains(GROUP_CLASS)
        ? page.querySelector(':scope > .kalq-report-group-content')
        : page;
      if (!content) return;
      const candidates = [...content.children].filter((node) => !node.matches?.(STRUCTURAL));
      if (!candidates.some(hasMeaningfulContent)) page.remove();
    });
  }

  function contentFits(page, content) {
    const footer = page.querySelector(':scope > .report-footer');
    const bottom = footer ? footer.offsetTop - 8 : page.clientHeight - 18;
    return content.offsetTop + content.scrollHeight <= bottom;
  }

  function paginate(root, nodes, template, kind, claimedIds) {
    if (!nodes.length) return [];
    const made = [];
    let shell = null;

    function newPage() {
      shell = cloneShell(template, kind, made.length + 1, claimedIds);
      root.append(shell.page);
      made.push(shell.page);
    }

    newPage();
    nodes.forEach((node) => {
      shell.content.append(node);
      if (shell.content.children.length > 1 && !contentFits(shell.page, shell.content)) {
        node.remove();
        newPage();
        shell.content.append(node);
      }
      if (shell.content.children.length === 1 && !contentFits(shell.page, shell.content)) {
        shell.page.dataset.kalqOversized = 'true';
      }
    });

    made.forEach((page, index) => {
      const description = page.querySelector(':scope > .report-title p');
      if (description && made.length > 1) {
        description.textContent += ` Part ${index + 1} of ${made.length}.`;
      }
    });
    return made;
  }

  function setPageNumber(page, index, total) {
    const stamp = page.querySelector('.report-page-no');
    if (!stamp) return;
    const counter = stamp.querySelector('.report-page-counter, .report-page-count');
    if (counter) {
      counter.textContent = `Page ${index} of ${total}`;
      return;
    }
    const totalNode = stamp.querySelector('.reportTotal');
    const br = stamp.querySelector('br');
    if (totalNode && br) {
      let textNode = br.nextSibling;
      while (textNode && textNode.nodeType !== Node.TEXT_NODE) textNode = textNode.nextSibling;
      if (!textNode) {
        textNode = document.createTextNode('');
        br.after(textNode);
      }
      textNode.nodeValue = `Page ${index} of `;
      totalNode.textContent = String(total);
      return;
    }
    if (br) {
      let textNode = br.nextSibling;
      while (textNode && textNode.nodeType !== Node.TEXT_NODE) textNode = textNode.nextSibling;
      if (!textNode) {
        textNode = document.createTextNode('');
        br.after(textNode);
      }
      textNode.nodeValue = `Page ${index} of ${total}`;
    }
  }

  function renumber(root) {
    const pages = reportPages(root).filter((page) => !page.hidden);
    pages.forEach((page) => page.classList.remove('kalq-report-last-page'));
    pages.at(-1)?.classList.add('kalq-report-last-page');
    pages.forEach((page, index) => setPageNumber(page, index + 1, pages.length));
    root.querySelectorAll('.reportTotal').forEach((node) => { node.textContent = String(pages.length); });
  }

  function organize(root) {
    if (!root || organizing) return;
    organizing = true;
    const wasHidden = getComputedStyle(root).display === 'none';
    try {
      const pages = reportPages(root);
      const candidates = pages.filter(isGuidePage);
      if (!candidates.length) {
        renumber(root);
        return;
      }

      const templates = {
        guidance: candidates.find((page) => page.dataset.kalqReportGroup === 'guidance') || candidates[0],
        resources: candidates.find((page) => page.dataset.kalqReportGroup === 'resources') || candidates[1] || candidates[0]
      };
      const guidance = [];
      const resources = [];

      candidates.forEach((page) => {
        pruneEmptyContainers(page);
        authoredContent(page).forEach((node) => {
          (classifyBlock(node) === 'resources' ? resources : guidance).push(node);
        });
      });

      candidates.forEach((page) => page.remove());
      if (wasHidden) root.classList.add('kalq-report-measuring');
      const claimedIds = new Set();
      paginate(root, guidance, templates.guidance, 'guidance', claimedIds);
      paginate(root, resources, templates.resources, 'resources', claimedIds);
      pruneBlankPages(root, root.classList.contains('is-preview'));
      renumber(root);
    } finally {
      root.classList.remove('kalq-report-measuring');
      organizing = false;
    }
  }

  function schedule(root) {
    if (!root || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      organize(root);
    });
  }

  function init() {
    const root = document.getElementById('reportRoot');
    if (!root) return;
    organize(root);

    const observer = new MutationObserver((records) => {
      const addedOriginalPage = records.some((record) => [...record.addedNodes].some((node) =>
        node.nodeType === Node.ELEMENT_NODE &&
        !node.classList?.contains(GROUP_CLASS) &&
        (node.matches?.('.report-page') || node.querySelector?.('.report-page:not(.kalq-report-group-page)'))
      ));
      if (addedOriginalPage) schedule(root);
    });
    observer.observe(root, { childList: true, subtree: true });

    document.addEventListener('click', (event) => {
      if (event.target.closest('#previewReportBtn, #previewBtn, #viewReportBtn, #printBtn, #previewPrintBtn, [data-report-preview], [data-print-report]')) {
        schedule(root);
        setTimeout(() => {
          organize(root);
          pruneBlankPages(root, true);
          renumber(root);
        }, 80);
      }
    }, true);
    window.addEventListener('beforeprint', () => {
      organize(root);
      pruneBlankPages(root, true);
      renumber(root);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
