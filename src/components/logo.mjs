import { company } from '../config/company.mjs';
import { escapeHtml as e } from '../utils/html.mjs';

// Shared by public layouts and the local editor. Future admin shells use this too.
// Surface colours belong to the surrounding layout; the mark always stays transparent.
export function logo({href='/',profile=company,compact=false,className='',variant='original'}={}) {
 const original=profile.name===company.name;
 const symbol=profile.logo??company.logo;
 return `<a class="farm-logo ${e(className)}${compact?' farm-logo--compact':''}${variant==='white'?' farm-logo--white':''}" href="${e(href)}" aria-label="${e(profile.name)} — Home">${symbol?`<span class="brand-symbol"><img src="${e(symbol)}" alt="" width="234" height="211"></span>`:''}<span class="brand-lettering"><span class="brand-name">${original?'Ohajiugwo':e(profile.name)}</span>${original?'<span class="brand-description">Organic Farms LTD</span>':''}</span></a>`;
}
