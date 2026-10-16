// Disposable educational layout fixture. Never included in seed content or production routes.
import { samplePosts } from '../../src/content/seed.mjs';
const paragraph='A growing record can bring observations together without assuming that one approach suits every place. Note the weather, the condition of the ground and the crops being considered. Seek advice that reflects local growing conditions before making substantial changes. ';
export const longArticle = {
 ...samplePosts[0],id:'local-contents-fixture',slug:'local-contents-fixture',reviewOnly:true,
 title:'Understanding soil and planning a growing record',
 blocks:['Reading the soil','Reading the soil','Planning observations over several seasons with a clear and practical record of changing growing conditions','Reading the soil 2'].flatMap(text=>[
  {type:'heading',text},...Array.from({length:2},()=>({type:'paragraph',text:paragraph.repeat(3).trim()}))
 ])
};
