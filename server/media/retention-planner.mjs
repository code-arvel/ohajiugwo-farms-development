// Advisory only. There is deliberately no storage, SQL or delete adapter here.
const DAY=86_400_000;
export function planRetention({now,revisions=[],contents=[],media=[],usages=[],releaseRefs=[]}={}){
 const time=Date.parse(now);if(!Number.isFinite(time))throw new Error('An explicit valid inventory time is required.');
 const validDate=value=>{const t=Date.parse(value);if(!Number.isFinite(t))throw new Error('Inventory contains an invalid date.');return t;};
 const current=new Map(contents.map(c=>[c.id,c.draftRevision]));
 const retained=new Set(),expiredRevisionIds=[];
 for(const r of revisions){if(!r.id||!r.contentId||!Number.isSafeInteger(r.revision))throw new Error('Incomplete revision inventory.');if(!current.has(r.contentId)||current.get(r.contentId)===r.revision||validDate(r.createdAt)>time-90*DAY)retained.add(r.id);else expiredRevisionIds.push(r.id);}
 const protectedVersions=new Set(releaseRefs.map(r=>r.mediaVersionId));
 // Even expired revision references hold bytes until a subsequent inventory proves
 // those revisions/links were actually removed. No same-plan deletion assumptions.
 for(const u of usages)protectedVersions.add(u.mediaVersionId);
 const purgeMediaIds=[],blockedMediaIds=[];
 for(const m of media){if(!m.id||!Array.isArray(m.versions)||m.versions.length===0)throw new Error('Incomplete media inventory.');if(!m.deletedAt)continue;if(validDate(m.deletedAt)>time-30*DAY)continue;if(m.versions.some(v=>!v.id||protectedVersions.has(v.id)))blockedMediaIds.push(m.id);else purgeMediaIds.push(m.id);}
 return{preparedOnly:true,deleteEnabled:false,asOf:new Date(time).toISOString(),revisionRetentionDays:90,trashRetentionDays:30,expiredRevisionIds,purgeMediaIds,blockedMediaIds};
}
