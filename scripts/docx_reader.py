"""Read a .docx file into a flat list of blocks, using only the standard library.

Each block is a Block with:
  kind  'p' (paragraph) or 't' (table)
  style the paragraph style name, e.g. 'Heading2' ('' for tables)
  text  the paragraph text (for tables: '')
  rows  for tables, a list of rows, each a list of cell texts
"""
import re
import zipfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


@dataclass
class Block:
    kind: str
    style: str = ''
    text: str = ''
    rows: list = field(default_factory=list)

    @property
    def heading(self):
        """Heading level (1-9) or 0 for body text and tables."""
        m = re.fullmatch(r'Heading(\d)', self.style)
        return int(m.group(1)) if m else 0


def _text(el):
    out = []
    for n in el.iter():
        if n.tag == W + 't':
            out.append(n.text or '')
        elif n.tag in (W + 'br', W + 'cr'):
            out.append('\n')
        elif n.tag == W + 'tab':
            out.append(' ')
    return clean(''.join(out))


def clean(s):
    s = s.replace(' ', ' ')
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r' *\n *', '\n', s)
    return s.strip()


def read_blocks(path):
    """Return the document body as a list of Blocks (empty paragraphs dropped)."""
    root = ET.fromstring(zipfile.ZipFile(path).read('word/document.xml'))
    blocks = []
    for el in root.find(W + 'body'):
        if el.tag == W + 'p':
            st = el.find(f'{W}pPr/{W}pStyle')
            text = _text(el)
            if text:
                blocks.append(Block('p', st.get(W + 'val') if st is not None else '', text))
        elif el.tag == W + 'tbl':
            rows = [[_text(tc) for tc in tr.findall(W + 'tc')] for tr in el.findall(W + 'tr')]
            blocks.append(Block('t', rows=rows))
    return blocks


def section(blocks, heading_text, level=None):
    """Blocks after the heading whose text starts with heading_text, up to the next heading of the same or a
    higher level. Raises if the heading is missing, so a renamed heading fails loudly."""
    for i, b in enumerate(blocks):
        if b.heading and (level is None or b.heading == level) and b.text.startswith(heading_text):
            out = []
            for c in blocks[i + 1:]:
                if c.heading and c.heading <= b.heading:
                    break
                out.append(c)
            return out
    raise KeyError(f'heading not found: {heading_text!r}')
