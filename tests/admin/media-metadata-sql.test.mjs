import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {localDatabase} from './fixtures/local-sql.mjs';
test('media metadata SQL preserves CAS, private guards, retained refs and recoverable soft deletion',async()=>{
 const db=await localDatabase(['202610170005_durable_cleanup.sql','202610170006_account_lifecycle.sql','202610170007_content_commands.sql','202610170008_private_media.sql','202610170009_media_content_refs.sql','202611140010_content_conflict_status.sql','202611140011_cleanup_review_inspection.sql','202611210012_release_commands.sql','202611210013_media_metadata.sql']);
 try{await db.exec(await readFile('supabase/tests/media-metadata.sql','utf8'));}finally{await db.close();}
});
