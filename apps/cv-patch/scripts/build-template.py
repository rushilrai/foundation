import copy
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DOCX_PATH = BASE_DIR / "test.docx"
OUT_PATH = BASE_DIR / "convex" / "assets" / "resume-template.docx"

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"

ET.register_namespace("w", NS["w"])
ET.register_namespace("", "http://schemas.openxmlformats.org/package/2006/content-types")


def set_space_preserve(t_el, text):
    if text.startswith(" ") or text.endswith(" "):
        t_el.set(XML_SPACE, "preserve")


def set_text_simple(paragraph, text):
    t_nodes = paragraph.findall('.//w:t', NS)
    if not t_nodes:
        return
    first = t_nodes[0]
    first.text = text
    set_space_preserve(first, text)
    for t in t_nodes[1:]:
        t.text = ""


def set_text_with_tabs(paragraph, left_text, right_text):
    runs = paragraph.findall('./w:r', NS)
    before_tab = True
    left_set = False
    right_set = False
    tab_run = None
    last_text_run = None

    for r in runs:
        has_tab = r.find('./w:tab', NS) is not None
        t_nodes = r.findall('./w:t', NS)

        if t_nodes:
            last_text_run = r

        if before_tab and not has_tab:
            for t in t_nodes:
                if not left_set:
                    t.text = left_text
                    set_space_preserve(t, left_text)
                    left_set = True
                else:
                    t.text = ""
        elif not before_tab:
            for t in t_nodes:
                if right_text is None:
                    t.text = ""
                elif not right_set:
                    t.text = right_text
                    set_space_preserve(t, right_text)
                    right_set = True
                else:
                    t.text = ""

        if has_tab:
            before_tab = False
            tab_run = r

    if right_text is None:
        return

    if not left_set and last_text_run is not None:
        t_nodes = last_text_run.findall('./w:t', NS)
        if t_nodes:
            t_nodes[0].text = left_text
            set_space_preserve(t_nodes[0], left_text)

    if not right_set and tab_run is not None:
        new_run = ET.Element(f"{{{NS['w']}}}r")
        rpr = tab_run.find('./w:rPr', NS)
        if rpr is None and last_text_run is not None:
            rpr = last_text_run.find('./w:rPr', NS)
        if rpr is not None:
            new_run.append(copy.deepcopy(rpr))
        t_el = ET.SubElement(new_run, f"{{{NS['w']}}}t")
        t_el.text = right_text
        set_space_preserve(t_el, right_text)

        children = list(paragraph)
        try:
            idx = children.index(tab_run)
            paragraph.insert(idx + 1, new_run)
        except ValueError:
            paragraph.append(new_run)


def replace_after_colon(paragraph, placeholder):
    t_nodes = paragraph.findall('.//w:t', NS)
    colon_found = False
    placeholder_set = False

    for t in t_nodes:
        text = t.text or ""
        if not colon_found:
            if ":" in text:
                colon_found = True
            continue

        if not placeholder_set:
            t.text = placeholder
            set_space_preserve(t, placeholder)
            placeholder_set = True
        else:
            t.text = ""


def make_tag_paragraph(tag_text):
    p = ET.Element(f"{{{NS['w']}}}p")
    r = ET.SubElement(p, f"{{{NS['w']}}}r")
    t = ET.SubElement(r, f"{{{NS['w']}}}t")
    t.text = tag_text
    set_space_preserve(t, tag_text)
    return p


def insert_before(body, anchor, new_paragraph):
    children = list(body)
    idx = children.index(anchor)
    body.insert(idx, new_paragraph)


def insert_after(body, anchor, new_paragraph):
    children = list(body)
    idx = children.index(anchor)
    body.insert(idx + 1, new_paragraph)


def main():
    if not DOCX_PATH.exists():
        raise SystemExit(f"Missing {DOCX_PATH}")

    with zipfile.ZipFile(DOCX_PATH) as z:
        xml = z.read('word/document.xml')
        other_files = {name: z.read(name) for name in z.namelist() if name != 'word/document.xml'}

    other_files.pop("docProps/custom.xml", None)

    content_types = other_files.get("[Content_Types].xml")
    if content_types:
        ct_root = ET.fromstring(content_types)
        ct_ns = {"ct": "http://schemas.openxmlformats.org/package/2006/content-types"}
        for override in list(ct_root.findall("ct:Override", ct_ns)):
            if override.get("PartName") == "/docProps/custom.xml":
                ct_root.remove(override)
        other_files["[Content_Types].xml"] = ET.tostring(
            ct_root, encoding="utf-8", xml_declaration=True
        )

    root = ET.fromstring(xml)
    body = root.find('.//w:body', NS)
    if body is None:
        raise SystemExit("Missing document body")

    paragraphs = body.findall('w:p', NS)

    # Insert template tags
    set_text_simple(paragraphs[1], '{header.name}')
    set_text_simple(paragraphs[2], '{header.phone}    {header.email}    {header.linkedin}')

    insert_before(body, paragraphs[5], make_tag_paragraph('{#education}'))
    set_text_with_tabs(paragraphs[5], '{school}', '{location} | {dates}')
    set_text_simple(paragraphs[6], '{degree}')
    set_text_simple(paragraphs[7], '{details}')
    insert_after(body, paragraphs[7], make_tag_paragraph('{/education}'))

    insert_before(body, paragraphs[14], make_tag_paragraph('{#experience}'))
    set_text_with_tabs(paragraphs[14], '{company}', '{companyMeta}')
    insert_before(body, paragraphs[15], make_tag_paragraph('{#roles}'))
    set_text_with_tabs(paragraphs[15], '{title}', '{meta}')
    insert_before(body, paragraphs[16], make_tag_paragraph('{#bullets}'))
    set_text_simple(paragraphs[16], '{.}')
    insert_after(body, paragraphs[16], make_tag_paragraph('{/experience}'))
    insert_after(body, paragraphs[16], make_tag_paragraph('{/roles}'))
    insert_after(body, paragraphs[16], make_tag_paragraph('{/bullets}'))

    insert_before(body, paragraphs[36], make_tag_paragraph('{#projects}'))
    set_text_with_tabs(paragraphs[36], '{name}', '{dates}')
    insert_before(body, paragraphs[37], make_tag_paragraph('{#bullets}'))
    set_text_simple(paragraphs[37], '{.}')
    insert_after(body, paragraphs[37], make_tag_paragraph('{/projects}'))
    insert_after(body, paragraphs[37], make_tag_paragraph('{/bullets}'))

    replace_after_colon(paragraphs[45], '{skills.technical}')
    replace_after_colon(paragraphs[46], '{skills.financial}')
    replace_after_colon(paragraphs[47], '{skills.languages}')

    insert_before(body, paragraphs[50], make_tag_paragraph('{#extras}'))
    set_text_simple(paragraphs[50], '{.}')
    insert_after(body, paragraphs[50], make_tag_paragraph('{/extras}'))

    # Remove extra blocks (reverse order)
    remove_indices = [
        51,  # extra-curricular second bullet
        43, 42, 41, 40, 39, 38,  # projects extra lines
        33, 32, 31, 30, 29,      # AntPod
        27, 26, 25, 24,          # Girl Up Heron
        22, 21, 20, 19, 18, 17,  # extra roles/bullets
        11, 10, 9,               # second education
    ]

    for idx in remove_indices:
        body.remove(paragraphs[idx])

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    new_xml = ET.tostring(root, encoding='utf-8', xml_declaration=True)

    with zipfile.ZipFile(OUT_PATH, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        for name, content in other_files.items():
            z.writestr(name, content)
        z.writestr('word/document.xml', new_xml)

    print(f"Wrote template to {OUT_PATH}")


if __name__ == '__main__':
    main()
