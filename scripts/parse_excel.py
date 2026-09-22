#!/usr/bin/env python3
"""
Advanced Parser for Kitab Audio Fernanda Gunsan XLSX file.
Handles multi-row headers, notes, hyperlinks, price formats, and audio metrics.
Zero external dependencies.
"""

import os
import re
import json
import zipfile
import xml.etree.ElementTree as ET

def col2num(col_str):
    num = 0
    for c in col_str:
        num = num * 26 + (ord(c.upper()) - ord('A')) + 1
    return num

def clean_text(val):
    if val is None:
        return ""
    val = str(val).strip()
    return val

def format_rupiah(price_num):
    if not price_num:
        return ""
    return f"Rp {price_num:,}".replace(",", ".")

def clean_price(val):
    if not val:
        return None
    val_str = str(val).split('\n')[0].strip()
    # Handle scientific notation like 1.24E7 or 2.1367E7
    try:
        if 'E' in val_str.upper() or 'e' in val_str:
            return int(float(val_str))
    except Exception:
        pass
    
    clean = re.sub(r'[^0-9.]', '', val_str)
    try:
        f = float(clean)
        return int(f)
    except Exception:
        return None

def is_likely_header_row(cells_dict):
    texts = [c["val"].lower() for c in cells_dict.values() if c["val"]]
    if not texts:
        return False
    header_keywords = [
        "tier", "rank", "value", "price", "harga", "link", "review", 
        "sound", "tonality", "technicality", "driver", "codec", "bluetooth",
        "battery", "batre", "anc", "mic", "tws", "iem", "headphone", "dac",
        "speaker", "kabel", "eartips", "soundcard", "dap", "charger", "shopee", "tiktok", "unit", "colokan"
    ]
    matches = sum(1 for t in texts if any(k in t for k in header_keywords))
    return matches >= 2

def parse_xlsx(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    with zipfile.ZipFile(file_path) as z:
        # 1. Parse Shared Strings
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for elem in tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                text_parts = [t.text for t in elem.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if t.text]
                shared_strings.append(''.join(text_parts))

        # 2. Sheet Mapping
        wb_tree = ET.fromstring(z.read('xl/workbook.xml'))
        sheet_elems = wb_tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet')
        sheet_dict = {}
        for s in sheet_elems:
            r_id = s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            sheet_dict[r_id] = s.attrib.get('name')

        rels_tree = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        sheet_files = {}
        for rel in rels_tree.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
            r_id = rel.attrib.get('Id')
            target = rel.attrib.get('Target')
            if r_id in sheet_dict:
                sheet_files[sheet_dict[r_id]] = 'xl/' + target

        database = {
            "title": "Kitab Audio Fernanda Gunsan",
            "version": "Update 14-09-2026",
            "categories": [],
            "readme": [],
            "stats": {}
        }

        total_items = 0

        cat_order = [
            "TWS", "TWS NO KARET", "OWS", "IEM", "W. Headphone", "Headphone",
            "Dongle DAC", "Blutut DAC", "Desktop DAC", "Headphone Amp", "Gaming",
            "Eartips", "Kabel", "Mic", "Clip On Wireless", "Soundcard", "DAP",
            "Speaker 2 unit", "Blutut Speaker", "Soundbar", "Charger"
        ]

        sorted_sheet_names = sorted(sheet_files.keys(), key=lambda x: cat_order.index(x) if x in cat_order else 99)

        for sheet_name in sorted_sheet_names:
            sheet_xml_path = sheet_files[sheet_name]
            if sheet_xml_path not in z.namelist():
                continue

            sheet_dir = os.path.dirname(sheet_xml_path)
            sheet_base = os.path.basename(sheet_xml_path)
            rels_path = f"{sheet_dir}/_rels/{sheet_base}.rels"
            hyperlink_targets = {}
            if rels_path in z.namelist():
                r_tree = ET.fromstring(z.read(rels_path))
                for rel in r_tree.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
                    hyperlink_targets[rel.attrib.get('Id')] = rel.attrib.get('Target', '')

            stree = ET.fromstring(z.read(sheet_xml_path))

            cell_links = {}
            for h in stree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}hyperlink'):
                ref = h.attrib.get('ref')
                r_id = h.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                if ref and r_id in hyperlink_targets:
                    cell_links[ref] = hyperlink_targets[r_id]

            rows_data = {}
            for row in stree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
                r_idx = int(row.attrib['r'])
                row_cells = {}
                for c in row.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                    r_ref = c.attrib['r']
                    m = re.match(r'([A-Z]+)(\d+)', r_ref)
                    if not m: continue
                    c_col, c_row = m.groups()
                    col_n = col2num(c_col)
                    t = c.attrib.get('t')
                    v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                    val = ''
                    if v is not None and v.text is not None:
                        if t == 's':
                            idx = int(v.text)
                            val = shared_strings[idx] if idx < len(shared_strings) else ''
                        else:
                            val = v.text
                    
                    url = cell_links.get(r_ref, '')
                    row_cells[col_n] = {
                        "val": clean_text(val),
                        "url": url,
                        "ref": r_ref
                    }
                if row_cells:
                    rows_data[r_idx] = row_cells

            if not rows_data:
                continue

            # Readme Sheet
            if "BACA" in sheet_name.upper():
                readme_items = []
                for r_idx in sorted(rows_data.keys()):
                    r = rows_data[r_idx]
                    texts = [cell["val"] for cell in r.values() if cell["val"]]
                    if texts:
                        readme_items.append({
                            "row": r_idx,
                            "content": "\n".join(texts)
                        })
                database["readme"] = readme_items
                continue

            r1 = rows_data.get(1, {})
            r2 = rows_data.get(2, {})

            sheet_notes = []
            headers = {}
            data_start_row = 2

            if sheet_name == "IEM":
                # IEM dual-row headers
                data_start_row = 3
                for col_idx in range(1, 35):
                    h1 = r1.get(col_idx, {}).get("val", "").replace('\n', ' ').strip()
                    h2 = r2.get(col_idx, {}).get("val", "").replace('\n', ' ').strip()
                    if h2 and h1:
                        headers[col_idx] = f"{h1} - {h2}"
                    elif h2:
                        headers[col_idx] = h2
                    elif h1:
                        headers[col_idx] = h1
                    else:
                        headers[col_idx] = f"Col_{col_idx}"
            elif is_likely_header_row(r2) and not is_likely_header_row(r1):
                # Row 1 is disclaimer, Row 2 is headers
                r1_texts = [c["val"] for c in r1.values() if c["val"]]
                sheet_notes.extend(r1_texts)
                for col_idx, cell in r2.items():
                    headers[col_idx] = cell["val"].replace('\n', ' ').strip()
                data_start_row = 3
            else:
                for col_idx, cell in r1.items():
                    headers[col_idx] = cell["val"].replace('\n', ' ').strip()
                data_start_row = 2

            items = []
            row_keys = sorted([k for k in rows_data.keys() if k >= data_start_row])

            for r_idx in row_keys:
                r_cells = rows_data[r_idx]
                non_empty = [c["val"] for c in r_cells.values() if c["val"]]
                if not non_empty:
                    continue

                item_dict = {
                    "id": f"{sheet_name}_{r_idx}",
                    "row": r_idx,
                    "category": sheet_name,
                    "raw_fields": {},
                    "links": {}
                }

                name = ""
                tier = ""
                value_for_money = ""
                price_raw = ""
                review_text = ""
                mic_test = ""
                codec = ""
                battery = ""
                anc = ""
                overall_sound = ""
                sound_scores = {}
                driver_info = ""
                fitting_info = ""
                eq_info = ""
                ip_rating = ""

                for col_idx, cell in r_cells.items():
                    h_name = headers.get(col_idx, f"Col_{col_idx}").strip()
                    val = cell["val"]
                    url = cell["url"]

                    item_dict["raw_fields"][h_name] = val
                    if url:
                        item_dict["links"][h_name] = url

                    h_lower = h_name.lower()
                    if ("tier" in h_lower or "rank" in h_lower) and not tier and "value" not in h_lower:
                        tier = val
                    elif "value" in h_lower and not value_for_money:
                        value_for_money = val
                    elif any(k in h_lower for k in ["tws", "iem", "headphone", "dac", "microphone", "speaker", "kabel", "eartips", "soundcard", "dap", "charger", "soundbar", "name", "nama", "produk"]) and not name and "rank" not in h_lower and "tier" not in h_lower and "fitur" not in h_lower and "needs" not in h_lower and "posisi" not in h_lower and "konektor" not in h_lower:
                        name = val
                    elif "price" in h_lower or "harga" in h_lower:
                        price_raw = val
                        if url: item_dict["links"]["tokopedia"] = url
                    elif "shopee" in h_lower:
                        if url: item_dict["links"]["shopee"] = url
                    elif "tiktok" in h_lower:
                        if url: item_dict["links"]["tiktok"] = url
                    elif "review" in h_lower or "sound description" in h_lower or "fitur dan review" in h_lower:
                        review_text = val
                        if url: item_dict["links"]["review_video"] = url
                    elif "mic" in h_lower and ("test" in h_lower or "mic test" in h_lower):
                        mic_test = val
                    elif "codec" in h_lower or "bluetooth" in h_lower:
                        codec = val
                    elif "battery" in h_lower or "batre" in h_lower:
                        battery = val
                    elif "anc" in h_lower:
                        anc = val
                    elif "overall" in h_lower or "total sound" in h_lower or "sound 4 the price" in h_lower:
                        overall_sound = val
                    elif "driver" in h_lower:
                        driver_info = val
                    elif "fitting" in h_lower or "fit" in h_lower:
                        fitting_info = val
                    elif "eq" in h_lower or "equalizer" in h_lower:
                        eq_info = val
                        if url: item_dict["links"]["eq_drive"] = url
                    elif "ip " in h_lower or "ip rating" in h_lower:
                        ip_rating = val
                    elif any(m in h_lower for m in ["bass", "lo mid", "hi mid", "treble", "vocal", "soundstage", "timbre", "voc", "imaging", "punch", "detail", "clarity", "separation"]):
                        try:
                            clean_m = h_name.split(' - ')[-1] if ' - ' in h_name else h_name
                            sound_scores[clean_m] = float(val) if val else None
                        except ValueError:
                            sound_scores[h_name] = val

                # Fallback for name
                if not name:
                    for col_idx in [2, 3, 1, 4]:
                        if col_idx in r_cells and r_cells[col_idx]["val"]:
                            cand = r_cells[col_idx]["val"]
                            if len(cand) > 1 and not cand.startswith("http") and cand.lower() not in ["s", "a", "b", "c", "d", "ss", "s+", "a+", "a-", "s++", "rank", "tier"]:
                                name = cand
                                break

                name_parts = name.split('\n')
                main_name = name_parts[0].strip()
                taglines = [p.strip() for p in name_parts[1:] if p.strip()]
                tagline = ' • '.join(taglines) if taglines else ''

                if not main_name or main_name.lower() in ["tws", "iem", "headphone", "tier", "name", "rank", "speaker", "dac", "link + price"]:
                    continue

                price_n = clean_price(price_raw)

                item_dict["name"] = main_name
                item_dict["tagline"] = tagline
                item_dict["tier"] = tier or "A"
                item_dict["value_for_money"] = value_for_money or tier or "A"
                item_dict["price_raw"] = price_raw
                item_dict["price_num"] = price_n
                item_dict["price_formatted"] = format_rupiah(price_n) if price_n else price_raw
                item_dict["review"] = review_text
                item_dict["mic_test"] = mic_test
                item_dict["codec"] = codec
                item_dict["battery"] = battery
                item_dict["anc"] = anc
                item_dict["overall_sound"] = overall_sound
                item_dict["driver"] = driver_info
                item_dict["fitting"] = fitting_info
                item_dict["eq"] = eq_info
                item_dict["ip_rating"] = ip_rating
                item_dict["sound_scores"] = sound_scores

                items.append(item_dict)

            category_data = {
                "name": sheet_name,
                "notes": sheet_notes,
                "total_items": len(items),
                "headers": list(headers.values()),
                "items": items
            }

            database["categories"].append(category_data)
            total_items += len(items)

        database["stats"] = {
            "total_categories": len(database["categories"]),
            "total_items": total_items
        }

        return database

def main():
    excel_file = "Kitab Audio Fernanda Gunsan _ Update 14-09 -26.xlsx"
    out_dir = "src/data"
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "audio_data.json")

    print(f"Parsing {excel_file}...")
    db = parse_xlsx(excel_file)
    print(f"Parsed {db['stats']['total_categories']} categories with {db['stats']['total_items']} total audio items.")

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)

    print(f"Saved database to {out_file} ({os.path.getsize(out_file) / 1024:.1f} KB)")

if __name__ == "__main__":
    main()
