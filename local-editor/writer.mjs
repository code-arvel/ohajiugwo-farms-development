import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Link from '@tiptap/extension-link';
import { UndoRedo } from '@tiptap/extensions';
import { safeLink, fromEditorDocument } from '../src/content/article.mjs';

export function createWriter(element, content, { onChange, onSelection }) {
  return new Editor({
    element, content, injectCSS:false,
    extensions:[Document,Paragraph,Text,Heading.configure({levels:[2,3]}),BulletList,OrderedList,ListItem,UndoRedo,
      Link.configure({openOnClick:false,autolink:false,linkOnPaste:false,HTMLAttributes:{target:null,rel:null,class:null},isAllowedUri:uri=>{try{safeLink(uri);return true;}catch{return false;}}})],
    editorProps:{attributes:{role:'textbox','aria-label':'Article body','aria-multiline':'true',spellcheck:'true'}},
    onUpdate:({editor})=>onChange(editor),onSelectionUpdate:({editor})=>onSelection(editor),
  });
}
export const writerContent = editor => fromEditorDocument(editor.getJSON());
