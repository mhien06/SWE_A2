"""Render this project's small PlantUML sequence subset to editable Draw.io, SVG, PNG.

PlantUML is the source of truth. Unsupported statements fail instead of disappearing.
Requires Pillow for PNG previews; run from any directory with Python 3.
"""
from pathlib import Path
import re
import textwrap
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'docs/diagrams/sources'
OUT = ROOT / 'docs/diagrams/exports'
WIDTH = 2400
XS = {'C': 180, 'UI': 660, 'API': 1140, 'DB': 1620, 'VN': 2100}
FONT = Path('C:/Windows/Fonts/arial.ttf')
if not FONT.exists():
    FONT = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')


def render(path):
    shapes, fragments, active, activations = [], [], {}, []
    y = 220
    title = path.stem
    names = {}
    actors = set()

    def box(x, yy, w, h, fill='#ffffff', stroke='#64748b', dash=False):
        shapes.append(('box', x, yy, w, h, fill, stroke, dash))

    def line(x1, y1, x2, y2, arrow=False, dash=False):
        shapes.append(('line', x1, y1, x2, y2, arrow, dash))

    def label(x, yy, w, text, size=22, bold=False, align='center'):
        shapes.append(('text', x, yy, w, text, size, bold, align))

    def wrapped(text, x=80, w=2240, size=22):
        nonlocal y
        for part in textwrap.wrap(text, width=max(30, int(w / (size * .56)))):
            label(x, y, w, part, size, align='left')
            y += 30

    for raw in path.read_text(encoding='utf-8').splitlines():
        s = raw.strip()
        if not s or s.startswith(('@', 'hide ', 'skinparam ', "'")):
            continue
        if s.startswith('title '):
            title = s[6:]
            continue
        match = re.match(r'(actor|participant|database) (.+) as (\w+)$', s)
        if match:
            names[match[3]] = match[2].strip('"')
            if match[1] == 'actor':
                actors.add(match[3])
            continue
        match = re.match(r'(activate|deactivate) (\w+)$', s)
        if match:
            alias = match[2]
            if match[1] == 'activate':
                if alias in active:
                    raise ValueError(f'Double activation: {s}')
                active[alias] = y - 12
            elif alias in active:
                start = active.pop(alias)
                activations.append(('box', XS[alias] - 9, start, 18, max(24, y - start), '#dbeafe', '#2563eb', False))
            else:
                raise ValueError(f'Inactive lifeline: {s}')
            continue
        match = re.match(r'(alt|opt|loop|group) (.+)$', s)
        if match:
            inset = 35 + len(fragments) * 18
            frame = ('frame', inset, y - 10, WIDTH - 2 * inset, 0)
            shapes.append(frame)
            fragments.append((len(shapes) - 1, y - 10, inset))
            box(inset, y - 10, WIDTH - 2 * inset, 48, '#e2e8f0', '#64748b')
            wrapped(match[1] + '  [' + match[2] + ']', inset + 15, WIDTH - 2 * inset - 30)
            y += 32
            continue
        if s.startswith('else '):
            _, _, inset = fragments[-1]
            line(inset, y - 12, WIDTH - inset, y - 12, dash=True)
            box(inset + 1, y - 10, WIDTH - 2 * inset - 2, 46, '#f1f5f9', 'none')
            wrapped('else  [' + s[5:] + ']', inset + 15, WIDTH - 2 * inset - 30)
            y += 30
            continue
        if s == 'end':
            idx, start, inset = fragments.pop()
            shapes[idx] = ('frame', inset, start, WIDTH - 2 * inset, y - start)
            y += 28
            continue
        match = re.match(r'(ref|note) over [\w, ]+: (.+)$', s)
        if match:
            text = match[1] + ': ' + match[2]
            rows = textwrap.wrap(text, width=170)
            h = 30 * len(rows) + 20
            box(80, y - 8, WIDTH - 160, h, '#eff6ff' if match[1] == 'ref' else '#fffbeb')
            wrapped(text, 96, WIDTH - 192)
            y += 30
            continue
        match = re.match(r'(\w+)\s+(--?>)\s+(\w+): (.+)$', s)
        if match:
            a, arrow, b, text = match.groups()
            xa, xb = XS[a], XS[b]
            rows = textwrap.wrap(text, width=110)
            tw = min(1700, max(380, max(map(len, rows)) * 12 + 30))
            center = (xa + xb) / 2 if a != b else xa + 280
            tx = max(90, min(WIDTH - tw - 90, center - tw / 2))
            box(tx, y - 4, tw, len(rows) * 29 + 6, '#ffffff', 'none')
            for row in rows:
                label(tx, y, tw, row)
                y += 29
            if a == b:
                line(xa, y + 4, xa + 90, y + 4)
                line(xa + 90, y + 4, xa + 90, y + 26)
                line(xa + 90, y + 26, xa, y + 26, True, arrow == '-->')
                y += 64
            else:
                line(xa, y + 7, xb, y + 7, True, arrow == '-->')
                y += 48
            continue
        raise ValueError(f'Unsupported statement: {s}')
    if fragments or active:
        raise ValueError(f'Unclosed fragments/activations in {path}')
    height = y + 60
    # Monochrome UML; one stick figure for each actor, no duplicate header box.
    header = []
    for alias, name in names.items():
        x = XS[alias]
        header.append(('line', x, 205 if alias in actors else 160, x, height - 30, False, True))
        if alias in actors:
            header += [('ellipse', x - 14, 85, 28, 28),
                       ('line', x, 113, x, 144, False, False),
                       ('line', x - 24, 123, x + 24, 123, False, False),
                       ('line', x, 144, x - 23, 168, False, False),
                       ('line', x, 144, x + 23, 168, False, False),
                       ('text', x - 140, 170, 280, name, 22, False, 'center')]
        else:
            header += [('box', x - 140, 100, 280, 60, '#ffffff', '#111111', False),
                       ('text', x - 140, 118, 280, name, 24, True, 'center')]
    shapes = header + activations + shapes
    shapes += [('text', 40, 30, WIDTH - 80, title, 32, True, 'center')]

    svg = ET.Element('svg', xmlns='http://www.w3.org/2000/svg', width=str(WIDTH), height=str(height), viewBox=f'0 0 {WIDTH} {height}')
    ET.SubElement(svg, 'rect', width='100%', height='100%', fill='white')
    mx = ET.Element('mxfile', host='app.diagrams.net')
    diagram = ET.SubElement(mx, 'diagram', name=title, id=path.stem)
    model = ET.SubElement(diagram, 'mxGraphModel', page='1', pageWidth=str(WIDTH), pageHeight=str(height))
    root = ET.SubElement(model, 'root')
    ET.SubElement(root, 'mxCell', id='0')
    ET.SubElement(root, 'mxCell', id='1', parent='0')
    canvas = Image.new('RGB', (WIDTH, height), 'white')
    draw = ImageDraw.Draw(canvas)
    for i, shape in enumerate(shapes, 2):
        typ, *v = shape
        if typ == 'ellipse':
            x, yy, w, h = v
            ET.SubElement(svg, 'ellipse', cx=str(x+w/2), cy=str(yy+h/2), rx=str(w/2), ry=str(h/2), fill='white', stroke='#111111', **{'stroke-width': '2'})
            draw.ellipse((x, yy, x+w, yy+h), fill='white', outline='#111111', width=2)
            cell = ET.SubElement(root, 'mxCell', id=str(i), parent='1', vertex='1', value='', style='ellipse;fillColor=#ffffff;strokeColor=#111111;')
            ET.SubElement(cell, 'mxGeometry', x=str(x), y=str(yy), width=str(w), height=str(h), attrib={'as': 'geometry'})
        elif typ in ('box', 'frame'):
            x, yy, w, h = v[:4]
            fill, stroke, dash = v[4:] if typ == 'box' else ('none', '#64748b', False)
            fill = 'none' if fill == 'none' else '#ffffff'
            stroke = 'none' if stroke == 'none' else '#111111'
            ET.SubElement(svg, 'rect', x=str(x), y=str(yy), width=str(w), height=str(h), fill=fill, stroke=stroke)
            draw.rectangle((x, yy, x + w, yy + h), fill=None if fill == 'none' else fill, outline=None if stroke == 'none' else stroke, width=2)
            cell = ET.SubElement(root, 'mxCell', id=str(i), parent='1', vertex='1', value='', style=f'rounded=0;fillColor={fill};strokeColor={stroke};')
            ET.SubElement(cell, 'mxGeometry', x=str(x), y=str(yy), width=str(w), height=str(h), attrib={'as': 'geometry'})
        elif typ == 'line':
            x1, y1, x2, y2, arrow, dash = v
            attrs = dict(x1=str(x1), y1=str(y1), x2=str(x2), y2=str(y2), stroke='#111111', **{'stroke-width': '2'})
            if dash:
                attrs['stroke-dasharray'] = '8 6'
            ET.SubElement(svg, 'line', attrs)
            if dash:
                import math
                length = math.hypot(x2-x1, y2-y1)
                for pos in range(0, int(length), 14):
                    end = min(pos+8, length)
                    draw.line((x1+(x2-x1)*pos/length, y1+(y2-y1)*pos/length, x1+(x2-x1)*end/length, y1+(y2-y1)*end/length), fill='#111111', width=2)
            else:
                draw.line((x1, y1, x2, y2), fill='#111111', width=2)
            if arrow:
                direction = 1 if x2 > x1 else -1
                points = [(x2, y2), (x2-13*direction, y2-7), (x2-13*direction, y2+7)]
                ET.SubElement(svg, 'polygon', points=' '.join(f'{x},{yy}' for x, yy in points), fill='white' if dash else '#111111', stroke='#111111')
                draw.polygon(points, fill='white' if dash else '#111111', outline='#111111')
            cell = ET.SubElement(root, 'mxCell', id=str(i), parent='1', edge='1', style=f'edgeStyle=none;endArrow={"open" if dash else "block" if arrow else "none"};endFill={0 if dash else 1};dashed={int(dash)};strokeColor=#111111;')
            # Lifelines and fragment separators must never acquire arrowheads.
            if not arrow:
                cell.set('style', f'edgeStyle=none;endArrow=none;dashed={int(dash)};strokeColor=#111111;')
            geo = ET.SubElement(cell, 'mxGeometry', relative='1', attrib={'as': 'geometry'})
            ET.SubElement(geo, 'mxPoint', x=str(x1), y=str(y1), attrib={'as': 'sourcePoint'})
            ET.SubElement(geo, 'mxPoint', x=str(x2), y=str(y2), attrib={'as': 'targetPoint'})
        else:
            x, yy, w, text, size, bold, align = v
            color = '#111111'
            xx = x + w / 2 if align == 'center' else x
            node = ET.SubElement(svg, 'text', x=str(xx), y=str(yy + size), fill=color, **{'font-family': 'Arial, sans-serif', 'font-size': str(size), 'font-weight': 'bold' if bold else 'normal', 'text-anchor': 'middle' if align == 'center' else 'start'})
            node.text = text
            font = ImageFont.truetype(str(FONT), size)
            draw.text((xx, yy), text, fill=color, font=font, anchor='mt' if align == 'center' else 'lt')
            cell = ET.SubElement(root, 'mxCell', id=str(i), parent='1', vertex='1', value=text, style=f'text;html=0;whiteSpace=wrap;align={align};verticalAlign=top;fontFamily=Arial;fontSize={size};fontStyle={int(bold)};fontColor={color};strokeColor=none;fillColor=none;')
            ET.SubElement(cell, 'mxGeometry', x=str(x), y=str(yy), width=str(w), height=str(size + 10), attrib={'as': 'geometry'})
    ET.indent(mx)
    ET.ElementTree(mx).write(path.with_suffix('.drawio'), encoding='utf-8', xml_declaration=True)
    ET.ElementTree(svg).write(OUT / (path.stem + '.svg'), encoding='utf-8', xml_declaration=True)
    canvas.save(OUT / (path.stem + '.png'))
    print(f'{path.stem}: {WIDTH} x {height}; {len(shapes)} editable objects')


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    for source in sorted(SRC.glob('sequence-*.puml')):
        render(source)
