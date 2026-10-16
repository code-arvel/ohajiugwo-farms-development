import { validateSampleDocument, saveSampleDraft } from '../src/content/schema.mjs';
import { migrateSampleDocument } from '../src/content/article.mjs';

export const storageKey = 'ohajiugwo-stage1-sample-v1';
export function normaliseSample(value) {
  validateSampleDocument(value);
  return validateSampleDocument(migrateSampleDocument(value));
}
export function readSample(storage, fallback) {
  const raw=storage.getItem(storageKey);
  return normaliseSample(raw?JSON.parse(raw):fallback);
}
export function writeSample(storage, fallback, edited, baseRevision) {
  const current=readSample(storage,fallback);
  const next=normaliseSample(edited);
  next.posts=next.posts.map(post=>{
    const prior=current.posts.find(p=>p.id===post.id);
    return prior&&JSON.stringify(prior)!==JSON.stringify(post)?{...post,revision:prior.revision+1}:post;
  });
  const saved=saveSampleDraft(current,next,baseRevision);
  storage.setItem(storageKey,JSON.stringify(saved));
  return saved;
}
export function resetSample(storage,fallback) {
  const current=readSample(storage,fallback);
  const next={...normaliseSample(fallback),revision:current.revision+1};
  storage.setItem(storageKey,JSON.stringify(next));
  return next;
}
