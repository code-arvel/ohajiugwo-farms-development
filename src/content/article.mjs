// A small allowlisted document format, independent of Tiptap and any browser DOM.
const fail = message => { throw new Error(message); };
const record = (value, allowed, required = []) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>!allowed.includes(k)) || required.some(k=>!Object.hasOwn(value,k))) fail('Unsupported article structure.');
};
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function safeLink(href) {
  if (typeof href !== 'string' || href.length > 2048 || !href || /[\u0000-\u0020\u007f\\]/.test(href) || /^\/\//.test(href)) fail('Link: use a complete http/https address, an internal path or a #section link.');
  if (!/^(https?:\/\/|\/(?!\/)|#)/i.test(href)) fail('Link: only http/https addresses and internal links are allowed.');
  const parsed = new URL(href, 'https://local.invalid');
  if (!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password) fail('Link: credentials and unsafe protocols are not allowed.');
  return href;
}

export function validateDocument(doc) {
  let count=0;
  const walk=(node,parent,depth=0)=>{
    if (++count>4000 || depth>8) fail('Article is too complex. Use shorter lists and fewer blocks.');
    record(node,['type','attrs','content','text','marks'],['type']);
    if (!['doc','paragraph','heading','bulletList','orderedList','listItem','text'].includes(node.type)) fail('Only paragraphs, headings, lists and linked text are supported.');
    const allowedChildren={doc:['paragraph','heading','bulletList','orderedList'],paragraph:['text'],heading:['text'],bulletList:['listItem'],orderedList:['listItem'],listItem:['paragraph','bulletList','orderedList'],text:[]};
    if (parent && !allowedChildren[parent].includes(node.type)) fail('Unsupported article nesting.');
    if (!parent && node.type!=='doc') fail('Article must have a document root.');
    if(node.type==='text') {
      if (typeof node.text!=='string' || !node.text || node.text.length>2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(node.text) || node.content || node.attrs) fail('Article text is invalid or too long.');
      if(node.marks) {
        if(!Array.isArray(node.marks)||node.marks.length>1) fail('Unsupported text formatting.');
        for(const mark of node.marks) { record(mark,['type','attrs'],['type','attrs']); if(mark.type!=='link')fail('Only safe links are supported.');record(mark.attrs,['href'],['href']);safeLink(mark.attrs.href); }
      }
    } else {
      if(node.text!==undefined||node.marks!==undefined) fail('Unexpected text fields.');
      if(node.type==='heading') { record(node.attrs,['level'],['level']); if(![2,3].includes(node.attrs.level))fail('Article headings must be H2 or H3.'); }
      else if(node.type==='orderedList' && node.attrs) { record(node.attrs,['start'],['start']);if(!Number.isSafeInteger(node.attrs.start)||node.attrs.start<1||node.attrs.start>999)fail('Invalid list numbering.'); }
      else if(node.attrs!==undefined) fail('Unsupported block settings.');
      if(node.content!==undefined&&!Array.isArray(node.content))fail('Invalid article content.');
      const children=node.content||[];
      if(node.type==='doc'&&(children.length<1||children.length>40))fail('Use 1–40 article blocks.');
      if(['bulletList','orderedList'].includes(node.type)&&(children.length<1||children.length>12))fail('Use 1–12 items in each list.');
      if(node.type==='listItem'&&(children.length<1||children.length>3||children[0].type!=='paragraph'))fail('Start each list item with a paragraph.');
      children.forEach(child=>walk(child,node.type,depth+1));
      if(['paragraph','heading'].includes(node.type)) {
        const length=children.reduce((n,c)=>n+c.text.length,0);
        if(length>(node.type==='heading'?120:2000))fail('A heading or paragraph is too long.');
      }
    }
  };
  walk(doc,null);
  if(JSON.stringify(doc).length>1000000)fail('Article is too large.');
  return doc;
}

export function toDocument(post) {
  if(post.body) return structuredClone(validateDocument(post.body));
  if(!Array.isArray(post.blocks)||!post.blocks.length)fail('Article content is missing.');
  const textNode=text=>[{type:'text',text}];
  const content=post.blocks.map(block=>{
    if(block.type==='paragraph')return {type:'paragraph',content:textNode(block.text)};
    if(block.type==='heading')return {type:'heading',attrs:{level:2},content:textNode(block.text)};
    if(block.type==='list'&&Array.isArray(block.items))return {type:'bulletList',content:block.items.map(text=>({type:'listItem',content:[{type:'paragraph',content:textNode(text)}]}))};
    fail('Unsupported legacy article block.');
  });
  return validateDocument({type:'doc',content});
}

export function documentText(doc) {
  validateDocument(doc);
  const walk=node=>node.type==='text'?node.text:(node.content||[]).map(walk).join(['paragraph','heading'].includes(node.type)?'':' ');
  return walk(doc).trim();
}
export function readingMinutes(doc) { return Math.max(1,Math.ceil((documentText(doc).match(/\S+/g)||[]).length/200)); }

export function renderDocument(doc, { headingIds = [] } = {}) {
  validateDocument(doc);
  let headingIndex=0;
  const walk=node=>{
    if(node.type==='text') { const text=escape(node.text); return node.marks?.[0]?`<a href="${escape(safeLink(node.marks[0].attrs.href))}">${text}</a>`:text; }
    const inner=(node.content||[]).map(walk).join('');
    if(node.type==='doc')return inner;
    const tag={paragraph:'p',heading:`h${node.attrs?.level}`,bulletList:'ul',orderedList:'ol',listItem:'li'}[node.type];
    return `<${tag}${node.type==='heading'&&headingIds[headingIndex]?` id="${escape(headingIds[headingIndex++])}" tabindex="-1"`:''}${node.type==='orderedList'&&node.attrs?.start>1?` start="${node.attrs.start}"`:''}>${inner}</${tag}>`;
  };
  return walk(doc);
}

// Remove editor-only default link attributes before validating the portable document.
export function fromEditorDocument(doc) {
  const clean=node=>{
    const result=structuredClone(node);
    if(result.type==='orderedList'&&result.attrs) {
      record(result.attrs,['start','type'],['start']);
      // The writing toolbar offers decimal lists; pasted list styling is normalised.
      result.attrs={start:result.attrs.start};
    }
    if(result.marks) result.marks=result.marks.map(mark=>{
      if(mark.type!=='link')fail('Unsupported formatting.');
      record(mark.attrs,['href','target','rel','class','title'],['href']);
      return {type:'link',attrs:{href:safeLink(mark.attrs.href)}};
    });
    if(result.content)result.content=result.content.map(clean);
    return result;
  };
  return validateDocument(clean(doc));
}

export function migrateSampleDocument(data) {
  const migrated=structuredClone(data);
  if(!Array.isArray(migrated.posts))fail('Choose a structured sample document.');
  migrated.posts=migrated.posts.map(post=>{
    const body=toDocument(post);const next={...post,body,reviewOnly:true};delete next.blocks;return next;
  });
  return migrated;
}
