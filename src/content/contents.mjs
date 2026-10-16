import { validateDocument, readingMinutes } from './article.mjs';

// IDs depend on heading text and occurrence, not paragraph positions or word counts.
// Identical repeated headings receive deterministic numeric suffixes.
export function articleContents(doc) {
 validateDocument(doc);
 const text=node=>node.type==='text'?node.text:(node.content||[]).map(text).join(' ');
 const used=new Set(),headingIds=[],sections=[];
 doc.content.forEach((node,index)=>{
  if(node.type!=='heading')return;
  const label=text(node).trim().replace(/\s+/g,' ');
  const slug=label.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'section';
  const base=`article-section-${slug}`;let id=base,suffix=2;
  while(used.has(id))id=`${base}-${suffix++}`;
  used.add(id);headingIds.push(id);
  // A meaningful section has a named heading and non-empty body before the next heading.
  let body='';for(let i=index+1;i<doc.content.length&&doc.content[i].type!=='heading';i++)body+=text(doc.content[i]);
  if(label&&body.trim())sections.push({id,label,level:node.attrs.level});
 });
 return {headingIds,items:sections.length>=3&&readingMinutes(doc)>=4?sections:[]};
}
