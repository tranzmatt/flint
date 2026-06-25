import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { Wikilink } from './src/components/tiptap/Wikilink.ts';

const editor = new Editor({
  extensions: [StarterKit, Markdown, Wikilink],
  content: '<p><span data-wiki="true" data-target="hello" class="wiki-link">[[hello]]</span></p>'
});
console.log(editor.storage.markdown.getMarkdown());
